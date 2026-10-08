-- Rhythms Nook (RHY-001..008).
--
--   rhythms .............. RHY-001..005: the Home's recurring chores, each
--                          with a next due date, a repeat and an optional owner
--   rhythm_log ........... RHY-006: who did each one, and when
--   complete_rhythm() .... marks one done and rolls the date forward
--   undo_rhythm() ........ takes the latest "done" back
--   rhythms_daily() ...... RHY-007: heads-up, due-day and overdue nudges
--
-- Nothing here touches gifts or claims, so GIFT-007 is unaffected.

-- ===========================================================================
-- 1. Tables
-- ===========================================================================

create table public.rhythms (
  id uuid primary key default gen_random_uuid(),
  home_id uuid not null references public.homes (id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 80),
  area text not null default 'other'
    check (area in ('heating', 'safety', 'indoors', 'outdoors', 'car', 'health', 'paperwork', 'other')),
  -- Next time it's due (null = a one-off that's been done, or no date yet).
  due_on date,
  -- Comes round again this many months after it's done (null = once).
  repeat_months int check (repeat_months is null or repeat_months in (1, 3, 6, 12, 24)),
  -- One person in the Home whose job it is (null = anyone's).
  owner uuid references public.profiles (id) on delete set null,
  notes text check (notes is null or char_length(notes) <= 300),
  last_done_on date,
  last_done_by uuid references public.profiles (id) on delete set null,
  -- The Home's time zone (from the phone that set it up), so "due today"
  -- means the right day.
  tz text not null default 'UTC' check (char_length(tz) <= 64),
  -- Which due date each nudge was last sent for, so each goes out once.
  heads_up_for date,
  due_day_for date,
  overdue_for date,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index rhythms_home on public.rhythms (home_id, due_on);

create table public.rhythm_log (
  id uuid primary key default gen_random_uuid(),
  rhythm_id uuid not null references public.rhythms (id) on delete cascade,
  done_by uuid references public.profiles (id) on delete set null,
  done_on date not null,
  note text check (note is null or char_length(note) <= 200),
  -- What the rhythm looked like before, so the latest one can be undone.
  was_due_on date,
  was_last_done_on date,
  was_last_done_by uuid,
  created_at timestamptz not null default now()
);

create index rhythm_log_rhythm on public.rhythm_log (rhythm_id, done_on desc, created_at desc);

alter table public.rhythms enable row level security;
alter table public.rhythm_log enable row level security;

-- ===========================================================================
-- 2. Helpers (security definer so they don't re-enter RLS)
-- ===========================================================================

create function public.rhythm_home(target_rhythm uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select home_id from public.rhythms where id = target_rhythm;
$$;

-- Is this person in that Home? (Owners must live there.)
create function public.lives_in_home(person uuid, target_home uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.home_members where profile_id = person and home_id = target_home);
$$;

-- ===========================================================================
-- 3. Row level security (RHY-002: the Home, and only the Home)
-- ===========================================================================

-- Checks the row's own home_id rather than looking it up by id, so a new
-- rhythm can be read back in the same statement that adds it.
create policy "rhythms visible to the Home" on public.rhythms
  for select using (public.is_home_member(home_id));

create policy "rhythms added by the Home" on public.rhythms
  for insert with check (
    public.is_home_member(home_id)
    and created_by = (select auth.uid())
    and (owner is null or public.lives_in_home(owner, home_id))
  );

create policy "rhythms changed by the Home" on public.rhythms
  for update using (public.is_home_member(home_id))
  with check (public.is_home_member(home_id) and (owner is null or public.lives_in_home(owner, home_id)));

create policy "rhythms removed by the Home" on public.rhythms
  for delete using (public.is_home_member(home_id));

-- A rhythm can't move Homes; "done" goes through complete_rhythm().
revoke update on public.rhythms from anon, authenticated;
grant update (title, area, due_on, repeat_months, owner, notes, tz) on public.rhythms to authenticated;

-- The log is read directly but only written by complete_rhythm/undo_rhythm,
-- so nobody can log a chore as someone else.
create policy "rhythm_log visible to the Home" on public.rhythm_log
  for select using (public.is_home_member(public.rhythm_home(rhythm_id)));

-- ===========================================================================
-- 4. Done and undo (RHY-004, RHY-006, RHY-007)
-- ===========================================================================

-- Pick up to "today" plus a day of slack for time zones; done once per day.
-- Repeating rhythms roll forward from the day they were done.
create function public.complete_rhythm(target_rhythm uuid, on_day date, note text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  item public.rhythms;
  entry uuid;
  doer text;
  next_due date;
  who record;
begin
  select * into item from public.rhythms where id = target_rhythm for update;
  if not found or not public.is_home_member(item.home_id) then
    raise exception 'That isn''t there';
  end if;
  if on_day is null or on_day > current_date + 1 or on_day < current_date - 366 then
    raise exception 'Pick a day in the last year';
  end if;
  if exists (select 1 from public.rhythm_log where rhythm_id = target_rhythm and done_on = on_day) then
    raise exception 'Already done that day' using errcode = '23505';
  end if;

  insert into public.rhythm_log (rhythm_id, done_by, done_on, note, was_due_on, was_last_done_on, was_last_done_by)
  values (
    target_rhythm, caller, on_day, nullif(left(trim(coalesce(note, '')), 200), ''),
    item.due_on, item.last_done_on, item.last_done_by
  )
  returning id into entry;

  next_due := case when item.repeat_months is null then null
    else (on_day + make_interval(months => item.repeat_months))::date end;
  -- Doing it early (or backdating) never moves the date backwards.
  if next_due is not null and item.due_on is not null and on_day < item.due_on and next_due < item.due_on then
    next_due := item.due_on;
  end if;

  update public.rhythms
  set due_on = next_due,
      last_done_on = greatest(on_day, coalesce(item.last_done_on, on_day)),
      last_done_by = case when item.last_done_on is null or on_day >= item.last_done_on then caller else item.last_done_by end,
      heads_up_for = null,
      due_day_for = null,
      overdue_for = null
  where id = target_rhythm;

  -- "Someone did it" (RHY-007, off unless turned on), for the rest of the Home.
  select coalesce(nullif(trim(display_name), ''), 'Someone') into doer from public.profiles where id = caller;
  for who in select profile_id from public.home_members where home_id = item.home_id and profile_id <> caller loop
    if public.wants_rhythm_notice(who.profile_id, 'notifyDone') then
      insert into public.notifications (profile_id, nook, kind, title, body, data)
      values (
        who.profile_id, 'rhythms', 'rhythm_done',
        doer || ' did: ' || item.title,
        case when next_due is null then 'All done.' else 'Next due ' || to_char(next_due, 'FMMonth FMDD, YYYY') || '.' end,
        jsonb_build_object('rhythm_id', target_rhythm)
      );
    end if;
  end loop;
  return entry;
end;
$$;

-- Take back the latest "done" on a rhythm: its dates go back to how they were.
create function public.undo_rhythm(target_entry uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  entry public.rhythm_log;
begin
  select * into entry from public.rhythm_log where id = target_entry;
  if not found or not public.is_home_member(public.rhythm_home(entry.rhythm_id)) then
    raise exception 'That isn''t there';
  end if;
  if exists (
    select 1 from public.rhythm_log
    where rhythm_id = entry.rhythm_id and id <> entry.id and created_at > entry.created_at
  ) then
    raise exception 'Only the latest one can be undone';
  end if;

  update public.rhythms
  set due_on = entry.was_due_on,
      last_done_on = entry.was_last_done_on,
      last_done_by = entry.was_last_done_by
  where id = entry.rhythm_id;
  delete from public.rhythm_log where id = entry.id;
end;
$$;

-- ===========================================================================
-- 5. Nudges (RHY-007)
-- ===========================================================================

-- Rhythms settings (nook_settings, 'rhythms'): heads-up, due-day and overdue
-- are on unless turned off; "someone did it" is off unless turned on.
create function public.wants_rhythm_notice(recipient uuid, setting text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select recipient is not null
    and not public.is_managed_profile(recipient)
    and coalesce(
      (select (settings ->> setting)::boolean from public.nook_settings where profile_id = recipient and nook = 'rhythms'),
      setting <> 'notifyDone'
    );
$$;

-- Who hears about a rhythm: its owner if it has one (and they still live
-- there), otherwise everyone in the Home.
create function public.rhythm_recipients(target_rhythm uuid)
returns table (profile_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select m.profile_id
  from public.rhythms r
  join public.home_members m on m.home_id = r.home_id
  where r.id = target_rhythm
    and (
      r.owner is null
      or m.profile_id = r.owner
      or not public.lives_in_home(r.owner, r.home_id)
    );
$$;

-- Runs hourly. Each rhythm gets, once per due date and from 8 AM in the
-- Home's time zone: a heads-up a week ahead (not for monthly ones, which
-- would be noisy), a nudge on the day, and one once it's overdue.
create function public.rhythms_daily()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  item record;
  who record;
  local_now timestamp;
  today date;
  kind text;
  setting text;
  body text;
begin
  for item in
    select id, title, due_on, repeat_months, tz, heads_up_for, due_day_for, overdue_for
    from public.rhythms
    where due_on is not null and due_on <= current_date + 8
  loop
    begin
      local_now := now() at time zone item.tz;
    exception when others then
      local_now := now() at time zone 'UTC';
    end;
    if local_now::time < time '08:00' then
      continue;
    end if;
    today := local_now::date;
    kind := null;

    if item.due_on < today and item.overdue_for is distinct from item.due_on then
      kind := 'rhythm_overdue';
      setting := 'notifyOverdue';
      body := 'This was due ' || to_char(item.due_on, 'FMMonth FMDD') || '.';
      update public.rhythms set overdue_for = item.due_on, due_day_for = item.due_on, heads_up_for = item.due_on where id = item.id;
    elsif item.due_on = today and item.due_day_for is distinct from item.due_on then
      kind := 'rhythm_due';
      setting := 'notifyDueDay';
      body := 'Due today.';
      update public.rhythms set due_day_for = item.due_on, heads_up_for = item.due_on where id = item.id;
    elsif item.due_on > today and item.due_on <= today + 7
      and item.heads_up_for is distinct from item.due_on
      and coalesce(item.repeat_months, 12) > 1
    then
      kind := 'rhythm_heads_up';
      setting := 'notifyHeadsUp';
      body := case when item.due_on = today + 1 then 'Due tomorrow.'
        else 'Due ' || to_char(item.due_on, 'FMDay, FMMonth FMDD') || '.' end;
      update public.rhythms set heads_up_for = item.due_on where id = item.id;
    end if;

    if kind is not null then
      for who in select profile_id from public.rhythm_recipients(item.id) loop
        if public.wants_rhythm_notice(who.profile_id, setting) then
          insert into public.notifications (profile_id, nook, kind, title, body, data)
          values (who.profile_id, 'rhythms', kind, item.title, body, jsonb_build_object('rhythm_id', item.id));
        end if;
      end loop;
    end if;
  end loop;

  -- The log keeps a few years of "last done" history.
  delete from public.rhythm_log where done_on < current_date - interval '5 years';
end;
$$;

revoke execute on function public.complete_rhythm(uuid, date, text) from public, anon;
grant execute on function public.complete_rhythm(uuid, date, text) to authenticated;
revoke execute on function public.undo_rhythm(uuid) from public, anon;
grant execute on function public.undo_rhythm(uuid) to authenticated;
revoke execute on function public.rhythms_daily() from public, anon, authenticated;
revoke execute on function public.wants_rhythm_notice(uuid, text) from public, anon, authenticated;
revoke execute on function public.rhythm_recipients(uuid) from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.schedule('rhythm-nudges', '5 * * * *', 'select public.rhythms_daily()');
  else
    raise notice 'pg_cron not available — enable it, then schedule public.rhythms_daily()';
  end if;
exception when others then
  raise notice 'Could not schedule rhythms_daily (%): enable pg_cron in Database > Extensions', sqlerrm;
end;
$$;

-- ===========================================================================
-- 6. Rhythms move with you when you join a Home (HOME-003, HOME-005)
-- ===========================================================================

-- Same as before, plus: a Home that was only yours brings its rhythms along;
-- leaving a shared one hands your rhythms back to "anyone".
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
      delete from public.home_members where profile_id = caller;
      delete from public.homes where id = old_home;
    else
      update public.rhythms set owner = null where home_id = old_home and owner = caller;
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
  delete from public.home_members where profile_id = caller;
  insert into public.homes default values returning id into new_home;
  insert into public.home_members (profile_id, home_id) values (caller, new_home);

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
