-- GIFT-035: Burrows plan a Birthday Gathering for each member who has set a
-- birthday (kids too), starting 30 days ahead, once per person per year.
--
-- It's done by whichever phone opens Nook first (plan_birthday below), not a
-- scheduled job, so it doesn't depend on pg_cron. The table is the "claim":
-- (burrow, person, year) is unique, so two phones racing can't make two
-- Gatherings, and deleting a Birthday Gathering doesn't bring it back that
-- year — the claim row stays (gathering_id just becomes null).

create table public.birthday_gatherings (
  burrow_id uuid not null references public.burrows (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  year int not null,
  gathering_id uuid references public.gatherings (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (burrow_id, profile_id, year)
);

alter table public.birthday_gatherings enable row level security;

-- Members can see which birthdays are already planned (so their phone can
-- skip them). Rows are only ever written by plan_birthday().
create policy "birthday_gatherings visible to burrow members" on public.birthday_gatherings
  for select using (public.is_burrow_member(burrow_id));

create function public.plan_birthday(
  target_burrow uuid,
  target_profile uuid,
  birthday_year int,
  gathering_title text,
  gathering_ends_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  this_year int := extract(year from now())::int;
  new_gathering uuid;
begin
  if caller is null
     or not public.is_burrow_member(target_burrow)
     or not public.burrow_has_member(target_burrow, target_profile) then
    raise exception 'You can only plan birthdays for people in your own Burrows';
  end if;
  if not exists (select 1 from public.profiles where id = target_profile and birthday is not null) then
    raise exception 'They have not shared a birthday';
  end if;
  if birthday_year not between this_year and this_year + 1
     or gathering_ends_at < now() - interval '2 days'
     or gathering_ends_at > now() + interval '400 days'
     or coalesce(trim(gathering_title), '') = '' then
    raise exception 'That birthday does not look right';
  end if;

  insert into public.birthday_gatherings (burrow_id, profile_id, year)
  values (target_burrow, target_profile, birthday_year)
  on conflict do nothing;

  -- Already planned (or planned and then deleted): nothing to do.
  if not found then
    return null;
  end if;

  insert into public.gatherings (burrow_id, title, kind, ends_at, created_by)
  values (target_burrow, left(trim(gathering_title), 120), 'birthday', gathering_ends_at, caller)
  returning id into new_gathering;

  insert into public.gathering_honorees (gathering_id, profile_id)
  values (new_gathering, target_profile);

  update public.birthday_gatherings
  set gathering_id = new_gathering
  where burrow_id = target_burrow and profile_id = target_profile and year = birthday_year;

  return new_gathering;
end;
$$;

revoke execute on function public.plan_birthday(uuid, uuid, int, text, timestamptz) from public, anon;
grant execute on function public.plan_birthday(uuid, uuid, int, text, timestamptz) to authenticated;
