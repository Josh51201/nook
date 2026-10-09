-- Recipe Box Nook (REC-001..012).
--
--   recipes ............... REC-001/003: each person's own recipes
--   can_see_recipe() ...... REC-002/012: you, and family in your Burrows
--                           unless the recipe is "Just me"
--   potluck_dishes ........ REC-009: a dish can point at the recipe it's made from
--
-- Nothing here touches gifts or claims, so GIFT-007 is unaffected. Saving a
-- copy of someone's recipe tells nobody (no trigger, no notification).

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 120),
  servings int check (servings is null or servings between 1 and 100),
  prep_minutes int check (prep_minutes is null or prep_minutes between 0 and 2880),
  cook_minutes int check (cook_minutes is null or cook_minutes between 0 and 2880),
  -- One line each, in order.
  ingredients text[] not null default '{}' check (cardinality(ingredients) <= 100),
  steps text[] not null default '{}' check (cardinality(steps) <= 60),
  notes text check (notes is null or char_length(notes) <= 2000),
  source_url text check (source_url is null or char_length(source_url) <= 2000),
  image_url text check (image_url is null or char_length(image_url) <= 2000),
  -- What's in it, the same keys as Potluck dish tags (POT-004).
  tags text[] not null default '{}' check (cardinality(tags) <= 20),
  -- Shelf names (REC-006). Shelves are just the names in use, so there's no
  -- separate table to keep in step.
  shelves text[] not null default '{}' check (cardinality(shelves) <= 10),
  -- "Just me" (REC-002): nobody else ever sees it.
  private boolean not null default false,
  -- A copy saved from someone else's box: whose it was, and which recipe
  -- (cleared if the original is deleted).
  from_name text check (from_name is null or char_length(from_name) <= 80),
  from_recipe_id uuid references public.recipes (id) on delete set null,
  made_count int not null default 0 check (made_count >= 0),
  last_made_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index recipes_owner on public.recipes (owner_id, title);

alter table public.recipes enable row level security;

-- Security definer so other tables' policies (potluck_dishes) can ask
-- without re-entering RLS on recipes.
create function public.can_see_recipe(target_recipe uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.recipes r
    where r.id = target_recipe
      and (
        r.owner_id = (select auth.uid())
        or (not r.private and public.shares_burrow_with((select auth.uid()), r.owner_id))
      )
  );
$$;

create function public.owns_recipe(target_recipe uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.recipes where id = target_recipe and owner_id = (select auth.uid())
  );
$$;

create policy "recipes visible to their owner and Burrow family" on public.recipes
  for select using (
    owner_id = (select auth.uid())
    or (not private and public.shares_burrow_with((select auth.uid()), owner_id))
  );

-- Only for yourself, and a copy can only come from a recipe you can see.
create policy "recipes added by their owner" on public.recipes
  for insert with check (
    owner_id = (select auth.uid())
    and not public.is_managed_profile(owner_id)
    and (from_recipe_id is null or public.can_see_recipe(from_recipe_id))
  );

create policy "recipes edited by their owner" on public.recipes
  for update using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "recipes deleted by their owner" on public.recipes
  for delete using (owner_id = (select auth.uid()));

-- A recipe can't be handed to someone else or re-pointed at another copy.
revoke update on public.recipes from anon, authenticated;
grant update (
  title, servings, prep_minutes, cook_minutes, ingredients, steps, notes, source_url, image_url,
  tags, shelves, private, made_count, last_made_at, updated_at
) on public.recipes to authenticated;

create function public.touch_recipe()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger recipes_touch
  before update on public.recipes
  for each row execute procedure public.touch_recipe();

-- ===========================================================================
-- Potluck dishes made from a recipe (REC-009)
-- ===========================================================================

alter table public.potluck_dishes
  add column recipe_id uuid references public.recipes (id) on delete set null;

-- Re-create the dish policies so a dish can only point at one of the
-- bringer's own recipes. Guests open it only if the recipe lets them
-- (can_see_recipe): a "Just me" recipe stays hidden.
drop policy "potluck_dishes added by guests for themselves" on public.potluck_dishes;
create policy "potluck_dishes added by guests for themselves" on public.potluck_dishes
  for insert with check (
    public.can_see_potluck(potluck_id)
    and brought_by = (select auth.uid())
    and (slot_id is null or public.slot_in_potluck(slot_id, potluck_id))
    and (recipe_id is null or public.owns_recipe(recipe_id))
  );

drop policy "potluck_dishes edited by whoever brings them" on public.potluck_dishes;
create policy "potluck_dishes edited by whoever brings them" on public.potluck_dishes
  for update using (brought_by = (select auth.uid()))
  with check (
    brought_by = (select auth.uid())
    and (slot_id is null or public.slot_in_potluck(slot_id, potluck_id))
    and (recipe_id is null or public.owns_recipe(recipe_id))
  );

grant update (recipe_id) on public.potluck_dishes to authenticated;
