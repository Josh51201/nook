-- Letterbox Nook (LET-001..011) and mailing addresses (PROF-005).
--
--   profile_addresses ........ PROF-005: your own mailing address
--   address_hidden_burrows ... PROF-005: Burrows you leave out (a work Burrow)
--   letterboxes .............. LET-002: one per household
--   letterbox_members ........ LET-002: who shares it (one Letterbox each)
--   letterbox_invites ........ LET-002: asked from your Burrows, then accepted
--   letterbox_households ..... LET-003/004: one entry per mailing address
--   letterbox_people ......... LET-003: who lives there (birthdays, LET-010)
--   letterbox_cards .......... LET-005/006/007: cards sent and received
--   letterbox_thanks ......... LET-011: thank-you notes owed
--   letterbox_daily() ........ LET-010: birthday-card reminders a week ahead
--   storage bucket letterbox . LET-007: photos of cards
--
-- GIFT-007: nothing here reads claims. Thank-yous can point at one of your
-- own *received* gifts (GIFT-026), but who it was from is only ever what
-- you typed in yourself.

-- ===========================================================================
-- 1. Mailing addresses (PROF-005)
-- ===========================================================================

-- Kept off public.profiles on purpose (like dietary_needs): profiles also
-- reach "co-givers" in other families, and an address should only reach the
-- Burrows its owner chose.
create table public.profile_addresses (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  line1 text not null check (char_length(trim(line1)) between 1 and 120),
  line2 text check (line2 is null or char_length(line2) <= 120),
  city text not null check (char_length(trim(city)) between 1 and 80),
  region text check (region is null or char_length(region) <= 60),
  postal_code text check (postal_code is null or char_length(postal_code) <= 20),
  country text check (country is null or char_length(country) <= 60),
  updated_at timestamptz not null default now()
);

-- Burrows that don't get to see your address. A separate table so the list
-- itself stays private to you.
create table public.address_hidden_burrows (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  burrow_id uuid not null references public.burrows (id) on delete cascade,
  primary key (profile_id, burrow_id)
);

alter table public.profile_addresses enable row level security;
alter table public.address_hidden_burrows enable row level security;

-- ===========================================================================
-- 2. Letterbox tables
-- ===========================================================================

create table public.letterboxes (
  id uuid primary key default gen_random_uuid(),
  -- How the household signs its cards and the return-address name
  -- ("Josh & Sarah McDowell").
  signed_as text check (signed_as is null or char_length(signed_as) <= 80),
  created_at timestamptz not null default now()
);

-- One Letterbox per person (the primary key), shared by everyone in it.
create table public.letterbox_members (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  letterbox_id uuid not null references public.letterboxes (id) on delete cascade,
  joined_at timestamptz not null default now()
);

create index letterbox_members_box on public.letterbox_members (letterbox_id);

create table public.letterbox_invites (
  id uuid primary key default gen_random_uuid(),
  letterbox_id uuid not null references public.letterboxes (id) on delete cascade,
  invited uuid not null references public.profiles (id) on delete cascade,
  invited_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (letterbox_id, invited)
);

