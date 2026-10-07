-- GIFT-032 / GIFT-033 (proposed by Claude, 2026-10-07): owners can mark a
-- gift ❤️ Most wanted (shown first) and give an approximate price, so
-- givers can browse by budget. Both are owner-controlled, so sorting or
-- filtering by them can't hint at tucks (GIFT-007).

alter table public.gifts
  add column is_most_wanted boolean not null default false,
  add column price numeric(10, 2) check (price is null or price >= 0);

grant update (is_most_wanted, price) on public.gifts to authenticated;

-- A price change matters to someone who already tucked the gift; toggling
-- Most wanted doesn't. Same column list in both triggers.
create or replace function public.touch_gift_updated_at()
returns trigger
language plpgsql
as $$
begin
  if (new.title, new.url, new.notes, new.is_repeatable, new.details, new.shelf_id, new.image_url, new.price)
     is distinct from
     (old.title, old.url, old.notes, old.is_repeatable, old.details, old.shelf_id, old.image_url, old.price)
  then
    new.updated_at := now();
  else
    new.updated_at := old.updated_at;
  end if;
  return new;
end;
$$;

create or replace function public.notify_tuck_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  was_removed boolean := new.removed_at is not null and old.removed_at is null;
  owner_name text;
  claimer uuid;
begin
  if not was_removed
     and (new.title, new.url, new.notes, new.is_repeatable, new.details, new.shelf_id, new.image_url, new.price)
         is not distinct from
         (old.title, old.url, old.notes, old.is_repeatable, old.details, old.shelf_id, old.image_url, old.price)
  then
    return new;
  end if;

  select coalesce(p.display_name, 'Someone') into owner_name
  from public.wishbooks w join public.profiles p on p.id = w.owner_id
  where w.id = new.wishbook_id;

  for claimer in
    select distinct claimed_by from public.claims
    where gift_id = new.id
      and released_at is null
      and status <> 'given'
      and claimed_by is distinct from auth.uid()
  loop
    perform public.notify(
      claimer,
      'tuck_changed',
      case when was_removed then owner_name || ' removed a gift you tucked'
           else owner_name || ' changed a gift you tucked' end,
      new.title,
      jsonb_build_object('gift_id', new.id)
    );
  end loop;

  return new;
end;
$$;
