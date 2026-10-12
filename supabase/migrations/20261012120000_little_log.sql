-- Little Log Nook (LOG-001..010).
--
--   little_logs ............ LOG-001, LOG-006, LOG-008: one thing you keep
--                            track of (weight, blood pressure, mood…), what
--                            kind of value it takes, and who can see it
--   little_log_entries ..... LOG-003: each time something was logged
--
-- A log belongs to the person who made it, not to a Home. Private by
-- default; a shared one is seen (and added to) by whoever lives with its
-- owner right now, so it follows them if they move Homes and nothing has
-- to be copied when they do (LOG-006).
--
-- Nothing here touches gifts or claims, so GIFT-007 is unaffected.

-- ===========================================================================
-- 1. Tables
-- ===========================================================================

create table public.little_logs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 40),
  -- What each entry holds (LOG-001):
  --   number  one number, like a weight          value
  --   pair    two numbers, like 120/80           value, value2
  --   scale   1 to 5, like a mood                value
  --   yesno   did it happen today                value (1 yes, 0 no)
  --   text    just words                         note
  kind text not null check (kind in ('number', 'pair', 'scale', 'yesno', 'text')),
  unit text check (unit is null or char_length(unit) <= 12),
  -- A pair's two names, like {Top, Bottom}.
  labels text[] check (labels is null or (cardinality(labels) = 2 and char_length(labels[1]) <= 16 and char_length(labels[2]) <= 16)),
  icon text not null default 'chart' check (char_length(icon) <= 30),
  color text not null default '#4f7a8c' check (color ~ '^#[0-9a-fA-F]{6}$'),
  -- LOG-006: everyone in the owner's Home can see it and add to it.
  shared boolean not null default false,
  -- LOG-009: a daily nudge on the owner's own phone, at this time there
  -- ("HH:MM"). The phone schedules it; this is so another phone of theirs can too.
  remind_at text check (remind_at is null or remind_at ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  created_at timestamptz not null default now()
);

create index little_logs_owner on public.little_logs (owner_id, created_at);

create table public.little_log_entries (
  id uuid primary key default gen_random_uuid(),
  log_id uuid not null references public.little_logs (id) on delete cascade,
  logged_at timestamptz not null default now(),
  value numeric check (value is null or abs(value) < 1e9),
  value2 numeric check (value2 is null or abs(value2) < 1e9),
  note text check (note is null or char_length(note) <= 500),
  written_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index little_log_entries_log on public.little_log_entries (log_id, logged_at desc);

alter table public.little_logs enable row level security;
alter table public.little_log_entries enable row level security;

-- ===========================================================================
-- 2. An entry has to fit its log's kind
-- ===========================================================================

create function public.check_little_log_entry()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  log_kind text;
begin
  select kind into log_kind from public.little_logs where id = new.log_id;
  if new.note is not null and char_length(trim(new.note)) = 0 then
    new.note := null;
  end if;
  if log_kind = 'number' and (new.value is null or new.value2 is not null) then
    raise exception 'This log needs one number';
  elsif log_kind = 'pair' and (new.value is null or new.value2 is null) then
    raise exception 'This log needs both numbers';
  elsif log_kind = 'scale' and (new.value is null or new.value2 is not null or new.value not in (1, 2, 3, 4, 5)) then
    raise exception 'Pick 1 to 5';
  elsif log_kind = 'yesno' and (new.value is null or new.value2 is not null or new.value not in (0, 1)) then
    raise exception 'Pick yes or no';
  elsif log_kind = 'text' and (new.note is null or new.value is not null or new.value2 is not null) then
    raise exception 'Write something to log';
  end if;
  return new;
end;
$$;

create trigger little_log_entries_fit
  before insert or update on public.little_log_entries
  for each row execute function public.check_little_log_entry();

-- ===========================================================================
-- 3. Helpers (security definer so they don't re-enter RLS)
-- ===========================================================================

-- Can the caller see this log? Their own, or a shared one of someone they
-- live with.
create function public.can_see_little_log(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.little_logs l
    where l.id = target
      and (l.owner_id = (select auth.uid()) or (l.shared and public.shares_home_with(l.owner_id)))
  );
$$;

create function public.owns_little_log(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.little_logs l where l.id = target and l.owner_id = (select auth.uid()));
$$;

-- ===========================================================================
-- 4. Row level security (LOG-006)
-- ===========================================================================

-- Checks the row's own columns, so a new log can be read back in the same
-- statement that adds it.
create policy "little_logs seen by their owner and, if shared, their Home" on public.little_logs
  for select using (
    owner_id = (select auth.uid()) or (shared and public.shares_home_with(owner_id))
  );

create policy "little_logs made by their owner" on public.little_logs
  for insert with check (owner_id = (select auth.uid()));

create policy "little_logs changed by their owner" on public.little_logs
  for update using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

create policy "little_logs removed by their owner" on public.little_logs
  for delete using (owner_id = (select auth.uid()));

-- A log can't change hands or change what kind of thing it holds (its
-- entries are already that kind).
revoke update on public.little_logs from anon, authenticated;
grant update (name, unit, labels, icon, color, shared, remind_at) on public.little_logs to authenticated;

create policy "little_log_entries seen with the log" on public.little_log_entries
  for select using (public.can_see_little_log(log_id));

-- Anyone who can see a log can add to it (a shared one is for the Home).
create policy "little_log_entries added by whoever sees the log" on public.little_log_entries
  for insert with check (public.can_see_little_log(log_id) and written_by = (select auth.uid()));

-- An entry is changed or removed by whoever wrote it, or the log's owner.
create policy "little_log_entries changed by their writer or the owner" on public.little_log_entries
  for update using (
    public.can_see_little_log(log_id) and (written_by = (select auth.uid()) or public.owns_little_log(log_id))
  )
  with check (public.can_see_little_log(log_id));

create policy "little_log_entries removed by their writer or the owner" on public.little_log_entries
  for delete using (
    public.can_see_little_log(log_id) and (written_by = (select auth.uid()) or public.owns_little_log(log_id))
  );

-- An entry can't move to another log or change who wrote it.
revoke update on public.little_log_entries from anon, authenticated;
grant update (logged_at, value, value2, note) on public.little_log_entries to authenticated;