create table public.letterbox_households (
  id uuid primary key default gen_random_uuid(),
  letterbox_id uuid not null references public.letterboxes (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  -- A family member whose own profile address this household uses, so it
  -- stays current when they move (LET-004). Otherwise the typed one below.
  address_from uuid references public.profiles (id) on delete set null,
  line1 text check (line1 is null or char_length(line1) <= 120),
  line2 text check (line2 is null or char_length(line2) <= 120),
  city text check (city is null or char_length(city) <= 80),
  region text check (region is null or char_length(region) <= 60),
  postal_code text check (postal_code is null or char_length(postal_code) <= 20),
  country text check (country is null or char_length(country) <= 60),
  on_holiday_list boolean not null default true,
  notes text check (notes is null or char_length(notes) <= 500),
  created_at timestamptz not null default now()
);

create index letterbox_households_box on public.letterbox_households (letterbox_id, name);

create table public.letterbox_people (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.letterbox_households (id) on delete cascade,
  letterbox_id uuid not null references public.letterboxes (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 60),
  birthday date,
  -- Linked to someone on Nook: their profile's birthday wins over this one.
  profile_id uuid references public.profiles (id) on delete set null,
  position int not null default 0
);

create index letterbox_people_household on public.letterbox_people (household_id, position);
create index letterbox_people_box on public.letterbox_people (letterbox_id);

create table public.letterbox_cards (
  id uuid primary key default gen_random_uuid(),
  letterbox_id uuid not null references public.letterboxes (id) on delete cascade,
  household_id uuid not null references public.letterbox_households (id) on delete cascade,
  direction text not null check (direction in ('sent', 'received')),
  occasion text not null check (
    occasion in ('holiday', 'birthday', 'thank_you', 'sympathy', 'wedding', 'graduation', 'baby', 'get_well', 'other')
  ),
  -- The year it counts for: a holiday card that arrives in January still
  -- belongs to last year's season.
  season int not null check (season between 1900 and 2200),
  on_date date not null default current_date,
  note text check (note is null or char_length(note) <= 300),
  photo_path text check (photo_path is null or char_length(photo_path) <= 300),
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index letterbox_cards_box on public.letterbox_cards (letterbox_id, season);
create index letterbox_cards_household on public.letterbox_cards (household_id, on_date desc);

create table public.letterbox_thanks (
  id uuid primary key default gen_random_uuid(),
  letterbox_id uuid not null references public.letterboxes (id) on delete cascade,
  -- Who it's to: a household in the Letterbox, or just a name.
  household_id uuid references public.letterbox_households (id) on delete set null,
  from_name text check (from_name is null or char_length(trim(from_name)) between 1 and 80),
  what text not null check (char_length(trim(what)) between 1 and 120),
  -- One of your own received gifts (GIFT-026), or a kid's you manage.
  gift_id uuid references public.gifts (id) on delete set null,
  thanked_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  check (household_id is not null or from_name is not null)
);

create index letterbox_thanks_box on public.letterbox_thanks (letterbox_id, thanked_at);
create unique index letterbox_thanks_gift on public.letterbox_thanks (letterbox_id, gift_id) where gift_id is not null;

alter table public.letterboxes enable row level security;
alter table public.letterbox_members enable row level security;
alter table public.letterbox_invites enable row level security;
alter table public.letterbox_households enable row level security;
alter table public.letterbox_people enable row level security;
alter table public.letterbox_cards enable row level security;
alter table public.letterbox_thanks enable row level security;

-- ===========================================================================
-- 3. Helpers (security definer so they don't re-enter RLS)
-- ===========================================================================

create function public.is_letterbox_member(target_box uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.letterbox_members
    where letterbox_id = target_box and profile_id = (select auth.uid())
  );
$$;

create function public.is_invited_to_letterbox(target_box uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.letterbox_invites
    where letterbox_id = target_box and invited = (select auth.uid())
  );
$$;

create function public.shares_letterbox_with(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.letterbox_members mine
    join public.letterbox_members theirs on theirs.letterbox_id = mine.letterbox_id
    where mine.profile_id = (select auth.uid()) and theirs.profile_id = target
  );
$$;

-- PROF-005: you, your household, and anyone sharing a Burrow with you that
-- you haven't left out.
create function public.can_see_address(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target = (select auth.uid())
    or public.shares_letterbox_with(target)
    or exists (
      select 1
      from public.burrow_members mine
      join public.burrow_members theirs on theirs.burrow_id = mine.burrow_id
      where mine.profile_id = (select auth.uid())
        and theirs.profile_id = target
        and not exists (
          select 1 from public.address_hidden_burrows hidden
          where hidden.profile_id = target and hidden.burrow_id = mine.burrow_id
        )
    );
$$;

create function public.household_in_letterbox(target_household uuid, target_box uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.letterbox_households where id = target_household and letterbox_id = target_box
  );
$$;

-- A received gift you (or a kid you manage) own — never anyone else's.
create function public.can_thank_for_gift(target_gift uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.gifts g
    where g.id = target_gift and g.received_at is not null and public.can_manage_wishbook(g.wishbook_id)
  );
$$;

-- Photos live at "<letterbox id>/<file>" in the letterbox bucket.
create function public.can_use_letterbox_photo(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when split_part(object_name, '/', 1) ~ '^[0-9a-fA-F-]{36}$'
      then public.is_letterbox_member(split_part(object_name, '/', 1)::uuid)
    else false
  end;
$$;

-- ===========================================================================
-- 4. Row level security
-- ===========================================================================

-- profile_addresses ----------------------------------------------------------
create policy "profile_addresses visible to self, household and chosen Burrows" on public.profile_addresses
  for select using (public.can_see_address(profile_id));

create policy "profile_addresses added by self" on public.profile_addresses
  for insert with check (profile_id = (select auth.uid()));

create policy "profile_addresses edited by self" on public.profile_addresses
  for update using (profile_id = (select auth.uid())) with check (profile_id = (select auth.uid()));

create policy "profile_addresses cleared by self" on public.profile_addresses
  for delete using (profile_id = (select auth.uid()));

-- address_hidden_burrows -----------------------------------------------------
create policy "address_hidden_burrows only for self" on public.address_hidden_burrows
  for select using (profile_id = (select auth.uid()));

create policy "address_hidden_burrows added by self" on public.address_hidden_burrows
  for insert with check (profile_id = (select auth.uid()) and public.is_burrow_member(burrow_id));

create policy "address_hidden_burrows removed by self" on public.address_hidden_burrows
  for delete using (profile_id = (select auth.uid()));

-- letterboxes (made and joined through the functions below) --------------------
create policy "letterboxes visible to members and invitees" on public.letterboxes
  for select using (public.is_letterbox_member(id) or public.is_invited_to_letterbox(id));

create policy "letterboxes edited by members" on public.letterboxes
  for update using (public.is_letterbox_member(id)) with check (public.is_letterbox_member(id));

revoke update on public.letterboxes from anon, authenticated;
grant update (signed_as) on public.letterboxes to authenticated;

create policy "letterbox_members visible to members and invitees" on public.letterbox_members
  for select using (public.is_letterbox_member(letterbox_id) or public.is_invited_to_letterbox(letterbox_id));

-- letterbox_invites (sent through invite_to_letterbox) -------------------------
create policy "letterbox_invites visible to the household and the invitee" on public.letterbox_invites
  for select using (invited = (select auth.uid()) or public.is_letterbox_member(letterbox_id));

create policy "letterbox_invites withdrawn or declined" on public.letterbox_invites
  for delete using (invited = (select auth.uid()) or public.is_letterbox_member(letterbox_id));

-- households -----------------------------------------------------------------
create policy "letterbox_households for the household" on public.letterbox_households
  for select using (public.is_letterbox_member(letterbox_id));

-- Using someone's profile address needs to be able to see it in the first place.
create policy "letterbox_households added by the household" on public.letterbox_households
  for insert with check (
    public.is_letterbox_member(letterbox_id)
    and (address_from is null or public.can_see_address(address_from))
  );

create policy "letterbox_households edited by the household" on public.letterbox_households
  for update using (public.is_letterbox_member(letterbox_id))
  with check (
    public.is_letterbox_member(letterbox_id)
    and (address_from is null or public.can_see_address(address_from))
  );

create policy "letterbox_households removed by the household" on public.letterbox_households
  for delete using (public.is_letterbox_member(letterbox_id));

-- people ---------------------------------------------------------------------
create policy "letterbox_people for the household" on public.letterbox_people
  for select using (public.is_letterbox_member(letterbox_id));

create policy "letterbox_people added by the household" on public.letterbox_people
  for insert with check (
    public.is_letterbox_member(letterbox_id)
    and public.household_in_letterbox(household_id, letterbox_id)
    and (profile_id is null or profile_id = (select auth.uid()) or public.shares_burrow_with((select auth.uid()), profile_id))
  );

create policy "letterbox_people edited by the household" on public.letterbox_people
  for update using (public.is_letterbox_member(letterbox_id))
  with check (
    public.is_letterbox_member(letterbox_id)
    and public.household_in_letterbox(household_id, letterbox_id)
    and (profile_id is null or profile_id = (select auth.uid()) or public.shares_burrow_with((select auth.uid()), profile_id))
  );

create policy "letterbox_people removed by the household" on public.letterbox_people
  for delete using (public.is_letterbox_member(letterbox_id));

-- cards ----------------------------------------------------------------------
create policy "letterbox_cards for the household" on public.letterbox_cards
  for select using (public.is_letterbox_member(letterbox_id));

create policy "letterbox_cards added by the household" on public.letterbox_cards
  for insert with check (
    public.is_letterbox_member(letterbox_id)
    and public.household_in_letterbox(household_id, letterbox_id)
    and (photo_path is null or split_part(photo_path, '/', 1) = letterbox_id::text)
  );

create policy "letterbox_cards edited by the household" on public.letterbox_cards
  for update using (public.is_letterbox_member(letterbox_id))
  with check (
    public.is_letterbox_member(letterbox_id)
    and public.household_in_letterbox(household_id, letterbox_id)
    and (photo_path is null or split_part(photo_path, '/', 1) = letterbox_id::text)
  );

create policy "letterbox_cards removed by the household" on public.letterbox_cards
  for delete using (public.is_letterbox_member(letterbox_id));

-- thank-yous -----------------------------------------------------------------
create policy "letterbox_thanks for the household" on public.letterbox_thanks
  for select using (public.is_letterbox_member(letterbox_id));

create policy "letterbox_thanks added by the household" on public.letterbox_thanks
  for insert with check (
    public.is_letterbox_member(letterbox_id)
    and (household_id is null or public.household_in_letterbox(household_id, letterbox_id))
    and (gift_id is null or public.can_thank_for_gift(gift_id))
  );

create policy "letterbox_thanks edited by the household" on public.letterbox_thanks
  for update using (public.is_letterbox_member(letterbox_id))
  with check (
    public.is_letterbox_member(letterbox_id)
    and (household_id is null or public.household_in_letterbox(household_id, letterbox_id))
  );

create policy "letterbox_thanks removed by the household" on public.letterbox_thanks
  for delete using (public.is_letterbox_member(letterbox_id));

-- A thank-you can't be re-pointed at a different gift after the fact.
revoke update on public.letterbox_thanks from anon, authenticated;
grant update (household_id, from_name, what, thanked_at) on public.letterbox_thanks to authenticated;

-- ===========================================================================
-- 5. Your Letterbox, invites, joining and leaving (LET-002)
-- ===========================================================================

-- Your Letterbox, made the first time you open the Nook.
create function public.my_letterbox()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  box uuid;
begin
  if caller is null or public.is_managed_profile(caller) then
    raise exception 'Sign in to use the Letterbox';
  end if;
  select letterbox_id into box from public.letterbox_members where profile_id = caller;
  if box is null then
    insert into public.letterboxes default values returning id into box;
    insert into public.letterbox_members (profile_id, letterbox_id) values (caller, box)
    on conflict (profile_id) do nothing;
    if not found then
      -- Opened on two screens at once: keep the one that won.
      delete from public.letterboxes where id = box;
      select letterbox_id into box from public.letterbox_members where profile_id = caller;
    end if;
  end if;
  return box;
end;
$$;

-- Ask someone you share a Burrow with to share your Letterbox.
create function public.invite_to_letterbox(target uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  box uuid;
  invite uuid;
  inviter text;
begin
  select letterbox_id into box from public.letterbox_members where profile_id = caller;
  if box is null then
    raise exception 'Open your Letterbox first';
  end if;
  if target is null or target = caller or public.is_managed_profile(target) then
    raise exception 'You can''t invite them';
  end if;
  if not public.shares_burrow_with(caller, target) then
    raise exception 'You can only invite family from your Burrows';
  end if;
  if exists (select 1 from public.letterbox_members where profile_id = target and letterbox_id = box) then
    raise exception 'They already share this Letterbox';
  end if;

  insert into public.letterbox_invites (letterbox_id, invited, invited_by)
  values (box, target, caller)
  on conflict (letterbox_id, invited) do update set created_at = now(), invited_by = excluded.invited_by
  returning id into invite;

  select coalesce(nullif(trim(display_name), ''), 'Someone') into inviter from public.profiles where id = caller;
  insert into public.notifications (profile_id, nook, kind, title, body, data)
  values (
    target,
    'letterbox',
    'letterbox_invite',
    inviter || ' wants to share a Letterbox',
    'One card and address list for your household. Tap to answer.',
    jsonb_build_object('invite_id', invite)
  );
  return invite;
end;
$$;

-- Join a Letterbox you were invited to. If yours was only yours, its whole
-- list comes along with you; otherwise you just leave it.
create function public.accept_letterbox_invite(invite_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  target_box uuid;
  inviter uuid;
  old_box uuid;
  others int;
  joiner text;
begin
  select letterbox_id, invited_by into target_box, inviter
  from public.letterbox_invites where id = invite_id and invited = caller;
  if target_box is null then
    raise exception 'That invite isn''t there any more';
  end if;

  select letterbox_id into old_box from public.letterbox_members where profile_id = caller;
  if old_box is not null and old_box <> target_box then
    select count(*) into others from public.letterbox_members where letterbox_id = old_box and profile_id <> caller;
    if others = 0 then
      -- A kid's gift two parents both thanked for: keep the one already there.
      delete from public.letterbox_thanks t
      where t.letterbox_id = old_box and t.gift_id is not null
        and exists (
          select 1 from public.letterbox_thanks kept
          where kept.letterbox_id = target_box and kept.gift_id = t.gift_id
        );
      update public.letterbox_households set letterbox_id = target_box where letterbox_id = old_box;
      update public.letterbox_people set letterbox_id = target_box where letterbox_id = old_box;
      update public.letterbox_cards set letterbox_id = target_box where letterbox_id = old_box;
      update public.letterbox_thanks set letterbox_id = target_box where letterbox_id = old_box;
      delete from public.letterbox_members where profile_id = caller;
      delete from public.letterboxes where id = old_box;
    else
      delete from public.letterbox_members where profile_id = caller;
    end if;
  end if;

  insert into public.letterbox_members (profile_id, letterbox_id)
  values (caller, target_box)
  on conflict (profile_id) do update set letterbox_id = excluded.letterbox_id, joined_at = now();
  delete from public.letterbox_invites where letterbox_id = target_box and invited = caller;

  if inviter is not null and inviter <> caller then
    select coalesce(nullif(trim(display_name), ''), 'Someone') into joiner from public.profiles where id = caller;
    insert into public.notifications (profile_id, nook, kind, title, body, data)
    values (inviter, 'letterbox', 'letterbox_joined', joiner || ' joined your Letterbox', 'You now share one card list.', '{}'::jsonb);
  end if;
  return target_box;
end;
$$;

-- Leave a shared Letterbox. You get your own again, with a copy of the
-- addresses (not the card history, which stays with the household).
create function public.leave_letterbox()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  old_box uuid;
  new_box uuid;
  house record;
  new_house uuid;
begin
  select letterbox_id into old_box from public.letterbox_members where profile_id = caller;
  if old_box is null then
    return public.my_letterbox();
  end if;
  if not exists (select 1 from public.letterbox_members where letterbox_id = old_box and profile_id <> caller) then
    raise exception 'This Letterbox is only yours';
  end if;

  delete from public.letterbox_members where profile_id = caller;
  insert into public.letterboxes default values returning id into new_box;
  insert into public.letterbox_members (profile_id, letterbox_id) values (caller, new_box);

  for house in select * from public.letterbox_households where letterbox_id = old_box loop
    insert into public.letterbox_households (
      letterbox_id, name, address_from, line1, line2, city, region, postal_code, country, on_holiday_list, notes
    )
    values (
      new_box, house.name,
      case when public.can_see_address(house.address_from) then house.address_from end,
      house.line1, house.line2, house.city, house.region, house.postal_code, house.country,
      house.on_holiday_list, house.notes
    )
    returning id into new_house;
    insert into public.letterbox_people (household_id, letterbox_id, name, birthday, profile_id, position)
    select new_house, new_box, name, birthday, profile_id, position
    from public.letterbox_people where household_id = house.id;
  end loop;
  return new_box;
end;
$$;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.my_letterbox()',
    'public.invite_to_letterbox(uuid)',
    'public.accept_letterbox_invite(uuid)',
    'public.leave_letterbox()'
  ] loop
    execute format('revoke execute on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end;
$$;

-- ===========================================================================
-- 6. Birthday-card reminders (LET-010)
-- ===========================================================================

-- Letterbox settings (nook_settings, 'letterbox'); on unless turned off.
create function public.wants_letterbox_reminder(recipient uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select recipient is not null
    and coalesce((
      select (settings ->> 'notifyBirthdays')::boolean
      from public.nook_settings
      where profile_id = recipient and nook = 'letterbox'
    ), true);
$$;

-- Runs once a day: anyone in your Letterbox whose birthday is a week away
-- gets you a nudge to send a card. Feb 29 birthdays count on Mar 1 in
-- other years.
create function public.letterbox_daily()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target date := current_date + 7;
  leap boolean := extract(day from make_date(extract(year from (current_date + 7))::int, 3, 1) - 1) = 29;
  due record;
begin
  for due in
    select m.profile_id as recipient, p.household_id, p.name
    from public.letterbox_people p
    join public.letterbox_members m on m.letterbox_id = p.letterbox_id
    left join public.profiles pr on pr.id = p.profile_id
    where coalesce(pr.birthday, p.birthday) is not null
      and p.profile_id is distinct from m.profile_id
      and (
        to_char(coalesce(pr.birthday, p.birthday), 'MM-DD') = to_char(target, 'MM-DD')
        or (not leap and to_char(coalesce(pr.birthday, p.birthday), 'MM-DD') = '02-29' and to_char(target, 'MM-DD') = '03-01')
      )
  loop
    if public.wants_letterbox_reminder(due.recipient) then
      insert into public.notifications (profile_id, nook, kind, title, body, data)
      values (
        due.recipient,
        'letterbox',
        'birthday_card',
        due.name || '''s birthday is in a week',
        'Time to send a card so it gets there by ' || trim(to_char(target, 'FMMonth FMDD')) || '.',
        jsonb_build_object('household_id', due.household_id)
      );
    end if;
  end loop;
end;
$$;

revoke execute on function public.letterbox_daily() from public, anon, authenticated;
revoke execute on function public.wants_letterbox_reminder(uuid) from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.schedule('letterbox-daily', '0 15 * * *', 'select public.letterbox_daily()');
  else
    raise notice 'pg_cron not available — enable it, then schedule public.letterbox_daily()';
  end if;
exception when others then
  raise notice 'Could not schedule letterbox_daily (%): enable pg_cron in Database > Extensions', sqlerrm;
end;
$$;

-- ===========================================================================
-- 7. Card photos (LET-007)
-- ===========================================================================

insert into storage.buckets (id, name, public)
values ('letterbox', 'letterbox', false)
on conflict (id) do nothing;

create policy "letterbox photos seen by the household" on storage.objects
  for select to authenticated
  using (bucket_id = 'letterbox' and public.can_use_letterbox_photo(name));

create policy "letterbox photos added by the household" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'letterbox' and public.can_use_letterbox_photo(name));

create policy "letterbox photos removed by the household" on storage.objects
  for delete to authenticated
  using (bucket_id = 'letterbox' and public.can_use_letterbox_photo(name));
