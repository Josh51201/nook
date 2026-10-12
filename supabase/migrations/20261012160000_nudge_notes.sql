-- A short note on a nudge (CORE-101). Run after 20261012150000_nudges.sql.
--
-- send_nudge() takes one more, optional thing: a few words of the sender's
-- own, up to 140 letters, shown first in the notice ("“Stocking stuffers
-- would be great!” · Add a few more things to your Wishbook."). Everything
-- else (who can send, who hears, once a day, the off switch) is unchanged.
--
-- GIFT-007: the note is the sender's own words, like a text message. The
-- app adds nothing to it and never sends a nudge on its own; the Wishbook
-- nudge screen reminds the sender not to give away what's been tucked.

-- A new argument means a new function, so the old one goes first (otherwise
-- both would exist and calls without a note couldn't tell them apart).
drop function public.send_nudge(text, uuid, uuid, uuid);

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
-- note: a few words of the sender's own, up to 140 letters, shown first in
-- the notice. Optional.
--
-- Returns how many people were nudged. 0 means everyone was already nudged
-- today (or nobody was left to nudge).
create function public.send_nudge(
  nudge_kind text,
  target uuid,
  person uuid default null,
  about_gathering uuid default null,
  note text default null
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
  clean_note text := nullif(trim(regexp_replace(coalesce(note, ''), '\s+', ' ', 'g')), '');
  -- What goes before each notice's usual words: “the note” · …
  note_lead text;
begin
  if caller is null then
    raise exception 'Sign in first';
  end if;
  if char_length(clean_note) > 140 then
    raise exception 'Keep the note to 140 letters';
  end if;
  note_lead := coalesce('“' || clean_note || '” · ', '');
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
          note_lead || 'Add a few more things to ' || public.person_name(target) || '''s Wishbook'
            || coalesce(' for ' || for_title, '') || '.',
          jsonb_build_object('owner_id', target, 'kid', true)
        );
      end loop;
    else
      perform public.deliver_nudge(
        target, 'gift-nook', 'nudge_wishbook',
        me || ' would love more gift ideas',
        note_lead || 'Add a few more things to your Wishbook' || coalesce(' for ' || for_title, '') || '.',
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
            note_lead || thing_title || ' · ' || public.gathering_day(target),
            jsonb_build_object('gathering_id', target, 'profile_id', who)
          );
        end loop;
      else
        perform public.deliver_nudge(
          who, 'gatherings', 'nudge_rsvp',
          me || ' is asking: are you coming?',
          note_lead || thing_title || ' · ' || public.gathering_day(target),
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
        note_lead || thing_title || ': pick a dish so the food comes together.',
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
      note_lead || 'Before ' || for_title || '.',
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
      note_lead || 'It''s yours to do.',
      jsonb_build_object('rhythm_id', target)
    );
    return 1;
  end if;

  raise exception 'Unknown nudge';
end;
$$;

revoke execute on function public.send_nudge(text, uuid, uuid, uuid, text) from public, anon;
grant execute on function public.send_nudge(text, uuid, uuid, uuid, text) to authenticated;
