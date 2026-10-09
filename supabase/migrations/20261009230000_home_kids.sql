-- Kids in a Home (HOME-007..011).
--
--   home_kids ............. HOME-007: a kid's profile belongs to one Home
--                           (the grown-ups who look after them live there).
--                           Kids count toward the Home's 6 (HOME-006).
--   create_home_kid() ..... HOME-008: add a kid from the Home page (also
--                           makes their Wishbook, like the Gift Nook does)
--   set_kid_home() ........ HOME-009: "Lives here" for kids made before
--   accept_handoff() ...... HOME-010: a kid with their own phone takes their
--                           profile over and keeps their place in the Home,
--                           with everything that was theirs
--   moving Homes .......... HOME-011: kids go with the grown-up who looks
--                           after them, unless another one stays behind
--
-- Before this, a kid was "in" every Home where one of their managers lived.
-- Now it's one Home, chosen on purpose, so Home Nooks (Sitter Sheet, Sick
-- Day) and the Home's Nook Plus (MON-011) know who belongs where.
--
-- GIFT-007 is unchanged: the hand-off still moves the kid's gifts onto their
-- own account and removes the managed profile, so managers stop seeing tucks
-- and the kid, now the owner, sees none.

-- ===========================================================================
-- 1. Which Home a kid lives in
-- ===========================================================================

create table public.home_kids (
  -- One Home per kid.
  kid_id uuid primary key references public.profiles (id) on delete cascade,
  home_id uuid not null references public.homes (id) on delete cascade,
  added_by uuid references public.profiles (id) on delete set null default auth.uid(),
  added_at timestamptz not null default now()
);

create index home_kids_home on public.home_kids (home_id);

alter table public.home_kids enable row level security;

-- The Home sees its kids; a kid's managers see where they live.
create policy "home_kids visible to the Home and the kid's managers" on public.home_kids
  for select using (public.is_home_member(home_id) or public.manages_profile(kid_id));

-- Only written through the functions below.
revoke insert, update, delete on public.home_kids from anon, authenticated;
revoke all on public.home_kids from anon;

-- Only kid (managed) profiles go here; grown-ups are home_members.
create function public.check_home_kid()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_managed_profile(new.kid_id) then
    raise exception 'Only a kid''s profile can be added this way' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger home_kids_managed
  before insert or update of kid_id on public.home_kids
  for each row execute function public.check_home_kid();

-- ===========================================================================
-- 2. Kids count toward the 6 (HOME-006)
-- ===========================================================================

create or replace function public.enforce_home_size()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Lock the Home so two people joining at once can't both take the last place.
  perform 1 from public.homes where id = new.home_id for update;
  if (select count(*) from public.home_members where home_id = new.home_id and profile_id <> new.profile_id)
     + (select count(*) from public.home_kids where home_id = new.home_id) >= 6 then
    raise exception 'That Home is full — a Home holds up to 6 people, kids included';
  end if;
  return new;
end;
$$;

create or replace function public.enforce_home_invites()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform 1 from public.homes where id = new.home_id for update;
  if (select count(*) from public.home_members where home_id = new.home_id)
     + (select count(*) from public.home_kids where home_id = new.home_id)
     + (select count(*) from public.home_invites where home_id = new.home_id and invited <> new.invited) >= 6 then
    raise exception 'Your Home is full — a Home holds up to 6 people, kids included';
  end if;
  return new;
end;
$$;

create function public.enforce_home_kids_size()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform 1 from public.homes where id = new.home_id for update;
  if (select count(*) from public.home_members where home_id = new.home_id)
     + (select count(*) from public.home_kids where home_id = new.home_id and kid_id <> new.kid_id)
     + (select count(*) from public.home_invites where home_id = new.home_id) >= 6 then
    raise exception 'That Home is full — a Home holds up to 6 people, kids included';
  end if;
  return new;
end;
$$;

create trigger home_kids_size
  before insert or update of home_id on public.home_kids
  for each row execute function public.enforce_home_kids_size();

