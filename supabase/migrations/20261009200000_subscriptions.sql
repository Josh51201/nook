-- Subscriptions Nook (SUB-001..012).
--
--   subscriptions ............. SUB-001..006, SUB-010: the Home's recurring
--                               charges (or "Just me" ones), each with a price,
--                               how often it bills, the next renewal, who pays
--                               and the card it goes on
--   subscription_prices ....... SUB-008: every price it's had, written by a
--                               trigger so history can't be made up
--   subscriptions_daily() ..... SUB-003: rolls renewals forward and sends the
--                               "cancel by" and "trial ends" reminders
--
-- Nothing here touches gifts or claims, so GIFT-007 is unaffected.

-- ===========================================================================
-- 1. Tables
-- ===========================================================================

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  home_id uuid not null references public.homes (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 60),
  category text not null default 'other'
    check (category in ('streaming', 'music', 'gaming', 'reading', 'apps', 'fitness', 'food', 'home', 'memberships', 'other')),
  -- What each charge costs, in cents (so $15.49 is 1549).
  price_cents int not null default 0 check (price_cents between 0 and 10000000),
  cycle text not null default 'monthly'
    check (cycle in ('weekly', 'monthly', 'quarterly', 'half_yearly', 'yearly')),
  -- The next charge. On a free trial, the day the trial ends and the first
  -- charge lands.
  renews_on date not null,
  on_trial boolean not null default false,
  -- Remind this many days before it renews (null = no reminder).
  remind_days int default 3 check (remind_days is null or remind_days in (1, 3, 7, 14)),
  -- "Just me" (SUB-002): only whoever added it can see it.
  private boolean not null default false,
  -- Who pays (SUB-005): someone in the Home, or not said.
  payer uuid references public.profiles (id) on delete set null,
  -- Which card (SUB-005): a nickname and the last 4 digits. Never a full
  -- card number: the nickname can't hold a long run of digits.
  card_name text check (card_name is null or (char_length(card_name) <= 30 and card_name !~ '[0-9]{5,}')),
  card_last4 text check (card_last4 is null or card_last4 ~ '^[0-9]{4}$'),
  -- Where to manage or cancel it (SUB-009).
  manage_url text check (manage_url is null or (char_length(manage_url) <= 500 and manage_url ~* '^https?://')),
  notes text check (notes is null or char_length(notes) <= 300),
  -- Paused or cancelled ones are kept (SUB-010); stopped_on is when, for
  -- "what cancelling has saved you".
  status text not null default 'active' check (status in ('active', 'paused', 'cancelled')),
  stopped_on date,
  -- The phone's time zone, so reminders go out in the morning.
  tz text not null default 'UTC' check (char_length(tz) <= 64),
  -- Which renewal date the reminder was last sent for, so it goes out once.
  reminded_for date,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  check ((status = 'active') = (stopped_on is null))
);

create index subscriptions_home on public.subscriptions (home_id, renews_on);

