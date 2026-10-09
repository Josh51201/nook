-- Sitter Sheet Nook (SIT-001..008).
--
--   sitter_sheets .............. SIT-001/002/004: one sheet per Home, the
--                                parts you type (address, numbers, doctor,
--                                bedtime, rules, food, anything else)
--   sitter_links ............... SIT-003/006/008: a secret link for one stay,
--                                what it shows, and when it stops working
--   sitter_sheet_for_link() .... SIT-005/007: the only way in without an
--                                account. Read-only, and it returns nothing
--                                for a made-up, switched-off or expired link.
--
-- The sitter never signs in. Their page calls sitter_sheet_for_link() with
-- the secret from the link, and that function hands back only the sections,
-- kids and pets that link was made with. Nobody without an account can read
-- either table directly.
--
-- Kids' details are kept to a first name, allergies and diets (SIT-006): no
-- birthdays, photos or last names ever leave through a link.
--
-- Nothing here touches gifts or claims, so GIFT-007 is unaffected.

-- ===========================================================================
-- 1. Tables
-- ===========================================================================

-- Emergency numbers: a short list of {name, phone, note}.
create function public.sitter_contacts_ok(contacts jsonb)
returns boolean
language sql
immutable
as $$
  select jsonb_typeof(contacts) = 'array'
    and jsonb_array_length(contacts) <= 12
    and not exists (
      select 1 from jsonb_array_elements(contacts) c
      where jsonb_typeof(c) <> 'object'
        or jsonb_typeof(c -> 'name') is distinct from 'string'
        or char_length(c ->> 'name') not between 1 and 60
        or jsonb_typeof(c -> 'phone') is distinct from 'string'
        or char_length(c ->> 'phone') not between 1 and 30
        or (c ? 'note' and (jsonb_typeof(c -> 'note') <> 'string' or char_length(c ->> 'note') > 60))
        or exists (select 1 from jsonb_object_keys(c) k where k not in ('name', 'phone', 'note'))
    );
$$;

create table public.sitter_sheets (
  home_id uuid primary key references public.homes (id) on delete cascade,
  -- Where the sitter is, for calling 911.
  address text check (address is null or char_length(address) <= 200),
  contacts jsonb not null default '[]' check (public.sitter_contacts_ok(contacts)),
  doctor_name text check (doctor_name is null or char_length(doctor_name) <= 80),
  doctor_phone text check (doctor_phone is null or char_length(doctor_phone) <= 30),
  bedtime text check (bedtime is null or char_length(bedtime) <= 600),
  rules text check (rules is null or char_length(rules) <= 1000),
  food text check (food is null or char_length(food) <= 600),
  -- Wi-Fi, where things are, anything else.
  notes text check (notes is null or char_length(notes) <= 1000),
  updated_by uuid references public.profiles (id) on delete set null default auth.uid(),
  updated_at timestamptz not null default now()
);

-- The typed sections a link can show.
create function public.sitter_sections_ok(sections text[])
returns boolean
language sql
immutable
as $$
  select sections <@ array['address', 'contacts', 'doctor', 'bedtime', 'rules', 'food', 'notes']::text[];
$$;

-- 32 strong random bytes, URL-safe (gen_random_uuid draws from the same
-- strong source as pgcrypto). Too long to ever guess.
create function public.new_sitter_token()
returns text
language sql
volatile
as $$
  select rtrim(translate(encode(decode(
    replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
    'hex'), 'base64'), '+/', '-_'), '=');
$$;

create table public.sitter_links (
  id uuid primary key default gen_random_uuid(),
  home_id uuid not null references public.homes (id) on delete cascade,
  -- Always made here, never chosen by the app (see the trigger below).
  token text not null unique default public.new_sitter_token(),
  -- Who it's for, e.g. "Grandma, Thanksgiving weekend".
  label text not null check (char_length(trim(label)) between 1 and 60),
  starts_on date not null,
  ends_on date not null,
  -- The time zone of the phone that made it, so "the end of the last day"
  -- means the Home's evening, not UTC's.
  tz text not null default 'UTC' check (char_length(tz) <= 64),
  -- Set from ends_on and tz by the trigger below (SIT-008).
  expires_at timestamptz not null default now(),
  sections text[] not null default array['address', 'contacts', 'doctor', 'bedtime', 'rules', 'food', 'notes']::text[]
    check (public.sitter_sections_ok(sections)),
  -- Pulled from other Nooks, off unless picked (SIT-006).
  kid_ids uuid[] not null default '{}' check (cardinality(kid_ids) <= 12),
  pet_ids uuid[] not null default '{}' check (cardinality(pet_ids) <= 12),
  revoked_at timestamptz,
  views int not null default 0,
  last_viewed_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on and ends_on - starts_on <= 60)
);

create index sitter_links_home on public.sitter_links (home_id, created_at desc);

alter table public.sitter_sheets enable row level security;
alter table public.sitter_links enable row level security;