revoke execute on function public.enforce_home_kids_size() from public, anon, authenticated;
revoke execute on function public.check_home_kid() from public, anon, authenticated;

-- ===========================================================================
-- 3. "A kid in this Home" now means home_kids (Sitter Sheet, Sick Day)
-- ===========================================================================

create or replace function public.is_home_kid(kid uuid, target_home uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.home_kids where kid_id = kid and home_id = target_home);
$$;

-- The kids in your Home, for pickers.
create or replace function public.home_kids()
returns table (id uuid, display_name text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.display_name
  from public.home_members me
  join public.home_kids k on k.home_id = me.home_id
  join public.profiles p on p.id = k.kid_id
  where me.profile_id = (select auth.uid())
  order by p.display_name;
$$;

-- ===========================================================================
-- 4. Adding a kid, and "Lives here" (HOME-008, HOME-009)
-- ===========================================================================

-- Put a kid you look after in your Home, or take them out of the Home they're
-- in. Adding: you must manage them, and they can't already live somewhere
-- else (take them out there first). Taking out: their managers, or anyone in
-- that Home.
create function public.set_kid_home(target_kid uuid, lives_here boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  mine uuid;
  current_home uuid;
begin
  if caller is null or public.is_managed_profile(caller) then
    raise exception 'Sign in first';
  end if;
  if not public.is_managed_profile(target_kid) then
    raise exception 'Only a kid''s profile can be added this way' using errcode = '22023';
  end if;
  select home_id into current_home from public.home_kids where kid_id = target_kid;

  if lives_here then
    if not public.manages_profile(target_kid) then
      raise exception 'Only the grown-ups who look after them can add them' using errcode = '42501';
    end if;
    mine := public.my_home();
    if current_home = mine then
      return;
    end if;
    if current_home is not null then
      raise exception 'They already live in another Home. Take them out there first, then add them here.' using errcode = '22023';
    end if;
    insert into public.home_kids (kid_id, home_id, added_by) values (target_kid, mine, caller);
  else
    if current_home is null then
      return;
    end if;
    if not (public.manages_profile(target_kid) or public.is_home_member(current_home)) then
      raise exception 'Only their grown-ups can do that' using errcode = '42501';
    end if;
    delete from public.home_kids where kid_id = target_kid;
  end if;
end;
$$;

-- Add a kid from the Home page: their profile and Wishbook (GIFT-019), in
-- your Burrows, living in your Home. All or nothing, so a full Home doesn't
-- leave a half-made kid behind.
create function public.create_home_kid(profile_name text, burrow_ids uuid[], lives_here boolean default true)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  kid uuid;
begin
  kid := public.create_managed_profile(profile_name, burrow_ids);
  if lives_here then
    perform public.set_kid_home(kid, true);
  end if;
  return kid;
end;
$$;

revoke execute on function public.set_kid_home(uuid, boolean) from public, anon;
grant execute on function public.set_kid_home(uuid, boolean) to authenticated;
revoke execute on function public.create_home_kid(text, uuid[], boolean) from public, anon;
grant execute on function public.create_home_kid(text, uuid[], boolean) to authenticated;

-- The kids you look after and where each lives (for "Lives here?").
create function public.my_kids()
returns table (id uuid, display_name text, avatar_icon text, avatar_color text, home_id uuid, lives_with_me boolean)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.display_name, p.avatar_icon, p.avatar_color, k.home_id,
    k.home_id is not null and public.is_home_member(k.home_id)
  from public.profile_managers pm
  join public.profiles p on p.id = pm.profile_id
  left join public.home_kids k on k.kid_id = p.id
  where pm.manager_id = (select auth.uid()) and p.is_managed
  order by p.display_name;
$$;

revoke execute on function public.my_kids() from public, anon;
grant execute on function public.my_kids() to authenticated;

-- ===========================================================================
-- 5. Moving Homes: kids go with you (HOME-011)
-- ===========================================================================

-- Kids in `old_home` that `person` looks after, and nobody else who looks
-- after them is staying there, move to `new_home` (their sick days too).
create function public.move_my_kids(old_home uuid, new_home uuid, person uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  kid record;
begin
  for kid in
    select k.kid_id from public.home_kids k
    join public.profile_managers pm on pm.profile_id = k.kid_id and pm.manager_id = person
    where k.home_id = old_home
      and not exists (
        select 1 from public.profile_managers other
        join public.home_members m on m.profile_id = other.manager_id and m.home_id = old_home
        where other.profile_id = k.kid_id and other.manager_id <> person
      )
  loop
    update public.home_kids set home_id = new_home, added_by = person, added_at = now() where kid_id = kid.kid_id;
    perform public.move_my_sick_days(old_home, new_home, kid.kid_id);
  end loop;
end;
$$;

revoke execute on function public.move_my_kids(uuid, uuid, uuid) from public, anon, authenticated;

-- Same as before (sick_day migration), plus kids: a Home that was only yours
-- brings its kids; leaving a shared one brings the kids only you look after
-- there. A kid moving in counts toward the new Home's 6.
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

create or replace function public.leave_home()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  old_home uuid;
  new_home uuid;
  contact record;
  new_contact uuid;
begin
  select home_id into old_home from public.home_members where profile_id = caller;
  if old_home is null then
    return public.my_home();
  end if;
  if not exists (select 1 from public.home_members where home_id = old_home and profile_id <> caller) then
    raise exception 'This Home is only yours';
  end if;

  update public.rhythms set owner = null where home_id = old_home and owner = caller;
  update public.subscriptions set payer = null
  where home_id = old_home and payer = caller and not (private and created_by = caller);
  delete from public.home_members where profile_id = caller;
  insert into public.homes default values returning id into new_home;
  insert into public.home_members (profile_id, home_id) values (caller, new_home);
  update public.subscriptions set home_id = new_home
  where home_id = old_home and private and created_by = caller;
  perform public.move_my_sick_days(old_home, new_home, caller);
  perform public.move_my_kids(old_home, new_home, caller);

  for contact in select * from public.letterbox_contacts where home_id = old_home loop
    insert into public.letterbox_contacts (
      home_id, name, address_from, line1, line2, city, region, postal_code, country, on_holiday_list, notes
    )
    values (
      new_home, contact.name,
      case when public.can_see_address(contact.address_from) then contact.address_from end,
      contact.line1, contact.line2, contact.city, contact.region, contact.postal_code, contact.country,
      contact.on_holiday_list, contact.notes
    )
    returning id into new_contact;
    insert into public.letterbox_people (contact_id, home_id, name, birthday, profile_id, position)
    select new_contact, new_home, name, birthday, profile_id, position
    from public.letterbox_people where contact_id = contact.id;
  end loop;
  return new_home;
end;
$$;

-- ===========================================================================
-- 6. Hand-off keeps the kid's place and everything that was theirs (HOME-010)
-- ===========================================================================

-- GIFT-021, now for the whole app: the kid signs in with their own email and
-- enters the code. Their Wishbook, Burrows, Gatherings, picture and birthday,
-- allergies, Potlucks, Getaways, sick days and the rest move onto their real
-- account; if they lived in a Home they take their place there as a grown-up
-- member (the same seat, so it still counts once toward the 6). The managed
-- profile then goes away, so managers stop seeing tucks and the kid (now the
-- owner) sees none (GIFT-007), including suggestions left on their list.
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

  -- Their name, picture, birthday and "about me", where the new account has none.
  update public.profiles
  set display_name = case when display_name is null or display_name like '%@%' then kid_profile.display_name else display_name end,
      avatar_icon = coalesce(avatar_icon, kid_profile.avatar_icon),
      avatar_color = coalesce(avatar_color, kid_profile.avatar_color),
      birthday = coalesce(birthday, kid_profile.birthday),
      bio = coalesce(bio, kid_profile.bio)
  where id = caller;

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
