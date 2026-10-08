-- Pet Care Nook (PET-001..007).
--
--   pets ............. PET-002/006: belong to a Home; profile and records
--   pet_meals ........ PET-003: the meals set for each pet
--   pet_care_log ..... PET-003/005: meals fed, walks, potty, litter, treats
--   pet_health ....... PET-004: vet visits, vaccines, medications, due dates
--   pet_helpers ...... PET-002: a sitter or grandparent with access to one pet
--   pet_care_daily() . PET-007: missed-meal and due-date nudges
--   storage bucket pets  PET-006: photos
--
-- Nothing here touches gifts or claims, so GIFT-007 is unaffected.

-- ===========================================================================
-- 1. Tables
-- ===========================================================================

create table public.pets (
  id uuid primary key default gen_random_uuid(),
  home_id uuid not null references public.homes (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 40),
  species text not null default 'dog' check (species in ('dog', 'cat', 'bird', 'fish', 'rabbit', 'reptile', 'small', 'other')),
  breed text check (breed is null or char_length(breed) <= 60),
  birthday date,
  photo_path text check (photo_path is null or char_length(photo_path) <= 300),
  microchip text check (microchip is null or char_length(microchip) <= 40),
  vet_name text check (vet_name is null or char_length(vet_name) <= 80),
  vet_phone text check (vet_phone is null or char_length(vet_phone) <= 30),
  food text check (food is null or char_length(food) <= 120),
  notes text check (notes is null or char_length(notes) <= 600),
  -- The pet's time zone (from the phone that set it up), so "today" and
  -- meal reminders mean the right day.
  tz text not null default 'UTC' check (char_length(tz) <= 64),
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index pets_home on public.pets (home_id, name);

create table public.pet_meals (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets (id) on delete cascade,
  label text not null check (char_length(trim(label)) between 1 and 40),
  -- Nudge the Home if this meal isn't fed by this time of day (pet's time zone).
  remind_at time,
  last_nudged_day date,
  position int not null default 0
);

create index pet_meals_pet on public.pet_meals (pet_id, position);

create table public.pet_care_log (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets (id) on delete cascade,
  kind text not null check (kind in ('meal', 'walk', 'potty', 'litter', 'treat', 'other')),
  -- The set meal this fed (kind = 'meal'); null for the rest.
  meal_id uuid references public.pet_meals (id) on delete set null,
  done_by uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  done_at timestamptz not null default now(),
  -- The pet's local day it counts for, set by the phone.
  day date not null,
  note text check (note is null or char_length(note) <= 120),
  check (kind <> 'meal' or meal_id is not null)
);

create index pet_care_log_pet on public.pet_care_log (pet_id, done_at desc);
-- Nobody feeds twice: a set meal can be checked off once per day.
create unique index pet_care_log_one_meal_a_day on public.pet_care_log (meal_id, day) where kind = 'meal';

create table public.pet_health (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets (id) on delete cascade,
  kind text not null check (kind in ('vet', 'vaccine', 'medication', 'other')),
  title text not null check (char_length(trim(title)) between 1 and 80),
  due_on date,
  -- Comes round again this many days after it's done (null = once).
  repeat_days int check (repeat_days is null or repeat_days between 1 and 3660),
  last_done_on date,
  notes text check (notes is null or char_length(notes) <= 300),
  last_nudged_for date,
  created_at timestamptz not null default now()
);

create index pet_health_pet on public.pet_health (pet_id, due_on);

