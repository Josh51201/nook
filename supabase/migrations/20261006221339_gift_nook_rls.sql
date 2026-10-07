-- Row level security for the Gift Nook. The one rule that must never
-- break: a list owner can never see claims on their own gifts (GIFT-007),
-- even though every other Burrow they're in (GIFT-013) can.

-- Helper: do two profiles share at least one Burrow? security definer so
-- it can read burrow_members regardless of the caller's own RLS grants.
create function public.shares_burrow_with(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.burrow_members m1
    join public.burrow_members m2 on m1.burrow_id = m2.burrow_id
    where m1.profile_id = a and m2.profile_id = b
  );
$$;

-- profiles: see your own profile, or anyone you share a Burrow with
-- (needed to show names/avatars of family members).
create policy "profiles self or burrow-mates" on public.profiles
  for select using (
    id = (select auth.uid())
    or public.shares_burrow_with((select auth.uid()), id)
  );

create policy "profiles self insert" on public.profiles
  for insert with check (id = (select auth.uid()));

create policy "profiles self update" on public.profiles
  for update using (id = (select auth.uid()));

-- burrows: visible to members; any signed-in user can create one (they
-- become a member via a separate insert into burrow_members).
create policy "burrows visible to members" on public.burrows
  for select using (
    exists (
      select 1 from public.burrow_members
      where burrow_id = burrows.id and profile_id = (select auth.uid())
    )
  );

create policy "burrows created by any signed-in user" on public.burrows
  for insert with check (created_by = (select auth.uid()));

create policy "burrows updated by admins" on public.burrows
  for update using (
    exists (
      select 1 from public.burrow_members
      where burrow_id = burrows.id
        and profile_id = (select auth.uid())
        and role = 'admin'
    )
  );

-- burrow_members: visible to fellow members. Self-join allowed for now —
-- there's no Knock/invite table yet (future session), so joining a Burrow
-- today means inserting your own membership row (e.g. after following an
-- invite link/code at the app layer).
create policy "burrow_members visible to burrow-mates" on public.burrow_members
  for select using (
    exists (
      select 1 from public.burrow_members mine
      where mine.burrow_id = burrow_members.burrow_id
        and mine.profile_id = (select auth.uid())
    )
  );

create policy "burrow_members self join" on public.burrow_members
  for insert with check (profile_id = (select auth.uid()));

create policy "burrow_members self leave" on public.burrow_members
  for delete using (profile_id = (select auth.uid()));

-- wishbooks: GIFT-012 — owner sees their own, and so does anyone who
-- shares a Burrow with the owner.
create policy "wishbooks owner or burrow-mates" on public.wishbooks
  for select using (
    owner_id = (select auth.uid())
    or public.shares_burrow_with((select auth.uid()), owner_id)
  );

-- shelves: shared reference data, readable by anyone signed in. No
-- insert/update/delete policy — changing categories is an admin/service
-- role action, not a client action.
create policy "shelves readable by anyone signed in" on public.shelves
  for select using (auth.role() = 'authenticated');

-- gifts: GIFT-002/005 — owner always sees their own list; other Burrow
-- members see it too (so they can browse what to give/claim). Only the
-- owner can edit.
create policy "gifts owner or burrow-mates" on public.gifts
  for select using (
    exists (
      select 1 from public.wishbooks w
      where w.id = gifts.wishbook_id
        and (
          w.owner_id = (select auth.uid())
          or public.shares_burrow_with((select auth.uid()), w.owner_id)
        )
    )
  );

create policy "gifts owner writes" on public.gifts
  for insert with check (
    exists (
      select 1 from public.wishbooks w
      where w.id = gifts.wishbook_id and w.owner_id = (select auth.uid())
    )
  );

create policy "gifts owner updates" on public.gifts
  for update using (
    exists (
      select 1 from public.wishbooks w
      where w.id = gifts.wishbook_id and w.owner_id = (select auth.uid())
    )
  );

create policy "gifts owner deletes" on public.gifts
  for delete using (
    exists (
      select 1 from public.wishbooks w
      where w.id = gifts.wishbook_id and w.owner_id = (select auth.uid())
    )
  );

-- claims: THE rule. A claim is visible only to someone who (a) shares a
-- Burrow with the gift's owner, and (b) is not the owner. That second
-- condition is what makes GIFT-007 hold even for the owner's own gifts —
-- there is no path through this policy where owner_id = auth.uid() ever
-- returns a row.
create policy "claims visible to family, never to the owner" on public.claims
  for select using (
    exists (
      select 1
      from public.gifts g
      join public.wishbooks w on w.id = g.wishbook_id
      where g.id = claims.gift_id
        and w.owner_id <> (select auth.uid())
        and public.shares_burrow_with((select auth.uid()), w.owner_id)
    )
  );

-- Claiming: you can claim a gift if you share a Burrow with its owner and
-- you are not the owner (GIFT-006), and the claim must be recorded as you.
create policy "family members can claim gifts" on public.claims
  for insert with check (
    claimed_by = (select auth.uid())
    and exists (
      select 1
      from public.gifts g
      join public.wishbooks w on w.id = g.wishbook_id
      where g.id = claims.gift_id
        and w.owner_id <> (select auth.uid())
        and public.shares_burrow_with((select auth.uid()), w.owner_id)
    )
  );

-- Releasing a claim (Q-008): only the person who made it can release it.
create policy "claimant can release their own claim" on public.claims
  for update using (claimed_by = (select auth.uid()));

-- gatherings / honorees / gathering_gifts: visible and editable by
-- members of the owning Burrow. Not GIFT-007-sensitive, so kept simple.
create policy "gatherings visible to burrow members" on public.gatherings
  for select using (
    exists (
      select 1 from public.burrow_members
      where burrow_id = gatherings.burrow_id and profile_id = (select auth.uid())
    )
  );

create policy "gatherings managed by burrow members" on public.gatherings
  for all using (
    exists (
      select 1 from public.burrow_members
      where burrow_id = gatherings.burrow_id and profile_id = (select auth.uid())
    )
  );

create policy "gathering_honorees visible to burrow members" on public.gathering_honorees
  for select using (
    exists (
      select 1 from public.gatherings g
      join public.burrow_members bm on bm.burrow_id = g.burrow_id
      where g.id = gathering_honorees.gathering_id and bm.profile_id = (select auth.uid())
    )
  );

create policy "gathering_honorees managed by burrow members" on public.gathering_honorees
  for all using (
    exists (
      select 1 from public.gatherings g
      join public.burrow_members bm on bm.burrow_id = g.burrow_id
      where g.id = gathering_honorees.gathering_id and bm.profile_id = (select auth.uid())
    )
  );

create policy "gathering_gifts visible to burrow members" on public.gathering_gifts
  for select using (
    exists (
      select 1 from public.gatherings g
      join public.burrow_members bm on bm.burrow_id = g.burrow_id
      where g.id = gathering_gifts.gathering_id and bm.profile_id = (select auth.uid())
    )
  );

create policy "gathering_gifts managed by burrow members" on public.gathering_gifts
  for all using (
    exists (
      select 1 from public.gatherings g
      join public.burrow_members bm on bm.burrow_id = g.burrow_id
      where g.id = gathering_gifts.gathering_id and bm.profile_id = (select auth.uid())
    )
  );
