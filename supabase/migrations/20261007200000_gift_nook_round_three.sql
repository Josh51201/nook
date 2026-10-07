-- Gift Nook, round 3 — decisions from 2026-10-07 (docs/NOOK_REQUIREMENTS.md):
--   managed (kid) profiles + hand-off ........ GIFT-019/020/021 (Q-007)
--   hidden gift suggestions .................. GIFT-022 (Q-006)
--   tuck status, notes, co-giver names ....... GIFT-023/024 (Q-005/008/016)
--   heads-up when a tucked gift changes ...... GIFT-025 (Q-009)
--   "did you receive these?" after a Gathering GIFT-026 (Q-013)
--   cleanup timing ........................... GIFT-027 (Q-014)
--   Burrow admin powers ...................... GIFT-028 (Q-017)
--   notifications inbox ...................... GIFT-029
--   link previews (image) .................... GIFT-030 (Q-011)
--
-- GIFT-007 still holds for every list *owner*. The one deliberate exception
-- (Josh, 2026-10-07): managers of a kid's profile see tucks on that kid's
-- gifts. That falls out of the existing claims policy — managers aren't the
-- owner — and ends at hand-off, when the kid becomes the owner.

-- ===========================================================================
-- 1. Columns and tables
-- ===========================================================================

-- Managed profiles have no login, so a profile id no longer has to be an
-- auth user id. A trigger keeps the old cascade-on-delete for real users.
alter table public.profiles drop constraint profiles_id_fkey;
alter table public.profiles add column is_managed boolean not null default false;

create function public.handle_deleted_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.profiles where id = old.id;
  return old;
end;
$$;

create trigger on_auth_user_deleted
  after delete on auth.users
  for each row execute procedure public.handle_deleted_user();

