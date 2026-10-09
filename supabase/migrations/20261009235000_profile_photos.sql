-- Profile photos (PROF-006).
--
--   profiles.avatar_path ... a photo for your picture, instead of the icon or
--                            initials on a color (which stay as the choice
--                            when there's no photo, and as the fallback)
--   storage bucket avatars . the photos, at "<profile id>/<file>"
--   accept_handoff() ....... a kid taking over their profile keeps their photo
--
-- Who sees a photo: exactly whoever can already see that person's profile
-- (the profiles policy decides, so it follows any later change to it), plus
-- the person and a kid's managers while they're choosing one. Only you, or a
-- kid's managers, can add or remove a photo.
--
-- Nothing here touches gifts or claims, so GIFT-007 is unaffected.

-- ===========================================================================
-- 1. The column
-- ===========================================================================

alter table public.profiles add column avatar_path text;

create index profiles_avatar_path on public.profiles (avatar_path) where avatar_path is not null;

grant update (avatar_path) on public.profiles to authenticated;

-- A photo is "<profile id>/<file>" in that person's own folder, so nobody can
-- show someone else's photo as their own (and so let other people see it).
-- The one exception is a kid's hand-off below, where the new account keeps
-- the photo from the kid's folder.
create function public.check_avatar_path()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.avatar_path is null or (tg_op = 'UPDATE' and new.avatar_path is not distinct from old.avatar_path) then
    return new;
  end if;
  if new.avatar_path !~ '^[0-9a-fA-F-]{36}/[A-Za-z0-9._-]+$' then
    raise exception 'That isn''t a profile photo' using errcode = '22023';
  end if;
  if split_part(new.avatar_path, '/', 1) <> new.id::text
     and split_part(new.avatar_path, '/', 1) is distinct from nullif(current_setting('nook.photo_handoff', true), '') then
    raise exception 'That photo belongs to someone else' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger profiles_avatar_path
  before insert or update of avatar_path on public.profiles
  for each row execute function public.check_avatar_path();

revoke execute on function public.check_avatar_path() from public, anon, authenticated;

-- ===========================================================================
-- 2. The bucket and who can use it
-- ===========================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 5242880, array['image/jpeg', 'image/png', 'image/heic', 'image/webp'])
on conflict (id) do nothing;

-- You, or the grown-ups who look after a kid, can put photos in that folder.
create function public.can_change_profile_photo(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when split_part(object_name, '/', 1) ~ '^[0-9a-fA-F-]{36}$' then
      (split_part(object_name, '/', 1)::uuid = (select auth.uid()) and not public.is_managed_profile((select auth.uid())))
      or public.manages_profile(split_part(object_name, '/', 1)::uuid)
    else false
  end;
$$;

-- Seeing a photo: it's the picture of a profile you can see. Deliberately
-- NOT security definer, so the profiles policy is what decides.
create function public.can_see_profile_photo(object_name text)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (select 1 from public.profiles where avatar_path = object_name)
    or public.can_change_profile_photo(object_name);
$$;

revoke execute on function public.can_change_profile_photo(text) from public, anon;
grant execute on function public.can_change_profile_photo(text) to authenticated;
revoke execute on function public.can_see_profile_photo(text) from public, anon;
grant execute on function public.can_see_profile_photo(text) to authenticated;

create policy "profile photos seen by whoever sees the profile" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and public.can_see_profile_photo(name));

create policy "profile photos added by the person or a kid's grown-ups" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and public.can_change_profile_photo(name));

create policy "profile photos removed by the person or a kid's grown-ups" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and public.can_change_profile_photo(name));

-- ===========================================================================
-- 3. Hand-off keeps the photo (PROF-006, HOME-010)
-- ===========================================================================

-- Same as the home_kids migration, plus: if the new account has no photo yet,
-- it takes the kid's (the file stays where it is, in the kid's old folder).

