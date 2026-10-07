-- Gift Nook, part 2: Knocks (invites, GIFT-001) plus fixes found while
-- wiring up the real screens against the first two migrations.
--
-- Fixes:
--  * burrow_members' select policy queried burrow_members itself, which
--    Postgres rejects as "infinite recursion detected in policy" — so did
--    every policy on burrows/gatherings that looked up membership. All
--    membership checks now go through security definer helpers.
--  * GIFT-007 leak: enforce_one_and_done_claim runs BEFORE the RLS insert
--    check, so an owner trying to claim their own gift got "already has an
--    active claim" only when it was claimed — telling them it was. The
--    trigger now rejects owners/outsiders first, with the same error RLS
--    gives.
--  * Anyone could add themselves to any Burrow by id ("self join"). Joining
--    is now only via create_burrow() or answer_knock().
--  * A claimant could UPDATE any column of their claim (e.g. repoint
--    gift_id, or un-release it to dodge GIFT-009). Releasing is now only
--    via release_tuck().

-- ---------------------------------------------------------------------------
-- Membership helpers (security definer, so they don't re-enter RLS)
-- ---------------------------------------------------------------------------

create function public.burrow_has_member(target_burrow uuid, target_profile uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.burrow_members
    where burrow_id = target_burrow and profile_id = target_profile
  );
$$;

create function public.is_burrow_member(target_burrow uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.burrow_has_member(target_burrow, (select auth.uid()));
$$;

create function public.is_burrow_admin(target_burrow uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.burrow_members
    where burrow_id = target_burrow
      and profile_id = (select auth.uid())
      and role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------------
-- Burrows / members: replace recursive policies
-- ---------------------------------------------------------------------------

drop policy "burrows visible to members" on public.burrows;
create policy "burrows visible to members" on public.burrows
  for select using (public.is_burrow_member(id));

drop policy "burrows updated by admins" on public.burrows;
create policy "burrows updated by admins" on public.burrows
  for update using (public.is_burrow_admin(id));

-- Creating goes through create_burrow() so the creator becomes an admin
-- member in the same step (a bare insert left an orphan Burrow its creator
-- couldn't even read back).
drop policy "burrows created by any signed-in user" on public.burrows;

drop policy "burrow_members visible to burrow-mates" on public.burrow_members;
create policy "burrow_members visible to burrow-mates" on public.burrow_members
  for select using (public.is_burrow_member(burrow_id));

drop policy "burrow_members self join" on public.burrow_members;
-- "burrow_members self leave" stays as-is.

-- ---------------------------------------------------------------------------
-- Gatherings: same recursion fix
-- ---------------------------------------------------------------------------

drop policy "gatherings visible to burrow members" on public.gatherings;
drop policy "gatherings managed by burrow members" on public.gatherings;
create policy "gatherings managed by burrow members" on public.gatherings
  for all using (public.is_burrow_member(burrow_id))
  with check (public.is_burrow_member(burrow_id));

drop policy "gathering_honorees visible to burrow members" on public.gathering_honorees;
drop policy "gathering_honorees managed by burrow members" on public.gathering_honorees;
-- Honorees must themselves be members of the Gathering's Burrow.
create policy "gathering_honorees managed by burrow members" on public.gathering_honorees
  for all using (
    exists (
      select 1 from public.gatherings g
      where g.id = gathering_honorees.gathering_id
        and public.is_burrow_member(g.burrow_id)
    )
  )
  with check (
    exists (
      select 1 from public.gatherings g
      where g.id = gathering_honorees.gathering_id
        and public.is_burrow_member(g.burrow_id)
        and public.burrow_has_member(g.burrow_id, gathering_honorees.profile_id)
    )
  );

drop policy "gathering_gifts visible to burrow members" on public.gathering_gifts;
drop policy "gathering_gifts managed by burrow members" on public.gathering_gifts;
create policy "gathering_gifts managed by burrow members" on public.gathering_gifts
  for all using (
    exists (
      select 1 from public.gatherings g
      where g.id = gathering_gifts.gathering_id
        and public.is_burrow_member(g.burrow_id)
    )
  );

-- ---------------------------------------------------------------------------
-- Knocks = invites (GIFT-001). Provisional design pending Q-010: a short
-- code any member can generate and text to someone, valid for 7 days.
-- ---------------------------------------------------------------------------

create table public.knocks (
  id uuid primary key default gen_random_uuid(),
  burrow_id uuid not null references public.burrows (id) on delete cascade,
  code text not null unique,
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days'
);

alter table public.knocks enable row level security;

-- Read-only from the client; created via create_knock().
create policy "knocks visible to burrow members" on public.knocks
  for select using (public.is_burrow_member(burrow_id));

create function public.create_burrow(burrow_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  new_burrow_id uuid;
begin
  if caller is null then
    raise exception 'Sign in first';
  end if;
  if coalesce(trim(burrow_name), '') = '' then
    raise exception 'Give your Burrow a name';
  end if;

  insert into public.burrows (name, created_by)
  values (trim(burrow_name), caller)
  returning id into new_burrow_id;

  insert into public.burrow_members (burrow_id, profile_id, role)
  values (new_burrow_id, caller, 'admin');

  return new_burrow_id;
end;
$$;

create function public.create_knock(target_burrow uuid)
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
  if not public.is_burrow_member(target_burrow) then
    raise exception 'Only members of this Burrow can send a Knock';
  end if;

  loop
    new_code := '';
    for i in 1..6 loop
      new_code := new_code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.knocks where code = new_code);
  end loop;

  insert into public.knocks (burrow_id, code, created_by)
  values (target_burrow, new_code, auth.uid());

  return new_code;
end;
$$;

create function public.answer_knock(knock_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  target_burrow uuid;
begin
  if caller is null then
    raise exception 'Sign in first';
  end if;

  select burrow_id into target_burrow
  from public.knocks
  where code = upper(trim(knock_code)) and expires_at > now();

  if target_burrow is null then
    raise exception 'That Knock code is not valid or has expired';
  end if;

  insert into public.burrow_members (burrow_id, profile_id, role)
  values (target_burrow, caller, 'member')
  on conflict (burrow_id, profile_id) do nothing;

  return target_burrow;
end;
$$;

-- ---------------------------------------------------------------------------
-- Claims (Tucks): close the GIFT-007 oracle and lock down updates
-- ---------------------------------------------------------------------------

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
  where g.id = new.gift_id
  for update of g;

  -- GIFT-007: this trigger fires BEFORE the RLS insert check. Anyone RLS
  -- would reject (the owner, or someone outside the owner's Burrows) must
  -- be rejected here with the identical error, before we look at existing
  -- claims — otherwise the error text reveals whether the gift is claimed.
  -- caller is null only for the service role, which bypasses RLS anyway.
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

  if not gift_is_repeatable and exists (
    select 1 from public.claims
    where gift_id = new.gift_id and released_at is null
  ) then
    raise exception 'Someone already tucked this gift away';
  end if;

  return new;
end;
$$;

drop policy "claimant can release their own claim" on public.claims;

create function public.release_tuck(claim_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.claims
  set released_at = now()
  where id = claim_id
    and claimed_by = auth.uid()
    and released_at is null;

  if not found then
    raise exception 'That tuck is not yours to release';
  end if;
end;
$$;

-- RPCs are for signed-in users only.
revoke execute on function public.create_burrow(text) from public, anon;
revoke execute on function public.create_knock(uuid) from public, anon;
revoke execute on function public.answer_knock(text) from public, anon;
revoke execute on function public.release_tuck(uuid) from public, anon;
grant execute on function public.create_burrow(text) to authenticated;
grant execute on function public.create_knock(uuid) to authenticated;
grant execute on function public.answer_knock(text) to authenticated;
grant execute on function public.release_tuck(uuid) to authenticated;
