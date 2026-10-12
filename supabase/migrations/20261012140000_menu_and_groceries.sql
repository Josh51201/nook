-- Menu Board Nook (MENU-001..010) and Grocery List Nook (GROC-001..009).
--
--   menu_meals ....... MENU-001..004: what the Home is having for each
--                      breakfast, lunch and dinner, "Going out" or "On your
--                      own", maybe from a Recipe Box recipe
--   grocery_lists .... GROC-001, GROC-002: someone's lists, each just theirs
--                      or shared with whoever they live with
--   grocery_items .... GROC-003..006: what's on a list, its aisle, whether
--                      it's in the cart, and (from a Potluck) the day it
--                      joins the list
--
-- The menu belongs to the Home, like Subscriptions; a grocery list belongs
-- to the person who made it, like a note (NOTE-006).
--
-- Nothing here touches gifts or claims, so GIFT-007 is unaffected (GROC-009).

-- ===========================================================================
-- 1. The menu (MENU-001..004)
-- ===========================================================================

create table public.menu_meals (
  id uuid primary key default gen_random_uuid(),
  home_id uuid not null references public.homes (id) on delete cascade,
  day date not null,
  meal text not null check (meal in ('breakfast', 'lunch', 'dinner')),
  -- A dish you're having, "Going out" (title is where, maybe blank) or
  -- "On your own" (MENU-003).
  kind text not null default 'dish' check (kind in ('dish', 'out', 'own')),
  title text not null default '' check (char_length(title) <= 80),
  -- The Recipe Box recipe it's made from (MENU-004). The title is kept too,
  -- so people who can't open the recipe still see what's for dinner.
  recipe_id uuid references public.recipes (id) on delete set null,
  position int not null default 0,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check (kind <> 'dish' or char_length(trim(title)) >= 1),
  check (kind = 'dish' or recipe_id is null)
);

create index menu_meals_home_day on public.menu_meals (home_id, day);

alter table public.menu_meals enable row level security;

create policy "menu seen by the Home" on public.menu_meals
  for select using (public.is_home_member(home_id));

create policy "menu written by the Home" on public.menu_meals
  for insert with check (public.is_home_member(home_id));

create policy "menu changed by the Home" on public.menu_meals
  for update using (public.is_home_member(home_id))
  with check (public.is_home_member(home_id));

create policy "menu wiped by the Home" on public.menu_meals
  for delete using (public.is_home_member(home_id));

-- A meal can't move to another Home; who wrote it is the database's.
revoke update on public.menu_meals from anon, authenticated;
grant update (day, meal, kind, title, recipe_id, position) on public.menu_meals to authenticated;

-- You can only put a recipe on the menu that you can open yourself. Checked
-- as the caller (not security definer), so the Recipe Box's own row level
-- security decides. Only when the recipe changes, so someone who can't see
-- a recipe can still move or rename the meal it's on.
create function public.check_menu_recipe()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.recipe_id is not null
    and (tg_op = 'INSERT' or new.recipe_id is distinct from old.recipe_id)
    and not exists (select 1 from public.recipes where id = new.recipe_id)
  then
    raise exception 'That recipe isn''t one you can see';
  end if;
  return new;
end;
$$;

create trigger menu_meals_recipe
  before insert or update on public.menu_meals
  for each row execute function public.check_menu_recipe();

-- ===========================================================================
-- 2. Grocery lists (GROC-001..006)
-- ===========================================================================

create table public.grocery_lists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 40),
  shared boolean not null default false,
  created_at timestamptz not null default now()
);

create index grocery_lists_owner on public.grocery_lists (owner_id);

