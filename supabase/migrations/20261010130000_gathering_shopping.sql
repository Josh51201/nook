-- Shopping for a big Gathering (GIFT-038..040).
--
--   gathering_skips ....... GIFT-039: "I'm not getting them a gift" for one
--                           Gathering, so they stop showing as still needing
--                           one. Private to whoever set it.
--   set_tuck_gathering() .. GIFT-040: count one of your tucks for a different
--                           Gathering (or none), e.g. a gift you tucked
--                           before Christmas was planned.
--
-- GIFT-007: a skip is only ever visible to the person who made it — never to
-- the person skipped, nor anyone else — and sends no notice. Moving a tuck
-- changes only your own tuck and tells nobody. Nothing here lets the owner of
-- a gift learn anything about tucks on it.

-- ===========================================================================
-- 1. "Not getting them a gift" (GIFT-039)
-- ===========================================================================

create table public.gathering_skips (
  gathering_id uuid not null references public.gatherings (id) on delete cascade,
  giver_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (gathering_id, giver_id, profile_id)
);

alter table public.gathering_skips enable row level security;

create policy "gathering_skips seen only by whoever set them" on public.gathering_skips
  for select using (giver_id = (select auth.uid()));

-- For someone else invited to a Gathering you can see.
create policy "gathering_skips set for yourself" on public.gathering_skips
  for insert with check (
    giver_id = (select auth.uid())
    and profile_id <> (select auth.uid())
    and public.can_see_gathering(gathering_id)
    and public.gathering_has_guest(gathering_id, profile_id)
  );

create policy "gathering_skips cleared by whoever set them" on public.gathering_skips
  for delete using (giver_id = (select auth.uid()));

revoke update on public.gathering_skips from anon, authenticated;

-- ===========================================================================
-- 2. Which Gathering a tuck is for (GIFT-040)
-- ===========================================================================

-- Your own, still-open tuck only. The Gathering must be one you and the
-- gift's owner are both invited to; null means "not for a Gathering".
create function public.set_tuck_gathering(claim_id uuid, target_gathering uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  owner uuid;
begin
  select w.owner_id into owner
  from public.claims c
  join public.gifts g on g.id = c.gift_id
  join public.wishbooks w on w.id = g.wishbook_id
  where c.id = claim_id
    and c.claimed_by = auth.uid()
    and c.released_at is null
    and c.status <> 'given';
  if owner is null then
    raise exception 'That tuck is not yours to change';
  end if;
  if target_gathering is not null and not (
    public.gathering_has_guest(target_gathering, auth.uid())
    and public.gathering_has_guest(target_gathering, owner)
  ) then
    raise exception 'They are not both invited to that Gathering';
  end if;

  update public.claims set gathering_id = target_gathering where id = claim_id;
end;
$$;

revoke execute on function public.set_tuck_gathering(uuid, uuid) from public, anon;
grant execute on function public.set_tuck_gathering(uuid, uuid) to authenticated;