create table public.pet_helpers (
  pet_id uuid not null references public.pets (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  -- Their access ends after this day (null = until removed).
  until date,
  added_by uuid references public.profiles (id) on delete set null default auth.uid(),
  added_at timestamptz not null default now(),
  primary key (pet_id, profile_id)
);

create index pet_helpers_profile on public.pet_helpers (profile_id);

alter table public.pets enable row level security;
alter table public.pet_meals enable row level security;
alter table public.pet_care_log enable row level security;
alter table public.pet_health enable row level security;
alter table public.pet_helpers enable row level security;

-- ===========================================================================
-- 2. Helpers (security definer so they don't re-enter RLS)
-- ===========================================================================

create function public.pet_home(target_pet uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select home_id from public.pets where id = target_pet;
$$;

-- Everyone in the pet's Home can change it (PET-002).
create function public.can_edit_pet(target_pet uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.is_home_member(public.pet_home(target_pet)), false);
$$;

-- The Home, plus helpers whose time hasn't run out.
create function public.can_see_pet(target_pet uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_edit_pet(target_pet)
    or exists (
      select 1 from public.pet_helpers h
      where h.pet_id = target_pet
        and h.profile_id = (select auth.uid())
        and (h.until is null or h.until >= current_date)
    );
$$;

create function public.meal_in_pet(target_meal uuid, target_pet uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.pet_meals where id = target_meal and pet_id = target_pet);
$$;

-- Photos live at "<pet id>/<file>" in the pets bucket.
create function public.can_use_pet_photo(object_name text, writing boolean)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when split_part(object_name, '/', 1) ~ '^[0-9a-fA-F-]{36}$'
      then case when writing
        then public.can_edit_pet(split_part(object_name, '/', 1)::uuid)
        else public.can_see_pet(split_part(object_name, '/', 1)::uuid)
      end
    else false
  end;
$$;

-- ===========================================================================
-- 3. Row level security
-- ===========================================================================

create policy "pets visible to the Home and helpers" on public.pets
  for select using (public.can_see_pet(id));

create policy "pets added by the Home" on public.pets
  for insert with check (public.is_home_member(home_id) and created_by = (select auth.uid()));

create policy "pets changed by the Home" on public.pets
  for update using (public.can_edit_pet(id)) with check (public.can_edit_pet(id));

create policy "pets removed by the Home" on public.pets
  for delete using (public.can_edit_pet(id));

-- A pet can't move to another Home or be re-attributed.
revoke update on public.pets from anon, authenticated;
grant update (name, species, breed, birthday, photo_path, microchip, vet_name, vet_phone, food, notes, tz)
  on public.pets to authenticated;

create policy "pet_meals visible to the Home and helpers" on public.pet_meals
  for select using (public.can_see_pet(pet_id));
create policy "pet_meals set by the Home" on public.pet_meals
  for insert with check (public.can_edit_pet(pet_id));
create policy "pet_meals changed by the Home" on public.pet_meals
  for update using (public.can_edit_pet(pet_id)) with check (public.can_edit_pet(pet_id));
create policy "pet_meals removed by the Home" on public.pet_meals
  for delete using (public.can_edit_pet(pet_id));

revoke update on public.pet_meals from anon, authenticated;
grant update (label, remind_at, position) on public.pet_meals to authenticated;

-- Helpers can check things off too, but only as themselves.
create policy "pet_care_log visible to the Home and helpers" on public.pet_care_log
  for select using (public.can_see_pet(pet_id));
create policy "pet_care_log added as yourself" on public.pet_care_log
  for insert with check (
    public.can_see_pet(pet_id)
    and done_by = (select auth.uid())
    and (meal_id is null or public.meal_in_pet(meal_id, pet_id))
  );
-- Undo your own, or let the Home tidy up.
create policy "pet_care_log removed by whoever did it or the Home" on public.pet_care_log
  for delete using (done_by = (select auth.uid()) and public.can_see_pet(pet_id) or public.can_edit_pet(pet_id));

create policy "pet_health visible to the Home and helpers" on public.pet_health
  for select using (public.can_see_pet(pet_id));
create policy "pet_health added by the Home" on public.pet_health
  for insert with check (public.can_edit_pet(pet_id));
create policy "pet_health changed by the Home" on public.pet_health
  for update using (public.can_edit_pet(pet_id)) with check (public.can_edit_pet(pet_id));
create policy "pet_health removed by the Home" on public.pet_health
  for delete using (public.can_edit_pet(pet_id));

revoke update on public.pet_health from anon, authenticated;
grant update (kind, title, due_on, repeat_days, notes) on public.pet_health to authenticated;

-- Helpers: the Home hands them out from people they share a Burrow with
-- (not kids, who can't sign in); a helper can see their own and step away.
create policy "pet_helpers visible to the Home and the helper" on public.pet_helpers
  for select using (public.can_edit_pet(pet_id) or profile_id = (select auth.uid()));
create policy "pet_helpers added by the Home" on public.pet_helpers
  for insert with check (
    public.can_edit_pet(pet_id)
    and added_by = (select auth.uid())
    and profile_id <> (select auth.uid())
    and not public.is_managed_profile(profile_id)
    and public.shares_burrow_with((select auth.uid()), profile_id)
  );
create policy "pet_helpers changed by the Home" on public.pet_helpers
  for update using (public.can_edit_pet(pet_id)) with check (public.can_edit_pet(pet_id));
create policy "pet_helpers removed by the Home or the helper" on public.pet_helpers
  for delete using (public.can_edit_pet(pet_id) or profile_id = (select auth.uid()));

revoke update on public.pet_helpers from anon, authenticated;
grant update (until) on public.pet_helpers to authenticated;

-- Marking a vet visit, vaccine or medication done: anyone who can see the
-- pet (a sitter giving the meds, say). Repeating ones roll forward.
create function public.complete_pet_health(target_item uuid, on_day date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  item public.pet_health;
begin
  select * into item from public.pet_health where id = target_item;
  if not found or not public.can_see_pet(item.pet_id) then
    raise exception 'That isn''t there';
  end if;
  update public.pet_health
  set last_done_on = on_day,
      due_on = case when repeat_days is null then null else on_day + repeat_days end,
      last_nudged_for = null
  where id = target_item;
end;
$$;

revoke execute on function public.complete_pet_health(uuid, date) from public, anon;
grant execute on function public.complete_pet_health(uuid, date) to authenticated;

-- ===========================================================================
-- 4. Notices (PET-007)
-- ===========================================================================

-- Pet Care settings (nook_settings, 'pets'): the first two are on unless
-- turned off, "fed" is off unless turned on.
create function public.wants_pet_notice(recipient uuid, setting text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select recipient is not null
    and not public.is_managed_profile(recipient)
    and coalesce(
      (select (settings ->> setting)::boolean from public.nook_settings where profile_id = recipient and nook = 'pets'),
      setting <> 'notifyFed'
    );
$$;

-- Everyone who looks after a pet right now: the Home and active helpers.
create function public.pet_caretakers(target_pet uuid)
returns table (profile_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select m.profile_id from public.home_members m where m.home_id = public.pet_home(target_pet)
  union
  select h.profile_id from public.pet_helpers h
  where h.pet_id = target_pet and (h.until is null or h.until >= current_date);
$$;

-- When someone feeds a pet, the others looking after it can hear (off by default).
create function public.notify_pet_fed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  pet_name text;
  meal_label text;
  doer text;
  who record;
begin
  if new.kind <> 'meal' then
    return new;
  end if;
  select name into pet_name from public.pets where id = new.pet_id;
  select label into meal_label from public.pet_meals where id = new.meal_id;
  select coalesce(nullif(trim(display_name), ''), 'Someone') into doer from public.profiles where id = new.done_by;
  for who in select profile_id from public.pet_caretakers(new.pet_id) where profile_id <> new.done_by loop
    if public.wants_pet_notice(who.profile_id, 'notifyFed') then
      insert into public.notifications (profile_id, nook, kind, title, body, data)
      values (
        who.profile_id, 'pets', 'pet_fed',
        pet_name || ' was fed',
        doer || ' did ' || lower(coalesce(meal_label, 'a meal')) || '.',
        jsonb_build_object('pet_id', new.pet_id)
      );
    end if;
  end loop;
  return new;
end;
$$;

create trigger pet_fed_notice
  after insert on public.pet_care_log
  for each row execute procedure public.notify_pet_fed();

-- Runs every 15 minutes: a meal past its reminder time with nothing logged
-- today nudges the Home (once a day per meal); vet visits, vaccines and
-- refills due within a week (or past due) nudge once per due date. Things
-- that repeat more often than monthly — a daily pill — aren't nudged.
create function public.pet_care_daily()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  meal record;
  item record;
  who record;
  local_now timestamp;
begin
  for meal in
    select m.id, m.pet_id, m.label, m.remind_at, p.name, p.tz
    from public.pet_meals m
    join public.pets p on p.id = m.pet_id
    where m.remind_at is not null
  loop
    begin
      local_now := now() at time zone meal.tz;
    exception when others then
      local_now := now() at time zone 'UTC';
    end;
    if local_now::time >= meal.remind_at
      and (select last_nudged_day from public.pet_meals where id = meal.id) is distinct from local_now::date
      and not exists (
        select 1 from public.pet_care_log l where l.meal_id = meal.id and l.day = local_now::date
      )
    then
      update public.pet_meals set last_nudged_day = local_now::date where id = meal.id;
      for who in select profile_id from public.pet_caretakers(meal.pet_id) loop
        if public.wants_pet_notice(who.profile_id, 'notifyMissed') then
          insert into public.notifications (profile_id, nook, kind, title, body, data)
          values (
            who.profile_id, 'pets', 'meal_missed',
            meal.name || ' hasn''t had ' || lower(meal.label) || ' yet',
            'Nobody has checked it off today.',
            jsonb_build_object('pet_id', meal.pet_id)
          );
        end if;
      end loop;
    end if;
  end loop;

  for item in
    select h.id, h.pet_id, h.title, h.due_on, p.name
    from public.pet_health h
    join public.pets p on p.id = h.pet_id
    where h.due_on is not null
      and h.due_on <= current_date + 7
      and h.last_nudged_for is distinct from h.due_on
      and (h.repeat_days is null or h.repeat_days >= 28)
  loop
    update public.pet_health set last_nudged_for = item.due_on where id = item.id;
    for who in select profile_id from public.pet_caretakers(item.pet_id) loop
      if public.wants_pet_notice(who.profile_id, 'notifyDue') then
        insert into public.notifications (profile_id, nook, kind, title, body, data)
        values (
          who.profile_id, 'pets', 'health_due',
          item.name || ': ' || item.title,
          case
            when item.due_on < current_date then 'This was due ' || to_char(item.due_on, 'FMMonth FMDD') || '.'
            when item.due_on = current_date then 'Due today.'
            else 'Due ' || to_char(item.due_on, 'FMMonth FMDD') || '.'
          end,
          jsonb_build_object('pet_id', item.pet_id)
        );
      end if;
    end loop;
  end loop;

  -- Old care-log entries are only history after a while.
  delete from public.pet_care_log where done_at < now() - interval '120 days';
end;
$$;

revoke execute on function public.pet_care_daily() from public, anon, authenticated;
revoke execute on function public.wants_pet_notice(uuid, text) from public, anon, authenticated;
revoke execute on function public.pet_caretakers(uuid) from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.schedule('pet-care-nudges', '*/15 * * * *', 'select public.pet_care_daily()');
  else
    raise notice 'pg_cron not available — enable it, then schedule public.pet_care_daily()';
  end if;
exception when others then
  raise notice 'Could not schedule pet_care_daily (%): enable pg_cron in Database > Extensions', sqlerrm;
end;
$$;

-- ===========================================================================
-- 5. Pets move with you when you join a Home (HOME-005)
-- ===========================================================================

create or replace function public.accept_home_invite(invite_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  target_home uuid;
  inviter uuid;
  old_home uuid;
  others int;
  joiner text;
begin
  select home_id, invited_by into target_home, inviter
  from public.home_invites where id = invite_id and invited = caller;
  if target_home is null then
    raise exception 'That invite isn''t there any more';
  end if;

  select home_id into old_home from public.home_members where profile_id = caller;
  if old_home is not null and old_home <> target_home then
    select count(*) into others from public.home_members where home_id = old_home and profile_id <> caller;
    if others = 0 then
      delete from public.letterbox_thanks t
      where t.home_id = old_home and t.gift_id is not null
        and exists (
          select 1 from public.letterbox_thanks kept
          where kept.home_id = target_home and kept.gift_id = t.gift_id
        );
      update public.letterbox_contacts set home_id = target_home where home_id = old_home;
      update public.letterbox_people set home_id = target_home where home_id = old_home;
      update public.letterbox_cards set home_id = target_home where home_id = old_home;
      update public.letterbox_thanks set home_id = target_home where home_id = old_home;
      update public.pets set home_id = target_home where home_id = old_home;
      delete from public.home_members where profile_id = caller;
      delete from public.homes where id = old_home;
    else
      delete from public.home_members where profile_id = caller;
    end if;
  end if;

  insert into public.home_members (profile_id, home_id)
  values (caller, target_home)
  on conflict (profile_id) do update set home_id = excluded.home_id, joined_at = now();
  delete from public.home_invites where home_id = target_home and invited = caller;

  if inviter is not null and inviter <> caller then
    select coalesce(nullif(trim(display_name), ''), 'Someone') into joiner from public.profiles where id = caller;
    insert into public.notifications (profile_id, nook, kind, title, body, data)
    values (inviter, 'home', 'home_joined', joiner || ' joined your Home', 'You now share one Home.', '{}'::jsonb);
  end if;
  return target_home;
end;
$$;

-- ===========================================================================
-- 6. Photos (PET-006)
-- ===========================================================================

insert into storage.buckets (id, name, public)
values ('pets', 'pets', false)
on conflict (id) do nothing;

create policy "pet photos seen by the Home and helpers" on storage.objects
  for select to authenticated
  using (bucket_id = 'pets' and public.can_use_pet_photo(name, false));

create policy "pet photos added by the Home" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'pets' and public.can_use_pet_photo(name, true));

create policy "pet photos removed by the Home" on storage.objects
  for delete to authenticated
  using (bucket_id = 'pets' and public.can_use_pet_photo(name, true));