create table public.grocery_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.grocery_lists (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  amount text check (amount is null or char_length(amount) <= 60),
  aisle text not null default 'other'
    check (aisle in ('produce', 'meat', 'dairy', 'bakery', 'pantry', 'frozen', 'drinks', 'snacks', 'household', 'personal', 'other')),
  -- What it's for: "Tacos", "Christmas Potluck" (GROC-005, GROC-006).
  source text check (source is null or char_length(source) <= 80),
  potluck_id uuid references public.potlucks (id) on delete set null,
  -- Potluck shopping waits until the week of (GROC-006): until this day it
  -- sits in "Coming up". Null means it's on the list now.
  show_from date,
  -- In the cart (GROC-004).
  checked boolean not null default false,
  added_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index grocery_items_list on public.grocery_items (list_id, created_at);

alter table public.grocery_lists enable row level security;
alter table public.grocery_items enable row level security;

-- Can the caller use this list? Their own, or a shared one of someone they
-- live with right now.
create function public.can_use_grocery_list(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.grocery_lists l
    where l.id = target
      and (l.owner_id = (select auth.uid()) or (l.shared and public.shares_home_with(l.owner_id)))
  );
$$;

-- Checks the row's own columns, so a new list can be read back in the same
-- statement that adds it.
create policy "grocery lists seen by their owner and, if shared, their Home" on public.grocery_lists
  for select using (
    owner_id = (select auth.uid()) or (shared and public.shares_home_with(owner_id))
  );

create policy "grocery lists made by their owner" on public.grocery_lists
  for insert with check (owner_id = (select auth.uid()));

create policy "grocery lists changed by their owner" on public.grocery_lists
  for update using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "grocery lists deleted by their owner" on public.grocery_lists
  for delete using (owner_id = (select auth.uid()));

-- A list can't change hands.
revoke update on public.grocery_lists from anon, authenticated;
grant update (name, shared) on public.grocery_lists to authenticated;

create policy "grocery items seen with their list" on public.grocery_items
  for select using (public.can_use_grocery_list(list_id));

create policy "grocery items added to a list you can use" on public.grocery_items
  for insert with check (public.can_use_grocery_list(list_id));

-- Moving an item to another list needs both lists to be yours to use.
create policy "grocery items changed on a list you can use" on public.grocery_items
  for update using (public.can_use_grocery_list(list_id))
  with check (public.can_use_grocery_list(list_id));

create policy "grocery items removed from a list you can use" on public.grocery_items
  for delete using (public.can_use_grocery_list(list_id));

-- Who added it is the database's.
revoke update on public.grocery_items from anon, authenticated;
grant update (list_id, name, amount, aisle, source, show_from, checked) on public.grocery_items to authenticated;

-- Live: two people shopping from one shared list see each other's ticks
-- (GROC-004), and a menu changed on one phone shows on another. Row level
-- security still decides who hears.
alter publication supabase_realtime add table public.grocery_items;
alter publication supabase_realtime add table public.menu_meals;

-- ===========================================================================
-- 3. The menu moves with the Home (MENU-009, HOME-003, HOME-005)
-- ===========================================================================

-- Same as before (home_kids migration), plus the menu: a Home that was only
-- yours brings its menu along, keeping the new Home's wherever both had
-- planned the same meal. Leaving a shared Home leaves the menu with it, so
-- leave_home() is unchanged. Grocery lists follow their owner already.
create or replace function public.accept_home_invite(invite_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  target_home uuid;
  inviter uuid;
  old_home uuid;
  others int;
  joiner text;
begin
  select home_id, invited_by into target_home, inviter
  from public.home_invites where id = invite_id and invited = caller;
  if target_home is null then
    raise exception 'That invite isn''t there any more';
  end if;

  select home_id into old_home from public.home_members where profile_id = caller;
  if old_home is not null and old_home <> target_home then
    select count(*) into others from public.home_members where home_id = old_home and profile_id <> caller;
    if others = 0 then
      delete from public.letterbox_thanks t
      where t.home_id = old_home and t.gift_id is not null
        and exists (
          select 1 from public.letterbox_thanks kept
          where kept.home_id = target_home and kept.gift_id = t.gift_id
        );
      update public.letterbox_contacts set home_id = target_home where home_id = old_home;
      update public.letterbox_people set home_id = target_home where home_id = old_home;
      update public.letterbox_cards set home_id = target_home where home_id = old_home;
      update public.letterbox_thanks set home_id = target_home where home_id = old_home;
      update public.pets set home_id = target_home where home_id = old_home;
      update public.rhythms set home_id = target_home where home_id = old_home;
      update public.subscriptions set home_id = target_home where home_id = old_home;
      update public.sick_spells set home_id = target_home where home_id = old_home;
      update public.sick_medicines set home_id = target_home where home_id = old_home;
      update public.home_kids set home_id = target_home where home_id = old_home;
      update public.menu_meals m set home_id = target_home
      where m.home_id = old_home
        and not exists (
          select 1 from public.menu_meals kept
          where kept.home_id = target_home and kept.day = m.day and kept.meal = m.meal
        );
      delete from public.home_members where profile_id = caller;
      delete from public.homes where id = old_home;
    else
      update public.rhythms set owner = null where home_id = old_home and owner = caller;
      update public.subscriptions set home_id = target_home
      where home_id = old_home and private and created_by = caller;
      update public.subscriptions set payer = null where home_id = old_home and payer = caller;
      perform public.move_my_sick_days(old_home, target_home, caller);
      perform public.move_my_kids(old_home, target_home, caller);
      delete from public.home_members where profile_id = caller;
    end if;
  end if;

  insert into public.home_members (profile_id, home_id)
  values (caller, target_home)
  on conflict (profile_id) do update set home_id = excluded.home_id, joined_at = now();
  delete from public.home_invites where home_id = target_home and invited = caller;

  if inviter is not null and inviter <> caller then
    select coalesce(nullif(trim(display_name), ''), 'Someone') into joiner from public.profiles where id = caller;
    insert into public.notifications (profile_id, nook, kind, title, body, data)
    values (inviter, 'home', 'home_joined', joiner || ' joined your Home', 'You now share one Home.', '{}'::jsonb);
  end if;
  return target_home;
end;
$$;
