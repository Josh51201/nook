-- GIFT-017 (answers Q-002): every Gathering shows each person's whole
-- Wishbook by default, but each owner can include/exclude specific gifts
-- per Gathering — e.g. only money for their birthday, everything for
-- Christmas.
--
-- How it's stored:
--  * gathering_gifts gets an `included` flag: a row is the owner's explicit
--    choice for that gift in that Gathering.
--  * gathering_wishbook_settings.include_new decides gifts with no row
--    (including ones added later). No settings row = include_new true.
-- So "whole Wishbook" is zero rows, and "only money" is: money gifts
-- included, include_new false.

alter table public.gathering_gifts
  add column included boolean not null default true;

create table public.gathering_wishbook_settings (
  gathering_id uuid not null references public.gatherings (id) on delete cascade,
  wishbook_id uuid not null references public.wishbooks (id) on delete cascade,
  include_new boolean not null default true,
  primary key (gathering_id, wishbook_id)
);

alter table public.gathering_wishbook_settings enable row level security;

-- Only the Wishbook's owner picks, and only for Gatherings in a Burrow
-- they're in. Everyone in that Burrow can read the picks (to filter the
-- list they see).
create function public.can_pick_for_gathering(target_gathering uuid, target_wishbook uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.gatherings g
    join public.wishbooks w on w.id = target_wishbook
    where g.id = target_gathering
      and w.owner_id = (select auth.uid())
      and public.is_burrow_member(g.burrow_id)
  );
$$;

drop policy "gathering_gifts managed by burrow members" on public.gathering_gifts;

create policy "gathering_gifts visible to burrow members" on public.gathering_gifts
  for select using (
    exists (
      select 1 from public.gatherings g
      where g.id = gathering_gifts.gathering_id
        and public.is_burrow_member(g.burrow_id)
    )
  );

create policy "gathering_gifts picked by the gift owner" on public.gathering_gifts
  for all using (
    public.can_pick_for_gathering(
      gathering_id,
      (select wishbook_id from public.gifts where id = gathering_gifts.gift_id)
    )
  )
  with check (
    public.can_pick_for_gathering(
      gathering_id,
      (select wishbook_id from public.gifts where id = gathering_gifts.gift_id)
    )
  );

create policy "gathering_wishbook_settings visible to burrow members"
  on public.gathering_wishbook_settings
  for select using (
    exists (
      select 1 from public.gatherings g
      where g.id = gathering_wishbook_settings.gathering_id
        and public.is_burrow_member(g.burrow_id)
    )
  );

create policy "gathering_wishbook_settings set by the owner"
  on public.gathering_wishbook_settings
  for all using (public.can_pick_for_gathering(gathering_id, wishbook_id))
  with check (public.can_pick_for_gathering(gathering_id, wishbook_id));