-- ===========================================================================
-- 2. Helpers (security definer so they don't re-enter RLS)
-- ===========================================================================

-- A kid someone in this Home manages (GIFT kids' profiles).
create function public.is_home_kid(kid uuid, target_home uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profile_managers pm
    join public.home_members hm on hm.profile_id = pm.manager_id
    where pm.profile_id = kid and hm.home_id = target_home
  );
$$;

-- Every picked kid and pet belongs to this Home.
create function public.sitter_picks_ok(target_home uuid, kids uuid[], picked_pets uuid[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (select 1 from unnest(kids) k where not public.is_home_kid(k, target_home))
    and not exists (
      select 1 from unnest(picked_pets) p
      where not exists (select 1 from public.pets where id = p and home_id = target_home)
    );
$$;

-- The token and expiry are always set here, never by the app: a link can't
-- be given a guessable secret, and the end of its last day is worked out in
-- its own time zone.
create function public.sitter_link_defaults()
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
  end if;
  new.expires_at := ((new.ends_on + 1)::timestamp at time zone new.tz);
  if tg_op = 'INSERT' and new.expires_at <= now() then
    raise exception 'That stay has already ended' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger sitter_link_defaults
  before insert or update of ends_on, tz on public.sitter_links
  for each row execute function public.sitter_link_defaults();

-- Only your own Home's kids and pets can be picked. Checked when the picks
-- are made or changed (not on every update), so a link can still be
-- switched off after a kid or pet on it has left the Home.
create function public.check_sitter_picks()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not public.sitter_picks_ok(new.home_id, new.kid_ids, new.pet_ids) then
    raise exception 'Only kids and pets from your Home can go on a sitter link' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger check_sitter_picks
  before insert or update of kid_ids, pet_ids on public.sitter_links
  for each row execute function public.check_sitter_picks();

create function public.touch_sitter_sheet()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

create trigger touch_sitter_sheet
  before update on public.sitter_sheets
  for each row execute function public.touch_sitter_sheet();

-- ===========================================================================
-- 3. Row level security (SIT-002: the Home, and only the Home)
-- ===========================================================================

create policy "sitter_sheets visible to the Home" on public.sitter_sheets
  for select using (public.is_home_member(home_id));

create policy "sitter_sheets started by the Home" on public.sitter_sheets
  for insert with check (public.is_home_member(home_id));

create policy "sitter_sheets changed by the Home" on public.sitter_sheets
  for update using (public.is_home_member(home_id))
  with check (public.is_home_member(home_id));

create policy "sitter_sheets removed by the Home" on public.sitter_sheets
  for delete using (public.is_home_member(home_id));

revoke all on public.sitter_sheets from anon;
revoke update on public.sitter_sheets from authenticated;
grant update (address, contacts, doctor_name, doctor_phone, bedtime, rules, food, notes) on public.sitter_sheets to authenticated;

create policy "sitter_links visible to the Home" on public.sitter_links
  for select using (public.is_home_member(home_id));

create policy "sitter_links made by the Home" on public.sitter_links
  for insert with check (
    public.is_home_member(home_id)
    and created_by = (select auth.uid())
  );

create policy "sitter_links changed by the Home" on public.sitter_links
  for update using (public.is_home_member(home_id))
  with check (public.is_home_member(home_id));

create policy "sitter_links removed by the Home" on public.sitter_links
  for delete using (public.is_home_member(home_id));

-- A link can't move Homes, and its secret and view count are the database's.
revoke all on public.sitter_links from anon;
revoke insert, update on public.sitter_links from authenticated;
grant insert (home_id, label, starts_on, ends_on, tz, sections, kid_ids, pet_ids, created_by) on public.sitter_links to authenticated;
grant update (label, starts_on, ends_on, tz, sections, kid_ids, pet_ids, revoked_at) on public.sitter_links to authenticated;

-- ===========================================================================
-- 4. The sitter's way in (SIT-005, SIT-007)
-- ===========================================================================

-- Everything the sitter's page shows, or null. Read-only apart from counting
-- the visit. Only what the link was made with comes back, and a kid or pet
-- that has since left the Home drops out.
create function public.sitter_sheet_for_link(link text)
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
    where id = l.id;
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
  if 'bedtime' = any(l.sections) then result := result || jsonb_build_object('bedtime', s.bedtime); end if;
  if 'rules' = any(l.sections) then result := result || jsonb_build_object('rules', s.rules); end if;
  if 'food' = any(l.sections) then result := result || jsonb_build_object('food', s.food); end if;
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

-- The kids anyone in your Home looks after, for picking onto a link.
create function public.home_kids()
returns table (id uuid, display_name text)
language sql
stable
security definer
set search_path = public
as $$
  select distinct p.id, p.display_name
  from public.home_members me
  join public.home_members hm on hm.home_id = me.home_id
  join public.profile_managers pm on pm.manager_id = hm.profile_id
  join public.profiles p on p.id = pm.profile_id
  where me.profile_id = (select auth.uid())
  order by p.display_name;
$$;

revoke execute on function public.home_kids() from public, anon;
grant execute on function public.home_kids() to authenticated;

-- The helpers are for policies, not for calling from outside.
revoke execute on function public.is_home_kid(uuid, uuid) from public, anon;
revoke execute on function public.sitter_picks_ok(uuid, uuid[], uuid[]) from public, anon;
grant execute on function public.is_home_kid(uuid, uuid) to authenticated;
grant execute on function public.sitter_picks_ok(uuid, uuid[], uuid[]) to authenticated;
