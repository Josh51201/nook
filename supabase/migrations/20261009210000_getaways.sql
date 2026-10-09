-- Getaway Nook (TRIP-001..014).
--
--   getaways ................ TRIP-001: a trip with its dates and place
--   getaway_people .......... TRIP-002: who's going; only they see the trip
--   getaway_items ........... TRIP-003, TRIP-006: packing lists (each
--                             person's and a shared one) and the
--                             before-you-go checklist
--   getaway_bookings ........ TRIP-004: confirmations (flights, stays, cars…)
--   getaway_plans ........... TRIP-005: the day-by-day plan
--   getaway_costs ........... TRIP-009: who paid for what, split between whom
--   getaway_pack_lists ...... TRIP-008: your saved packing lists
--   create_getaway() ........ starts one, with the people going
--   getaways_daily() ........ TRIP-006, TRIP-011: do-by reminders and
--                             "leaving tomorrow"
--
-- Nothing here touches gifts or claims, so GIFT-007 is unaffected.

-- ===========================================================================
-- 1. Tables
-- ===========================================================================

create table public.getaways (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 1 and 60),
  place text check (place is null or char_length(place) <= 80),
  kind text not null default 'other'
    check (kind in ('beach', 'mountains', 'city', 'camping', 'family', 'road', 'cruise', 'park', 'other')),
  starts_on date not null,
  ends_on date not null,
  notes text check (notes is null or char_length(notes) <= 500),
  -- The phone's time zone, so reminders go out in the morning.
  tz text not null default 'UTC' check (char_length(tz) <= 64),
  -- Which start date "leaving tomorrow" was last sent for.
  leaving_noticed_for date,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on and ends_on <= starts_on + 366)
);

