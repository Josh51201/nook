-- Idea Stash (GIFT-036): your own private notes about people in your
-- Burrows: gift ideas, and things worth remembering (sizes, what they
-- mentioned liking). Only the person who wrote a note can ever see it, not
-- the person it's about, not their Burrow, not their Home.
--
-- Like claims (GIFT-007), this is enforced here in Postgres, not just hidden
-- in the screens. There is deliberately no trigger, notification, count or
-- anything else derived from these rows that anyone else could see. Turning
-- an idea into a gift is the app adding an ordinary suggestion (GIFT-022)
-- as you; the idea itself only records that you did ("suggested_at"), with
-- no link to the gift.

create table public.idea_stash (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  about_id uuid not null references public.profiles (id) on delete cascade,
  -- 'idea' can become a suggestion on their list; 'note' is for sizes, likes
  -- and the like.
  kind text not null default 'idea' check (kind in ('idea', 'note')),
  title text not null check (char_length(title) between 1 and 120),
  notes text check (char_length(notes) <= 1000),
  url text check (char_length(url) <= 2000),
  price numeric(10, 2) check (price >= 0),
  suggested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idea_stash_owner_idx on public.idea_stash (owner_id, about_id);

alter table public.idea_stash enable row level security;

create policy "idea_stash seen by its writer only" on public.idea_stash
  for select using (owner_id = (select auth.uid()));

-- You can only write notes about someone you share a Burrow with (or a kid
-- you manage), and never about yourself.
create policy "idea_stash added by its writer" on public.idea_stash
  for insert with check (
    owner_id = (select auth.uid())
    and about_id <> (select auth.uid())
    and (public.shares_burrow_with((select auth.uid()), about_id) or public.manages_profile(about_id))
  );

create policy "idea_stash changed by its writer" on public.idea_stash
  for update using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()) and about_id <> (select auth.uid()));

create policy "idea_stash removed by its writer" on public.idea_stash
  for delete using (owner_id = (select auth.uid()));
