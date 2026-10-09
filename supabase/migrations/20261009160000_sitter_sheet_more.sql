-- Sitter Sheet Nook, round two (SIT-010..013).
--
--   routine ................. SIT-010: the day's timeline ({time, what})
--   wifi_name/_password ..... SIT-013: Wi-Fi, with a copy button on the page
--   places .................. SIT-013: where things are
--   codes ................... SIT-013: door or alarm codes, never on a link
--                             unless ticked for that link
--   sitter_opened notice .... SIT-011: the first time a sitter opens a link
--   sitter_ending notice .... SIT-011: the morning a link's last day starts
--
-- Notices go to whoever made the link, each with a switch in the Sitter
-- Sheet's settings (nook_settings, 'sitter'). The sitter's page still only
-- reads; the notices are written by the database, not by the sitter.
--
-- Nothing here touches gifts or claims, so GIFT-007 is unaffected.

-- ===========================================================================
-- 1. More on the sheet
-- ===========================================================================

-- The routine: up to 20 steps of {time "HH:MM", what}.
create function public.sitter_routine_ok(routine jsonb)
returns boolean
language sql
immutable
as $$
  select jsonb_typeof(routine) = 'array'
    and jsonb_array_length(routine) <= 20
    and not exists (
      select 1 from jsonb_array_elements(routine) r
      where jsonb_typeof(r) <> 'object'
        or jsonb_typeof(r -> 'time') is distinct from 'string'
        or (r ->> 'time') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
        or jsonb_typeof(r -> 'what') is distinct from 'string'
        or char_length(r ->> 'what') not between 1 and 80
        or exists (select 1 from jsonb_object_keys(r) k where k not in ('time', 'what'))
    );
$$;

alter table public.sitter_sheets
  add column routine jsonb not null default '[]' check (public.sitter_routine_ok(routine)),
  add column wifi_name text check (wifi_name is null or char_length(wifi_name) <= 60),
  add column wifi_password text check (wifi_password is null or char_length(wifi_password) <= 100),
  add column places text check (places is null or char_length(places) <= 1000),
  add column codes text check (codes is null or char_length(codes) <= 300);

grant update (routine, wifi_name, wifi_password, places, codes) on public.sitter_sheets to authenticated;

-- The new sections a link can show. Same signature, so the existing check
-- on sitter_links picks it up.
create or replace function public.sitter_sections_ok(sections text[])
returns boolean
language sql
immutable
as $$
  select sections <@ array[
    'address', 'contacts', 'doctor', 'bedtime', 'rules', 'food', 'notes',
    'routine', 'wifi', 'places', 'codes'
  ]::text[];
$$;

-- Codes are never on by default.
alter table public.sitter_links
  alter column sections set default array[
    'address', 'contacts', 'doctor', 'bedtime', 'rules', 'food', 'notes', 'routine', 'wifi', 'places'
  ]::text[],
  add column ending_noticed boolean not null default false;

-- Moving a link's last day means it can warn again.
create or replace function public.sitter_link_defaults()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.token := public.new_sitter_token();
    new.views := 0;
    new.last_viewed_at := null;
    new.revoked_at := null;
    new.ending_noticed := false;
  elsif new.ends_on is distinct from old.ends_on then
    new.ending_noticed := false;
  end if;
  new.expires_at := ((new.ends_on + 1)::timestamp at time zone new.tz);
  if tg_op = 'INSERT' and new.expires_at <= now() then
    raise exception 'That stay has already ended' using errcode = '22023';
  end if;
  return new;
end;
$$;

-- ===========================================================================
-- 2. Notices (SIT-011)
-- ===========================================================================

-- Both on unless turned off.
create function public.wants_sitter_notice(recipient uuid, setting text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select recipient is not null
    and not public.is_managed_profile(recipient)
    and coalesce(
      (select (settings ->> setting)::boolean from public.nook_settings where profile_id = recipient and nook = 'sitter'),
      true
    );
$$;

-- Runs hourly. From 8 AM on a link's last day (its own time zone), tells
-- whoever made it, once.
create function public.sitter_daily()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  item record;
  local_now timestamp;
begin
  for item in
    select id, label, ends_on, tz, created_by, home_id
    from public.sitter_links
    where not ending_noticed and revoked_at is null and expires_at > now()
      and ends_on <= current_date + 1
  loop
    begin
      local_now := now() at time zone item.tz;
    exception when others then
      local_now := now() at time zone 'UTC';
    end;
    if local_now::date <> item.ends_on or local_now::time < time '08:00' then
      continue;
    end if;
    update public.sitter_links set ending_noticed = true where id = item.id;
    if public.lives_in_home(item.created_by, item.home_id) and public.wants_sitter_notice(item.created_by, 'notifyEnding') then
      insert into public.notifications (profile_id, nook, kind, title, body, data)
      values (item.created_by, 'sitter', 'sitter_ending', item.label, 'This sitter link stops working tonight.', jsonb_build_object('link_id', item.id));
    end if;
  end loop;

  -- Ended links are kept a year for "same as last time", then tidied away.
  delete from public.sitter_links where expires_at < now() - interval '1 year';
end;
$$;

revoke execute on function public.sitter_daily() from public, anon, authenticated;
revoke execute on function public.wants_sitter_notice(uuid, text) from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.schedule('sitter-links', '10 * * * *', 'select public.sitter_daily()');
  else
    raise notice 'pg_cron not available — enable it, then schedule public.sitter_daily()';
  end if;
exception when others then
  raise notice 'Could not schedule sitter_daily (%): enable pg_cron in Database > Extensions', sqlerrm;
end;
$$;

-- ===========================================================================
-- 3. The sitter's way in, with the new sections and the "opened" notice
-- ===========================================================================

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
