-- More inbox notices (CORE-027), so the Nooks use the inbox more fully:
--
--   Gift Nook ... someone plans a new Gathering in your Burrow
--   Potluck ..... a new Potluck is planned; its time, place or name changes;
--                 someone RSVPs (off by default); someone picks a dish (off
--                 by default)
--
-- Every notice has its own on/off switch in that Nook's settings. Anything
-- that could get chatty is off unless you turn it on, like Pet Care's "fed"
-- notice. Managed kids never get notices (they can't sign in), the person
-- who made the change never gets told about their own change, and the
-- automatic Birthday Gatherings (GIFT-035) stay quiet because nobody
-- "planned" them.
--
-- GIFT-007: nothing here looks at claims, tucks or who is getting what.

-- ===========================================================================
-- 1. Gift Nook: a new Gathering
-- ===========================================================================

-- The same function as before, with one more switch.
create or replace function public.wants_notification(recipient uuid, notify_kind text)
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
        when 'gathering_new' then 'notifyGatheringNew'
        when 'new_gifts' then 'notifyNewGifts'
        when 'tuck_changed' then 'notifyTuckChanged'
        when 'member_joined' then 'notifyMemberJoined'
      end)::boolean
      from public.nook_settings
      where profile_id = recipient and nook = 'gift-nook'
    ), true);
$$;

-- plan_birthday() makes Birthday Gatherings on its own: mark that, so
-- the notice below stays quiet for them.
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

  perform set_config('nook.auto_gathering', '1', true);
  insert into public.gatherings (burrow_id, title, kind, ends_at, created_by)
  values (target_burrow, left(trim(gathering_title), 120), 'birthday', gathering_ends_at, caller)
  returning id into new_gathering;
  perform set_config('nook.auto_gathering', '', true);

  insert into public.gathering_honorees (gathering_id, profile_id)
  values (new_gathering, target_profile);

  update public.birthday_gatherings
  set gathering_id = new_gathering
  where burrow_id = target_burrow and profile_id = target_profile and year = birthday_year;

  return new_gathering;
end;
$$;

create function public.notify_new_gathering()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  maker text;
  recipient uuid;
begin
  if coalesce(current_setting('nook.auto_gathering', true), '') = '1' then
    return new;
  end if;

  select coalesce(nullif(trim(display_name), ''), 'Someone') into maker
  from public.profiles where id = coalesce(new.created_by, auth.uid());

  for recipient in
    select m.profile_id from public.burrow_members m
    where m.burrow_id = new.burrow_id
      and m.profile_id is distinct from coalesce(new.created_by, auth.uid())
  loop
    perform public.notify(
      recipient,
      'gathering_new',
      maker || ' planned ' || new.title,
      to_char(new.ends_at at time zone 'UTC', 'FMMon FMDD'),
      jsonb_build_object('gathering_id', new.id, 'burrow_id', new.burrow_id)
    );
  end loop;
  return new;
end;
$$;

create trigger after_gathering_insert
  after insert on public.gatherings
  for each row execute procedure public.notify_new_gathering();

-- ===========================================================================
-- 2. Potluck
-- ===========================================================================

-- Potluck settings (nook_settings, 'potluck'). `fallback` is what it is
-- until the person chooses: on for the useful ones, off for the chatty ones.
create function public.wants_potluck_notice(recipient uuid, setting text, fallback boolean)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select recipient is not null
    and not public.is_managed_profile(recipient)
    and coalesce((
      select (settings ->> setting)::boolean
      from public.nook_settings
      where profile_id = recipient and nook = 'potluck'
    ), fallback);
$$;

