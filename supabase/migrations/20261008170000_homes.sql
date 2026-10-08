-- Home (HOME-001..005): the people you live with, shared by every Nook that
-- keeps things for a household (Letterbox now; Pet Care and others next).
--
-- The Letterbox's sharing tables become the Home tables, so anything already
-- in a Letterbox carries over untouched:
--
--   letterboxes ........... -> homes
--   letterbox_members ..... -> home_members   (one Home per person)
--   letterbox_invites ..... -> home_invites
--   letterbox_households .. -> letterbox_contacts (an entry in the card list)
--
-- "Household" used to mean both the people you live with and an address in
-- the card list; now the first is your Home and the second is a contact.
-- Nothing here touches gifts or claims, so GIFT-007 is unaffected.

-- ===========================================================================
-- 1. Rename tables and columns
-- ===========================================================================

alter table public.letterboxes rename to homes;
alter table public.letterbox_members rename to home_members;
alter table public.letterbox_invites rename to home_invites;
alter table public.letterbox_households rename to letterbox_contacts;

alter table public.home_members rename column letterbox_id to home_id;
alter table public.home_invites rename column letterbox_id to home_id;
alter table public.letterbox_contacts rename column letterbox_id to home_id;
alter table public.letterbox_people rename column letterbox_id to home_id;
alter table public.letterbox_people rename column household_id to contact_id;
alter table public.letterbox_cards rename column letterbox_id to home_id;
alter table public.letterbox_cards rename column household_id to contact_id;
alter table public.letterbox_thanks rename column letterbox_id to home_id;
alter table public.letterbox_thanks rename column household_id to contact_id;

-- ===========================================================================
-- 2. Replace the helpers (and, with them, every policy that used them)
-- ===========================================================================

-- SQL-language function bodies are stored as text, so they'd break on the
-- rename. Dropping them takes the policies that depend on them along; all of
-- those are recreated below.
drop function public.is_letterbox_member(uuid) cascade;
drop function public.is_invited_to_letterbox(uuid) cascade;
drop function public.shares_letterbox_with(uuid) cascade;
drop function public.can_see_address(uuid) cascade;
drop function public.household_in_letterbox(uuid, uuid) cascade;
drop function public.can_thank_for_gift(uuid) cascade;
drop function public.can_use_letterbox_photo(text) cascade;
drop function public.my_letterbox() cascade;
drop function public.invite_to_letterbox(uuid) cascade;
drop function public.accept_letterbox_invite(uuid) cascade;
drop function public.leave_letterbox() cascade;

create function public.is_home_member(target_home uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.home_members
    where home_id = target_home and profile_id = (select auth.uid())
  );
$$;

create function public.is_invited_to_home(target_home uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.home_invites
    where home_id = target_home and invited = (select auth.uid())
  );
$$;

create function public.shares_home_with(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.home_members mine
    join public.home_members theirs on theirs.home_id = mine.home_id
    where mine.profile_id = (select auth.uid()) and theirs.profile_id = target
  );
$$;