create or replace function public.accept_handoff(handoff_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  kid uuid;
  handed_by uuid;
  kid_profile public.profiles;
  my_wishbook uuid;
  kid_wishbook uuid;
  kid_home uuid;
  invite uuid;
begin
  if caller is null then
    raise exception 'Sign in first';
  end if;
  if public.is_managed_profile(caller) then
    raise exception 'Sign in with your own account first';
  end if;

  select profile_id, created_by into kid, handed_by
  from public.profile_handoffs
  where code = upper(trim(handoff_code)) and expires_at > now();
  if kid is null then
    raise exception 'That code is not valid or has expired';
  end if;
  if exists (
    select 1 from public.profile_managers where profile_id = kid and manager_id = caller
  ) then
    raise exception 'This code is for them to use on their own account, not yours';
  end if;

  select * into kid_profile from public.profiles where id = kid;
  select id into my_wishbook from public.wishbooks where owner_id = caller;
  select id into kid_wishbook from public.wishbooks where owner_id = kid;

  -- Their name, picture (photo too), birthday and "about me", where the new
  -- account has none. The photo stays in the kid's old folder, which
  -- check_avatar_path() allows for this one update.
  perform set_config('nook.photo_handoff', kid::text, true);
  update public.profiles
  set display_name = case when display_name is null or display_name like '%@%' then kid_profile.display_name else display_name end,
      avatar_icon = coalesce(avatar_icon, kid_profile.avatar_icon),
      avatar_color = coalesce(avatar_color, kid_profile.avatar_color),
      birthday = coalesce(birthday, kid_profile.birthday),
      bio = coalesce(bio, kid_profile.bio),
      avatar_path = coalesce(avatar_path, kid_profile.avatar_path)
  where id = caller;
  perform set_config('nook.photo_handoff', '', true);

  -- The Gift Nook, as before.
  update public.gifts set wishbook_id = my_wishbook where wishbook_id = kid_wishbook;

  insert into public.gathering_wishbook_settings (gathering_id, wishbook_id, include_new)
  select gathering_id, my_wishbook, include_new
  from public.gathering_wishbook_settings where wishbook_id = kid_wishbook
  on conflict do nothing;

  insert into public.burrow_members (burrow_id, profile_id, role)
  select burrow_id, caller, 'member' from public.burrow_members where profile_id = kid
  on conflict do nothing;

  insert into public.gathering_honorees (gathering_id, profile_id)
  select gathering_id, caller from public.gathering_honorees where profile_id = kid
  on conflict do nothing;

  insert into public.gathering_receipts (gathering_id, profile_id, responded_at)
  select gathering_id, caller, responded_at from public.gathering_receipts where profile_id = kid
  on conflict do nothing;

  insert into public.birthday_gatherings (burrow_id, profile_id, year, gathering_id, created_at)
  select burrow_id, caller, year, gathering_id, created_at from public.birthday_gatherings where profile_id = kid
  on conflict do nothing;

  -- Allergies and diets, merged with any they've already set.
  insert into public.dietary_needs as dn (profile_id, allergies, diets)
  select caller, k.allergies, k.diets from public.dietary_needs k where k.profile_id = kid
  on conflict (profile_id) do update set
    allergies = (select coalesce(array_agg(distinct a), '{}') from unnest(dn.allergies || excluded.allergies) a),
    diets = (select coalesce(array_agg(distinct d), '{}') from unnest(dn.diets || excluded.diets) d);

  -- Potlucks.
  insert into public.potluck_rsvps (potluck_id, profile_id, status, extra_guests)
  select potluck_id, caller, status, extra_guests from public.potluck_rsvps where profile_id = kid
  on conflict do nothing;
  insert into public.potluck_hosts (potluck_id, profile_id)
  select potluck_id, caller from public.potluck_hosts where profile_id = kid
  on conflict do nothing;
  update public.potluck_dishes set brought_by = caller where brought_by = kid;

  -- Getaways: the trips they're going on, their packing list, their share.
  insert into public.getaway_people (getaway_id, profile_id, added_by, added_at)
  select getaway_id, caller, added_by, added_at from public.getaway_people where profile_id = kid
  on conflict do nothing;
  update public.getaway_items set for_person = caller where for_person = kid;
  update public.getaway_costs set split_among = array_replace(split_among, kid, caller) where kid = any(split_among);
  update public.getaway_costs set paid_by = caller where paid_by = kid;

  -- The Letterbox, other people's private ideas about them, and sick days.
  update public.letterbox_people set profile_id = caller where profile_id = kid;
  update public.idea_stash set about_id = caller where about_id = kid;
  update public.sick_spells s set patient_id = caller
  where s.patient_id = kid
    and not (s.ended_on is null and exists (
      select 1 from public.sick_spells o where o.home_id = s.home_id and o.patient_id = caller and o.ended_on is null
    ));
  update public.sick_medicines set for_profile = caller where for_profile = kid;

  -- Their place in the Home: the kid's seat becomes theirs.
  select home_id into kid_home from public.home_kids where kid_id = kid;
  if kid_home is not null then
    delete from public.home_kids where kid_id = kid;
    insert into public.home_invites (home_id, invited, invited_by)
    values (kid_home, caller, handed_by)
    on conflict (home_id, invited) do update set invited_by = excluded.invited_by
    returning id into invite;
    perform public.accept_home_invite(invite);
  end if;

  delete from public.profiles where id = kid;
end;
$$;

-- ===========================================================================
-- 4. The kids you look after, now with their photo (for the Home page)
-- ===========================================================================

drop function public.my_kids();

create function public.my_kids()
returns table (id uuid, display_name text, avatar_icon text, avatar_color text, avatar_path text, home_id uuid, lives_with_me boolean)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.display_name, p.avatar_icon, p.avatar_color, p.avatar_path, k.home_id,
    k.home_id is not null and public.is_home_member(k.home_id)
  from public.profile_managers pm
  join public.profiles p on p.id = pm.profile_id
  left join public.home_kids k on k.kid_id = p.id
  where pm.manager_id = (select auth.uid()) and p.is_managed
  order by p.display_name;
$$;

revoke execute on function public.my_kids() from public, anon;
grant execute on function public.my_kids() to authenticated;
