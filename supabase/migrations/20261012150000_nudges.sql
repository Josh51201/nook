-- Nudges (CORE-101): a one-tap reminder from one person to another, wherever
-- someone is waiting on someone else. Each lands in the inbox of the Nook
-- it's about.
--
--   wishbook ... Gift Nook: "Add more to your Wishbook" (to the grown-ups
--                who look after a kid's Wishbook, for a kid)
--   rsvp ....... Gathering Nook: hosts nudge guests who haven't answered
--                (for a kid: the grown-ups who answer for them)
--   dish ....... Potluck Nook: hosts nudge people coming who haven't
--                picked a dish
--   todo ....... Getaway Nook: a before-you-go task that's someone's to do
--   rhythm ..... Rhythms Nook: a chore that's someone's to do
--
--   nudges ........ who nudged whom about what, so each person can only be
--                   nudged about one thing once a day by the same person.
--                   Only the sender can see their own.
--   send_nudge() .. the only way in: checks you're allowed, picks who
--                   hears, and sends the notices.
--
-- Anyone can turn nudges off (Settings → Notifications → Nudges). The sender
-- is never told, so turning them off doesn't hurt anyone's feelings.
--
-- GIFT-007: a Wishbook nudge says only that someone would like more ideas.
-- It is only ever sent by a person tapping the button, never by the app on
-- its own, and nothing here reads claims, so it can't hint at what's been
-- tucked away.

-- ===========================================================================
-- 1. Who nudged whom
-- ===========================================================================

create table public.nudges (
  id uuid primary key default gen_random_uuid(),
  sent_by uuid not null references public.profiles (id) on delete cascade,
  -- The person it's about (a kid, even when their grown-ups are the ones
  -- who hear).
  sent_to uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('wishbook', 'rsvp', 'dish', 'todo', 'rhythm')),
  -- The Wishbook's owner, the Gathering, the Potluck, the task or the chore.
  target uuid not null,
  created_at timestamptz not null default now()
);

create index nudges_recent on public.nudges (sent_by, sent_to, kind, target, created_at desc);

alter table public.nudges enable row level security;

-- Only send_nudge() writes here.
create policy "nudges seen by who sent them" on public.nudges
  for select using (sent_by = (select auth.uid()));

-- ===========================================================================
-- 2. Helpers
-- ===========================================================================