create function public.potluck_notice(
  recipient uuid,
  setting text,
  fallback boolean,
  notice_kind text,
  notice_title text,
  notice_body text,
  target_potluck uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.wants_potluck_notice(recipient, setting, fallback) then
    return;
  end if;
  -- A change made twice before it's read is one notice, not two.
  delete from public.notifications
  where profile_id = recipient and nook = 'potluck' and kind = notice_kind
    and read_at is null and data ->> 'potluck_id' = target_potluck::text
    and notice_kind in ('potluck_changed', 'potluck_rsvp');
  insert into public.notifications (profile_id, nook, kind, title, body, data)
  values (recipient, 'potluck', notice_kind, notice_title, notice_body, jsonb_build_object('potluck_id', target_potluck));
end;
$$;

revoke execute on function public.potluck_notice(uuid, text, boolean, text, text, text, uuid) from public, anon, authenticated;

create function public.person_name(target uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(nullif(trim(display_name), ''), 'Someone') from public.profiles where id = target;
$$;

revoke execute on function public.person_name(uuid) from public, anon, authenticated;

-- A new Potluck: everyone in the Burrow is invited.
create function public.notify_new_potluck()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recipient uuid;
  maker uuid := coalesce(new.created_by, auth.uid());
begin
  for recipient in
    select profile_id from public.burrow_members
    where burrow_id = new.burrow_id and profile_id is distinct from maker
  loop
    perform public.potluck_notice(
      recipient, 'notifyNew', true, 'potluck_new',
      public.person_name(maker) || ' is planning ' || new.title,
      'Tap to see what to bring' || coalesce(' · ' || new.place, ''),
      new.id
    );
  end loop;
  return new;
end;
$$;

create trigger after_potluck_insert
  after insert on public.potlucks
  for each row execute procedure public.notify_new_potluck();

-- Time, place or name changed: tell the people going, maybe going, or
-- bringing something.
create function public.notify_potluck_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recipient uuid;
  what text[] := '{}';
begin
  if new.starts_at is distinct from old.starts_at then what := what || 'time'; end if;
  if new.place is distinct from old.place then what := what || 'place'; end if;
  if new.title is distinct from old.title then what := what || 'name'; end if;
  if cardinality(what) = 0 then
    return new;
  end if;

  for recipient in
    select profile_id from public.potluck_rsvps where potluck_id = new.id and status in ('going', 'maybe')
    union
    select brought_by from public.potluck_dishes where potluck_id = new.id
  loop
    continue when recipient is not distinct from auth.uid();
    perform public.potluck_notice(
      recipient, 'notifyChanged', true, 'potluck_changed',
      new.title || ' changed',
      'The ' || array_to_string(what, ' and ') || ' changed',
      new.id
    );
  end loop;
  return new;
end;
$$;

create trigger after_potluck_update
  after update on public.potlucks
  for each row execute procedure public.notify_potluck_changed();

-- Someone RSVPs: the hosts hear about it (off unless turned on).
create function public.notify_potluck_rsvp()
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
  select p.title into title from public.potlucks p where p.id = new.potluck_id;
  for host in
    select profile_id from public.potluck_hosts where potluck_id = new.potluck_id
  loop
    continue when host is not distinct from auth.uid() or host = new.profile_id;
    perform public.potluck_notice(
      host, 'notifyRsvps', false, 'potluck_rsvp',
      case new.status
        when 'going' then who || ' is going'
        when 'maybe' then who || ' might come'
        else who || ' can''t make it'
      end,
      title,
      new.potluck_id
    );
  end loop;
  return new;
end;
$$;

create trigger after_potluck_rsvp
  after insert or update on public.potluck_rsvps
  for each row execute procedure public.notify_potluck_rsvp();

-- Someone picks a dish: the hosts hear about it (off unless turned on).
create function public.notify_potluck_dish()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  host uuid;
  title text;
begin
  select p.title into title from public.potlucks p where p.id = new.potluck_id;
  for host in
    select profile_id from public.potluck_hosts where potluck_id = new.potluck_id
  loop
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

create trigger after_potluck_dish
  after insert on public.potluck_dishes
  for each row execute procedure public.notify_potluck_dish();