-- Who can manage a kid's profile (GIFT-020).
create table public.profile_managers (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  manager_id uuid not null references public.profiles (id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (profile_id, manager_id)
);

alter table public.profile_managers enable row level security;

-- One-time codes that hand a kid's profile over to their own login (GIFT-021).
create table public.profile_handoffs (
  code text primary key,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days'
);

alter table public.profile_handoffs enable row level security;

alter table public.gifts
  add column suggested_by uuid references public.profiles (id) on delete set null, -- GIFT-022
  add column image_url text, -- GIFT-030
  add column removed_at timestamptz, -- GIFT-025: removed but someone still has it tucked
  add column received_at timestamptz; -- GIFT-026

create type public.tuck_status as enum ('planning', 'bought', 'given');

alter table public.claims
  add column status public.tuck_status not null default 'planning', -- GIFT-023
  add column note text, -- GIFT-024
  add column gathering_id uuid references public.gatherings (id) on delete set null,
  add column acknowledged_at timestamptz; -- GIFT-025: giver saw the latest change

alter table public.gatherings
  add column created_by uuid default auth.uid() references public.profiles (id) on delete set null;

-- Owner (or a kid's manager) answered "did you receive any of these?".
create table public.gathering_receipts (
  gathering_id uuid not null references public.gatherings (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  responded_at timestamptz not null default now(),
  primary key (gathering_id, profile_id)
);

alter table public.gathering_receipts enable row level security;

-- In-app inbox (GIFT-029). Written only by security definer code below.
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  nook text not null default 'gift-nook',
  kind text not null, -- gathering_soon | new_gifts | tuck_changed | member_joined
  title text not null,
  body text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index notifications_inbox on public.notifications (profile_id, created_at desc);

alter table public.notifications enable row level security;

-- ===========================================================================
-- 2. Helpers (security definer so they don't re-enter RLS)
-- ===========================================================================

create function public.manages_profile(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profile_managers
    where profile_id = target and manager_id = (select auth.uid())
  );
$$;

create function public.is_managed_profile(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_managed from public.profiles where id = target), false);
$$;

create function public.wishbook_owner(target_wishbook uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select owner_id from public.wishbooks where id = target_wishbook;
$$;

-- Owner, or a manager of the (kid) owner.
create function public.can_manage_wishbook(target_wishbook uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.wishbooks w
    where w.id = target_wishbook
      and (w.owner_id = (select auth.uid()) or public.manages_profile(w.owner_id))
  );
$$;

create function public.has_active_tuck_on(target_gift uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.claims
    where gift_id = target_gift and claimed_by = (select auth.uid()) and released_at is null
  );
$$;

-- GIFT-024/Q-016: co-givers and suggesters can be named to anyone who can
-- see that gift's tucks — even across Burrows. Never via the owner's own
-- gifts (owner_id <> caller), so it can't hint anything to an owner.
create function public.appears_on_visible_gift(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.gifts g
    join public.wishbooks w on w.id = g.wishbook_id
    where w.owner_id <> (select auth.uid())
      and (
        public.shares_burrow_with((select auth.uid()), w.owner_id)
        or public.manages_profile(w.owner_id)
      )
      and (
        g.suggested_by = target
        or exists (select 1 from public.claims c where c.gift_id = g.id and c.claimed_by = target)
      )
  );
$$;

-- ===========================================================================
-- 3. Policies
-- ===========================================================================

-- profiles ------------------------------------------------------------------
drop policy "profiles self or burrow-mates" on public.profiles;
create policy "profiles visible to self, family, managers, co-givers" on public.profiles
  for select using (
    id = (select auth.uid())
    or public.shares_burrow_with((select auth.uid()), id)
    or public.manages_profile(id)
    or public.appears_on_visible_gift(id)
  );

drop policy "profiles self insert" on public.profiles;
create policy "profiles self insert" on public.profiles
  for insert with check (id = (select auth.uid()) and not is_managed);

drop policy "profiles self update" on public.profiles;
create policy "profiles updated by self or managers" on public.profiles
  for update using (id = (select auth.uid()) or public.manages_profile(id))
  with check (id = (select auth.uid()) or public.manages_profile(id));

-- Only the name is editable from the app (not is_managed).
revoke update on public.profiles from anon, authenticated;
grant update (display_name) on public.profiles to authenticated;

-- profile_managers / handoffs / receipts --------------------------------------
create policy "profile_managers visible to managers and family" on public.profile_managers
  for select using (
    manager_id = (select auth.uid())
    or public.manages_profile(profile_id)
    or public.shares_burrow_with((select auth.uid()), profile_id)
  );

create policy "profile_handoffs visible to managers" on public.profile_handoffs
  for select using (public.manages_profile(profile_id));

create policy "gathering_receipts visible to self and managers" on public.gathering_receipts
  for select using (profile_id = (select auth.uid()) or public.manages_profile(profile_id));

-- notifications ----------------------------------------------------------------
create policy "notifications are private to their recipient" on public.notifications
  for select using (profile_id = (select auth.uid()));

create policy "notifications marked read by their recipient" on public.notifications
  for update using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

create policy "notifications cleared by their recipient" on public.notifications
  for delete using (profile_id = (select auth.uid()));

revoke insert, update on public.notifications from anon, authenticated;
grant update (read_at) on public.notifications to authenticated;

-- wishbooks: managers can see their kid's even outside a shared Burrow ----------
drop policy "wishbooks owner or burrow-mates" on public.wishbooks;
create policy "wishbooks owner, burrow-mates, or managers" on public.wishbooks
  for select using (
    owner_id = (select auth.uid())
    or public.shares_burrow_with((select auth.uid()), owner_id)
    or public.manages_profile(owner_id)
  );

-- gifts ---------------------------------------------------------------------------
drop policy "gifts owner or burrow-mates" on public.gifts;
drop policy "gifts owner writes" on public.gifts;
drop policy "gifts owner updates" on public.gifts;
drop policy "gifts owner deletes" on public.gifts; -- deleting is via remove_gift()

-- The owner sees their own gifts EXCEPT suggestions (GIFT-022) and removed
-- ones. Family/managers see everything on the list, plus removed gifts
-- they still have tucked (so they get the heads-up, GIFT-025).
create policy "gifts visible to owner (minus suggestions) and family" on public.gifts
  for select using (
    (
      public.wishbook_owner(wishbook_id) = (select auth.uid())
      and suggested_by is null
      and removed_at is null
    )
    or (
      public.wishbook_owner(wishbook_id) <> (select auth.uid())
      and (
        public.shares_burrow_with((select auth.uid()), public.wishbook_owner(wishbook_id))
        or public.manages_profile(public.wishbook_owner(wishbook_id))
      )
      and (removed_at is null or public.has_active_tuck_on(id))
    )
  );

create policy "gifts added by owner/managers, or suggested by family" on public.gifts
  for insert with check (
    removed_at is null
    and received_at is null
    and (
      (suggested_by is null and public.can_manage_wishbook(wishbook_id))
      or (
        suggested_by = (select auth.uid())
        and public.wishbook_owner(wishbook_id) <> (select auth.uid())
        and not public.manages_profile(public.wishbook_owner(wishbook_id))
        and public.shares_burrow_with((select auth.uid()), public.wishbook_owner(wishbook_id))
      )
    )
  );

-- Real gifts: owner or managers. Suggestions: whoever suggested it, or the
-- kid's managers. The owner can't even see suggestions, so can't edit them.
create policy "gifts edited by owner/managers, suggestions by suggester" on public.gifts
  for update using (
    (suggested_by is null and public.can_manage_wishbook(wishbook_id))
    or suggested_by = (select auth.uid())
    or (suggested_by is not null and public.manages_profile(public.wishbook_owner(wishbook_id)))
  )
  with check (
    (suggested_by is null and public.can_manage_wishbook(wishbook_id))
    or suggested_by = (select auth.uid())
    or (suggested_by is not null and public.manages_profile(public.wishbook_owner(wishbook_id)))
  );

-- removed_at / received_at / updated_at are server-controlled.
revoke update on public.gifts from anon, authenticated;
grant update (shelf_id, title, url, notes, is_repeatable, details, image_url)
  on public.gifts to authenticated;

-- updated_at only moves on a real content change (drives "changed since you
-- tucked it"). Claims never touch gifts, so it can't hint at tucks.
create function public.touch_gift_updated_at()
returns trigger
language plpgsql
as $$
begin
  if (new.title, new.url, new.notes, new.is_repeatable, new.details, new.shelf_id, new.image_url)
     is distinct from
     (old.title, old.url, old.notes, old.is_repeatable, old.details, old.shelf_id, old.image_url)
  then
    new.updated_at := now();
  else
    new.updated_at := old.updated_at;
  end if;
  return new;
end;
$$;

create trigger before_gift_update
  before update on public.gifts
  for each row execute procedure public.touch_gift_updated_at();

-- burrow_members: admins remove people and set roles; managers remove kids ----
drop policy "burrow_members self leave" on public.burrow_members;
create policy "burrow_members leave, removed by admins or managers" on public.burrow_members
  for delete using (
    profile_id = (select auth.uid())
    or public.is_burrow_admin(burrow_id)
    or public.manages_profile(profile_id)
  );

create policy "burrow_members roles set by admins" on public.burrow_members
  for update using (public.is_burrow_admin(burrow_id))
  with check (
    public.is_burrow_admin(burrow_id)
    and (role = 'member' or not public.is_managed_profile(profile_id))
  );

revoke update on public.burrow_members from anon, authenticated;
grant update (role) on public.burrow_members to authenticated;

-- A Burrow with people in it always keeps at least one admin.
create function public.keep_a_burrow_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target uuid := coalesce(old.burrow_id, new.burrow_id);
begin
  if not exists (
    select 1 from public.burrow_members where burrow_id = target and role = 'admin'
  ) then
    update public.burrow_members
    set role = 'admin'
    where (burrow_id, profile_id) = (
      select m.burrow_id, m.profile_id
      from public.burrow_members m
      join public.profiles p on p.id = m.profile_id
      where m.burrow_id = target and not p.is_managed
      order by m.joined_at
      limit 1
    );
  end if;
  return null;
end;
$$;

create trigger after_burrow_member_change
  after delete or update on public.burrow_members
  for each row execute procedure public.keep_a_burrow_admin();

-- burrows: admins can delete ------------------------------------------------------
create policy "burrows deleted by admins" on public.burrows
  for delete using (public.is_burrow_admin(id));

-- gatherings: members create/edit; only admins or the creator delete -------------
drop policy "gatherings managed by burrow members" on public.gatherings;

create policy "gatherings visible to burrow members" on public.gatherings
  for select using (public.is_burrow_member(burrow_id));

create policy "gatherings created by burrow members" on public.gatherings
  for insert with check (
    public.is_burrow_member(burrow_id) and created_by = (select auth.uid())
  );

create policy "gatherings edited by burrow members" on public.gatherings
  for update using (public.is_burrow_member(burrow_id))
  with check (public.is_burrow_member(burrow_id));

create policy "gatherings deleted by admins or their creator" on public.gatherings
  for delete using (
    public.is_burrow_admin(burrow_id)
    or (created_by = (select auth.uid()) and public.is_burrow_member(burrow_id))
  );

-- Gathering gift picks (GIFT-017): managers pick for their kid too.
create or replace function public.can_pick_for_gathering(target_gathering uuid, target_wishbook uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.gatherings g
    join public.wishbooks w on w.id = target_wishbook
    where g.id = target_gathering
      and (w.owner_id = (select auth.uid()) or public.manages_profile(w.owner_id))
      and public.is_burrow_member(g.burrow_id)
  );
$$;

-- ===========================================================================
-- 4. Claims (Tucks): status, notes, Gathering link
-- ===========================================================================

create or replace function public.enforce_one_and_done_claim()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  gift_owner uuid;
  gift_is_repeatable boolean;
begin
  -- Lock the gift row so two people tucking at once can't both win.
  select w.owner_id, g.is_repeatable into gift_owner, gift_is_repeatable
  from public.gifts g
  join public.wishbooks w on w.id = g.wishbook_id
  where g.id = new.gift_id and g.removed_at is null and g.received_at is null
  for update of g;

  -- GIFT-007: this trigger fires BEFORE the RLS insert check, so anyone RLS
  -- would reject is rejected here first with the identical error — before
  -- we look at existing claims, so the error can't reveal a tuck.
  if caller is not null and (
    gift_owner is null
    or gift_owner = caller
    or not public.shares_burrow_with(caller, gift_owner)
  ) then
    raise exception 'new row violates row-level security policy for table "claims"'
      using errcode = '42501';
  end if;

  -- Server decides these, not the client.
  new.claimed_at := now();
  new.released_at := null;
  new.status := 'planning';
  new.acknowledged_at := null;
  new.note := nullif(left(trim(new.note), 500), '');
  if new.gathering_id is not null and not exists (
    select 1 from public.gatherings g
    where g.id = new.gathering_id and public.burrow_has_member(g.burrow_id, caller)
  ) then
    new.gathering_id := null;
  end if;

  if not gift_is_repeatable and exists (
    select 1 from public.claims
    where gift_id = new.gift_id and released_at is null and status <> 'given'
  ) then
    raise exception 'Someone already tucked this gift away';
  end if;

  return new;
end;
$$;

-- A removed gift goes away for good once nobody has it tucked any more.
create function public.purge_removed_gift(target_gift uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.gifts g
  where g.id = target_gift
    and g.removed_at is not null
    and not exists (
      select 1 from public.claims c
      where c.gift_id = g.id and c.released_at is null and c.status <> 'given'
    );
$$;

create or replace function public.release_tuck(claim_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  released_gift uuid;
begin
  update public.claims
  set released_at = now()
  where id = claim_id
    and claimed_by = auth.uid()
    and released_at is null
    and status <> 'given'
  returning gift_id into released_gift;

  if released_gift is null then
    raise exception 'That tuck is not yours to release';
  end if;

  perform public.purge_removed_gift(released_gift);
end;
$$;

create function public.update_tuck(claim_id uuid, new_status public.tuck_status, new_note text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if new_status not in ('planning', 'bought') then
    raise exception 'A tuck can be planning or bought';
  end if;

  update public.claims
  set status = new_status, note = nullif(left(trim(new_note), 500), '')
  where id = claim_id
    and claimed_by = auth.uid()
    and released_at is null
    and status <> 'given';

  if not found then
    raise exception 'That tuck is not yours to change';
  end if;
end;
$$;

-- "Got it" on a changed-gift heads-up (GIFT-025).
create function public.acknowledge_tuck(claim_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.claims
  set acknowledged_at = now()
  where id = claim_id and claimed_by = auth.uid();
$$;

-- ===========================================================================
-- 5. Gifts: remove (GIFT-025) and received (GIFT-026)
-- ===========================================================================

-- The owner's experience is identical whether or not the gift was tucked:
-- it disappears from their list either way. Untucked gifts are deleted;
-- tucked ones are kept (hidden from the owner) so givers get a heads-up.
create function public.remove_gift(target_gift uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  gift_wishbook uuid;
  gift_suggested_by uuid;
begin
  select wishbook_id, suggested_by into gift_wishbook, gift_suggested_by
  from public.gifts
  where id = target_gift and removed_at is null;

  if gift_wishbook is null or not (
    (gift_suggested_by is null and public.can_manage_wishbook(gift_wishbook))
    or gift_suggested_by = caller
    or (gift_suggested_by is not null and public.manages_profile(public.wishbook_owner(gift_wishbook)))
  ) then
    raise exception 'That gift is not yours to remove';
  end if;

  if exists (
    select 1 from public.claims
    where gift_id = target_gift and released_at is null and status <> 'given'
  ) then
    update public.gifts set removed_at = now() where id = target_gift;
    -- GIFT-007: a hard delete would cascade these away; keeping them would
    -- let the owner spot that this gift was tucked. Remove them either way.
    delete from public.gathering_gifts where gift_id = target_gift;
  else
    delete from public.gifts where id = target_gift;
  end if;
end;
$$;

-- After a Gathering, the owner (or a kid's manager) checks off what they got.
-- One-and-done gifts leave the list; tucks on everything checked become
-- "given". Nothing is revealed about who gave what.
create function public.mark_received(
  target_gathering uuid,
  for_profile uuid,
  received_gift_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  ids uuid[] := coalesce(received_gift_ids, '{}');
begin
  if caller is null or not (for_profile = caller or public.manages_profile(for_profile)) then
    raise exception 'You can only do this for yourself or someone you manage';
  end if;
  if not exists (
    select 1 from public.gatherings g
    where g.id = target_gathering and public.burrow_has_member(g.burrow_id, for_profile)
  ) then
    raise exception 'They are not part of that Gathering';
  end if;

  update public.gifts g
  set received_at = now()
  from public.wishbooks w
  where w.id = g.wishbook_id
    and w.owner_id = for_profile
    and g.id = any(ids)
    and (g.suggested_by is null or for_profile <> caller)
    and not g.is_repeatable
    and g.removed_at is null
    and g.received_at is null;

  update public.claims c
  set status = 'given'
  from public.gifts g
  join public.wishbooks w on w.id = g.wishbook_id
  where c.gift_id = g.id
    and w.owner_id = for_profile
    and g.id = any(ids)
    and (g.suggested_by is null or for_profile <> caller)
    and c.released_at is null;

  insert into public.gathering_receipts (gathering_id, profile_id)
  values (target_gathering, for_profile)
  on conflict (gathering_id, profile_id) do update set responded_at = now();
end;
$$;

create function public.unreceive_gift(target_gift uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.gifts
  set received_at = null
  where id = target_gift
    and received_at is not null
    and public.can_manage_wishbook(wishbook_id)
    and (suggested_by is null or wishbook_owner(wishbook_id) <> auth.uid());
  if not found then
    raise exception 'That gift is not yours to change';
  end if;
end;
$$;

-- ===========================================================================
-- 6. Managed (kid) profiles and hand-off
-- ===========================================================================

-- Codes for Knocks and hand-offs share one space so a code means one thing.
create function public.generate_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  -- No 0/O/1/I/L, so codes read cleanly over a text message.
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  new_code text;
begin
  loop
    new_code := '';
    for i in 1..6 loop
      new_code := new_code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.knocks where code = new_code)
      and not exists (select 1 from public.profile_handoffs where code = new_code);
  end loop;
  return new_code;
end;
$$;

create or replace function public.create_knock(target_burrow uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  new_code text;
begin
  if not public.is_burrow_member(target_burrow) then
    raise exception 'Only members of this Burrow can send a Knock';
  end if;
  new_code := public.generate_code();
  insert into public.knocks (burrow_id, code, created_by)
  values (target_burrow, new_code, auth.uid());
  return new_code;
end;
$$;

create function public.create_managed_profile(profile_name text, burrow_ids uuid[])
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  new_profile uuid := gen_random_uuid();
  target_burrow uuid;
begin
  if caller is null or public.is_managed_profile(caller) then
    raise exception 'Sign in first';
  end if;
  if coalesce(trim(profile_name), '') = '' then
    raise exception 'Give them a name';
  end if;

  insert into public.profiles (id, display_name, is_managed)
  values (new_profile, trim(profile_name), true);
  insert into public.wishbooks (owner_id) values (new_profile);
  insert into public.profile_managers (profile_id, manager_id) values (new_profile, caller);

  foreach target_burrow in array coalesce(burrow_ids, '{}') loop
    if not public.is_burrow_member(target_burrow) then
      raise exception 'You can only add them to Burrows you are in';
    end if;
    insert into public.burrow_members (burrow_id, profile_id, role)
    values (target_burrow, new_profile, 'member')
    on conflict (burrow_id, profile_id) do nothing;
  end loop;

  return new_profile;
end;
$$;

create function public.set_managed_burrow(target_profile uuid, target_burrow uuid, is_in boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.manages_profile(target_profile) or not public.is_burrow_member(target_burrow) then
    raise exception 'You can only do this for someone you manage, in a Burrow you are in';
  end if;
  if is_in then
    insert into public.burrow_members (burrow_id, profile_id, role)
    values (target_burrow, target_profile, 'member')
    on conflict (burrow_id, profile_id) do nothing;
  else
    delete from public.burrow_members
    where burrow_id = target_burrow and profile_id = target_profile;
  end if;
end;
$$;

create function public.add_profile_manager(target_profile uuid, new_manager uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.manages_profile(target_profile) then
    raise exception 'Only their managers can add another manager';
  end if;
  if public.is_managed_profile(new_manager)
     or not public.shares_burrow_with(auth.uid(), new_manager) then
    raise exception 'Managers must be grown-ups in one of your Burrows';
  end if;
  insert into public.profile_managers (profile_id, manager_id)
  values (target_profile, new_manager)
  on conflict do nothing;
end;
$$;

create function public.remove_profile_manager(target_profile uuid, old_manager uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.manages_profile(target_profile) then
    raise exception 'Only their managers can change managers';
  end if;
  if (select count(*) from public.profile_managers where profile_id = target_profile) <= 1 then
    raise exception 'They need at least one manager';
  end if;
  delete from public.profile_managers
  where profile_id = target_profile and manager_id = old_manager;
end;
$$;

create function public.delete_managed_profile(target_profile uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.manages_profile(target_profile) or not public.is_managed_profile(target_profile) then
    raise exception 'Only their managers can delete this profile';
  end if;
  delete from public.profiles where id = target_profile;
end;
$$;

create function public.create_handoff(target_profile uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  new_code text;
begin
  if not public.manages_profile(target_profile) or not public.is_managed_profile(target_profile) then
    raise exception 'Only their managers can hand this profile over';
  end if;
  new_code := public.generate_code();
  insert into public.profile_handoffs (code, profile_id, created_by)
  values (new_code, target_profile, auth.uid());
  return new_code;
end;
$$;

-- GIFT-021: the kid signs in with their own email and enters the code.
-- Everything moves onto their real account and the managed profile goes
-- away — so managers stop seeing tucks, and the kid (now the owner) sees
-- none (GIFT-007), including suggestions others left on their list.
create function public.accept_handoff(handoff_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  kid uuid;
  kid_name text;
  my_wishbook uuid;
  kid_wishbook uuid;
begin
  if caller is null then
    raise exception 'Sign in first';
  end if;

  select profile_id into kid
  from public.profile_handoffs
  where code = upper(trim(handoff_code)) and expires_at > now();
  if kid is null then
    raise exception 'That code is not valid or has expired';
  end if;
  if exists (
    select 1 from public.profile_managers where profile_id = kid and manager_id = caller
  ) then
    raise exception 'This code is for them to use on their own account, not yours';
  end if;

  select display_name into kid_name from public.profiles where id = kid;
  select id into my_wishbook from public.wishbooks where owner_id = caller;
  select id into kid_wishbook from public.wishbooks where owner_id = kid;

  update public.profiles
  set display_name = kid_name
  where id = caller and (display_name is null or display_name like '%@%');

  update public.gifts set wishbook_id = my_wishbook where wishbook_id = kid_wishbook;

  insert into public.gathering_wishbook_settings (gathering_id, wishbook_id, include_new)
  select gathering_id, my_wishbook, include_new
  from public.gathering_wishbook_settings where wishbook_id = kid_wishbook
  on conflict do nothing;

  insert into public.burrow_members (burrow_id, profile_id, role)
  select burrow_id, caller, 'member' from public.burrow_members where profile_id = kid
  on conflict do nothing;

  insert into public.gathering_honorees (gathering_id, profile_id)
  select gathering_id, caller from public.gathering_honorees where profile_id = kid
  on conflict do nothing;

  insert into public.gathering_receipts (gathering_id, profile_id, responded_at)
  select gathering_id, caller, responded_at from public.gathering_receipts where profile_id = kid
  on conflict do nothing;

  delete from public.profiles where id = kid;
end;
$$;

-- One box in the app for any code: a Knock (join a Burrow) or a hand-off.
create function public.answer_code(any_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cleaned text := upper(trim(any_code));
begin
  if exists (select 1 from public.knocks where code = cleaned) then
    return jsonb_build_object('kind', 'burrow', 'id', public.answer_knock(cleaned));
  end if;
  if exists (select 1 from public.profile_handoffs where code = cleaned) then
    perform public.accept_handoff(cleaned);
    return jsonb_build_object('kind', 'handoff');
  end if;
  raise exception 'That code is not valid or has expired';
end;
$$;

-- ===========================================================================
-- 7. Notifications (GIFT-029)
-- ===========================================================================

-- Does this person want this kind of notice? Gift Nook settings
-- (nook_settings, 'gift-nook'); everything is on unless turned off. Managed
-- profiles can't sign in, so they never get notices.
create function public.wants_notification(recipient uuid, notify_kind text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select recipient is not null
    and not public.is_managed_profile(recipient)
    and coalesce((
      select (settings ->> case notify_kind
        when 'gathering_soon' then 'notifyGatheringSoon'
        when 'new_gifts' then 'notifyNewGifts'
        when 'tuck_changed' then 'notifyTuckChanged'
        when 'member_joined' then 'notifyMemberJoined'
      end)::boolean
      from public.nook_settings
      where profile_id = recipient and nook = 'gift-nook'
    ), true);
$$;

create function public.notify(
  recipient uuid,
  notify_kind text,
  notify_title text,
  notify_body text,
  notify_data jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.wants_notification(recipient, notify_kind) then
    return;
  end if;

  insert into public.notifications (profile_id, kind, title, body, data)
  values (recipient, notify_kind, notify_title, notify_body, coalesce(notify_data, '{}'::jsonb));
end;
$$;

-- "New gifts added", bundled per owner per day. Suggestions stay quiet, and
-- the owner is never a recipient.
create function public.notify_new_gift()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner uuid;
  owner_name text;
  recipient uuid;
  bumped int;
begin
  if new.suggested_by is not null then
    return new;
  end if;

  owner := public.wishbook_owner(new.wishbook_id);
  select coalesce(display_name, 'Someone') into owner_name from public.profiles where id = owner;

  for recipient in
    select distinct m2.profile_id
    from public.burrow_members m1
    join public.burrow_members m2 on m2.burrow_id = m1.burrow_id
    where m1.profile_id = owner
      and m2.profile_id <> owner
      and m2.profile_id is distinct from auth.uid()
  loop
    continue when not public.wants_notification(recipient, 'new_gifts');

    update public.notifications
    set data = jsonb_set(data, '{count}', to_jsonb(coalesce((data ->> 'count')::int, 1) + 1)),
        body = (coalesce((data ->> 'count')::int, 1) + 1) || ' new gifts on their Wishbook',
        created_at = now()
    where profile_id = recipient
      and kind = 'new_gifts'
      and read_at is null
      and data ->> 'owner_id' = owner::text
      and created_at > now() - interval '1 day';
    get diagnostics bumped = row_count;

    if bumped = 0 then
      perform public.notify(
        recipient,
        'new_gifts',
        owner_name || ' added to their Wishbook',
        '1 new gift on their Wishbook',
        jsonb_build_object('owner_id', owner, 'count', 1)
      );
    end if;
  end loop;

  return new;
end;
$$;

create trigger after_gift_insert
  after insert on public.gifts
  for each row execute procedure public.notify_new_gift();

-- "A gift you tucked changed" — only to the people who tucked it.
create function public.notify_tuck_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  was_removed boolean := new.removed_at is not null and old.removed_at is null;
  owner_name text;
  claimer uuid;
begin
  if not was_removed
     and (new.title, new.url, new.notes, new.is_repeatable, new.details, new.shelf_id, new.image_url)
         is not distinct from
         (old.title, old.url, old.notes, old.is_repeatable, old.details, old.shelf_id, old.image_url)
  then
    return new;
  end if;

  select coalesce(p.display_name, 'Someone') into owner_name
  from public.wishbooks w join public.profiles p on p.id = w.owner_id
  where w.id = new.wishbook_id;

  for claimer in
    select distinct claimed_by from public.claims
    where gift_id = new.id
      and released_at is null
      and status <> 'given'
      and claimed_by is distinct from auth.uid()
  loop
    perform public.notify(
      claimer,
      'tuck_changed',
      case when was_removed then owner_name || ' removed a gift you tucked'
           else owner_name || ' changed a gift you tucked' end,
      new.title,
      jsonb_build_object('gift_id', new.id)
    );
  end loop;

  return new;
end;
$$;

create trigger after_gift_update
  after update on public.gifts
  for each row execute procedure public.notify_tuck_changed();

-- "Someone joined your Burrow".
create function public.notify_member_joined()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  member_name text;
  burrow_name text;
  recipient uuid;
begin
  select coalesce(display_name, 'Someone') into member_name from public.profiles where id = new.profile_id;
  select name into burrow_name from public.burrows where id = new.burrow_id;

  for recipient in
    select profile_id from public.burrow_members
    where burrow_id = new.burrow_id
      and profile_id <> new.profile_id
      and profile_id is distinct from auth.uid()
  loop
    perform public.notify(
      recipient,
      'member_joined',
      member_name || ' joined ' || burrow_name,
      null,
      jsonb_build_object('burrow_id', new.burrow_id)
    );
  end loop;

  return new;
end;
$$;

create trigger after_burrow_member_insert
  after insert on public.burrow_members
  for each row execute procedure public.notify_member_joined();

-- ===========================================================================
-- 8. Daily job: reminders and cleanup (GIFT-016/026/027)
-- ===========================================================================

create function public.gift_nook_daily()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  gathering record;
  member uuid;
  days_left int;
begin
  -- "Gathering coming up": 7 days before, and the day before.
  for gathering in
    select id, burrow_id, title, ends_at from public.gatherings
    where ends_at > now() and ends_at < now() + interval '8 days'
  loop
    days_left := floor(extract(epoch from (gathering.ends_at - now())) / 86400);
    if days_left in (7, 1) then
      for member in select profile_id from public.burrow_members where burrow_id = gathering.burrow_id loop
        perform public.notify(
          member,
          'gathering_soon',
          gathering.title || case when days_left = 1 then ' is tomorrow' else ' is in a week' end,
          null,
          jsonb_build_object('gathering_id', gathering.id, 'burrow_id', gathering.burrow_id)
        );
      end loop;
    end if;
  end loop;

  -- 30 days after a Gathering ends, tucks made for it settle: "planning"
  -- ones are released, "bought" ones count as given.
  update public.claims c set released_at = now()
  from public.gatherings g
  where c.gathering_id = g.id and g.ends_at < now() - interval '30 days'
    and c.released_at is null and c.status = 'planning';

  update public.claims c set status = 'given'
  from public.gatherings g
  where c.gathering_id = g.id and g.ends_at < now() - interval '30 days'
    and c.released_at is null and c.status = 'bought';

  -- Removed gifts nobody has tucked any more.
  delete from public.gifts g
  where g.removed_at is not null
    and not exists (
      select 1 from public.claims c
      where c.gift_id = g.id and c.released_at is null and c.status <> 'given'
    );

  -- Archive at the end date; delete 90 days later (Q-014).
  update public.gatherings set archived_at = ends_at
  where archived_at is null and ends_at < now();
  delete from public.gatherings where ends_at < now() - interval '90 days';

  delete from public.notifications
  where read_at is not null and created_at < now() - interval '60 days';
  delete from public.profile_handoffs where expires_at < now() - interval '30 days';
  delete from public.knocks where expires_at < now() - interval '30 days';
end;
$$;

-- Run it every day at 15:00 UTC (10am Central) via pg_cron, if available.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.schedule('gift-nook-daily', '0 15 * * *', 'select public.gift_nook_daily()');
  else
    raise notice 'pg_cron not available — enable it, then schedule public.gift_nook_daily()';
  end if;
exception when others then
  raise notice 'Could not schedule gift_nook_daily (%): enable pg_cron in Database > Extensions', sqlerrm;
end;
$$;

-- ===========================================================================
-- 9. Who can call what
-- ===========================================================================

-- Internal only: never callable from the app.
revoke execute on function public.notify(uuid, text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.gift_nook_daily() from public, anon, authenticated;
revoke execute on function public.purge_removed_gift(uuid) from public, anon, authenticated;
revoke execute on function public.generate_code() from public, anon, authenticated;
revoke execute on function public.wants_notification(uuid, text) from public, anon, authenticated;

-- App RPCs: signed-in users only.
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.update_tuck(uuid, public.tuck_status, text)',
    'public.acknowledge_tuck(uuid)',
    'public.remove_gift(uuid)',
    'public.mark_received(uuid, uuid, uuid[])',
    'public.unreceive_gift(uuid)',
    'public.create_managed_profile(text, uuid[])',
    'public.set_managed_burrow(uuid, uuid, boolean)',
    'public.add_profile_manager(uuid, uuid)',
    'public.remove_profile_manager(uuid, uuid)',
    'public.delete_managed_profile(uuid)',
    'public.create_handoff(uuid)',
    'public.accept_handoff(text)',
    'public.answer_code(text)'
  ] loop
    execute format('revoke execute on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end;
$$;