-- Settings → Notifications → Nudges (lib/notification-catalog.ts). On unless
-- turned off. Kids never get notices (they can't sign in).
create function public.wants_nudges(recipient uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select recipient is not null
    and not public.is_managed_profile(recipient)
    and coalesce((
      select (settings ->> 'notifyNudges')::boolean
      from public.nook_settings
      where profile_id = recipient and nook = 'nudges'
    ), true);
$$;

revoke execute on function public.wants_nudges(uuid) from public, anon, authenticated;

-- Puts one nudge in someone's inbox. A second nudge about the same thing
-- before the first is read replaces it, so the inbox doesn't fill up.
create function public.deliver_nudge(
  recipient uuid,
  notice_nook text,
  notice_kind text,
  notice_title text,
  notice_body text,
  notice_data jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if recipient is null or recipient = auth.uid() or not public.wants_nudges(recipient) then
    return;
  end if;
  delete from public.notifications
  where profile_id = recipient and nook = notice_nook and kind = notice_kind
    and read_at is null and data = notice_data;
  insert into public.notifications (profile_id, nook, kind, title, body, data)
  values (recipient, notice_nook, notice_kind, notice_title, notice_body, notice_data);
end;
$$;

revoke execute on function public.deliver_nudge(uuid, text, text, text, text, jsonb) from public, anon, authenticated;

-- Notes a nudge, or says no if the caller already nudged this person about
-- this thing in the last 20 hours ("once a day", with some slack for
-- someone who nudges at 8pm one day and 7pm the next).
create function public.log_nudge(person uuid, nudge_kind text, nudge_target uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.nudges
    where sent_by = auth.uid() and sent_to = person and kind = nudge_kind and target = nudge_target
      and created_at > now() - interval '20 hours'
  ) then
    return false;
  end if;
  insert into public.nudges (sent_by, sent_to, kind, target) values (auth.uid(), person, nudge_kind, nudge_target);
  return true;
end;
$$;

revoke execute on function public.log_nudge(uuid, text, uuid) from public, anon, authenticated;

-- ===========================================================================
-- 3. send_nudge()
-- ===========================================================================

-- nudge_kind  target                     person
-- wishbook    the Wishbook's owner       (unused)
-- rsvp        the Gathering              one guest, or null for everyone
--                                        who hasn't answered
-- dish        the Potluck                one person, or null for everyone
--                                        coming without a dish
-- todo        the Getaway task           (unused: whoever's doing it)
-- rhythm      the chore                  (unused: whoever's it is)
--
-- about_gathering: for a Wishbook nudge, the Gathering it's for ("…before
-- Christmas"), if there is one.
--
-- Returns how many people were nudged. 0 means everyone was already nudged
-- today (or nobody was left to nudge).
create function public.send_nudge(
  nudge_kind text,
  target uuid,
  person uuid default null,
  about_gathering uuid default null
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  me text;
  who uuid;
  hearer uuid;
  sent int := 0;
  thing_title text;
  thing_parent uuid;
  doer uuid;
  done_when timestamptz;
  item_kind text;
  for_title text;
begin
  if caller is null then
    raise exception 'Sign in first';
  end if;
  me := public.person_name(caller);

  -- Gift Nook: more ideas, please.
  if nudge_kind = 'wishbook' then
    if target = caller or not public.shares_burrow_with(caller, target) then
      raise exception 'You can only nudge people who share a Burrow with you';
    end if;
    if about_gathering is not null then
      if not public.can_see_gathering(about_gathering) then
        raise exception 'That Gathering isn''t one you''re invited to';
      end if;
      select title into for_title from public.gatherings where id = about_gathering;
    end if;
    if not public.log_nudge(target, 'wishbook', target) then
      return 0;
    end if;
    if public.is_managed_profile(target) then
      for hearer in select manager_id from public.profile_managers where profile_id = target loop
        perform public.deliver_nudge(
          hearer, 'gift-nook', 'nudge_wishbook',
          me || ' would love more gift ideas for ' || public.person_name(target),
          'Add a few more things to ' || public.person_name(target) || '''s Wishbook'
            || coalesce(' for ' || for_title, '') || '.',
          jsonb_build_object('owner_id', target, 'kid', true)
        );
      end loop;
    else
      perform public.deliver_nudge(
        target, 'gift-nook', 'nudge_wishbook',
        me || ' would love more gift ideas',
        'Add a few more things to your Wishbook' || coalesce(' for ' || for_title, '') || '.',
        jsonb_build_object('owner_id', target)
      );
    end if;
    return 1;
  end if;

  -- Gathering Nook: are you coming?
  if nudge_kind = 'rsvp' then
    if not public.can_host_gathering(target) then
      raise exception 'Only a host can nudge people to answer';
    end if;
    select title into thing_title from public.gatherings where id = target and ends_at > now();
    if thing_title is null then
      raise exception 'That Gathering has already happened';
    end if;
    for who in
      select ids.guest_id
      from public.gathering_guest_ids(target) as ids(guest_id)
      where ids.guest_id <> caller
        and (person is null or ids.guest_id = person)
        -- Your own kids you can answer for yourself.
        and not exists (
          select 1 from public.profile_managers pm where pm.profile_id = ids.guest_id and pm.manager_id = caller
        )
        and not exists (
          select 1 from public.gathering_rsvps r where r.gathering_id = target and r.profile_id = ids.guest_id
        )
    loop
      continue when not public.log_nudge(who, 'rsvp', target);
      sent := sent + 1;
      if public.is_managed_profile(who) then
        for hearer in select manager_id from public.profile_managers where profile_id = who loop
          perform public.deliver_nudge(
            hearer, 'gatherings', 'nudge_rsvp',
            me || ' is asking: is ' || public.person_name(who) || ' coming?',
            thing_title || ' · ' || public.gathering_day(target),
            jsonb_build_object('gathering_id', target, 'profile_id', who)
          );
        end loop;
      else
        perform public.deliver_nudge(
          who, 'gatherings', 'nudge_rsvp',
          me || ' is asking: are you coming?',
          thing_title || ' · ' || public.gathering_day(target),
          jsonb_build_object('gathering_id', target, 'profile_id', who)
        );
      end if;
    end loop;
    return sent;
  end if;

  -- Potluck Nook: what are you bringing?
  if nudge_kind = 'dish' then
    if not public.can_host_potluck(target) then
      raise exception 'Only a host can nudge people to pick a dish';
    end if;
    select title, gathering_id into thing_title, thing_parent from public.potlucks where id = target and starts_at > now();
    if thing_title is null then
      raise exception 'That Potluck has already happened';
    end if;
    for who in
      select r.profile_id
      from public.gathering_rsvps r
      where r.gathering_id = thing_parent
        and r.status in ('going', 'maybe')
        and r.profile_id <> caller
        and (person is null or r.profile_id = person)
        and not public.is_managed_profile(r.profile_id)
        and not exists (
          select 1 from public.potluck_dishes d where d.potluck_id = target and d.brought_by = r.profile_id
        )
    loop
      continue when not public.log_nudge(who, 'dish', target);
      sent := sent + 1;
      perform public.deliver_nudge(
        who, 'potluck', 'nudge_dish',
        me || ' is asking what you''ll bring',
        thing_title || ': pick a dish so the food comes together.',
        jsonb_build_object('potluck_id', target)
      );
    end loop;
    return sent;
  end if;

  -- Getaway Nook: a before-you-go task.
  if nudge_kind = 'todo' then
    select i.getaway_id, i.kind, i.for_person, i.done_at, i.text
      into thing_parent, item_kind, doer, done_when, thing_title
    from public.getaway_items i where i.id = target;
    if thing_parent is null or not public.is_going(thing_parent) then
      raise exception 'That isn''t on a Getaway you''re going on';
    end if;
    if item_kind <> 'todo' or doer is null or doer = caller or done_when is not null then
      raise exception 'There''s nobody to nudge about that';
    end if;
    if not public.log_nudge(doer, 'todo', target) then
      return 0;
    end if;
    select title into for_title from public.getaways where id = thing_parent;
    perform public.deliver_nudge(
      doer, 'getaways', 'nudge_todo',
      me || ' is reminding you: ' || thing_title,
      'Before ' || for_title || '.',
      jsonb_build_object('getaway_id', thing_parent, 'item_id', target)
    );
    return 1;
  end if;

  -- Rhythms Nook: a chore that's someone's to do.
  if nudge_kind = 'rhythm' then
    select title, owner into thing_title, doer from public.rhythms where id = target;
    if thing_title is null or not public.lives_in_home(caller, public.rhythm_home(target)) then
      raise exception 'That isn''t one of your Home''s rhythms';
    end if;
    if doer is null or doer = caller then
      raise exception 'There''s nobody to nudge about that';
    end if;
    if not public.log_nudge(doer, 'rhythm', target) then
      return 0;
    end if;
    perform public.deliver_nudge(
      doer, 'rhythms', 'nudge_rhythm',
      me || ' is reminding you: ' || thing_title,
      'It''s yours to do.',
      jsonb_build_object('rhythm_id', target)
    );
    return 1;
  end if;

  raise exception 'Unknown nudge';
end;
$$;

revoke execute on function public.send_nudge(text, uuid, uuid, uuid) from public, anon;
grant execute on function public.send_nudge(text, uuid, uuid, uuid) to authenticated;
