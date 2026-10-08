-- Potluck Nook (POT-001..008) and allergies/dietary needs (PROF-004).
--
--   dietary_needs ........ PROF-004: allergies and diets, per person
--   potlucks ............. POT-001/002: belongs to a Burrow, optionally a Gathering
--   potluck_hosts ........ POT-008: host + co-hosts
--   potluck_slots ........ POT-003: what the host asks for ("2 sides")
--   potluck_dishes ....... POT-003/004: who's bringing what, tagged
--   potluck_rsvps ........ POT-006: going / maybe / no, plus a headcount
--   potluck_daily() ...... POT-007: day-before reminders, tidying up
--
-- Nothing here touches gifts or claims, so GIFT-007 is unaffected.

-- ===========================================================================
-- 1. Allergies and diets (PROF-004)
-- ===========================================================================

-- Kept off public.profiles on purpose: profiles are also visible to
-- "co-givers" in other families (appears_on_visible_gift), and health
-- details should only reach family in your own Burrows and a kid's managers.
create table public.dietary_needs (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  allergies text[] not null default '{}' check (cardinality(allergies) <= 20),
  diets text[] not null default '{}' check (cardinality(diets) <= 20),
  updated_at timestamptz not null default now()
);

alter table public.dietary_needs enable row level security;

create policy "dietary_needs visible to self, managers, and Burrow family" on public.dietary_needs
  for select using (
    profile_id = (select auth.uid())
    or public.manages_profile(profile_id)
    or public.shares_burrow_with((select auth.uid()), profile_id)
  );

create policy "dietary_needs added by self or managers" on public.dietary_needs
  for insert with check (profile_id = (select auth.uid()) or public.manages_profile(profile_id));

create policy "dietary_needs edited by self or managers" on public.dietary_needs
  for update using (profile_id = (select auth.uid()) or public.manages_profile(profile_id))
  with check (profile_id = (select auth.uid()) or public.manages_profile(profile_id));

create policy "dietary_needs cleared by self or managers" on public.dietary_needs
  for delete using (profile_id = (select auth.uid()) or public.manages_profile(profile_id));

-- ===========================================================================
-- 2. Tables
-- ===========================================================================

