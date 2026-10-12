-- Notes Nook (NOTE-001..010).
--
--   notes ..... NOTE-001..006: a note's text (its first line is the title),
--               which folder it's in, whether it's pinned, who can see it
--
-- Like Little Log, a note belongs to the person who wrote it, not a Home.
-- Private by default; a shared one is seen and edited by whoever lives
-- with its owner right now. Only the owner pins it, files it, shares or
-- unshares it, or deletes it (NOTE-006).
--
-- Nothing here touches gifts or claims, so GIFT-007 is unaffected.

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null default '' check (char_length(body) <= 20000),
  folder text check (folder is null or char_length(trim(folder)) between 1 and 30),
  pinned boolean not null default false,
  shared boolean not null default false,
  created_at timestamptz not null default now(),
  -- Kept by the trigger below: when it last changed, and by whom (a shared
  -- note says "edited by Sarah"; the app also uses it to notice when two
  -- people changed it at once).
  updated_at timestamptz not null default now(),
  edited_by uuid default auth.uid() references public.profiles (id) on delete set null
);

create index notes_owner on public.notes (owner_id, updated_at desc);

alter table public.notes enable row level security;

-- Every change stamps when and who. Someone the note is shared with can
-- change its words, nothing else.
create function public.stamp_note()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is distinct from old.owner_id
    and (new.folder is distinct from old.folder or new.pinned is distinct from old.pinned or new.shared is distinct from old.shared)
  then
    raise exception 'Only whoever wrote this note can do that';
  end if;
  if new.body is distinct from old.body then
    new.updated_at := now();
    new.edited_by := auth.uid();
  end if;
  return new;
end;
$$;

create trigger notes_stamped
  before update on public.notes
  for each row execute function public.stamp_note();

-- Checks the row's own columns, so a new note can be read back in the
-- same statement that adds it.
create policy "notes seen by their owner and, if shared, their Home" on public.notes
  for select using (
    owner_id = (select auth.uid()) or (shared and public.shares_home_with(owner_id))
  );

create policy "notes written by their owner" on public.notes
  for insert with check (owner_id = (select auth.uid()));

create policy "notes changed by their owner or, if shared, their Home" on public.notes
  for update using (
    owner_id = (select auth.uid()) or (shared and public.shares_home_with(owner_id))
  )
  with check (
    owner_id = (select auth.uid()) or (shared and public.shares_home_with(owner_id))
  );

create policy "notes removed by their owner" on public.notes
  for delete using (owner_id = (select auth.uid()));

-- A note can't change hands; the stamps are the trigger's.
revoke update on public.notes from anon, authenticated;
grant update (body, folder, pinned, shared) on public.notes to authenticated;
