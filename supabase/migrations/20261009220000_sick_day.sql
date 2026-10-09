-- Sick Day Nook (SICK-001..014).
--
--   sick_spells ............ SICK-001/011/012: one illness for one person in
--                            the Home (a kid or a grown-up), from the day it
--                            started until "Feeling better", with the school
--                            or work days it cost
--   sick_log ............... SICK-003: temperatures, symptoms and notes
--   sick_medicines ......... SICK-005: the Home's medicine cabinet: the dose
--                            the label or doctor gave, hours between doses,
--                            the most a day, and what's in it
--   sick_doses ............. SICK-004: every dose given. Only written by
--                            give_sick_dose(), which refuses one that's too
--                            soon, so two people can't both give it
--   sick_helpers ........... SICK-002: someone from your Burrows helping with
--                            one sick spell for a while
--   sick_day_ticks() ....... SICK-009: "the next dose is OK now" notices
--   sitter_links.show_sick . SICK-010: a Sitter Sheet link can show how the
--                            kids on it are doing and when their next dose is
--
-- Nook never works out a dose. It only keeps the gaps and limits you typed
-- in from the label or the doctor, and counts.
--
-- Nothing here touches gifts or claims, so GIFT-007 is unaffected.

-- ===========================================================================
-- 1. Tables
-- ===========================================================================

create table public.sick_spells (
  id uuid primary key default gen_random_uuid(),
  home_id uuid not null references public.homes (id) on delete cascade,
  -- Who's sick: someone in the Home, or a kid someone in the Home manages.
  patient_id uuid not null references public.profiles (id) on delete cascade,
  -- What it is, if you know ("Flu", "Strep throat").
  title text check (title is null or char_length(trim(title)) between 1 and 60),
  started_on date not null,
  -- "Feeling better" (SICK-011). Null while they're still sick.
  ended_on date,
  -- Missed days (SICK-012): what they missed, and which days.
  missed_from text check (missed_from is null or missed_from in ('school', 'daycare', 'work')),
  missed_days date[] not null default '{}' check (cardinality(missed_days) <= 60),
  notes text check (notes is null or char_length(notes) <= 600),
  -- The phone's time zone, so notices say the time where the family is.
  tz text not null default 'UTC' check (char_length(tz) <= 64),
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  check (ended_on is null or ended_on >= started_on)
);

create index sick_spells_home on public.sick_spells (home_id, started_on desc);
-- One illness at a time per person: "Mia is sick" means one thing. Per
-- Home, so a kid with two Homes never learns anything about the other one.
create unique index sick_spells_one_open on public.sick_spells (home_id, patient_id) where ended_on is null;

-- A short list of symptoms, each a word or two.
create function public.sick_symptoms_ok(symptoms text[])
returns boolean
language sql
immutable
as $$
  select cardinality(symptoms) <= 20
    and not exists (select 1 from unnest(symptoms) s where s is null or char_length(trim(s)) not between 1 and 40);
$$;

create table public.sick_log (
  id uuid primary key default gen_random_uuid(),
  spell_id uuid not null references public.sick_spells (id) on delete cascade,
  logged_at timestamptz not null default now(),
  logged_by uuid references public.profiles (id) on delete set null default auth.uid(),
  -- Always kept in °C; shown in °F or °C by each person's setting.
  temp_c numeric(4, 2) check (temp_c is null or temp_c between 30 and 45),
  temp_where text check (temp_where is null or temp_where in ('forehead', 'ear', 'mouth', 'armpit', 'bottom')),
  symptoms text[] not null default '{}' check (public.sick_symptoms_ok(symptoms)),
  note text check (note is null or char_length(note) <= 300),
  created_at timestamptz not null default now(),
  check (temp_c is not null or cardinality(symptoms) > 0 or note is not null),
  check (temp_where is null or temp_c is not null)
);

create index sick_log_spell on public.sick_log (spell_id, logged_at desc);

-- What's in a medicine, lower case ("acetaminophen"), so two medicines that
-- share one count together.
create function public.sick_ingredients_ok(ingredients text[])
returns boolean
language sql
immutable
as $$
  select cardinality(ingredients) <= 6
    and not exists (
      select 1 from unnest(ingredients) i
      where i is null or char_length(i) not between 2 and 40 or i <> lower(trim(i))
    );
$$;

