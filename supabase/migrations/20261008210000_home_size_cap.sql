-- A Home holds at most 6 people (HOME-006), so one subscription per Home
-- (MON-002) can't quietly cover a whole Burrow of 20.
--
-- Enforced with triggers rather than by rewriting the invite/join functions,
-- so every way into a Home is covered: joining, and inviting past the limit.

create function public.enforce_home_size()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Lock the Home so two people joining at once can't both take the last place.
  perform 1 from public.homes where id = new.home_id for update;
  if (
    select count(*) from public.home_members
    where home_id = new.home_id and profile_id <> new.profile_id
  ) >= 6 then
    raise exception 'That Home is full — a Home holds up to 6 people';
  end if;
  return new;
end;
$$;

create trigger home_members_size
  before insert or update of home_id on public.home_members
  for each row execute procedure public.enforce_home_size();

-- Invites count too, so a Home can't hand out more than it has room for.
create function public.enforce_home_invites()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform 1 from public.homes where id = new.home_id for update;
  if (select count(*) from public.home_members where home_id = new.home_id)
     + (select count(*) from public.home_invites where home_id = new.home_id and invited <> new.invited) >= 6 then
    raise exception 'Your Home is full — a Home holds up to 6 people';
  end if;
  return new;
end;
$$;

create trigger home_invites_size
  before insert on public.home_invites
  for each row execute procedure public.enforce_home_invites();

revoke execute on function public.enforce_home_size() from public, anon, authenticated;
revoke execute on function public.enforce_home_invites() from public, anon, authenticated;
