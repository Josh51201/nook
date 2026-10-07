-- AUTH-003 / PROF-001..: a real profile. New people are asked to set one up
-- before entering the Hearth (name, avatar, optional birthday and bio), and
-- can edit it any time. Family in your Burrows can see it (that's the point
-- of a name and avatar), so the app says so where it asks.

alter table public.profiles
  add column avatar_icon text, -- null = show initials
  add column avatar_color text,
  add column birthday date,
  add column bio text check (bio is null or char_length(bio) <= 160),
  add column onboarded_at timestamptz; -- null = hasn't set up their profile yet

-- People who already have a real name (not their email) don't need to do it
-- again, and managed kid profiles never sign in. Everyone else is asked next
-- time they open Nook.
update public.profiles
set onboarded_at = now()
where is_managed
   or (display_name is not null and trim(display_name) <> '' and display_name not like '%@%');

-- The app edits these columns (managers can also edit a kid's profile via the
-- existing "updated by self or managers" policy). is_managed stays locked.
grant update (display_name, avatar_icon, avatar_color, birthday, bio, onboarded_at)
  on public.profiles to authenticated;

-- New accounts start with no name instead of their email address, which
-- Burrow-mates could otherwise read in place of a name.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id);
  insert into public.wishbooks (owner_id) values (new.id);
  return new;
end;
$$;