create table public.sick_medicines (
  id uuid primary key default gen_random_uuid(),
  home_id uuid not null references public.homes (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 60),
  ingredients text[] not null default '{}' check (public.sick_ingredients_ok(ingredients)),
  -- The dose the label or doctor gave ("5 mL", "1 tablet"). Never worked out by Nook.
  amount text check (amount is null or char_length(amount) <= 40),
  -- At least this many hours between doses (null = no timer).
  every_hours numeric(4, 1) check (every_hours is null or every_hours between 0.5 and 72),
  -- At most this many doses in any 24 hours (null = no limit kept).
  max_per_day int check (max_per_day is null or max_per_day between 1 and 24),
  -- Saved for one person (their own dose), or anyone in the Home (null).
  for_profile uuid references public.profiles (id) on delete set null,
  notes text check (notes is null or char_length(notes) <= 300),
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index sick_medicines_home on public.sick_medicines (home_id, name);

create table public.sick_doses (
  id uuid primary key default gen_random_uuid(),
  spell_id uuid not null references public.sick_spells (id) on delete cascade,
  medicine_id uuid references public.sick_medicines (id) on delete set null,
  -- Copied from the cabinet when given, so the history still reads right
  -- after the cabinet changes and the rules it was given under are kept.
  medicine_name text not null check (char_length(trim(medicine_name)) between 1 and 60),
  ingredients text[] not null default '{}' check (public.sick_ingredients_ok(ingredients)),
  amount text check (amount is null or char_length(amount) <= 40),
  every_hours numeric(4, 1),
  max_per_day int,
  given_at timestamptz not null default now(),
  given_by uuid references public.profiles (id) on delete set null,
  -- Given before it was due, on purpose ("the doctor said to").
  early boolean not null default false,
  -- The "OK again" notice has gone out (SICK-009).
  ready_noticed boolean not null default false,
  created_at timestamptz not null default now()
);

create index sick_doses_spell on public.sick_doses (spell_id, given_at desc);
create index sick_doses_waiting on public.sick_doses (given_at) where not ready_noticed;

create table public.sick_helpers (
  spell_id uuid not null references public.sick_spells (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  -- Their access ends after this day (null = until removed or they're better).
  until date,
  added_by uuid references public.profiles (id) on delete set null default auth.uid(),
  added_at timestamptz not null default now(),
  primary key (spell_id, profile_id)
);

create index sick_helpers_profile on public.sick_helpers (profile_id);

alter table public.sick_spells enable row level security;
alter table public.sick_log enable row level security;
alter table public.sick_medicines enable row level security;
alter table public.sick_doses enable row level security;
alter table public.sick_helpers enable row level security;

-- ===========================================================================
-- 2. Helpers (security definer so they don't re-enter RLS)
-- ===========================================================================

-- Someone in the Home, or a kid someone in the Home manages.
create function public.is_home_person(person uuid, target_home uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.lives_in_home(person, target_home) or public.is_home_kid(person, target_home);
$$;

-- A helper's access lasts until their day, and stops the day after the
-- sick one is marked better.
create function public.sick_helper_active(helper public.sick_helpers, spell public.sick_spells)
returns boolean
language sql
stable
as $$
  select (helper.until is null or helper.until >= current_date)
    and (spell.ended_on is null or spell.ended_on >= current_date - 1);
$$;

create function public.is_sick_helper(person uuid, target_spell uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.sick_helpers h
    join public.sick_spells s on s.id = h.spell_id
    where h.spell_id = target_spell and h.profile_id = person and public.sick_helper_active(h, s)
  );
$$;

create function public.sick_spell_home(target_spell uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select home_id from public.sick_spells where id = target_spell;
$$;

-- The Home can change everything about a sick spell (SICK-002).
create function public.can_edit_sick_spell(target_spell uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.is_home_member(public.sick_spell_home(target_spell)), false);
$$;

-- The Home, plus helpers whose time hasn't run out.
create function public.can_see_sick_spell(target_spell uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_edit_sick_spell(target_spell) or public.is_sick_helper((select auth.uid()), target_spell);
$$;

-- The same, for anyone (notices go to people other than the caller).
create function public.sick_can_reach(person uuid, target_spell uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select person is not null
    and (public.lives_in_home(person, public.sick_spell_home(target_spell)) or public.is_sick_helper(person, target_spell));
$$;

-- Helping with any sick spell in this Home right now: helpers need the
-- cabinet to give doses.
create function public.helps_sick_home(target_home uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.sick_helpers h
    join public.sick_spells s on s.id = h.spell_id
    where s.home_id = target_home and h.profile_id = (select auth.uid()) and public.sick_helper_active(h, s)
  );
$$;

-- ===========================================================================
-- 3. Row level security (SICK-002, SICK-013)
-- ===========================================================================

-- Checks the row's own home_id rather than looking it up by id, so a new
-- sick spell can be read back in the same statement that adds it.
create policy "sick_spells visible to the Home and helpers" on public.sick_spells
  for select using (public.is_home_member(home_id) or public.is_sick_helper((select auth.uid()), id));

create policy "sick_spells started by the Home" on public.sick_spells
  for insert with check (
    public.is_home_member(home_id)
    and created_by = (select auth.uid())
    and public.is_home_person(patient_id, home_id)
  );

create policy "sick_spells changed by the Home" on public.sick_spells
  for update using (public.is_home_member(home_id)) with check (public.is_home_member(home_id));

create policy "sick_spells removed by the Home" on public.sick_spells
  for delete using (public.is_home_member(home_id));

-- A sick spell can't move Homes or become someone else's.
revoke update on public.sick_spells from anon, authenticated;
grant update (title, started_on, ended_on, missed_from, missed_days, notes, tz) on public.sick_spells to authenticated;

-- Helpers log too, but only as themselves; undo your own, or the Home tidies up.
create policy "sick_log visible to the Home and helpers" on public.sick_log
  for select using (public.can_see_sick_spell(spell_id));
create policy "sick_log added as yourself" on public.sick_log
  for insert with check (public.can_see_sick_spell(spell_id) and logged_by = (select auth.uid()));
create policy "sick_log removed by whoever logged it or the Home" on public.sick_log
  for delete using (logged_by = (select auth.uid()) and public.can_see_sick_spell(spell_id) or public.can_edit_sick_spell(spell_id));

revoke update on public.sick_log from anon, authenticated;

-- The cabinet: the Home keeps it; helpers can read it while they help.
create policy "sick_medicines visible to the Home and helpers" on public.sick_medicines
  for select using (public.is_home_member(home_id) or public.helps_sick_home(home_id));
create policy "sick_medicines added by the Home" on public.sick_medicines
  for insert with check (
    public.is_home_member(home_id)
    and created_by = (select auth.uid())
    and (for_profile is null or public.is_home_person(for_profile, home_id))
  );
create policy "sick_medicines changed by the Home" on public.sick_medicines
  for update using (public.is_home_member(home_id))
  with check (public.is_home_member(home_id) and (for_profile is null or public.is_home_person(for_profile, home_id)));
create policy "sick_medicines removed by the Home" on public.sick_medicines
  for delete using (public.is_home_member(home_id));

revoke update on public.sick_medicines from anon, authenticated;
grant update (name, ingredients, amount, every_hours, max_per_day, for_profile, notes) on public.sick_medicines to authenticated;

-- Doses are read directly but only written by give_sick_dose() (below).
create policy "sick_doses visible to the Home and helpers" on public.sick_doses
  for select using (public.can_see_sick_spell(spell_id));
create policy "sick_doses removed by whoever gave it or the Home" on public.sick_doses
  for delete using (given_by = (select auth.uid()) and public.can_see_sick_spell(spell_id) or public.can_edit_sick_spell(spell_id));

revoke insert, update on public.sick_doses from anon, authenticated;

-- Helpers: the Home hands them out from people they share a Burrow with who
-- don't live there (not kids, who can't sign in); a helper can step away.
create policy "sick_helpers visible to the Home and the helper" on public.sick_helpers
  for select using (public.can_edit_sick_spell(spell_id) or profile_id = (select auth.uid()));
create policy "sick_helpers added by the Home" on public.sick_helpers
  for insert with check (
    public.can_edit_sick_spell(spell_id)
    and added_by = (select auth.uid())
    and profile_id <> (select auth.uid())
    and not public.is_managed_profile(profile_id)
    and not public.lives_in_home(profile_id, public.sick_spell_home(spell_id))
    and public.shares_burrow_with((select auth.uid()), profile_id)
  );
create policy "sick_helpers changed by the Home" on public.sick_helpers
  for update using (public.can_edit_sick_spell(spell_id)) with check (public.can_edit_sick_spell(spell_id));
create policy "sick_helpers removed by the Home or the helper" on public.sick_helpers
  for delete using (public.can_edit_sick_spell(spell_id) or profile_id = (select auth.uid()));

revoke update on public.sick_helpers from anon, authenticated;
grant update (until) on public.sick_helpers to authenticated;

revoke all on public.sick_spells, public.sick_log, public.sick_medicines, public.sick_doses, public.sick_helpers from anon;

-- Names for everyone a sick spell mentions: the Home's people and kids, and
-- whoever is sick, logged something or is helping on a spell you can see.
-- (A helper may not share a Burrow with the kid they're helping with.)
create function public.sick_people()
returns table (id uuid, display_name text, is_kid boolean)
language sql
stable
security definer
set search_path = public
as $$
  with mine as (select home_id from public.home_members where profile_id = (select auth.uid())),
  spells as (
    select s.id, s.patient_id from public.sick_spells s
    where public.is_home_member(s.home_id) or public.is_sick_helper((select auth.uid()), s.id)
  ),
  ids as (
    select m.profile_id as id from public.home_members m, mine where m.home_id = mine.home_id
    union select k.id from public.home_kids() k
    union select patient_id from spells
    union select l.logged_by from public.sick_log l join spells on spells.id = l.spell_id
    union select d.given_by from public.sick_doses d join spells on spells.id = d.spell_id
    union select h.profile_id from public.sick_helpers h join spells on spells.id = h.spell_id
    union select h.added_by from public.sick_helpers h join spells on spells.id = h.spell_id
  )
  select p.id, p.display_name, p.is_managed
  from public.profiles p join ids on ids.id = p.id;
$$;

revoke execute on function public.sick_people() from public, anon;
grant execute on function public.sick_people() to authenticated;

-- ===========================================================================
-- 4. Giving a dose (SICK-004, SICK-005)
-- ===========================================================================

-- When the next dose of this medicine (or anything sharing what's in it)
-- would be OK for this person, judged at `as_of`. Null when it's OK now.
--   * gap: at least `every_hours` either side of every matching dose (the
--     longer of the two medicines' gaps, if both have one)
--   * day: no more than `max_per_day` in the 24 hours up to `as_of` (the
--     smaller limit, if both have one)
-- A matching dose is the same cabinet medicine, the same name, or one
-- sharing an ingredient (Tylenol and NyQuil are both acetaminophen).
create function public.sick_dose_wait(
  target_home uuid,
  patient uuid,
  med uuid,
  med_name text,
  ingr text[],
  gap numeric,
  per_day int,
  as_of timestamptz
)
returns table (safe_at timestamptz, reason text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  gap_until timestamptz;
  day_until timestamptz;
  given int;
  most int;
begin
  select max(d.given_at + (greatest(coalesce(gap, d.every_hours), coalesce(d.every_hours, gap))::float8 * interval '1 hour'))
  into gap_until
  from public.sick_doses d
  join public.sick_spells s on s.id = d.spell_id
  where s.patient_id = patient and s.home_id = target_home
    and d.given_at between as_of - interval '3 days' and as_of + interval '3 days'
    and (d.medicine_id = med or lower(trim(d.medicine_name)) = lower(trim(med_name)) or d.ingredients && ingr)
    and abs(extract(epoch from (as_of - d.given_at))) < greatest(coalesce(gap, d.every_hours), coalesce(d.every_hours, gap))::float8 * 3600;

  select count(*), least(per_day, min(d.max_per_day))
  into given, most
  from public.sick_doses d
  join public.sick_spells s on s.id = d.spell_id
  where s.patient_id = patient and s.home_id = target_home
    and d.given_at > as_of - interval '24 hours' and d.given_at <= as_of
    and (d.medicine_id = med or lower(trim(d.medicine_name)) = lower(trim(med_name)) or d.ingredients && ingr);

  if most is not null and given >= most then
    -- OK again once enough of them are more than a day old.
    select d.given_at + interval '24 hours' into day_until
    from public.sick_doses d
    join public.sick_spells s on s.id = d.spell_id
    where s.patient_id = patient and s.home_id = target_home
      and d.given_at > as_of - interval '24 hours' and d.given_at <= as_of
      and (d.medicine_id = med or lower(trim(d.medicine_name)) = lower(trim(med_name)) or d.ingredients && ingr)
    order by d.given_at
    offset given - most
    limit 1;
  end if;

  if gap_until is null and day_until is null then
    return;
  end if;
  safe_at := greatest(gap_until, day_until);
  reason := case when day_until is not null and day_until >= coalesce(gap_until, day_until) then 'day' else 'gap' end;
  return next;
end;
$$;

-- The only way a dose is written. Locks the person while it checks, so two
-- phones tapping "Give" at once can't both get through. A dose that's too
-- soon is refused (message 'too_soon', detail = when it's OK, hint = 'gap'
-- or 'day') unless `anyway` is set, and then it's marked as given early.
create function public.give_sick_dose(
  target_spell uuid,
  medicine uuid default null,
  medicine_name text default null,
  amount text default null,
  given_at timestamptz default null,
  anyway boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  sp public.sick_spells;
  med public.sick_medicines;
  label text;
  ingr text[] := '{}';
  gap numeric;
  per_day int;
  how_much text := nullif(trim(amount), '');
  as_of timestamptz := coalesce(given_at, now());
  wait record;
  new_id uuid;
begin
  select * into sp from public.sick_spells where id = target_spell;
  if not found or not public.can_see_sick_spell(sp.id) then
    raise exception 'That isn''t there' using errcode = '42501';
  end if;
  if as_of > now() + interval '5 minutes' then
    raise exception 'That time hasn''t come yet' using errcode = '22023';
  end if;
  if as_of < now() - interval '3 days' then
    raise exception 'Only doses from the last 3 days can be added' using errcode = '22023';
  end if;

  if medicine is not null then
    select * into med from public.sick_medicines m where m.id = medicine and m.home_id = sp.home_id;
    if not found then
      raise exception 'That medicine isn''t in your cabinet' using errcode = '42501';
    end if;
    if med.for_profile is not null and med.for_profile <> sp.patient_id then
      raise exception 'That medicine is saved for someone else' using errcode = '22023';
    end if;
    label := med.name;
    ingr := med.ingredients;
    gap := med.every_hours;
    per_day := med.max_per_day;
    how_much := coalesce(how_much, med.amount);
  else
    label := trim(medicine_name);
    if label is null or char_length(label) not between 1 and 60 then
      raise exception 'Which medicine?' using errcode = '22023';
    end if;
  end if;
  if how_much is not null and char_length(how_much) > 40 then
    raise exception 'Keep the amount short, like "5 mL"' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('sick-dose:' || sp.patient_id::text, 0));

  select * into wait from public.sick_dose_wait(sp.home_id, sp.patient_id, medicine, label, ingr, gap, per_day, as_of);
  if wait.safe_at is not null and not coalesce(anyway, false) then
    raise exception 'too_soon' using errcode = 'P0001', detail = to_char(wait.safe_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), hint = wait.reason;
  end if;

  insert into public.sick_doses (
    spell_id, medicine_id, medicine_name, ingredients, amount, every_hours, max_per_day, given_at, given_by, early
  )
  values (
    sp.id, medicine, label, ingr, how_much, gap, per_day, as_of, auth.uid(), wait.safe_at is not null
  )
  returning id into new_id;
  return new_id;
end;
$$;

revoke execute on function public.sick_dose_wait(uuid, uuid, uuid, text, text[], numeric, int, timestamptz) from public, anon, authenticated;
revoke execute on function public.give_sick_dose(uuid, uuid, text, text, timestamptz, boolean) from public, anon;
grant execute on function public.give_sick_dose(uuid, uuid, text, text, timestamptz, boolean) to authenticated;

-- ===========================================================================
-- 5. Notices (SICK-009)
-- ===========================================================================

-- Sick Day settings (nook_settings, 'sickday'): all on unless turned off.
create function public.wants_sick_notice(recipient uuid, setting text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select recipient is not null
    and not public.is_managed_profile(recipient)
    and coalesce(
      (select (settings ->> setting)::boolean from public.nook_settings where profile_id = recipient and nook = 'sickday'),
      true
    );
$$;

-- Everyone looking after a sick spell right now: the Home and active helpers.
create function public.sick_caretakers(target_spell uuid)
returns table (profile_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select m.profile_id from public.home_members m where m.home_id = public.sick_spell_home(target_spell)
  union
  select h.profile_id from public.sick_helpers h
  join public.sick_spells s on s.id = h.spell_id
  where h.spell_id = target_spell and public.sick_helper_active(h, s);
$$;

create function public.sick_first_name(person uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(nullif(split_part(trim(coalesce(display_name, '')), ' ', 1), ''), 'Someone') from public.profiles where id = person;
$$;

-- Someone gave a dose: the others looking after them hear, so nobody gives
-- it again.
create function public.notify_sick_dose()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sp public.sick_spells;
  who record;
  giver text;
  patient text;
  local_time text;
  body text;
begin
  select * into sp from public.sick_spells where id = new.spell_id;
  patient := public.sick_first_name(sp.patient_id);
  giver := coalesce(public.sick_first_name(new.given_by), 'Someone');
  begin
    local_time := to_char(new.given_at at time zone sp.tz, 'FMHH12:MI AM');
  exception when others then
    local_time := to_char(new.given_at at time zone 'UTC', 'FMHH12:MI AM') || ' UTC';
  end;
  body := giver || ' gave ' || coalesce(new.amount || ' ', '') || 'at ' || local_time
    || case when new.early then ', before it was due.' else '.' end;
  for who in select profile_id from public.sick_caretakers(new.spell_id) where profile_id is distinct from new.given_by loop
    if public.wants_sick_notice(who.profile_id, 'notifyDoseGiven') then
      insert into public.notifications (profile_id, nook, kind, title, body, data)
      values (who.profile_id, 'sickday', 'sick_dose_given', patient || ' had ' || new.medicine_name, body,
        jsonb_build_object('spell_id', new.spell_id));
    end if;
  end loop;
  return new;
end;
$$;

create trigger sick_dose_given_notice
  after insert on public.sick_doses
  for each row execute function public.notify_sick_dose();

-- Someone's been asked to help: tell them.
create function public.notify_sick_helper()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sp public.sick_spells;
begin
  select * into sp from public.sick_spells where id = new.spell_id;
  if public.wants_sick_notice(new.profile_id, 'notifyHelper') then
    insert into public.notifications (profile_id, nook, kind, title, body, data)
    values (
      new.profile_id, 'sickday', 'sick_helper',
      'You''re helping with ' || public.sick_first_name(sp.patient_id),
      coalesce(sp.title || '. ', '') || 'You can see how they''re doing and log temperatures and doses.',
      jsonb_build_object('spell_id', new.spell_id)
    );
  end if;
  return new;
end;
$$;

create trigger sick_helper_added_notice
  after insert on public.sick_helpers
  for each row execute function public.notify_sick_helper();

-- Runs every 5 minutes: once a dose's gap has passed (and the day's limit
-- allows another), whoever gave it hears it's OK again, once. Only the
-- latest dose of each medicine counts, and only while they're still sick.
create function public.sick_day_ticks()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  d record;
  wait record;
begin
  for d in
    select x.id, x.spell_id, x.medicine_id, x.medicine_name, x.ingredients, x.every_hours, x.max_per_day,
      x.given_at, x.given_by, s.patient_id, s.home_id
    from public.sick_doses x
    join public.sick_spells s on s.id = x.spell_id
    where not x.ready_noticed
      and x.given_at > now() - interval '2 days'
      and x.every_hours is not null
      and x.given_at + (x.every_hours::float8 * interval '1 hour') <= now()
  loop
    -- Something later of the same medicine: this one's moot.
    if exists (
      select 1 from public.sick_doses y
      join public.sick_spells s2 on s2.id = y.spell_id
      where s2.patient_id = d.patient_id and s2.home_id = d.home_id and y.given_at > d.given_at and y.id <> d.id
        and (y.medicine_id = d.medicine_id or lower(trim(y.medicine_name)) = lower(trim(d.medicine_name)) or y.ingredients && d.ingredients)
    ) or exists (select 1 from public.sick_spells s3 where s3.id = d.spell_id and s3.ended_on is not null) then
      update public.sick_doses set ready_noticed = true where id = d.id;
      continue;
    end if;

    select * into wait from public.sick_dose_wait(d.home_id, d.patient_id, d.medicine_id, d.medicine_name, d.ingredients, d.every_hours, d.max_per_day, now());
    if wait.safe_at is not null and wait.safe_at > now() then
      continue; -- the day's limit still holds; check again later
    end if;

    update public.sick_doses set ready_noticed = true where id = d.id;
    if public.sick_can_reach(d.given_by, d.spell_id) and public.wants_sick_notice(d.given_by, 'notifyDoseReady') then
      insert into public.notifications (profile_id, nook, kind, title, body, data)
      values (
        d.given_by, 'sickday', 'sick_dose_ready',
        public.sick_first_name(d.patient_id) || ' can have ' || d.medicine_name || ' again',
        'It''s been ' || rtrim(rtrim(d.every_hours::text, '0'), '.') || case when d.every_hours = 1 then ' hour' else ' hours' end
          || ' since the last one. Check before giving it.',
        jsonb_build_object('spell_id', d.spell_id)
      );
    end if;
  end loop;
end;
$$;

revoke execute on function public.sick_day_ticks() from public, anon, authenticated;
revoke execute on function public.wants_sick_notice(uuid, text) from public, anon, authenticated;
revoke execute on function public.sick_caretakers(uuid) from public, anon, authenticated;
revoke execute on function public.sick_can_reach(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.sick_first_name(uuid) from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.schedule('sick-day-doses', '*/5 * * * *', 'select public.sick_day_ticks()');
  else
    raise notice 'pg_cron not available — enable it, then schedule public.sick_day_ticks()';
  end if;
exception when others then
  raise notice 'Could not schedule sick_day_ticks (%): enable pg_cron in Database > Extensions', sqlerrm;
end;
$$;

-- ===========================================================================
-- 6. Sick days move with you (HOME-003, HOME-005, SICK-014)
-- ===========================================================================

-- Same as before (subscriptions migration), plus: a Home that was only yours
-- brings its sick spells and medicine cabinet along; leaving a shared one
-- brings your own sick spells (you were the sick one) and medicines saved
-- just for you. Kids' spells and the rest of the cabinet stay.
create function public.move_my_sick_days(old_home uuid, new_home uuid, person uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.sick_medicines set home_id = new_home where home_id = old_home and for_profile = person;
  update public.sick_doses d set medicine_id = null
  from public.sick_spells s
  where d.spell_id = s.id and s.home_id = old_home and s.patient_id = person
    and d.medicine_id is not null
    and not exists (select 1 from public.sick_medicines m where m.id = d.medicine_id and m.home_id = new_home);
  update public.sick_spells set home_id = new_home where home_id = old_home and patient_id = person;
end;
$$;

revoke execute on function public.move_my_sick_days(uuid, uuid, uuid) from public, anon, authenticated;

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
      update public.rhythms set home_id = target_home where home_id = old_home;
      update public.subscriptions set home_id = target_home where home_id = old_home;
      update public.sick_spells set home_id = target_home where home_id = old_home;
      update public.sick_medicines set home_id = target_home where home_id = old_home;
      delete from public.home_members where profile_id = caller;
      delete from public.homes where id = old_home;
    else
      update public.rhythms set owner = null where home_id = old_home and owner = caller;
      update public.subscriptions set home_id = target_home
      where home_id = old_home and private and created_by = caller;
      update public.subscriptions set payer = null where home_id = old_home and payer = caller;
      perform public.move_my_sick_days(old_home, target_home, caller);
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

create or replace function public.leave_home()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  old_home uuid;
  new_home uuid;
  contact record;
  new_contact uuid;
begin
  select home_id into old_home from public.home_members where profile_id = caller;
  if old_home is null then
    return public.my_home();
  end if;
  if not exists (select 1 from public.home_members where home_id = old_home and profile_id <> caller) then
    raise exception 'This Home is only yours';
  end if;

  update public.rhythms set owner = null where home_id = old_home and owner = caller;
  update public.subscriptions set payer = null
  where home_id = old_home and payer = caller and not (private and created_by = caller);
  delete from public.home_members where profile_id = caller;
  insert into public.homes default values returning id into new_home;
  insert into public.home_members (profile_id, home_id) values (caller, new_home);
  update public.subscriptions set home_id = new_home
  where home_id = old_home and private and created_by = caller;
  perform public.move_my_sick_days(old_home, new_home, caller);

  for contact in select * from public.letterbox_contacts where home_id = old_home loop
    insert into public.letterbox_contacts (
      home_id, name, address_from, line1, line2, city, region, postal_code, country, on_holiday_list, notes
    )
    values (
      new_home, contact.name,
      case when public.can_see_address(contact.address_from) then contact.address_from end,
      contact.line1, contact.line2, contact.city, contact.region, contact.postal_code, contact.country,
      contact.on_holiday_list, contact.notes
    )
    returning id into new_contact;
    insert into public.letterbox_people (contact_id, home_id, name, birthday, profile_id, position)
    select new_contact, new_home, name, birthday, profile_id, position
    from public.letterbox_people where contact_id = contact.id;
  end loop;
  return new_home;
end;
$$;

-- ===========================================================================
-- 7. The Sitter Sheet (SICK-010)
-- ===========================================================================

-- Off on every link unless ticked for it.
alter table public.sitter_links add column show_sick boolean not null default false;
grant insert (show_sick) on public.sitter_links to authenticated;
grant update (show_sick) on public.sitter_links to authenticated;

-- Same as before (sitter_sheet_more), plus the "sick" part: for kids ticked
-- on the link who are sick right now, what it is, their latest temperature,
-- and each medicine given during it with when the next is OK.
create or replace function public.sitter_sheet_for_link(link text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  l public.sitter_links;
  s public.sitter_sheets;
  result jsonb;
  opened int;
begin
  if link is null or char_length(link) not between 30 and 60 then
    return null;
  end if;

  select * into l from public.sitter_links
  where token = link and revoked_at is null and expires_at > now();
  if not found then
    return null;
  end if;

  -- Someone in the Home previewing it doesn't count as the sitter opening it.
  if auth.uid() is null or not public.is_home_member(l.home_id) then
    update public.sitter_links
    set views = views + 1, last_viewed_at = now()
    where id = l.id
    returning views into opened;
    -- The first time: let whoever made it know it arrived (SIT-011).
    if opened = 1
      and public.lives_in_home(l.created_by, l.home_id)
      and public.wants_sitter_notice(l.created_by, 'notifyOpened')
    then
      insert into public.notifications (profile_id, nook, kind, title, body, data)
      values (l.created_by, 'sitter', 'sitter_opened', l.label, 'They opened the sitter sheet.', jsonb_build_object('link_id', l.id));
    end if;
  end if;

  select * into s from public.sitter_sheets where home_id = l.home_id;

  result := jsonb_build_object(
    'label', l.label,
    'starts_on', l.starts_on,
    'ends_on', l.ends_on,
    'expires_at', l.expires_at
  );

  if 'address' = any(l.sections) then result := result || jsonb_build_object('address', s.address); end if;
  if 'contacts' = any(l.sections) then result := result || jsonb_build_object('contacts', coalesce(s.contacts, '[]'::jsonb)); end if;
  if 'doctor' = any(l.sections) then
    result := result || jsonb_build_object('doctor_name', s.doctor_name, 'doctor_phone', s.doctor_phone);
  end if;
  if 'routine' = any(l.sections) then result := result || jsonb_build_object('routine', coalesce(s.routine, '[]'::jsonb)); end if;
  if 'bedtime' = any(l.sections) then result := result || jsonb_build_object('bedtime', s.bedtime); end if;
  if 'rules' = any(l.sections) then result := result || jsonb_build_object('rules', s.rules); end if;
  if 'food' = any(l.sections) then result := result || jsonb_build_object('food', s.food); end if;
  if 'wifi' = any(l.sections) then
    result := result || jsonb_build_object('wifi_name', s.wifi_name, 'wifi_password', s.wifi_password);
  end if;
  if 'places' = any(l.sections) then result := result || jsonb_build_object('places', s.places); end if;
  if 'codes' = any(l.sections) then result := result || jsonb_build_object('codes', s.codes); end if;
  if 'notes' = any(l.sections) then result := result || jsonb_build_object('notes', s.notes); end if;

  -- First name, allergies and diets. Nothing else about a kid.
  result := result || jsonb_build_object('kids', coalesce((
    select jsonb_agg(jsonb_build_object(
      'name', split_part(trim(coalesce(p.display_name, 'Kid')), ' ', 1),
      'allergies', coalesce(d.allergies, '{}'),
      'diets', coalesce(d.diets, '{}')
    ) order by k.ord)
    from unnest(l.kid_ids) with ordinality as k(id, ord)
    join public.profiles p on p.id = k.id
    left join public.dietary_needs d on d.profile_id = k.id
    where public.is_home_kid(k.id, l.home_id)
  ), '[]'::jsonb));

  -- Sick today (SICK-010): only kids on the link, only while they're sick,
  -- and no symptom notes or who gave what.
  if l.show_sick then
    result := result || jsonb_build_object('sick', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', split_part(trim(coalesce(p.display_name, 'Kid')), ' ', 1),
        'what', sp.title,
        'since', sp.started_on,
        'temp', (
          select jsonb_build_object('temp_c', g.temp_c, 'at', g.logged_at)
          from public.sick_log g where g.spell_id = sp.id and g.temp_c is not null
          order by g.logged_at desc limit 1
        ),
        'medicines', coalesce((
          select jsonb_agg(jsonb_build_object(
            'name', latest.medicine_name,
            'amount', latest.amount,
            'every_hours', latest.every_hours,
            'last_given', latest.given_at,
            'next_ok', (
              select w.safe_at from public.sick_dose_wait(
                sp.home_id, sp.patient_id, latest.medicine_id, latest.medicine_name, latest.ingredients, latest.every_hours, latest.max_per_day, now()
              ) w
            )
          ) order by latest.given_at desc)
          from (
            select distinct on (lower(trim(x.medicine_name))) x.*
            from public.sick_doses x where x.spell_id = sp.id
            order by lower(trim(x.medicine_name)), x.given_at desc
          ) latest
        ), '[]'::jsonb)
      ) order by k.ord)
      from unnest(l.kid_ids) with ordinality as k(id, ord)
      join public.profiles p on p.id = k.id
      join public.sick_spells sp on sp.patient_id = k.id and sp.home_id = l.home_id and sp.ended_on is null
      where public.is_home_kid(k.id, l.home_id)
    ), '[]'::jsonb));
  end if;

  result := result || jsonb_build_object('pets', coalesce((
    select jsonb_agg(jsonb_build_object(
      'name', pet.name,
      'species', pet.species,
      'food', pet.food,
      'notes', pet.notes,
      'vet_name', pet.vet_name,
      'vet_phone', pet.vet_phone,
      'meals', coalesce((
        select jsonb_agg(jsonb_build_object('label', m.label, 'time', to_char(m.remind_at, 'HH24:MI')) order by m.position)
        from public.pet_meals m where m.pet_id = pet.id
      ), '[]'::jsonb),
      'medications', coalesce((
        select jsonb_agg(jsonb_build_object('title', h.title, 'notes', h.notes) order by h.title)
        from public.pet_health h
        where h.pet_id = pet.id and h.kind = 'medication' and (h.due_on is not null or h.last_done_on is null)
      ), '[]'::jsonb)
    ) order by k.ord)
    from unnest(l.pet_ids) with ordinality as k(id, ord)
    join public.pets pet on pet.id = k.id and pet.home_id = l.home_id
  ), '[]'::jsonb));

  return result;
end;
$$;

revoke execute on function public.sitter_sheet_for_link(text) from public;
grant execute on function public.sitter_sheet_for_link(text) to anon, authenticated;
