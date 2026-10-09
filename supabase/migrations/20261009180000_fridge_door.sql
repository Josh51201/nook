-- The Fridge Door (CORE-086): a Hearth widget drawn as a fridge door where
-- a Home or a Burrow sticks up little notes and doodles for each other.
-- Each one comes down by itself after a day, three days or a week.
--
--   fridge_notes ........... one note or doodle, on one Home's or one
--                            Burrow's fridge, until `expires_at`
--   notify_fridge_note() ... a notice in everyone else's inbox, which also
--                            lights the Home page's tab on their Hearth
--   fridge_tidy() .......... takes down notes whose time is up (hourly)
--
-- Only the Home (HOME-004) or the Burrow can see its fridge. Nothing here
-- touches gifts, tucks or claims, so GIFT-007 is unaffected.

create table public.fridge_notes (
  id uuid primary key default gen_random_uuid(),
  -- Exactly one of these: whose fridge it's on.
  home_id uuid references public.homes (id) on delete cascade,
  burrow_id uuid references public.burrows (id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('note', 'doodle')),
  -- A note's words, or a doodle's optional caption.
  body text check (body is null or char_length(body) <= 200),
  -- A doodle's pen strokes: [{ "c": color, "w": width, "p": [x, y, x, y, …] }],
  -- points on a 0–1000 square.
  doodle jsonb check (doodle is null or (jsonb_typeof(doodle) = 'array' and octet_length(doodle::text) <= 24000)),
  -- The paper's color key (lib/fridge.ts).
  paper text not null default 'lemon' check (char_length(paper) <= 20),
  -- How long it stays up; expires_at is worked out from it on the way in.
  lasts_days smallint not null default 1 check (lasts_days in (1, 3, 7)),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '1 day',
  check (num_nonnulls(home_id, burrow_id) = 1),
  check (
    (kind = 'note' and char_length(trim(coalesce(body, ''))) > 0 and doodle is null)
    or (kind = 'doodle' and doodle is not null and jsonb_array_length(doodle) between 1 and 60)
  )
);

create index fridge_notes_home on public.fridge_notes (home_id, expires_at) where home_id is not null;
create index fridge_notes_burrow on public.fridge_notes (burrow_id, expires_at) where burrow_id is not null;

alter table public.fridge_notes enable row level security;

-- Whether you're in the Home or Burrow a note is on.
create function public.can_see_fridge(target_home uuid, target_burrow uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when target_home is not null then public.is_home_member(target_home)
    else public.is_burrow_member(target_burrow)
  end;
$$;

-- A note whose time is up is gone, even before fridge_tidy() gets to it.
create policy "fridge_notes seen by their Home or Burrow" on public.fridge_notes
  for select using (expires_at > now() and public.can_see_fridge(home_id, burrow_id));

create policy "fridge_notes stuck up by their Home or Burrow" on public.fridge_notes
  for insert with check (
    author_id = (select auth.uid())
    and not public.is_managed_profile(author_id)
    and public.can_see_fridge(home_id, burrow_id)
  );

-- Whoever stuck it up can take it down. On a Home's fridge anyone in the
-- Home can, like anything else kept there (HOME-004).
create policy "fridge_notes taken down by their author or the Home" on public.fridge_notes
  for delete using (
    author_id = (select auth.uid())
    or (home_id is not null and public.is_home_member(home_id))
  );

-- No update policy: to change a note, take it down and stick up a new one.

-- Times come from the database's clock, never the phone's; a fridge holds
-- at most 30 notes at once; and old notes on it are tidied away.
create function public.prepare_fridge_note()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.created_at := now();
  new.expires_at := now() + make_interval(days => new.lasts_days);

  delete from public.fridge_notes
  where expires_at <= now()
    and (home_id = new.home_id or burrow_id = new.burrow_id);

  if (
    select count(*) from public.fridge_notes
    where home_id = new.home_id or burrow_id = new.burrow_id
  ) >= 30 then
    raise exception 'The fridge is full. Take something down first.';
  end if;
  return new;
end;
$$;

create trigger before_fridge_note_insert
  before insert on public.fridge_notes
  for each row execute procedure public.prepare_fridge_note();

-- ===========================================================================
-- Notices
-- ===========================================================================

-- Fridge settings (nook_settings, 'fridge'): notifyHome and notifyBurrow,
-- both on until someone turns them off.
create function public.wants_fridge_notice(recipient uuid, setting text)
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
      where profile_id = recipient and nook = 'fridge'
    ), true);
$$;

-- Everyone else on that fridge hears about it. One unread notice per
-- fridge: a new note replaces the last one nobody's read yet.
create function public.notify_fridge_note()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recipient uuid;
  who text := public.person_name(new.author_id);
  place_key text := case when new.home_id is not null then 'home_id' else 'burrow_id' end;
  place_id uuid := coalesce(new.home_id, new.burrow_id);
  setting text := case when new.home_id is not null then 'notifyHome' else 'notifyBurrow' end;
  fridge_name text;
begin
  if new.home_id is not null then
    fridge_name := 'the Home fridge';
  else
    select 'the ' || name || ' fridge' into fridge_name from public.burrows where id = new.burrow_id;
  end if;

  for recipient in
    select profile_id from public.home_members where new.home_id is not null and home_id = new.home_id
    union
    select profile_id from public.burrow_members where new.burrow_id is not null and burrow_id = new.burrow_id
  loop
    continue when recipient = new.author_id or not public.wants_fridge_notice(recipient, setting);

    delete from public.notifications
    where profile_id = recipient and nook = 'fridge' and read_at is null
      and data ->> place_key = place_id::text;

    insert into public.notifications (profile_id, nook, kind, title, body, data)
    values (
      recipient,
      'fridge',
      'fridge_note',
      who || case when new.kind = 'doodle' then ' stuck a doodle on ' else ' left a note on ' end || coalesce(fridge_name, 'the fridge'),
      case when new.body is not null then left(trim(new.body), 120) end,
      jsonb_build_object(place_key, place_id, 'note_id', new.id, 'expires_at', new.expires_at)
    );
  end loop;
  return new;
end;
$$;

create trigger after_fridge_note_insert
  after insert on public.fridge_notes
  for each row execute procedure public.notify_fridge_note();

-- A note taken down (or come down by itself) takes its notices with it.
create function public.forget_fridge_note()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.notifications
  where nook = 'fridge' and data ->> 'note_id' = old.id::text;
  return old;
end;
$$;

create trigger after_fridge_note_delete
  after delete on public.fridge_notes
  for each row execute procedure public.forget_fridge_note();

revoke execute on function public.prepare_fridge_note() from public, anon, authenticated;
revoke execute on function public.notify_fridge_note() from public, anon, authenticated;
revoke execute on function public.forget_fridge_note() from public, anon, authenticated;
revoke execute on function public.wants_fridge_notice(uuid, text) from public, anon, authenticated;

-- ===========================================================================
-- Coming down by themselves
-- ===========================================================================

create function public.fridge_tidy()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.fridge_notes where expires_at <= now();
$$;

revoke execute on function public.fridge_tidy() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.schedule('fridge-tidy', '20 * * * *', 'select public.fridge_tidy()');
  else
    raise notice 'pg_cron not available — enable it, then schedule public.fridge_tidy()';
  end if;
exception when others then
  raise notice 'Could not schedule fridge_tidy (%): enable pg_cron in Database > Extensions', sqlerrm;
end;
$$;

-- Live updates: a fridge on screen shows a new note within a moment, and
-- the Home page's tab lights up. Row level security still decides who hears.
alter publication supabase_realtime add table public.fridge_notes;
