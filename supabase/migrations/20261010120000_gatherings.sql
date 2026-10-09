-- The Gathering Nook (GATH-001..).
--
-- A Gathering used to belong to one Burrow, and a Potluck to one Burrow too.
-- Now a Gathering has its own guest list, its own hosts and its own RSVPs,
-- and the Gift Nook and the Potluck Nook are things a Gathering can have:
--
--   gatherings ............ + starts_at, place, notes, gifts (on/off);
--                           burrow_id is now just "the first Burrow invited"
--   gathering_burrows ..... GATH-003: whole Burrows invited (their members,
--                           including anyone who joins later)
--   gathering_guests ...... GATH-003: people invited one by one
--   gathering_hosts ....... GATH-005: who can change or delete it
--   gathering_rsvps ....... GATH-006: Going / Maybe / Can't make it
--   potlucks .............. every Potluck now belongs to a Gathering, and its
--                           guests, hosts and RSVPs are the Gathering's
--                           (POT-002 changed). potluck_hosts and potluck_rsvps
--                           move into the Gathering's and are dropped.
--   plan_gathering() / update_gathering() / add_potluck()
--   gathering_guest_list()  the guest list with RSVPs, for the screens
--
-- GIFT-007: nothing here reads or returns claims. Who can see a Wishbook is
-- unchanged (people who share a Burrow with its owner), so inviting someone
-- from another Burrow to a Gathering does NOT show them anyone's Wishbook or
-- tucks. A tuck is still only linked to a Gathering its giver is invited to.

-- ===========================================================================
-- 1. Gatherings get a time, a place, notes, and a gifts switch
-- ===========================================================================