-- PROF-005: you, your Home, and anyone sharing a Burrow with you that you
-- haven't left out.
create function public.can_see_address(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target = (select auth.uid())
    or public.shares_home_with(target)
    or exists (
      select 1
      from public.burrow_members mine
      join public.burrow_members theirs on theirs.burrow_id = mine.burrow_id
      where mine.profile_id = (select auth.uid())
        and theirs.profile_id = target
        and not exists (
          select 1 from public.address_hidden_burrows hidden
          where hidden.profile_id = target and hidden.burrow_id = mine.burrow_id
        )
    );
$$;

create function public.contact_in_home(target_contact uuid, target_home uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.letterbox_contacts where id = target_contact and home_id = target_home
  );
$$;

-- A received gift you (or a kid you manage) own — never anyone else's.
create function public.can_thank_for_gift(target_gift uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.gifts g
    where g.id = target_gift and g.received_at is not null and public.can_manage_wishbook(g.wishbook_id)
  );
$$;

-- Photos live at "<home id>/<file>" in the letterbox bucket.
create function public.can_use_letterbox_photo(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when split_part(object_name, '/', 1) ~ '^[0-9a-fA-F-]{36}$'
      then public.is_home_member(split_part(object_name, '/', 1)::uuid)
    else false
  end;
$$;

-- ===========================================================================
-- 3. Row level security, again
-- ===========================================================================

create policy "profile_addresses visible to self, Home and chosen Burrows" on public.profile_addresses
  for select using (public.can_see_address(profile_id));

create policy "homes visible to members and invitees" on public.homes
  for select using (public.is_home_member(id) or public.is_invited_to_home(id));

create policy "homes edited by members" on public.homes
  for update using (public.is_home_member(id)) with check (public.is_home_member(id));

create policy "home_members visible to members and invitees" on public.home_members
  for select using (public.is_home_member(home_id) or public.is_invited_to_home(home_id));

create policy "home_invites visible to the Home and the invitee" on public.home_invites
  for select using (invited = (select auth.uid()) or public.is_home_member(home_id));

create policy "home_invites withdrawn or declined" on public.home_invites
  for delete using (invited = (select auth.uid()) or public.is_home_member(home_id));

-- contacts -------------------------------------------------------------------
create policy "letterbox_contacts for the Home" on public.letterbox_contacts
  for select using (public.is_home_member(home_id));

create policy "letterbox_contacts added by the Home" on public.letterbox_contacts
  for insert with check (
    public.is_home_member(home_id)
    and (address_from is null or public.can_see_address(address_from))
  );

create policy "letterbox_contacts edited by the Home" on public.letterbox_contacts
  for update using (public.is_home_member(home_id))
  with check (
    public.is_home_member(home_id)
    and (address_from is null or public.can_see_address(address_from))
  );

create policy "letterbox_contacts removed by the Home" on public.letterbox_contacts
  for delete using (public.is_home_member(home_id));

-- people ---------------------------------------------------------------------
create policy "letterbox_people for the Home" on public.letterbox_people
  for select using (public.is_home_member(home_id));

create policy "letterbox_people added by the Home" on public.letterbox_people
  for insert with check (
    public.is_home_member(home_id)
    and public.contact_in_home(contact_id, home_id)
    and (profile_id is null or profile_id = (select auth.uid()) or public.shares_burrow_with((select auth.uid()), profile_id))
  );

create policy "letterbox_people edited by the Home" on public.letterbox_people
  for update using (public.is_home_member(home_id))
  with check (
    public.is_home_member(home_id)
    and public.contact_in_home(contact_id, home_id)
    and (profile_id is null or profile_id = (select auth.uid()) or public.shares_burrow_with((select auth.uid()), profile_id))
  );

create policy "letterbox_people removed by the Home" on public.letterbox_people
  for delete using (public.is_home_member(home_id));

-- cards ----------------------------------------------------------------------
create policy "letterbox_cards for the Home" on public.letterbox_cards
  for select using (public.is_home_member(home_id));

create policy "letterbox_cards added by the Home" on public.letterbox_cards
  for insert with check (
    public.is_home_member(home_id)
    and public.contact_in_home(contact_id, home_id)
    and (photo_path is null or split_part(photo_path, '/', 1) = home_id::text)
  );

create policy "letterbox_cards edited by the Home" on public.letterbox_cards
  for update using (public.is_home_member(home_id))
  with check (
    public.is_home_member(home_id)
    and public.contact_in_home(contact_id, home_id)
    and (photo_path is null or split_part(photo_path, '/', 1) = home_id::text)
  );

create policy "letterbox_cards removed by the Home" on public.letterbox_cards
  for delete using (public.is_home_member(home_id));

-- thank-yous -----------------------------------------------------------------
create policy "letterbox_thanks for the Home" on public.letterbox_thanks
  for select using (public.is_home_member(home_id));

create policy "letterbox_thanks added by the Home" on public.letterbox_thanks
  for insert with check (
    public.is_home_member(home_id)
    and (contact_id is null or public.contact_in_home(contact_id, home_id))
    and (gift_id is null or public.can_thank_for_gift(gift_id))
  );

create policy "letterbox_thanks edited by the Home" on public.letterbox_thanks
  for update using (public.is_home_member(home_id))
  with check (
    public.is_home_member(home_id)
    and (contact_id is null or public.contact_in_home(contact_id, home_id))
  );

create policy "letterbox_thanks removed by the Home" on public.letterbox_thanks
  for delete using (public.is_home_member(home_id));

-- The thank-you column grant named a column that has since been renamed.
revoke update on public.letterbox_thanks from anon, authenticated;
grant update (contact_id, from_name, what, thanked_at) on public.letterbox_thanks to authenticated;

-- Photos.
create policy "letterbox photos seen by the Home" on storage.objects
  for select to authenticated
  using (bucket_id = 'letterbox' and public.can_use_letterbox_photo(name));

create policy "letterbox photos added by the Home" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'letterbox' and public.can_use_letterbox_photo(name));

create policy "letterbox photos removed by the Home" on storage.objects
  for delete to authenticated
  using (bucket_id = 'letterbox' and public.can_use_letterbox_photo(name));

-- ===========================================================================
-- 4. Your Home: opening it, inviting, joining, leaving (HOME-002..004)
-- ===========================================================================

-- Your Home, made the first time anything needs it.
create function public.my_home()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  home uuid;
begin
  if caller is null or public.is_managed_profile(caller) then
    raise exception 'Sign in to use your Home';
  end if;
  select home_id into home from public.home_members where profile_id = caller;
  if home is null then
    insert into public.homes default values returning id into home;
    insert into public.home_members (profile_id, home_id) values (caller, home)
    on conflict (profile_id) do nothing;
    if not found then
      -- Opened on two screens at once: keep the one that won.
      delete from public.homes where id = home;
      select home_id into home from public.home_members where profile_id = caller;
    end if;
  end if;
  return home;
end;
$$;

-- Ask someone you share a Burrow with to share your Home.
create function public.invite_to_home(target uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  home uuid;
  invite uuid;
  inviter text;
begin
  select home_id into home from public.home_members where profile_id = caller;
  if home is null then
    raise exception 'Open your Home first';
  end if;
  if target is null or target = caller or public.is_managed_profile(target) then
    raise exception 'You can''t invite them';
  end if;
  if not public.shares_burrow_with(caller, target) then
    raise exception 'You can only invite family from your Burrows';
  end if;
  if exists (select 1 from public.home_members where profile_id = target and home_id = home) then
    raise exception 'They already share this Home';
  end if;

  insert into public.home_invites (home_id, invited, invited_by)
  values (home, target, caller)
  on conflict (home_id, invited) do update set created_at = now(), invited_by = excluded.invited_by
  returning id into invite;

  select coalesce(nullif(trim(display_name), ''), 'Someone') into inviter from public.profiles where id = caller;
  insert into public.notifications (profile_id, nook, kind, title, body, data)
  values (
    target,
    'home',
    'home_invite',
    inviter || ' wants to share a Home with you',
    'The people you live with, and everything you keep together. Tap to answer.',
    jsonb_build_object('invite_id', invite)
  );
  return invite;
end;
$$;

-- Join a Home you were invited to. If yours was only yours, everything kept
-- in it comes along with you; otherwise you just leave it.
create function public.accept_home_invite(invite_id uuid)
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
      -- A kid's gift two parents both thanked for: keep the one already there.
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
      -- Other Nooks that keep things in a Home add their move here.
      delete from public.home_members where profile_id = caller;
      delete from public.homes where id = old_home;
    else
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

-- Leave a shared Home. You get your own again, with a copy of the Letterbox
-- addresses (not the card history, which stays with the Home).
create function public.leave_home()
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

  delete from public.home_members where profile_id = caller;
  insert into public.homes default values returning id into new_home;
  insert into public.home_members (profile_id, home_id) values (caller, new_home);

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

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.my_home()',
    'public.invite_to_home(uuid)',
    'public.accept_home_invite(uuid)',
    'public.leave_home()'
  ] loop
    execute format('revoke execute on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end;
$$;

-- ===========================================================================
-- 5. Birthday reminders read the renamed tables (LET-010)
-- ===========================================================================

create or replace function public.letterbox_daily()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target date := current_date + 7;
  leap boolean := extract(day from make_date(extract(year from (current_date + 7))::int, 3, 1) - 1) = 29;
  due record;
begin
  for due in
    select m.profile_id as recipient, p.contact_id, p.name
    from public.letterbox_people p
    join public.home_members m on m.home_id = p.home_id
    left join public.profiles pr on pr.id = p.profile_id
    where coalesce(pr.birthday, p.birthday) is not null
      and p.profile_id is distinct from m.profile_id
      and (
        to_char(coalesce(pr.birthday, p.birthday), 'MM-DD') = to_char(target, 'MM-DD')
        or (not leap and to_char(coalesce(pr.birthday, p.birthday), 'MM-DD') = '02-29' and to_char(target, 'MM-DD') = '03-01')
      )
  loop
    if public.wants_letterbox_reminder(due.recipient) then
      insert into public.notifications (profile_id, nook, kind, title, body, data)
      values (
        due.recipient,
        'letterbox',
        'birthday_card',
        due.name || '''s birthday is in a week',
        'Time to send a card so it gets there by ' || trim(to_char(target, 'FMMonth FMDD')) || '.',
        jsonb_build_object('contact_id', due.contact_id)
      );
    end if;
  end loop;
end;
$$;

revoke execute on function public.letterbox_daily() from public, anon, authenticated;

-- Notices already sent about Letterbox invites now belong to the Home.
update public.notifications set nook = 'home', kind = 'home_invite' where nook = 'letterbox' and kind = 'letterbox_invite';
update public.notifications set nook = 'home', kind = 'home_joined' where nook = 'letterbox' and kind = 'letterbox_joined';
update public.notifications set data = (data - 'household_id') || jsonb_build_object('contact_id', data -> 'household_id')
  where nook = 'letterbox' and kind = 'birthday_card' and data ? 'household_id';