create table public.potlucks (
  id uuid primary key default gen_random_uuid(),
  burrow_id uuid not null references public.burrows (id) on delete cascade,
  -- Tied to a Gathering (POT-002), or null for a standalone Potluck. If the
  -- Gathering is deleted, the Potluck carries on on its own.
  gathering_id uuid references public.gatherings (id) on delete set null,
  title text not null check (char_length(trim(title)) between 1 and 80),
  starts_at timestamptz not null,
  place text check (place is null or char_length(place) <= 120),
  notes text check (notes is null or char_length(notes) <= 500),
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index potlucks_burrow on public.potlucks (burrow_id, starts_at);
create index potlucks_gathering on public.potlucks (gathering_id);

create table public.potluck_hosts (
  potluck_id uuid not null references public.potlucks (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  primary key (potluck_id, profile_id)
);

create table public.potluck_slots (
  id uuid primary key default gen_random_uuid(),
  potluck_id uuid not null references public.potlucks (id) on delete cascade,
  label text not null check (char_length(trim(label)) between 1 and 60),
  wanted int not null default 1 check (wanted between 1 and 20),
  position int not null default 0
);

create index potluck_slots_potluck on public.potluck_slots (potluck_id, position);

create table public.potluck_dishes (
  id uuid primary key default gen_random_uuid(),
  potluck_id uuid not null references public.potlucks (id) on delete cascade,
  -- The slot it fills, or null for a dish someone just added.
  slot_id uuid references public.potluck_slots (id) on delete set null,
  brought_by uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  name text not null check (char_length(trim(name)) between 1 and 80),
  tags text[] not null default '{}' check (cardinality(tags) <= 20),
  note text check (note is null or char_length(note) <= 200),
  created_at timestamptz not null default now()
);

create index potluck_dishes_potluck on public.potluck_dishes (potluck_id);

create table public.potluck_rsvps (
  potluck_id uuid not null references public.potlucks (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  status text not null check (status in ('going', 'maybe', 'no')),
  extra_guests int not null default 0 check (extra_guests between 0 and 20),
  updated_at timestamptz not null default now(),
  primary key (potluck_id, profile_id)
);

alter table public.potlucks enable row level security;
alter table public.potluck_hosts enable row level security;
alter table public.potluck_slots enable row level security;
alter table public.potluck_dishes enable row level security;
alter table public.potluck_rsvps enable row level security;

-- ===========================================================================
-- 3. Helpers (security definer so they don't re-enter RLS)
-- ===========================================================================

create function public.potluck_burrow(target_potluck uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select burrow_id from public.potlucks where id = target_potluck;
$$;

-- Anyone in the Potluck's Burrow is invited and can see it (POT-002).
create function public.can_see_potluck(target_potluck uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.is_burrow_member(public.potluck_burrow(target_potluck)), false);
$$;

-- Hosts and co-hosts can change a Potluck; Burrow admins can step in (POT-008).
create function public.can_host_potluck(target_potluck uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_see_potluck(target_potluck) and (
    exists (
      select 1 from public.potluck_hosts
      where potluck_id = target_potluck and profile_id = (select auth.uid())
    )
    or public.is_burrow_admin(public.potluck_burrow(target_potluck))
  );
$$;

create function public.gathering_in_burrow(target_gathering uuid, target_burrow uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.gatherings where id = target_gathering and burrow_id = target_burrow
  );
$$;

create function public.slot_in_potluck(target_slot uuid, target_potluck uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.potluck_slots where id = target_slot and potluck_id = target_potluck
  );
$$;

-- ===========================================================================
-- 4. Row level security
-- ===========================================================================

-- potlucks ------------------------------------------------------------------
create policy "potlucks visible to burrow members" on public.potlucks
  for select using (public.is_burrow_member(burrow_id));

create policy "potlucks created by burrow members" on public.potlucks
  for insert with check (
    public.is_burrow_member(burrow_id)
    and created_by = (select auth.uid())
    and (gathering_id is null or public.gathering_in_burrow(gathering_id, burrow_id))
  );

create policy "potlucks edited by hosts" on public.potlucks
  for update using (public.can_host_potluck(id))
  with check (gathering_id is null or public.gathering_in_burrow(gathering_id, burrow_id));

create policy "potlucks deleted by hosts" on public.potlucks
  for delete using (public.can_host_potluck(id));

-- A Potluck can't be moved to another Burrow or re-attributed.
revoke update on public.potlucks from anon, authenticated;
grant update (title, starts_at, place, notes, gathering_id) on public.potlucks to authenticated;

-- Whoever makes a Potluck is its first host.
create function public.add_potluck_creator_as_host()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.created_by is not null then
    insert into public.potluck_hosts (potluck_id, profile_id)
    values (new.id, new.created_by)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

create trigger potluck_creator_hosts
  after insert on public.potlucks
  for each row execute procedure public.add_potluck_creator_as_host();

-- potluck_hosts -------------------------------------------------------------
create policy "potluck_hosts visible to guests" on public.potluck_hosts
  for select using (public.can_see_potluck(potluck_id));

-- Hosts add co-hosts from the Burrow (not kids, who can't sign in).
create policy "potluck_hosts added by hosts" on public.potluck_hosts
  for insert with check (
    public.can_host_potluck(potluck_id)
    and public.burrow_has_member(public.potluck_burrow(potluck_id), profile_id)
    and not public.is_managed_profile(profile_id)
  );

create policy "potluck_hosts removed by hosts" on public.potluck_hosts
  for delete using (public.can_host_potluck(potluck_id));

-- potluck_slots -------------------------------------------------------------
create policy "potluck_slots visible to guests" on public.potluck_slots
  for select using (public.can_see_potluck(potluck_id));

create policy "potluck_slots added by hosts" on public.potluck_slots
  for insert with check (public.can_host_potluck(potluck_id));

create policy "potluck_slots edited by hosts" on public.potluck_slots
  for update using (public.can_host_potluck(potluck_id))
  with check (public.can_host_potluck(potluck_id));

create policy "potluck_slots removed by hosts" on public.potluck_slots
  for delete using (public.can_host_potluck(potluck_id));

-- potluck_dishes ------------------------------------------------------------
create policy "potluck_dishes visible to guests" on public.potluck_dishes
  for select using (public.can_see_potluck(potluck_id));

-- You can only sign yourself up to bring something.
create policy "potluck_dishes added by guests for themselves" on public.potluck_dishes
  for insert with check (
    public.can_see_potluck(potluck_id)
    and brought_by = (select auth.uid())
    and (slot_id is null or public.slot_in_potluck(slot_id, potluck_id))
  );

create policy "potluck_dishes edited by whoever brings them" on public.potluck_dishes
  for update using (brought_by = (select auth.uid()))
  with check (
    brought_by = (select auth.uid())
    and (slot_id is null or public.slot_in_potluck(slot_id, potluck_id))
  );

-- Hosts can take a dish off too (e.g. someone who can't come any more).
create policy "potluck_dishes removed by whoever brings them, or hosts" on public.potluck_dishes
  for delete using (brought_by = (select auth.uid()) or public.can_host_potluck(potluck_id));

revoke update on public.potluck_dishes from anon, authenticated;
grant update (slot_id, name, tags, note) on public.potluck_dishes to authenticated;

-- A slot takes only as many dishes as the host asked for — so two people
-- can't both grab the last "dessert" at the same moment.
create function public.enforce_slot_room()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  room int;
  taken int;
begin
  if new.slot_id is null or (tg_op = 'UPDATE' and new.slot_id is not distinct from old.slot_id) then
    return new;
  end if;
  select wanted into room from public.potluck_slots where id = new.slot_id for update;
  select count(*) into taken from public.potluck_dishes where slot_id = new.slot_id and id <> new.id;
  if taken >= room then
    raise exception 'That spot is already taken care of — add your dish without a spot instead';
  end if;
  return new;
end;
$$;

create trigger potluck_dish_slot_room
  before insert or update of slot_id on public.potluck_dishes
  for each row execute procedure public.enforce_slot_room();

-- potluck_rsvps -------------------------------------------------------------
create policy "potluck_rsvps visible to guests" on public.potluck_rsvps
  for select using (public.can_see_potluck(potluck_id));

-- RSVP for yourself, or for a kid you manage (POT-006), as long as they're
-- in the Potluck's Burrow.
create policy "potluck_rsvps added for self or managed kids" on public.potluck_rsvps
  for insert with check (
    public.can_see_potluck(potluck_id)
    and (profile_id = (select auth.uid()) or public.manages_profile(profile_id))
    and public.burrow_has_member(public.potluck_burrow(potluck_id), profile_id)
  );

create policy "potluck_rsvps changed for self or managed kids" on public.potluck_rsvps
  for update using (profile_id = (select auth.uid()) or public.manages_profile(profile_id))
  with check (
    public.can_see_potluck(potluck_id)
    and (profile_id = (select auth.uid()) or public.manages_profile(profile_id))
  );

create policy "potluck_rsvps cleared for self or managed kids" on public.potluck_rsvps
  for delete using (profile_id = (select auth.uid()) or public.manages_profile(profile_id));

-- ===========================================================================
-- 5. Reminders and tidying up (POT-007)
-- ===========================================================================

-- Potluck settings (nook_settings, 'potluck'); on unless turned off.
create function public.wants_potluck_reminder(recipient uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select recipient is not null
    and not public.is_managed_profile(recipient)
    and coalesce((
      select (settings ->> 'notifyReminder')::boolean
      from public.nook_settings
      where profile_id = recipient and nook = 'potluck'
    ), true);
$$;

-- Runs once a day. Each Potluck lands in exactly one day's 24-hour window
-- (9 to 33 hours ahead), so everyone bringing something gets one reminder
-- the day before.
create function public.potluck_daily()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  bringing record;
begin
  for bringing in
    select p.id as potluck_id, p.title, d.brought_by, string_agg(d.name, ', ' order by d.created_at) as dishes
    from public.potlucks p
    join public.potluck_dishes d on d.potluck_id = p.id
    where p.starts_at >= now() + interval '9 hours'
      and p.starts_at < now() + interval '33 hours'
    group by p.id, p.title, d.brought_by
  loop
    if public.wants_potluck_reminder(bringing.brought_by) then
      insert into public.notifications (profile_id, nook, kind, title, body, data)
      values (
        bringing.brought_by,
        'potluck',
        'potluck_reminder',
        'Tomorrow: ' || bringing.title,
        'You''re bringing ' || bringing.dishes,
        jsonb_build_object('potluck_id', bringing.potluck_id)
      );
    end if;
  end loop;

  -- Gone 90 days after the day, like Gatherings (proposed).
  delete from public.potlucks where starts_at < now() - interval '90 days';
end;
$$;

revoke execute on function public.potluck_daily() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.schedule('potluck-daily', '0 15 * * *', 'select public.potluck_daily()');
  else
    raise notice 'pg_cron not available — enable it, then schedule public.potluck_daily()';
  end if;
exception when others then
  raise notice 'Could not schedule potluck_daily (%): enable pg_cron in Database > Extensions', sqlerrm;
end;
$$;