alter table public.gatherings
  add column starts_at timestamptz, -- null = all day (ends_at's day)
  add column place text check (place is null or char_length(place) <= 120),
  add column notes text check (notes is null or char_length(notes) <= 500),
  -- Shown in the Gift Nook, with Wishbooks (GATH-004). Off for a game night.
  add column gifts boolean not null default true,
  alter column burrow_id drop not null;

-- The Burrow the Gathering was made in is no longer who's invited, so losing
-- it (Burrow deleted) shouldn't take the Gathering with it.
alter table public.gatherings drop constraint gatherings_burrow_id_fkey;
alter table public.gatherings
  add constraint gatherings_burrow_id_fkey foreign key (burrow_id) references public.burrows (id) on delete set null;

-- ===========================================================================
-- 2. Guest lists, hosts and RSVPs
-- ===========================================================================

create table public.gathering_burrows (
  gathering_id uuid not null references public.gatherings (id) on delete cascade,
  burrow_id uuid not null references public.burrows (id) on delete cascade,
  primary key (gathering_id, burrow_id)
);
create index gathering_burrows_burrow on public.gathering_burrows (burrow_id);

create table public.gathering_guests (
  gathering_id uuid not null references public.gatherings (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  primary key (gathering_id, profile_id)
);
create index gathering_guests_profile on public.gathering_guests (profile_id);

create table public.gathering_hosts (
  gathering_id uuid not null references public.gatherings (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  primary key (gathering_id, profile_id)
);
create index gathering_hosts_profile on public.gathering_hosts (profile_id);

create table public.gathering_rsvps (
  gathering_id uuid not null references public.gatherings (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  status text not null check (status in ('going', 'maybe', 'no')),
  extra_guests int not null default 0 check (extra_guests between 0 and 20),
  updated_at timestamptz not null default now(),
  primary key (gathering_id, profile_id)
);

alter table public.gathering_burrows enable row level security;
alter table public.gathering_guests enable row level security;
alter table public.gathering_hosts enable row level security;
alter table public.gathering_rsvps enable row level security;

-- ===========================================================================
-- 3. Helpers (security definer so they don't re-enter RLS)
-- ===========================================================================

-- Everyone invited: hosts, people invited one by one, and everyone in an
-- invited Burrow.
create function public.gathering_guest_ids(target_gathering uuid)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select profile_id from public.gathering_hosts where gathering_id = target_gathering
  union
  select profile_id from public.gathering_guests where gathering_id = target_gathering
  union
  select m.profile_id
  from public.gathering_burrows gb
  join public.burrow_members m on m.burrow_id = gb.burrow_id
  where gb.gathering_id = target_gathering;
$$;

create function public.gathering_has_guest(target_gathering uuid, person uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select person is not null and (
    exists (select 1 from public.gathering_hosts where gathering_id = target_gathering and profile_id = person)
    or exists (select 1 from public.gathering_guests where gathering_id = target_gathering and profile_id = person)
    or exists (
      select 1 from public.gathering_burrows gb
      join public.burrow_members m on m.burrow_id = gb.burrow_id
      where gb.gathering_id = target_gathering and m.profile_id = person
    )
  );
$$;

-- You can see a Gathering you're invited to, or one a kid you look after is.
create function public.can_see_gathering(target_gathering uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.gathering_has_guest(target_gathering, (select auth.uid()))
    or exists (
      select 1 from public.gathering_guests g
      join public.profile_managers pm on pm.profile_id = g.profile_id
      where g.gathering_id = target_gathering and pm.manager_id = (select auth.uid())
    );
$$;

-- GATH-005: hosts change it. A Gathering with no hosts (an automatic
-- Birthday Gathering, or every host left) can be changed by anyone invited,
-- and an admin of an invited Burrow can always step in, like POT-008.
create function public.can_host_gathering(target_gathering uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_see_gathering(target_gathering) and (
    exists (
      select 1 from public.gathering_hosts
      where gathering_id = target_gathering and profile_id = (select auth.uid())
    )
    or not exists (select 1 from public.gathering_hosts where gathering_id = target_gathering)
    or exists (
      select 1 from public.gathering_burrows gb
      where gb.gathering_id = target_gathering and public.is_burrow_admin(gb.burrow_id)
    )
  );
$$;

revoke execute on function public.gathering_guest_ids(uuid) from public, anon, authenticated;
revoke execute on function public.gathering_has_guest(uuid, uuid) from public, anon;
grant execute on function public.gathering_has_guest(uuid, uuid) to authenticated;
revoke execute on function public.can_see_gathering(uuid) from public, anon;
grant execute on function public.can_see_gathering(uuid) to authenticated;
revoke execute on function public.can_host_gathering(uuid) from public, anon;
grant execute on function public.can_host_gathering(uuid) to authenticated;

-- ===========================================================================
-- 4. Bring what's there across
-- ===========================================================================

-- The old "someone planned a Gathering" notice went to one Burrow;
-- plan_gathering() now tells everyone invited. Gone first, so moving
-- Potlucks across below doesn't send anyone a notice.
drop trigger after_gathering_insert on public.gatherings;
drop function public.notify_new_gathering();

-- Every Gathering invited its Burrow.
insert into public.gathering_burrows (gathering_id, burrow_id)
select id, burrow_id from public.gatherings where burrow_id is not null
on conflict do nothing;

-- Whoever planned it hosts it, except automatic Birthday Gatherings (made by
-- whichever phone opened Nook first), which anyone invited can change.
insert into public.gathering_hosts (gathering_id, profile_id)
select g.id, g.created_by from public.gatherings g
where g.created_by is not null
  and not exists (select 1 from public.birthday_gatherings b where b.gathering_id = g.id)
on conflict do nothing;

-- A Potluck on its own gets a Gathering of its own; a Potluck that was
-- already for a Gathering brings its time and place if the Gathering had
-- none. Potluck hosts become the Gathering's hosts, Potluck RSVPs its RSVPs.
do $$
declare
  solo record;
  new_gathering uuid;
begin
  for solo in select * from public.potlucks where gathering_id is null loop
    insert into public.gatherings (burrow_id, title, kind, ends_at, starts_at, place, notes, gifts, created_by, created_at)
    values (solo.burrow_id, left(solo.title, 120), 'dinner', solo.starts_at + interval '2 hours', solo.starts_at, solo.place, solo.notes, false, solo.created_by, solo.created_at)
    returning id into new_gathering;
    insert into public.gathering_burrows (gathering_id, burrow_id) values (new_gathering, solo.burrow_id);
    update public.potlucks set gathering_id = new_gathering where id = solo.id;
  end loop;

  update public.gatherings g
  set starts_at = coalesce(g.starts_at, p.starts_at),
      place = coalesce(g.place, p.place),
      notes = coalesce(g.notes, p.notes)
  from public.potlucks p
  where p.gathering_id = g.id;
end;
$$;

insert into public.gathering_hosts (gathering_id, profile_id)
select p.gathering_id, h.profile_id
from public.potluck_hosts h join public.potlucks p on p.id = h.potluck_id
on conflict do nothing;

insert into public.gathering_rsvps (gathering_id, profile_id, status, extra_guests, updated_at)
select distinct on (p.gathering_id, r.profile_id) p.gathering_id, r.profile_id, r.status, r.extra_guests, r.updated_at
from public.potluck_rsvps r join public.potlucks p on p.id = r.potluck_id
order by p.gathering_id, r.profile_id, r.updated_at desc
on conflict do nothing;

-- ===========================================================================
-- 5. Who sees and changes what
-- ===========================================================================

-- gatherings ----------------------------------------------------------------
drop policy "gatherings visible to burrow members" on public.gatherings;
drop policy "gatherings created by burrow members" on public.gatherings;
drop policy "gatherings edited by burrow members" on public.gatherings;
drop policy "gatherings deleted by admins or their creator" on public.gatherings;

create policy "gatherings visible to guests" on public.gatherings
  for select using (public.can_see_gathering(id));

-- Planned through plan_gathering(), so the guest list comes with it.
create policy "gatherings edited by hosts" on public.gatherings
  for update using (public.can_host_gathering(id))
  with check (public.can_host_gathering(id));

create policy "gatherings deleted by hosts" on public.gatherings
  for delete using (public.can_host_gathering(id));

revoke insert, update on public.gatherings from anon, authenticated;
grant update (title, kind, ends_at, starts_at, place, notes, gifts) on public.gatherings to authenticated;

-- guest lists: read by guests, changed only through update_gathering() -------
create policy "gathering_burrows visible to guests" on public.gathering_burrows
  for select using (public.can_see_gathering(gathering_id));
create policy "gathering_guests visible to guests" on public.gathering_guests
  for select using (public.can_see_gathering(gathering_id));
create policy "gathering_hosts visible to guests" on public.gathering_hosts
  for select using (public.can_see_gathering(gathering_id));
revoke insert, update, delete on public.gathering_burrows, public.gathering_guests, public.gathering_hosts from anon, authenticated;

-- RSVPs: for yourself, or a kid you look after, if they're invited -----------
create policy "gathering_rsvps visible to guests" on public.gathering_rsvps
  for select using (public.can_see_gathering(gathering_id));

create policy "gathering_rsvps added for self or managed kids" on public.gathering_rsvps
  for insert with check (
    (profile_id = (select auth.uid()) or public.manages_profile(profile_id))
    and public.gathering_has_guest(gathering_id, profile_id)
  );

create policy "gathering_rsvps changed for self or managed kids" on public.gathering_rsvps
  for update using (profile_id = (select auth.uid()) or public.manages_profile(profile_id))
  with check (
    (profile_id = (select auth.uid()) or public.manages_profile(profile_id))
    and public.gathering_has_guest(gathering_id, profile_id)
  );

create policy "gathering_rsvps cleared for self or managed kids" on public.gathering_rsvps
  for delete using (profile_id = (select auth.uid()) or public.manages_profile(profile_id));


-- honorees: picked by hosts, from the guest list ----------------------------
drop policy "gathering_honorees managed by burrow members" on public.gathering_honorees;
create policy "gathering_honorees visible to guests" on public.gathering_honorees
  for select using (public.can_see_gathering(gathering_id));
create policy "gathering_honorees picked by hosts" on public.gathering_honorees
  for insert with check (
    public.can_host_gathering(gathering_id) and public.gathering_has_guest(gathering_id, profile_id)
  );
create policy "gathering_honorees removed by hosts" on public.gathering_honorees
  for delete using (public.can_host_gathering(gathering_id));

-- gift picks (GIFT-017): seen by guests, set by the Wishbook's owner --------
drop policy "gathering_gifts visible to burrow members" on public.gathering_gifts;
create policy "gathering_gifts visible to guests" on public.gathering_gifts
  for select using (public.can_see_gathering(gathering_id));

drop policy "gathering_wishbook_settings visible to burrow members" on public.gathering_wishbook_settings;
create policy "gathering_wishbook_settings visible to guests" on public.gathering_wishbook_settings
  for select using (public.can_see_gathering(gathering_id));

-- Only the Wishbook's owner (or a kid's manager) picks, and only for a
-- Gathering the owner is invited to.
create or replace function public.can_pick_for_gathering(target_gathering uuid, target_wishbook uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.wishbooks w
    where w.id = target_wishbook
      and (w.owner_id = (select auth.uid()) or public.manages_profile(w.owner_id))
      and public.gathering_has_guest(target_gathering, w.owner_id)
  );
$$;

-- ===========================================================================
-- 6. Potlucks are the food part of a Gathering
-- ===========================================================================

alter table public.potlucks alter column gathering_id set not null;
alter table public.potlucks drop constraint potlucks_gathering_id_fkey;
alter table public.potlucks
  add constraint potlucks_gathering_id_fkey foreign key (gathering_id) references public.gatherings (id) on delete cascade;
alter table public.potlucks alter column burrow_id drop not null;
alter table public.potlucks drop constraint potlucks_burrow_id_fkey;
alter table public.potlucks
  add constraint potlucks_burrow_id_fkey foreign key (burrow_id) references public.burrows (id) on delete set null;

-- A Potluck's name, time, place and notes are its Gathering's, kept in step
-- so everything that reads them (lists, widgets, reminders) still works.
create function public.potluck_from_gathering()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  g public.gatherings;
begin
  select * into g from public.gatherings where id = new.gathering_id;
  new.title := left(g.title, 80);
  new.starts_at := coalesce(g.starts_at, g.ends_at);
  new.place := g.place;
  new.notes := g.notes;
  new.burrow_id := g.burrow_id;
  return new;
end;
$$;

create trigger potluck_follows_gathering
  before insert on public.potlucks
  for each row execute function public.potluck_from_gathering();

create function public.gathering_to_potlucks()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.title, new.starts_at, new.ends_at, new.place, new.notes)
     is not distinct from (old.title, old.starts_at, old.ends_at, old.place, old.notes) then
    return new;
  end if;
  update public.potlucks
  set title = left(new.title, 80),
      starts_at = coalesce(new.starts_at, new.ends_at),
      place = new.place,
      notes = new.notes
  where gathering_id = new.id;
  return new;
end;
$$;

create trigger after_gathering_update_potlucks
  after update on public.gatherings
  for each row execute function public.gathering_to_potlucks();

revoke execute on function public.potluck_from_gathering() from public, anon, authenticated;
revoke execute on function public.gathering_to_potlucks() from public, anon, authenticated;

-- Guests and hosts come from the Gathering.
create or replace function public.can_see_potluck(target_potluck uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select public.can_see_gathering(gathering_id) from public.potlucks where id = target_potluck
  ), false);
$$;

create or replace function public.can_host_potluck(target_potluck uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select public.can_host_gathering(gathering_id) from public.potlucks where id = target_potluck
  ), false);
$$;

drop policy "potlucks visible to burrow members" on public.potlucks;
drop policy "potlucks created by burrow members" on public.potlucks;
drop policy "potlucks edited by hosts" on public.potlucks;
drop policy "potlucks deleted by hosts" on public.potlucks;

create policy "potlucks visible to guests" on public.potlucks
  for select using (public.can_see_potluck(id));

-- A Gathering's hosts add its Potluck (add_potluck() does it for the app).
create policy "potlucks added by the Gathering's hosts" on public.potlucks
  for insert with check (public.can_host_gathering(gathering_id) and created_by = (select auth.uid()));

create policy "potlucks removed by hosts" on public.potlucks
  for delete using (public.can_host_potluck(id));

revoke update on public.potlucks from anon, authenticated;

-- The old Potluck-only hosts and RSVPs now live on the Gathering.
drop trigger potluck_creator_hosts on public.potlucks;
drop trigger after_potluck_update on public.potlucks;
drop function public.add_potluck_creator_as_host();
drop table public.potluck_rsvps;
drop table public.potluck_hosts;
drop function public.notify_potluck_rsvp();
drop function public.notify_potluck_changed();
drop function public.gathering_in_burrow(uuid, uuid);
drop function public.potluck_burrow(uuid);

-- ===========================================================================
-- 7. Notices (GATH-008)
-- ===========================================================================

-- Settings live with the Gathering Nook (keys also in lib/nook-settings.ts —
-- rename in both places or not at all).
create function public.gathering_notice(
  recipient uuid,
  setting text,
  fallback boolean,
  notice_kind text,
  notice_title text,
  notice_body text,
  target_gathering uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if recipient is null or recipient is not distinct from auth.uid() or public.is_managed_profile(recipient) then
    return;
  end if;
  if not coalesce((
    select (settings ->> setting)::boolean
    from public.nook_settings
    where profile_id = recipient and nook = 'gatherings'
  ), fallback) then
    return;
  end if;
  -- A change made twice before it's read is one notice, not two.
  delete from public.notifications
  where profile_id = recipient and nook = 'gatherings' and kind = notice_kind
    and read_at is null and data ->> 'gathering_id' = target_gathering::text
    and notice_kind in ('gathering_changed', 'gathering_rsvp', 'gathering_soon');
  insert into public.notifications (profile_id, nook, kind, title, body, data)
  values (recipient, 'gatherings', notice_kind, notice_title, notice_body, jsonb_build_object('gathering_id', target_gathering));
end;
$$;

revoke execute on function public.gathering_notice(uuid, text, boolean, text, text, text, uuid) from public, anon, authenticated;

-- "Sat, Feb 14" for notices. Notices are made on the server, which doesn't
-- know the phone's time zone, so only the day is said.
create function public.gathering_day(target_gathering uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  -- ends_at is the end of the chosen day on the phone; noon that day is the
  -- same date in UTC for nearly every time zone.
  select to_char((ends_at - interval '12 hours') at time zone 'UTC', 'FMDy, FMMon FMDD') from public.gatherings where id = target_gathering;
$$;

revoke execute on function public.gathering_day(uuid) from public, anon, authenticated;

-- Someone said they're coming (or not): tell the hosts.
create function public.notify_gathering_rsvp()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  host uuid;
  title text;
  who text := public.person_name(new.profile_id);
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return new;
  end if;
  select g.title into title from public.gatherings g where g.id = new.gathering_id;
  for host in select profile_id from public.gathering_hosts where gathering_id = new.gathering_id loop
    continue when host = new.profile_id;
    perform public.gathering_notice(
      host, 'notifyRsvps', true, 'gathering_rsvp',
      case new.status
        when 'going' then who || ' is coming'
        when 'maybe' then who || ' might come'
        else who || ' can''t make it'
      end,
      title,
      new.gathering_id
    );
  end loop;
  return new;
end;
$$;

create trigger after_gathering_rsvp
  after insert or update on public.gathering_rsvps
  for each row execute function public.notify_gathering_rsvp();

-- A Potluck added to a Gathering that was already planned: tell the guests
-- (one planned together with its Gathering is in the invite already).
create or replace function public.notify_new_potluck()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recipient uuid;
  made_now boolean;
begin
  select g.created_at = now() into made_now from public.gatherings g where g.id = new.gathering_id;
  if made_now then
    return new;
  end if;
  for recipient in select public.gathering_guest_ids(new.gathering_id) loop
    continue when recipient is not distinct from coalesce(new.created_by, auth.uid());
    perform public.potluck_notice(
      recipient, 'notifyNew', true, 'potluck_new',
      public.person_name(coalesce(new.created_by, auth.uid())) || ' started a Potluck for ' || new.title,
      'Tap to see what to bring',
      new.id
    );
  end loop;
  return new;
end;
$$;

-- A dish signed up: tell the Gathering's hosts.
create or replace function public.notify_potluck_dish()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  host uuid;
  title text;
  target_gathering uuid;
begin
  select p.title, p.gathering_id into title, target_gathering from public.potlucks p where p.id = new.potluck_id;
  for host in select profile_id from public.gathering_hosts where gathering_id = target_gathering loop
    continue when host is not distinct from auth.uid() or host = new.brought_by;
    perform public.potluck_notice(
      host, 'notifyDishes', false, 'potluck_dish',
      public.person_name(new.brought_by) || ' is bringing ' || new.name,
      title,
      new.potluck_id
    );
  end loop;
  return new;
end;
$$;

-- ===========================================================================
-- 8. Planning and changing a Gathering (GATH-002..007)
-- ===========================================================================

-- Who you may invite: Burrows you're in, and people who share a Burrow with
-- you (or a kid you look after, or you).
create function public.check_gathering_invites(burrow_ids uuid[], guest_ids uuid[])
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
begin
  if exists (select 1 from unnest(coalesce(burrow_ids, '{}')) b where not public.is_burrow_member(b)) then
    raise exception 'You can only invite Burrows you''re in' using errcode = '42501';
  end if;
  if exists (
    select 1 from unnest(coalesce(guest_ids, '{}')) p
    where p <> caller and not public.shares_burrow_with(caller, p) and not public.manages_profile(p)
  ) then
    raise exception 'You can only invite people from your Burrows' using errcode = '42501';
  end if;
end;
$$;

-- Who it's for and who co-hosts must be on the guest list (or be `allowed`:
-- you, and hosts it already has); co-hosts can't be kids.
create function public.check_gathering_roles(
  burrow_ids uuid[],
  guest_ids uuid[],
  honoree_ids uuid[],
  cohost_ids uuid[],
  allowed uuid[]
)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  everyone uuid[];
begin
  if coalesce(cardinality(burrow_ids), 0) + coalesce(cardinality(guest_ids), 0) = 0 then
    raise exception 'Invite a Burrow or at least one person' using errcode = '22023';
  end if;
  select array_agg(distinct x) into everyone from (
    select unnest(array[auth.uid()] || coalesce(allowed, '{}')) as x
    union select unnest(coalesce(guest_ids, '{}'))
    union select m.profile_id from public.burrow_members m where m.burrow_id = any(coalesce(burrow_ids, '{}'))
  ) people;
  if exists (select 1 from unnest(coalesce(cohost_ids, '{}')) h where public.is_managed_profile(h) or not h = any(everyone)) then
    raise exception 'Co-hosts have to be invited, and can''t be kids' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(coalesce(honoree_ids, '{}')) h where not h = any(everyone)) then
    raise exception 'Who it''s for has to be invited' using errcode = '22023';
  end if;
end;
$$;

revoke execute on function public.check_gathering_invites(uuid[], uuid[]) from public, anon, authenticated;
revoke execute on function public.check_gathering_roles(uuid[], uuid[], uuid[], uuid[], uuid[]) from public, anon, authenticated;

-- Plan a Gathering with its guest list in one go, so everyone invited hears
-- about it once and nothing is left half-made. Returns its id.
create function public.plan_gathering(
  gathering_title text,
  gathering_kind text,
  gathering_ends_at timestamptz,
  gathering_starts_at timestamptz,
  gathering_place text,
  gathering_notes text,
  with_gifts boolean,
  with_food boolean,
  burrow_ids uuid[],
  guest_ids uuid[],
  honoree_ids uuid[],
  cohost_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  new_gathering uuid;
  recipient uuid;
  maker text;
begin
  if caller is null or public.is_managed_profile(caller) then
    raise exception 'Sign in first';
  end if;
  if coalesce(trim(gathering_title), '') = '' then
    raise exception 'Give it a name' using errcode = '22023';
  end if;
  perform public.check_gathering_invites(burrow_ids, guest_ids);
  perform public.check_gathering_roles(burrow_ids, guest_ids, honoree_ids, cohost_ids, '{}');

  insert into public.gatherings (burrow_id, title, kind, ends_at, starts_at, place, notes, gifts, created_by)
  values (
    (coalesce(burrow_ids, '{}'))[1],
    left(trim(gathering_title), 120),
    coalesce(nullif(gathering_kind, ''), 'other'),
    gathering_ends_at,
    gathering_starts_at,
    nullif(left(trim(coalesce(gathering_place, '')), 120), ''),
    nullif(left(trim(coalesce(gathering_notes, '')), 500), ''),
    coalesce(with_gifts, false),
    caller
  )
  returning id into new_gathering;

  insert into public.gathering_burrows (gathering_id, burrow_id)
  select distinct new_gathering, b from unnest(coalesce(burrow_ids, '{}')) b;
  insert into public.gathering_guests (gathering_id, profile_id)
  select distinct new_gathering, p from unnest(coalesce(guest_ids, '{}')) p;
  insert into public.gathering_hosts (gathering_id, profile_id)
  select distinct new_gathering, h from unnest(array[caller] || coalesce(cohost_ids, '{}')) h;
  insert into public.gathering_honorees (gathering_id, profile_id)
  select distinct new_gathering, h from unnest(coalesce(honoree_ids, '{}')) h;

  if with_food then
    insert into public.potlucks (gathering_id, title, starts_at, created_by)
    values (new_gathering, 'Potluck', coalesce(gathering_starts_at, gathering_ends_at), caller);
  end if;

  maker := public.person_name(caller);
  for recipient in select public.gathering_guest_ids(new_gathering) loop
    perform public.gathering_notice(
      recipient, 'notifyInvites', true, 'gathering_invite',
      maker || ' invited you to ' || left(trim(gathering_title), 120),
      public.gathering_day(new_gathering),
      new_gathering
    );
  end loop;
  return new_gathering;
end;
$$;

-- Change a Gathering and its guest list (hosts only). Newly invited people
-- hear about it; everyone still coming hears if the day, time or place moved.
create function public.update_gathering(
  target_gathering uuid,
  gathering_title text,
  gathering_kind text,
  gathering_ends_at timestamptz,
  gathering_starts_at timestamptz,
  gathering_place text,
  gathering_notes text,
  with_gifts boolean,
  burrow_ids uuid[],
  guest_ids uuid[],
  honoree_ids uuid[],
  cohost_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  before_row public.gatherings;
  before_ids uuid[];
  recipient uuid;
  what text[] := '{}';
  new_place text := nullif(left(trim(coalesce(gathering_place, '')), 120), '');
  existing_hosts uuid[];
begin
  if not public.can_host_gathering(target_gathering) then
    raise exception 'Only the hosts can change this Gathering' using errcode = '42501';
  end if;
  if coalesce(trim(gathering_title), '') = '' then
    raise exception 'Give it a name' using errcode = '22023';
  end if;
  select * into before_row from public.gatherings where id = target_gathering for update;
  select array_agg(x) into before_ids from public.gathering_guest_ids(target_gathering) as t(x);
  select array_agg(profile_id) into existing_hosts from public.gathering_hosts where gathering_id = target_gathering;

  -- Burrows and people already on the list stay allowed even if you couldn't
  -- add them yourself (another host did), so only check what's new.
  perform public.check_gathering_invites(
    array(select b from unnest(coalesce(burrow_ids, '{}')) b
          where not exists (select 1 from public.gathering_burrows where gathering_id = target_gathering and burrow_id = b)),
    array(select p from unnest(coalesce(guest_ids, '{}')) p
          where not exists (select 1 from public.gathering_guests where gathering_id = target_gathering and profile_id = p))
  );
  perform public.check_gathering_roles(burrow_ids, guest_ids, honoree_ids, cohost_ids, existing_hosts);

  update public.gatherings
  set title = left(trim(gathering_title), 120),
      kind = coalesce(nullif(gathering_kind, ''), 'other'),
      ends_at = gathering_ends_at,
      starts_at = gathering_starts_at,
      place = new_place,
      notes = nullif(left(trim(coalesce(gathering_notes, '')), 500), ''),
      gifts = coalesce(with_gifts, false),
      burrow_id = coalesce((coalesce(burrow_ids, '{}'))[1], burrow_id)
  where id = target_gathering;

  delete from public.gathering_burrows where gathering_id = target_gathering and not burrow_id = any(coalesce(burrow_ids, '{}'));
  insert into public.gathering_burrows (gathering_id, burrow_id)
  select distinct target_gathering, b from unnest(coalesce(burrow_ids, '{}')) b on conflict do nothing;
  delete from public.gathering_guests where gathering_id = target_gathering and not profile_id = any(coalesce(guest_ids, '{}'));
  insert into public.gathering_guests (gathering_id, profile_id)
  select distinct target_gathering, p from unnest(coalesce(guest_ids, '{}')) p on conflict do nothing;

  -- Hosts: the ones kept, plus new co-hosts. A Gathering that had none
  -- (automatic birthdays) stays open to everyone unless hosts are picked.
  delete from public.gathering_hosts where gathering_id = target_gathering and not profile_id = any(coalesce(cohost_ids, '{}'));
  insert into public.gathering_hosts (gathering_id, profile_id)
  select distinct target_gathering, h from unnest(coalesce(cohost_ids, '{}')) h on conflict do nothing;

  delete from public.gathering_honorees where gathering_id = target_gathering and not profile_id = any(coalesce(honoree_ids, '{}'));
  insert into public.gathering_honorees (gathering_id, profile_id)
  select distinct target_gathering, h from unnest(coalesce(honoree_ids, '{}')) h on conflict do nothing;

  -- Anyone no longer invited loses their RSVP.
  delete from public.gathering_rsvps r
  where r.gathering_id = target_gathering and not public.gathering_has_guest(target_gathering, r.profile_id);

  for recipient in
    select x from public.gathering_guest_ids(target_gathering) as t(x) where not x = any(coalesce(before_ids, '{}'))
  loop
    perform public.gathering_notice(
      recipient, 'notifyInvites', true, 'gathering_invite',
      public.person_name(caller) || ' invited you to ' || left(trim(gathering_title), 120),
      public.gathering_day(target_gathering),
      target_gathering
    );
  end loop;

  if gathering_ends_at is distinct from before_row.ends_at then what := what || 'day'; end if;
  if gathering_starts_at is distinct from before_row.starts_at then what := what || 'time'; end if;
  if new_place is distinct from before_row.place then what := what || 'place'; end if;
  if cardinality(what) > 0 then
    for recipient in
      select x from public.gathering_guest_ids(target_gathering) as t(x)
      where x = any(coalesce(before_ids, '{}'))
        and not exists (select 1 from public.gathering_rsvps r where r.gathering_id = target_gathering and r.profile_id = x and r.status = 'no')
    loop
      perform public.gathering_notice(
        recipient, 'notifyChanged', true, 'gathering_changed',
        left(trim(gathering_title), 120) || ' changed',
        'The ' || array_to_string(what, ' and ') || ' changed',
        target_gathering
      );
    end loop;
  end if;
end;
$$;

-- Add a Potluck to a Gathering that doesn't have one (hosts). Returns it.
create function public.add_potluck(target_gathering uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  existing uuid;
  new_potluck uuid;
begin
  if not public.can_host_gathering(target_gathering) then
    raise exception 'Only the hosts can add a Potluck' using errcode = '42501';
  end if;
  select id into existing from public.potlucks where gathering_id = target_gathering limit 1;
  if existing is not null then
    return existing;
  end if;
  insert into public.potlucks (gathering_id, title, starts_at, created_by)
  values (target_gathering, 'Potluck', now(), auth.uid())
  returning id into new_potluck;
  return new_potluck;
end;
$$;

-- The guest list for the Gathering screen: everyone invited, how (a Burrow
-- or one by one), their RSVP, whether they host, and whether you can open
-- their Wishbook (only people you share a Burrow with — GIFT-007's rules for
-- Wishbooks are unchanged). Names and pictures of the other guests are
-- shown even if you don't share a Burrow with them: you're at the same party.
create function public.gathering_guest_list(target_gathering uuid)
returns table (
  profile_id uuid,
  display_name text,
  avatar_icon text,
  avatar_color text,
  avatar_path text,
  is_managed boolean,
  is_host boolean,
  invited_alone boolean,
  status text,
  extra_guests int,
  can_see_wishbook boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.display_name, p.avatar_icon, p.avatar_color, p.avatar_path, p.is_managed,
    exists (select 1 from public.gathering_hosts h where h.gathering_id = target_gathering and h.profile_id = p.id),
    exists (select 1 from public.gathering_guests g where g.gathering_id = target_gathering and g.profile_id = p.id),
    r.status,
    coalesce(r.extra_guests, 0),
    p.id = (select auth.uid()) or public.shares_burrow_with((select auth.uid()), p.id) or public.manages_profile(p.id)
  from public.gathering_guest_ids(target_gathering) as ids(guest_id)
  join public.profiles p on p.id = ids.guest_id
  left join public.gathering_rsvps r on r.gathering_id = target_gathering and r.profile_id = p.id
  where public.can_see_gathering(target_gathering)
  order by p.display_name;
$$;

revoke execute on function public.plan_gathering(text, text, timestamptz, timestamptz, text, text, boolean, boolean, uuid[], uuid[], uuid[], uuid[]) from public, anon;
grant execute on function public.plan_gathering(text, text, timestamptz, timestamptz, text, text, boolean, boolean, uuid[], uuid[], uuid[], uuid[]) to authenticated;
revoke execute on function public.update_gathering(uuid, text, text, timestamptz, timestamptz, text, text, boolean, uuid[], uuid[], uuid[], uuid[]) from public, anon;
grant execute on function public.update_gathering(uuid, text, text, timestamptz, timestamptz, text, text, boolean, uuid[], uuid[], uuid[], uuid[]) to authenticated;
revoke execute on function public.add_potluck(uuid) from public, anon;
grant execute on function public.add_potluck(uuid) to authenticated;
revoke execute on function public.gathering_guest_list(uuid) from public, anon;
grant execute on function public.gathering_guest_list(uuid) to authenticated;

-- ===========================================================================
-- 9. The Gift Nook, now by guest list instead of Burrow
-- ===========================================================================

-- Automatic Birthday Gatherings (GIFT-035) invite their Burrow and have no
-- hosts, so anyone in it can change them, as before.
create or replace function public.plan_birthday(
  target_burrow uuid,
  target_profile uuid,
  birthday_year int,
  gathering_title text,
  gathering_ends_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  this_year int := extract(year from now())::int;
  new_gathering uuid;
begin
  if caller is null
     or not public.is_burrow_member(target_burrow)
     or not public.burrow_has_member(target_burrow, target_profile) then
    raise exception 'You can only plan birthdays for people in your own Burrows';
  end if;
  if not exists (select 1 from public.profiles where id = target_profile and birthday is not null) then
    raise exception 'They have not shared a birthday';
  end if;
  if birthday_year not between this_year and this_year + 1
     or gathering_ends_at < now() - interval '2 days'
     or gathering_ends_at > now() + interval '400 days'
     or coalesce(trim(gathering_title), '') = '' then
    raise exception 'That birthday does not look right';
  end if;

  insert into public.birthday_gatherings (burrow_id, profile_id, year)
  values (target_burrow, target_profile, birthday_year)
  on conflict do nothing;

  -- Already planned (or planned and then deleted): nothing to do.
  if not found then
    return null;
  end if;

  insert into public.gatherings (burrow_id, title, kind, ends_at, created_by, gifts)
  values (target_burrow, left(trim(gathering_title), 120), 'birthday', gathering_ends_at, caller, true)
  returning id into new_gathering;
  insert into public.gathering_burrows (gathering_id, burrow_id) values (new_gathering, target_burrow);
  insert into public.gathering_honorees (gathering_id, profile_id) values (new_gathering, target_profile);

  update public.birthday_gatherings
  set gathering_id = new_gathering
  where burrow_id = target_burrow and profile_id = target_profile and year = birthday_year;

  return new_gathering;
end;
$$;

-- "Did you receive any of these?" — for someone invited to the Gathering.
create or replace function public.mark_received(
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
  if not public.gathering_has_guest(target_gathering, for_profile) then
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

-- A tuck is linked to a Gathering only if its giver is invited to it.
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
  -- would reject is rejected here first with the identical error, before
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
  if new.gathering_id is not null and not public.gathering_has_guest(new.gathering_id, caller) then
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

-- "Coming up" reminders now go to everyone invited (not those who said they
-- can't make it), from the Gathering Nook. The rest is unchanged.
create or replace function public.gift_nook_daily()
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
    select id, title, ends_at from public.gatherings
    where ends_at > now() and ends_at < now() + interval '8 days'
  loop
    days_left := floor(extract(epoch from (gathering.ends_at - now())) / 86400);
    if days_left in (7, 1) then
      for member in
        select x from public.gathering_guest_ids(gathering.id) as t(x)
        where not exists (
          select 1 from public.gathering_rsvps r where r.gathering_id = gathering.id and r.profile_id = x and r.status = 'no'
        )
      loop
        perform public.gathering_notice(
          member, 'notifySoon', true, 'gathering_soon',
          gathering.title || case when days_left = 1 then ' is tomorrow' else ' is in a week' end,
          null,
          gathering.id
        );
      end loop;
    end if;
  end loop;

  -- 30 days after a Gathering ends, any tuck made for it that the owner
  -- didn't confirm as received is released, "bought" included. Until then
  -- a bought tuck keeps showing as Bought to other givers. Only the owner
  -- checking it off (mark_received) takes a gift off their list.
  update public.claims c set released_at = now()
  from public.gatherings g
  where c.gathering_id = g.id and g.ends_at < now() - interval '30 days'
    and c.released_at is null and c.status in ('planning', 'bought');

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

-- ===========================================================================
-- 10. Hand-off: a kid's invitations and RSVPs come with them (HOME-010)
-- ===========================================================================

-- Same as the profile_photos migration, with Gathering invites and RSVPs in
-- place of the old Potluck hosts and RSVPs.

create or replace function public.accept_handoff(handoff_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  kid uuid;
  handed_by uuid;
  kid_profile public.profiles;
  my_wishbook uuid;
  kid_wishbook uuid;
  kid_home uuid;
  invite uuid;
begin
  if caller is null then
    raise exception 'Sign in first';
  end if;
  if public.is_managed_profile(caller) then
    raise exception 'Sign in with your own account first';
  end if;

  select profile_id, created_by into kid, handed_by
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

  select * into kid_profile from public.profiles where id = kid;
  select id into my_wishbook from public.wishbooks where owner_id = caller;
  select id into kid_wishbook from public.wishbooks where owner_id = kid;

  -- Their name, picture (photo too), birthday and "about me", where the new
  -- account has none. The photo stays in the kid's old folder, which
  -- check_avatar_path() allows for this one update.
  perform set_config('nook.photo_handoff', kid::text, true);
  update public.profiles
  set display_name = case when display_name is null or display_name like '%@%' then kid_profile.display_name else display_name end,
      avatar_icon = coalesce(avatar_icon, kid_profile.avatar_icon),
      avatar_color = coalesce(avatar_color, kid_profile.avatar_color),
      birthday = coalesce(birthday, kid_profile.birthday),
      bio = coalesce(bio, kid_profile.bio),
      avatar_path = coalesce(avatar_path, kid_profile.avatar_path)
  where id = caller;
  perform set_config('nook.photo_handoff', '', true);

  -- The Gift Nook, as before.
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

  insert into public.birthday_gatherings (burrow_id, profile_id, year, gathering_id, created_at)
  select burrow_id, caller, year, gathering_id, created_at from public.birthday_gatherings where profile_id = kid
  on conflict do nothing;

  -- Allergies and diets, merged with any they've already set.
  insert into public.dietary_needs as dn (profile_id, allergies, diets)
  select caller, k.allergies, k.diets from public.dietary_needs k where k.profile_id = kid
  on conflict (profile_id) do update set
    allergies = (select coalesce(array_agg(distinct a), '{}') from unnest(dn.allergies || excluded.allergies) a),
    diets = (select coalesce(array_agg(distinct d), '{}') from unnest(dn.diets || excluded.diets) d);

  -- Gatherings they were invited to on their own, their RSVPs, and their
  -- Potluck dishes. (Kids never host.)
  insert into public.gathering_guests (gathering_id, profile_id)
  select gathering_id, caller from public.gathering_guests where profile_id = kid
  on conflict do nothing;
  insert into public.gathering_rsvps (gathering_id, profile_id, status, extra_guests, updated_at)
  select gathering_id, caller, status, extra_guests, updated_at from public.gathering_rsvps where profile_id = kid
  on conflict do nothing;
  update public.potluck_dishes set brought_by = caller where brought_by = kid;

  -- Getaways: the trips they're going on, their packing list, their share.
  insert into public.getaway_people (getaway_id, profile_id, added_by, added_at)
  select getaway_id, caller, added_by, added_at from public.getaway_people where profile_id = kid
  on conflict do nothing;
  update public.getaway_items set for_person = caller where for_person = kid;
  update public.getaway_costs set split_among = array_replace(split_among, kid, caller) where kid = any(split_among);
  update public.getaway_costs set paid_by = caller where paid_by = kid;

  -- The Letterbox, other people's private ideas about them, and sick days.
  update public.letterbox_people set profile_id = caller where profile_id = kid;
  update public.idea_stash set about_id = caller where about_id = kid;
  update public.sick_spells s set patient_id = caller
  where s.patient_id = kid
    and not (s.ended_on is null and exists (
      select 1 from public.sick_spells o where o.home_id = s.home_id and o.patient_id = caller and o.ended_on is null
    ));
  update public.sick_medicines set for_profile = caller where for_profile = kid;

  -- Their place in the Home: the kid's seat becomes theirs.
  select home_id into kid_home from public.home_kids where kid_id = kid;
  if kid_home is not null then
    delete from public.home_kids where kid_id = kid;
    insert into public.home_invites (home_id, invited, invited_by)
    values (kid_home, caller, handed_by)
    on conflict (home_id, invited) do update set invited_by = excluded.invited_by
    returning id into invite;
    perform public.accept_home_invite(invite);
  end if;

  delete from public.profiles where id = kid;
end;
$$;