create table public.subscription_prices (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions (id) on delete cascade,
  price_cents int not null,
  cycle text not null,
  changed_on date not null default current_date,
  changed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index subscription_prices_sub on public.subscription_prices (subscription_id, created_at desc);

alter table public.subscriptions enable row level security;
alter table public.subscription_prices enable row level security;

-- ===========================================================================
-- 2. Helpers (security definer so they don't re-enter RLS)
-- ===========================================================================

-- Can the caller see this subscription? Their Home's, unless it's someone
-- else's "Just me" one.
create function public.can_see_subscription(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.subscriptions s
    where s.id = target
      and public.is_home_member(s.home_id)
      and (not s.private or s.created_by = (select auth.uid()))
  );
$$;

-- ===========================================================================
-- 3. Row level security (SUB-002, SUB-012)
-- ===========================================================================

-- Checks the row's own columns rather than looking it up by id, so a new
-- subscription can be read back in the same statement that adds it.
create policy "subscriptions visible to the Home" on public.subscriptions
  for select using (
    public.is_home_member(home_id) and (not private or created_by = (select auth.uid()))
  );

create policy "subscriptions added by the Home" on public.subscriptions
  for insert with check (
    public.is_home_member(home_id)
    and created_by = (select auth.uid())
    and (payer is null or (case when private then payer = created_by else public.lives_in_home(payer, home_id) end))
  );

-- Only whoever added it can make it "Just me" (the check fails for anyone
-- else), and a "Just me" one can only be paid by them.
create policy "subscriptions changed by the Home" on public.subscriptions
  for update using (
    public.is_home_member(home_id) and (not private or created_by = (select auth.uid()))
  )
  with check (
    public.is_home_member(home_id)
    and (not private or created_by = (select auth.uid()))
    and (payer is null or (case when private then payer = created_by else public.lives_in_home(payer, home_id) end))
  );

create policy "subscriptions removed by the Home" on public.subscriptions
  for delete using (
    public.is_home_member(home_id) and (not private or created_by = (select auth.uid()))
  );

-- A subscription can't move Homes or change who added it; reminder
-- bookkeeping is the database's own.
revoke update on public.subscriptions from anon, authenticated;
grant update (
  name, category, price_cents, cycle, renews_on, on_trial, remind_days, private, payer,
  card_name, card_last4, manage_url, notes, status, stopped_on, tz
) on public.subscriptions to authenticated;

-- Price history is read directly but only written by the trigger below.
create policy "subscription_prices visible with the subscription" on public.subscription_prices
  for select using (public.can_see_subscription(subscription_id));

-- ===========================================================================
-- 4. Price history (SUB-008)
-- ===========================================================================

create function public.log_subscription_price()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.price_cents is distinct from old.price_cents or new.cycle is distinct from old.cycle then
    insert into public.subscription_prices (subscription_id, price_cents, cycle, changed_by)
    values (new.id, new.price_cents, new.cycle, auth.uid());
  end if;
  -- A new renewal date gets its own reminder.
  if new.renews_on is distinct from old.renews_on then
    new.reminded_for := null;
  end if;
  return new;
end;
$$;

create function public.subscription_price_logged()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.subscription_prices (subscription_id, price_cents, cycle, changed_by)
  values (new.id, new.price_cents, new.cycle, auth.uid());
  return new;
end;
$$;

-- Before update: log a changed price and reset the reminder (the daily job
-- changes neither price nor date when it marks a reminder sent). After
-- insert: log the first price (the row has to exist first).
create trigger subscriptions_price_changed
  before update on public.subscriptions
  for each row execute function public.log_subscription_price();

create trigger subscriptions_price_first
  after insert on public.subscriptions
  for each row execute function public.subscription_price_logged();

-- ===========================================================================
-- 5. Renewals and reminders (SUB-003)
-- ===========================================================================

-- Subscriptions settings (nook_settings, 'subscriptions'): trial and
-- yearly reminders are on unless turned off; monthly and weekly ones are
-- off unless turned on, since they'd come every few weeks.
create function public.wants_subscription_notice(recipient uuid, setting text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select recipient is not null
    and not public.is_managed_profile(recipient)
    and coalesce(
      (select (settings ->> setting)::boolean from public.nook_settings where profile_id = recipient and nook = 'subscriptions'),
      setting <> 'notifyMonthly'
    );
$$;

-- Who hears about one: just its adder if it's "Just me"; otherwise whoever
-- pays (if they still live there), or everyone in the Home.
create function public.subscription_recipients(target uuid)
returns table (profile_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select m.profile_id
  from public.subscriptions s
  join public.home_members m on m.home_id = s.home_id
  where s.id = target
    and case
      when s.private then m.profile_id = s.created_by
      when s.payer is not null and public.lives_in_home(s.payer, s.home_id) then m.profile_id = s.payer
      else true
    end;
$$;

-- The next charge after `day`, stepping by the subscription's cycle.
create function public.subscription_step(day date, every text)
returns date
language sql
immutable
as $$
  select case every
    when 'weekly' then day + 7
    when 'monthly' then (day + interval '1 month')::date
    when 'quarterly' then (day + interval '3 months')::date
    when 'half_yearly' then (day + interval '6 months')::date
    else (day + interval '1 year')::date
  end;
$$;

-- Runs hourly. From 8 AM in each subscription's time zone:
--   * a renewal date that's passed rolls forward to the next one (and a
--     free trial that's ended becomes a paid subscription);
--   * once per renewal, a reminder `remind_days` before it: "cancel by"
--     for a trial, "renews on" otherwise.
create function public.subscriptions_daily()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  item record;
  who record;
  local_now timestamp;
  today date;
  next_day date;
  setting text;
  kind text;
  title text;
  body text;
  price text;
begin
  for item in
    select * from public.subscriptions
    where status = 'active' and renews_on <= current_date + 15
  loop
    begin
      local_now := now() at time zone item.tz;
    exception when others then
      local_now := now() at time zone 'UTC';
    end;
    if local_now::time < time '08:00' then
      continue;
    end if;
    today := local_now::date;

    -- Roll forward past today (it renewed, or the trial turned into a paid one).
    if item.renews_on < today then
      next_day := item.renews_on;
      while next_day < today loop
        next_day := public.subscription_step(next_day, item.cycle);
      end loop;
      update public.subscriptions
      set renews_on = next_day, on_trial = false, reminded_for = null
      where id = item.id;
      item.renews_on := next_day;
      item.on_trial := false;
      item.reminded_for := null;
    end if;

    if item.remind_days is null
      or item.reminded_for is not distinct from item.renews_on
      or item.renews_on > today + item.remind_days
    then
      continue;
    end if;

    update public.subscriptions set reminded_for = item.renews_on where id = item.id;

    setting := case
      when item.on_trial then 'notifyTrials'
      when item.cycle in ('weekly', 'monthly') then 'notifyMonthly'
      else 'notifyYearly'
    end;
    price := '$' || to_char(item.price_cents / 100.0, 'FM999,999,990.00');
    if item.on_trial then
      kind := 'trial_ending';
      title := item.name || ': free trial ends ' ||
        case when item.renews_on = today then 'today' when item.renews_on = today + 1 then 'tomorrow'
          else to_char(item.renews_on, 'FMDay, FMMonth FMDD') end;
      body := 'Cancel before then, or it starts charging ' || price || '.';
    else
      kind := 'renewal_soon';
      title := item.name || ' renews ' ||
        case when item.renews_on = today then 'today' when item.renews_on = today + 1 then 'tomorrow'
          else to_char(item.renews_on, 'FMDay, FMMonth FMDD') end;
      body := price || ' will be charged. Cancel before then if you don''t want it.';
    end if;

    for who in select profile_id from public.subscription_recipients(item.id) loop
      if public.wants_subscription_notice(who.profile_id, setting) then
        insert into public.notifications (profile_id, nook, kind, title, body, data)
        values (who.profile_id, 'subscriptions', kind, title, body, jsonb_build_object('subscription_id', item.id));
      end if;
    end loop;
  end loop;
end;
$$;

revoke execute on function public.subscriptions_daily() from public, anon, authenticated;
revoke execute on function public.wants_subscription_notice(uuid, text) from public, anon, authenticated;
revoke execute on function public.subscription_recipients(uuid) from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.schedule('subscription-reminders', '7 * * * *', 'select public.subscriptions_daily()');
  else
    raise notice 'pg_cron not available — enable it, then schedule public.subscriptions_daily()';
  end if;
exception when others then
  raise notice 'Could not schedule subscriptions_daily (%): enable pg_cron in Database > Extensions', sqlerrm;
end;
$$;

-- ===========================================================================
-- 6. Subscriptions move with you (HOME-003, HOME-005, SUB-011)
-- ===========================================================================

-- Same as before (rhythms migration), plus: a Home that was only yours
-- brings its subscriptions along; leaving a shared one brings your "Just
-- me" ones with you and stops you being the payer of the shared ones.
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
      delete from public.home_members where profile_id = caller;
      delete from public.homes where id = old_home;
    else
      update public.rhythms set owner = null where home_id = old_home and owner = caller;
      update public.subscriptions set home_id = target_home
      where home_id = old_home and private and created_by = caller;
      update public.subscriptions set payer = null where home_id = old_home and payer = caller;
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
