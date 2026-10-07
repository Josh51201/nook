-- Gift Nook schema (GIFT-001..016). RLS is handled separately in the next
-- migration — tables here have RLS enabled but no policies yet, so by
-- default nothing is readable/writable until that migration runs.

-- One row per account. auth.users is managed by Supabase Auth; we mirror
-- the id here so the rest of the schema can reference a normal table.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Burrows = family groups (GIFT-001). A person can be in several at once
-- (GIFT-011) via burrow_members below.
create table public.burrows (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

alter table public.burrows enable row level security;

create type public.burrow_role as enum ('admin', 'member');

create table public.burrow_members (
  burrow_id uuid not null references public.burrows (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role public.burrow_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (burrow_id, profile_id)
);

alter table public.burrow_members enable row level security;

-- Wishbooks = account-level wish lists (GIFT-012). Exactly one per profile,
-- not owned by any Burrow, visible in every Burrow the owner belongs to.
create table public.wishbooks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.wishbooks enable row level security;

-- Shelves = gift categories (GIFT-003). Deliberately just a key/label pair;
-- category-specific questions live in gifts.details (jsonb) instead of
-- columns here, so adding a category never needs a migration. The seeded
-- rows below are placeholders pending Q-004.
create table public.shelves (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  label text not null,
  sort_order int not null default 0
);

alter table public.shelves enable row level security;

create table public.gifts (
  id uuid primary key default gen_random_uuid(),
  wishbook_id uuid not null references public.wishbooks (id) on delete cascade,
  shelf_id uuid not null references public.shelves (id),
  title text not null,
  url text,
  notes text,
  is_repeatable boolean not null default false, -- GIFT-009
  details jsonb not null default '{}'::jsonb, -- category-specific fields, e.g. {"size": "M"}
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.gifts enable row level security;

-- Claims deliberately do NOT reference a burrow — a claim belongs to the
-- claiming profile, full stop. That's what makes GIFT-013 (claims shared
-- across every Burrow the owner is in) fall out of the RLS policy instead
-- of needing to be modeled explicitly. released_at supports an eventual
-- answer to Q-008 (can a claim be released?) without a schema change.
create table public.claims (
  id uuid primary key default gen_random_uuid(),
  gift_id uuid not null references public.gifts (id) on delete cascade,
  claimed_by uuid not null references public.profiles (id),
  claimed_at timestamptz not null default now(),
  released_at timestamptz
);

alter table public.claims enable row level security;

-- Gatherings = events (GIFT-014/015/016).
create table public.gatherings (
  id uuid primary key default gen_random_uuid(),
  burrow_id uuid not null references public.burrows (id) on delete cascade,
  title text not null,
  kind text not null default 'other', -- christmas | birthday | anniversary | baby_shower | other
  ends_at timestamptz not null,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.gatherings enable row level security;

-- Who a Gathering is "about" — zero rows means no single honoree (e.g. a
-- group Christmas), one row covers a birthday, two rows cover an
-- anniversary. Answers Q-003 without forcing a single-honoree column.
create table public.gathering_honorees (
  gathering_id uuid not null references public.gatherings (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  primary key (gathering_id, profile_id)
);

alter table public.gathering_honorees enable row level security;

-- Optional: which specific gifts apply to a Gathering. Left empty, the app
-- can treat "show the owner's whole Wishbook" as the default — one way
-- Q-002 could be answered. Populated, it means "only these gifts apply
-- here" — the other way Q-002 could be answered. Either way, no migration.
create table public.gathering_gifts (
  gathering_id uuid not null references public.gatherings (id) on delete cascade,
  gift_id uuid not null references public.gifts (id) on delete cascade,
  primary key (gathering_id, gift_id)
);

alter table public.gathering_gifts enable row level security;

-- Auto-create a profile + wishbook whenever someone signs up.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name) values (new.id, new.email);
  insert into public.wishbooks (owner_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Enforce GIFT-009: a non-repeatable gift can only ever have one active
-- (non-released) claim. Enforced in the database, not just app logic, so
-- it holds regardless of which client is writing.
create function public.enforce_one_and_done_claim()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  gift_is_repeatable boolean;
  active_claim_count int;
begin
  select is_repeatable into gift_is_repeatable
  from public.gifts
  where id = new.gift_id;

  if not gift_is_repeatable then
    select count(*) into active_claim_count
    from public.claims
    where gift_id = new.gift_id and released_at is null;

    if active_claim_count > 0 then
      raise exception 'This gift already has an active claim and is not repeatable';
    end if;
  end if;

  return new;
end;
$$;

create trigger before_claim_insert
  before insert on public.claims
  for each row execute procedure public.enforce_one_and_done_claim();

-- Placeholder Shelves (Q-004 still open — rename/add/remove freely).
insert into public.shelves (key, label, sort_order) values
  ('clothes', 'Clothes', 1),
  ('money_gift_card', 'Money / Gift Card', 2),
  ('books', 'Books', 3),
  ('toys', 'Toys', 4),
  ('experiences', 'Experiences', 5),
  ('other', 'Other', 6);
