-- Saving a new pet failed with "You don't have permission": the app asks for
-- the new row back (INSERT ... RETURNING), and the old read rule looked the
-- pet up by id in a helper function, which can't see a row created in the
-- same statement. Reading a pet now also checks the row's own Home directly.

drop policy "pets visible to the Home and helpers" on public.pets;

create policy "pets visible to the Home and helpers" on public.pets
  for select using (public.is_home_member(home_id) or public.can_see_pet(id));
