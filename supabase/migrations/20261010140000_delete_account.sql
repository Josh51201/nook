-- Deleting your account (AUTH-003, Q-020). Apple requires apps with sign-up
-- to let people delete their account from inside the app.
--
-- What happens (Josh, 2026-10-10 — see the Decision Log):
--   * Everything is removed right away, no waiting period.
--   * A Burrow you started that still has other grown-ups stays: if you were
--     its only admin, the longest-standing grown-up becomes admin (the
--     existing keep_a_burrow_admin trigger already does this). A Burrow with
--     no other grown-ups is deleted.
--   * Gifts you had tucked for other people are released, so they show as
--     available again. Nothing is sent to the list owner (GIFT-007).
--   * Your Wishbook goes with you (it already cascades from your profile).
--   * Kids you look after stay if another grown-up looks after them or lives
--     in their Home (that grown-up takes over looking after them). Kids only
--     you looked after are deleted too; the app says so before you confirm.
--
-- Two foreign keys would have blocked deleting a profile, so they're fixed:
-- burrows.created_by (now just forgets who started it) and claims.claimed_by
-- (claims are removed first, below).

-- ===========================================================================
-- 1. A Burrow can outlive the person who started it
-- ===========================================================================

alter table public.burrows alter column created_by drop not null;
alter table public.burrows drop constraint burrows_created_by_fkey;
alter table public.burrows
  add constraint burrows_created_by_fkey
  foreign key (created_by) references public.profiles (id) on delete set null;

-- ===========================================================================
-- 2. Which kids would go with you
-- ===========================================================================

-- Kids that only `caller` looks after, and that have no other grown-up
-- living in their Home to take over.
create function public.account_doomed_kids(caller uuid)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select pm.profile_id
  from public.profile_managers pm
  where pm.manager_id = caller
    and not exists (
      select 1 from public.profile_managers other
      where other.profile_id = pm.profile_id and other.manager_id <> caller
    )
    and not exists (
      select 1
      from public.home_kids hk
      join public.home_members hm on hm.home_id = hk.home_id
      where hk.kid_id = pm.profile_id and hm.profile_id <> caller
    );
$$;

revoke execute on function public.account_doomed_kids(uuid) from public, anon, authenticated;

-- ===========================================================================
-- 3. The "here's what will happen" screen
-- ===========================================================================

-- Only ever describes the caller's own things: kids they look after, Burrows
-- they're in, and how many gifts they've tucked (their own tucks).
create function public.my_account_deletion_preview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null or public.is_managed_profile(caller) then
    raise exception 'Sign in first' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'kids', coalesce((
      select jsonb_agg(
        jsonb_build_object('id', p.id, 'name', coalesce(nullif(trim(p.display_name), ''), 'A kid'))
        order by p.display_name
      )
      from public.profiles p
      where p.id in (select public.account_doomed_kids(caller))
    ), '[]'::jsonb),
    'burrows', coalesce((
      select jsonb_agg(b.name order by b.name)
      from public.burrows b
      join public.burrow_members me on me.burrow_id = b.id and me.profile_id = caller
      where not exists (
        select 1
        from public.burrow_members o
        join public.profiles op on op.id = o.profile_id
        where o.burrow_id = b.id and o.profile_id <> caller and not op.is_managed
      )
    ), '[]'::jsonb),
    'tucks', (
      select count(*) from public.claims where claimed_by = caller and released_at is null
    )
  );
end;
$$;

-- ===========================================================================
-- 4. Deleting
-- ===========================================================================

create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  doomed uuid[];
  my_burrows uuid[];
  my_home uuid;
  kid record;
  new_manager uuid;
begin
  if caller is null or public.is_managed_profile(caller) then
    raise exception 'Sign in first' using errcode = '42501';
  end if;

  select coalesce(array_agg(burrow_id), '{}') into my_burrows
  from public.burrow_members where profile_id = caller;
  select home_id into my_home from public.home_members where profile_id = caller;
  doomed := coalesce(array(select public.account_doomed_kids(caller)), '{}');

  -- Kids who stay: if you were their only grown-up, someone in their Home
  -- takes over looking after them.
  for kid in
    select pm.profile_id as kid_id
    from public.profile_managers pm
    where pm.manager_id = caller and not (pm.profile_id = any (doomed))
  loop
    if not exists (
      select 1 from public.profile_managers
      where profile_id = kid.kid_id and manager_id <> caller
    ) then
      select hm.profile_id into new_manager
      from public.home_kids hk
      join public.home_members hm on hm.home_id = hk.home_id
      where hk.kid_id = kid.kid_id and hm.profile_id <> caller
      order by hm.joined_at
      limit 1;
      if new_manager is not null then
        insert into public.profile_managers (profile_id, manager_id)
        values (kid.kid_id, new_manager)
        on conflict do nothing;
      end if;
    end if;
  end loop;

  -- Release every gift you (or a kid going with you) had tucked. These are
  -- plain deletes: nothing here tells anyone, least of all the list owner.
  delete from public.claims where claimed_by = caller or claimed_by = any (doomed);

  -- Kids who go with you, then you. Deleting the login removes your profile
  -- (handle_deleted_user), and everything of yours cascades from that.
  delete from public.profiles where id = any (doomed);
  delete from auth.users where id = caller;

  -- Tidy up what's left empty. A leftover is harmless, so a hiccup here must
  -- never stop the deletion itself.
  begin
    delete from public.burrows b
    where b.id = any (my_burrows)
      and not exists (
        select 1
        from public.burrow_members m
        join public.profiles p on p.id = m.profile_id
        where m.burrow_id = b.id and not p.is_managed
      );
  exception when others then
    null;
  end;
  begin
    if my_home is not null then
      delete from public.homes h
      where h.id = my_home
        and not exists (select 1 from public.home_members where home_id = h.id);
    end if;
  exception when others then
    null;
  end;
end;
$$;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.my_account_deletion_preview()',
    'public.delete_my_account()'
  ] loop
    execute format('revoke execute on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end;
$$;
