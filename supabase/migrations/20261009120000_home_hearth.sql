-- The Home page of the Hearth (CORE-054): one page everyone in a Home sees
-- and arranges together, like a household bulletin board. It shows as a
-- "Home" tab next to each person's own Hearth pages once their Home has two
-- or more people.
--
-- One row per thing on the page (a widget, a Nook tile, text, a Trinket),
-- so two people changing different things at the same moment don't undo
-- each other. A row taken off the page is marked `removed` rather than
-- deleted, so everyone's phone hears about it through the live updates
-- below (and Undo can bring it back).
--
-- Only people in the Home can see or change any of it (HOME-004).
-- GIFT-007: rows hold a widget's settings only (which kind, its title,
-- colors, a note's text), never anything loaded from the Gift Nook. Every
-- widget loads its own contents for whoever is looking, so a "Gifts to buy"
-- widget here shows each person their own list and never anything about
-- tucks on their own gifts.

create table public.home_hearth_items (
  home_id uuid not null references public.homes (id) on delete cascade,
  id text not null check (char_length(id) between 1 and 64),
  item jsonb not null check (octet_length(item::text) <= 32768),
  position bigint not null default 0,
  removed boolean not null default false,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (home_id, id)
);

alter table public.home_hearth_items enable row level security;

create policy "home_hearth_items seen by the Home" on public.home_hearth_items
  for select using (public.is_home_member(home_id));

create policy "home_hearth_items added by the Home" on public.home_hearth_items
  for insert with check (public.is_home_member(home_id) and updated_by = (select auth.uid()));

create policy "home_hearth_items changed by the Home" on public.home_hearth_items
  for update using (public.is_home_member(home_id))
  with check (public.is_home_member(home_id) and updated_by = (select auth.uid()));

-- No delete policy: things are marked removed instead. Leaving a Home
-- leaves its page with the people still there; a Home that's deleted takes
-- its page with it (on delete cascade).

-- The page's name on everyone's tab ("Home" until someone renames it).
alter table public.homes
  add column hearth_page_name text check (char_length(hearth_page_name) <= 20);

-- Live updates: phones showing the Home page hear about each change as it
-- happens. Row level security still decides who hears what.
alter publication supabase_realtime add table public.home_hearth_items;

-- ===========================================================================
-- Photos on the Home page (Photo frame widgets)
-- ===========================================================================
-- Your own Hearth photos stay private under "<your user id>/…". Photos on
-- the Home page live under "home/<home id>/…", where everyone in that Home
-- can see, add and remove them. A frame moved onto the Home page gets its
-- own copies there, and back again when it's moved off.

create function public.can_use_home_hearth_photo(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select split_part(object_name, '/', 1) = 'home' and exists (
    select 1 from public.home_members
    where profile_id = (select auth.uid()) and home_id::text = split_part(object_name, '/', 2)
  );
$$;

create policy "home hearth photos seen by the Home" on storage.objects
  for select to authenticated
  using (bucket_id = 'hearth' and public.can_use_home_hearth_photo(name));

create policy "home hearth photos added by the Home" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'hearth' and public.can_use_home_hearth_photo(name));

create policy "home hearth photos removed by the Home" on storage.objects
  for delete to authenticated
  using (bucket_id = 'hearth' and public.can_use_home_hearth_photo(name));