create table public.getaway_people (
  getaway_id uuid not null references public.getaways (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  added_by uuid references public.profiles (id) on delete set null default auth.uid(),
  added_at timestamptz not null default now(),
  primary key (getaway_id, profile_id)
);

create index getaway_people_profile on public.getaway_people (profile_id);

create table public.getaway_items (
  id uuid primary key default gen_random_uuid(),
  getaway_id uuid not null references public.getaways (id) on delete cascade,
  -- pack: a packing list line; todo: a before-you-go task.
  kind text not null check (kind in ('pack', 'todo')),
  text text not null check (char_length(trim(text)) between 1 and 100),
  -- pack: whose list (null = the shared one). todo: who's doing it (null = anyone).
  for_person uuid references public.profiles (id) on delete set null,
  -- todo: do it by this day.
  due_on date,
  done_at timestamptz,
  -- Set by the database to whoever ticked it.
  done_by uuid references public.profiles (id) on delete set null,
  reminded_for date,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index getaway_items_getaway on public.getaway_items (getaway_id, kind, created_at);

create table public.getaway_bookings (
  id uuid primary key default gen_random_uuid(),
  getaway_id uuid not null references public.getaways (id) on delete cascade,
  kind text not null default 'other' check (kind in ('flight', 'stay', 'car', 'train', 'event', 'other')),
  title text not null check (char_length(trim(title)) between 1 and 80),
  code text check (code is null or char_length(code) <= 40),
  starts_on date not null,
  starts_time time,
  ends_on date,
  ends_time time,
  place text check (place is null or char_length(place) <= 200),
  url text check (url is null or (char_length(url) <= 500 and url ~* '^https?://')),
  notes text check (notes is null or char_length(notes) <= 500),
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  check (ends_on is null or ends_on >= starts_on)
);

create index getaway_bookings_getaway on public.getaway_bookings (getaway_id, starts_on);

create table public.getaway_plans (
  id uuid primary key default gen_random_uuid(),
  getaway_id uuid not null references public.getaways (id) on delete cascade,
  on_day date not null,
  at_time time,
  title text not null check (char_length(trim(title)) between 1 and 80),
  place text check (place is null or char_length(place) <= 200),
  notes text check (notes is null or char_length(notes) <= 300),
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index getaway_plans_getaway on public.getaway_plans (getaway_id, on_day);

create table public.getaway_costs (
  id uuid primary key default gen_random_uuid(),
  getaway_id uuid not null references public.getaways (id) on delete cascade,
  what text not null check (char_length(trim(what)) between 1 and 60),
  amount_cents int not null check (amount_cents between 1 and 10000000),
  -- Kept even if they leave the trip, so the sums still add up.
  paid_by uuid not null references public.profiles (id) on delete cascade,
  split_among uuid[] not null check (cardinality(split_among) between 1 and 50),
  spent_on date not null default current_date,
  -- "Sam paid Alex back": paid_by is Sam, split_among is just Alex.
  is_payback boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index getaway_costs_getaway on public.getaway_costs (getaway_id, spent_on);

create table public.getaway_pack_lists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  name text not null check (char_length(trim(name)) between 1 and 40),
  items text[] not null default '{}'
    check (cardinality(items) <= 150 and array_to_string(items, '') !~ '[\n\r]'),
  created_at timestamptz not null default now()
);

alter table public.getaways enable row level security;
alter table public.getaway_people enable row level security;
alter table public.getaway_items enable row level security;
alter table public.getaway_bookings enable row level security;
alter table public.getaway_plans enable row level security;
alter table public.getaway_costs enable row level security;
alter table public.getaway_pack_lists enable row level security;

-- ===========================================================================
-- 2. Helpers (security definer so they don't re-enter RLS)
-- ===========================================================================

-- Is the caller going on this Getaway?
create function public.is_going(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.getaway_people where getaway_id = target and profile_id = (select auth.uid())
  );
$$;

-- Is this person on this Getaway?
create function public.is_traveler(target uuid, person uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.getaway_people where getaway_id = target and profile_id = person);
$$;

-- Every one of these people is on this Getaway.
create function public.all_travelers(target uuid, people uuid[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1 from unnest(people) p
    where not exists (select 1 from public.getaway_people where getaway_id = target and profile_id = p)
  );
$$;

-- The caller's Home id without making one (my_home() creates one if needed).
create function public.my_home_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select home_id from public.home_members where profile_id = (select auth.uid());
$$;

-- Who the caller can bring along (TRIP-002): themselves, family in their
-- Burrows (kids included), anyone they live with, and kids they manage.
create function public.can_bring(person uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select person = (select auth.uid())
    or public.shares_burrow_with((select auth.uid()), person)
    or public.lives_in_home(person, public.my_home_id())
    or public.manages_profile(person);
$$;

-- ===========================================================================
-- 3. Row level security (TRIP-002, TRIP-013): the people going, and only them
-- ===========================================================================

create policy "getaways visible to the people going" on public.getaways
  for select using (public.is_going(id));

-- New ones come in through create_getaway(), so there's no insert policy.
create policy "getaways changed by the people going" on public.getaways
  for update using (public.is_going(id)) with check (public.is_going(id));

create policy "getaways removed by whoever started them" on public.getaways
  for delete using (created_by = (select auth.uid()) and public.is_going(id));

revoke update on public.getaways from anon, authenticated;
grant update (title, place, kind, starts_on, ends_on, notes, tz) on public.getaways to authenticated;

create policy "getaway_people visible to the people going" on public.getaway_people
  for select using (public.is_going(getaway_id));

create policy "getaway_people added by the people going" on public.getaway_people
  for insert with check (
    public.is_going(getaway_id)
    and added_by = (select auth.uid())
    and public.can_bring(profile_id)
  );

-- Take yourself off; whoever started it can take anyone off; a kid's
-- managers can take the kid off.
create policy "getaway_people removed" on public.getaway_people
  for delete using (
    profile_id = (select auth.uid())
    or (public.is_going(getaway_id) and exists (
      select 1 from public.getaways g where g.id = getaway_id and g.created_by = (select auth.uid())
    ))
    or (public.is_going(getaway_id) and public.manages_profile(profile_id))
  );

revoke update on public.getaway_people from anon, authenticated;

-- Lists, confirmations, plans and costs: anyone going can add, change and
-- remove them. Whoever a line is for must be going.
create policy "getaway_items for the people going" on public.getaway_items
  for all using (public.is_going(getaway_id))
  with check (
    public.is_going(getaway_id)
    and (for_person is null or public.is_traveler(getaway_id, for_person))
  );

revoke update on public.getaway_items from anon, authenticated;
grant update (text, for_person, due_on, done_at) on public.getaway_items to authenticated;

create policy "getaway_bookings for the people going" on public.getaway_bookings
  for all using (public.is_going(getaway_id)) with check (public.is_going(getaway_id));

revoke update on public.getaway_bookings from anon, authenticated;
grant update (kind, title, code, starts_on, starts_time, ends_on, ends_time, place, url, notes)
  on public.getaway_bookings to authenticated;

create policy "getaway_plans for the people going" on public.getaway_plans
  for all using (public.is_going(getaway_id)) with check (public.is_going(getaway_id));

revoke update on public.getaway_plans from anon, authenticated;
grant update (on_day, at_time, title, place, notes) on public.getaway_plans to authenticated;

-- Whoever paid and everyone it's split between must be going when it's
-- added or changed.
create policy "getaway_costs for the people going" on public.getaway_costs
  for all using (public.is_going(getaway_id))
  with check (
    public.is_going(getaway_id)
    and public.is_traveler(getaway_id, paid_by)
    and public.all_travelers(getaway_id, split_among)
  );

revoke update on public.getaway_costs from anon, authenticated;
grant update (what, amount_cents, paid_by, split_among, spent_on) on public.getaway_costs to authenticated;

-- Saved packing lists are yours alone.
create policy "getaway_pack_lists are their owner's" on public.getaway_pack_lists
  for all using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

revoke update on public.getaway_pack_lists from anon, authenticated;
grant update (name, items) on public.getaway_pack_lists to authenticated;

-- ===========================================================================
-- 4. Starting one, ticking things off, and who's going
-- ===========================================================================

-- Starts a Getaway with you on it, plus anyone else you can bring. Returns
-- its id. (Done here so the new trip can be read back straight away.)
create function public.create_getaway(
  title text,
  place text,
  kind text,
  starts_on date,
  ends_on date,
  notes text,
  tz text,
  people uuid[] default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  new_id uuid;
  person uuid;
begin
  if caller is null then
    raise exception 'Sign in first';
  end if;
  insert into public.getaways (title, place, kind, starts_on, ends_on, notes, tz, created_by)
  values (
    trim(title), nullif(trim(coalesce(place, '')), ''), coalesce(kind, 'other'), starts_on, ends_on,
    nullif(trim(coalesce(notes, '')), ''), coalesce(nullif(tz, ''), 'UTC'), caller
  )
  returning id into new_id;

  insert into public.getaway_people (getaway_id, profile_id, added_by) values (new_id, caller, caller);
  foreach person in array coalesce(people, '{}') loop
    if person <> caller then
      if not public.can_bring(person) then
        raise exception 'You can only bring family from your Burrows and people you live with';
      end if;
      insert into public.getaway_people (getaway_id, profile_id, added_by)
      values (new_id, person, caller)
      on conflict do nothing;
    end if;
  end loop;
  return new_id;
end;
$$;

revoke execute on function public.create_getaway(text, text, text, date, date, text, text, uuid[]) from public, anon;
grant execute on function public.create_getaway(text, text, text, date, date, text, text, uuid[]) to authenticated;

-- Ticking a line records who did it; unticking clears it.
create function public.getaway_item_ticked()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.done_by := case when new.done_at is null then null else auth.uid() end;
    new.reminded_for := null;
  elsif new.done_at is distinct from old.done_at then
    new.done_by := case when new.done_at is null then null else auth.uid() end;
  end if;
  -- A new do-by date gets its own reminder.
  if tg_op = 'UPDATE' and new.due_on is distinct from old.due_on then
    new.reminded_for := null;
  end if;
  return new;
end;
$$;

create trigger getaway_items_ticked
  before insert or update on public.getaway_items
  for each row execute function public.getaway_item_ticked();

-- Getaway settings (nook_settings, 'getaways'): all on unless turned off.
create function public.wants_getaway_notice(recipient uuid, setting text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select recipient is not null
    and not public.is_managed_profile(recipient)
    and coalesce(
      (select (settings ->> setting)::boolean from public.nook_settings where profile_id = recipient and nook = 'getaways'),
      true
    );
$$;

-- "Sam added you to Beach week" (TRIP-011).
create function public.getaway_person_added()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  adder text;
  trip public.getaways;
begin
  if new.added_by is null or new.added_by = new.profile_id then
    return new;
  end if;
  if not public.wants_getaway_notice(new.profile_id, 'notifyAdded') then
    return new;
  end if;
  select * into trip from public.getaways where id = new.getaway_id;
  select coalesce(nullif(trim(display_name), ''), 'Someone') into adder from public.profiles where id = new.added_by;
  insert into public.notifications (profile_id, nook, kind, title, body, data)
  values (
    new.profile_id, 'getaways', 'getaway_added',
    adder || ' added you to ' || trip.title,
    to_char(trip.starts_on, 'FMMonth FMDD') ||
      case when trip.ends_on = trip.starts_on then '' else ' – ' || to_char(trip.ends_on, 'FMMonth FMDD') end ||
      coalesce(' · ' || trip.place, '') || '.',
    jsonb_build_object('getaway_id', new.getaway_id)
  );
  return new;
end;
$$;

create trigger getaway_people_added
  after insert on public.getaway_people
  for each row execute function public.getaway_person_added();

-- When the last person who can sign in leaves, the Getaway goes too, so
-- nothing is left that nobody can see.
create function public.getaway_person_removed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- The whole Getaway is being removed: nothing to tidy.
  if not exists (select 1 from public.getaways where id = old.getaway_id) then
    return old;
  end if;
  if not exists (
    select 1 from public.getaway_people p
    join public.profiles pr on pr.id = p.profile_id
    where p.getaway_id = old.getaway_id and not pr.is_managed
  ) then
    delete from public.getaways where id = old.getaway_id;
    return old;
  end if;
  -- Their own packing list goes with them; things they were doing go back
  -- to "anyone".
  delete from public.getaway_items where getaway_id = old.getaway_id and kind = 'pack' and for_person = old.profile_id;
  update public.getaway_items set for_person = null
  where getaway_id = old.getaway_id and kind = 'todo' and for_person = old.profile_id;
  return old;
end;
$$;

create trigger getaway_people_removed
  after delete on public.getaway_people
  for each row execute function public.getaway_person_removed();

-- ===========================================================================
-- 5. Reminders (TRIP-006, TRIP-011)
-- ===========================================================================

-- Runs hourly. From 8 AM in each Getaway's time zone:
--   * a before-you-go task due today and not done reminds whoever's doing
--     it (or everyone going);
--   * the day before it starts, everyone going hears "starts tomorrow",
--     with how much is left on their packing list.
create function public.getaways_daily()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  trip record;
  item record;
  who record;
  local_now timestamp;
  today date;
  left_to_pack int;
  left_to_do int;
  body text;
begin
  for trip in
    select * from public.getaways
    where ends_on >= current_date - 1 and starts_on <= current_date + 400
  loop
    begin
      local_now := now() at time zone trip.tz;
    exception when others then
      local_now := now() at time zone 'UTC';
    end;
    if local_now::time < time '08:00' then
      continue;
    end if;
    today := local_now::date;

    for item in
      select * from public.getaway_items
      where getaway_id = trip.id and kind = 'todo' and done_at is null
        and due_on is not null and due_on <= today
        and reminded_for is distinct from due_on
    loop
      update public.getaway_items set reminded_for = item.due_on where id = item.id;
      for who in
        select p.profile_id from public.getaway_people p
        where p.getaway_id = trip.id and (item.for_person is null or p.profile_id = item.for_person)
      loop
        if public.wants_getaway_notice(who.profile_id, 'notifyTodos') then
          insert into public.notifications (profile_id, nook, kind, title, body, data)
          values (
            who.profile_id, 'getaways', 'getaway_todo',
            'Before ' || trip.title || ': ' || item.text,
            case when item.due_on = today then 'Today''s the day to do it.' else 'This was due ' || to_char(item.due_on, 'FMMonth FMDD') || '.' end,
            jsonb_build_object('getaway_id', trip.id)
          );
        end if;
      end loop;
    end loop;

    if trip.starts_on = today + 1 and trip.leaving_noticed_for is distinct from trip.starts_on then
      update public.getaways set leaving_noticed_for = trip.starts_on where id = trip.id;
      select count(*) into left_to_do from public.getaway_items
      where getaway_id = trip.id and kind = 'todo' and done_at is null;
      for who in select profile_id from public.getaway_people where getaway_id = trip.id loop
        if public.wants_getaway_notice(who.profile_id, 'notifyLeaving') then
          select count(*) into left_to_pack from public.getaway_items
          where getaway_id = trip.id and kind = 'pack' and done_at is null
            and (for_person is null or for_person = who.profile_id);
          body := case
            when left_to_pack = 0 and left_to_do = 0 then 'Everything''s packed and done. Have a wonderful time!'
            else concat_ws(' · ',
              case when left_to_pack > 0 then left_to_pack || ' thing' || case when left_to_pack = 1 then '' else 's' end || ' left to pack' end,
              case when left_to_do > 0 then left_to_do || ' before-you-go task' || case when left_to_do = 1 then '' else 's' end || ' left' end
            ) || '.'
          end;
          insert into public.notifications (profile_id, nook, kind, title, body, data)
          values (who.profile_id, 'getaways', 'getaway_tomorrow', trip.title || ' starts tomorrow', body, jsonb_build_object('getaway_id', trip.id));
        end if;
      end loop;
    end if;
  end loop;
end;
$$;

revoke execute on function public.getaways_daily() from public, anon, authenticated;
revoke execute on function public.wants_getaway_notice(uuid, text) from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.schedule('getaway-reminders', '9 * * * *', 'select public.getaways_daily()');
  else
    raise notice 'pg_cron not available — enable it, then schedule public.getaways_daily()';
  end if;
exception when others then
  raise notice 'Could not schedule getaways_daily (%): enable pg_cron in Database > Extensions', sqlerrm;
end;
$$;
