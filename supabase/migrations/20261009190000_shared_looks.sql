-- Share a look (CORE-055): send your Hearth's theme, or your whole Hearth,
-- to family as a short code, so they can copy it and make it their own.
--
--   shared_looks ...... one shared look under a 6-letter code, for 30 days
--   share_look() ...... makes a code for a look (yours)
--   open_look() ....... reads a look by its code, if you share a Burrow
--                       with whoever made it ("to family")
--
-- A look is how a Hearth is laid out and decorated: widget settings, never
-- what a widget loads, and the app leaves private things (checklists, habit
-- days, photos, pets) out before sharing. Nothing here touches gifts, tucks
-- or claims, so GIFT-007 is unaffected.

create table public.shared_looks (
  code text primary key check (code ~ '^[A-HJKMNP-Z2-9]{6}$'),
  created_by uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('theme', 'hearth')),
  look jsonb not null check (jsonb_typeof(look) = 'object' and octet_length(look::text) <= 262144),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days'
);

create index shared_looks_maker on public.shared_looks (created_by, created_at desc);

alter table public.shared_looks enable row level security;

-- You can see and remove the codes you made. Everyone else only reaches a
-- look through open_look(), one code at a time.
create policy "shared_looks seen by whoever made them" on public.shared_looks
  for select using (created_by = (select auth.uid()));

create policy "shared_looks removed by whoever made them" on public.shared_looks
  for delete using (created_by = (select auth.uid()));

-- No insert or update policies: codes are made by share_look() below.

create function public.share_look(look_kind text, look_data jsonb)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  -- No 0/O/1/I/L, so codes read cleanly over a text message.
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  new_code text;
begin
  if caller is null or public.is_managed_profile(caller) then
    raise exception 'Sign in to share a look';
  end if;

  -- Old codes go, and nobody keeps more than 20 at once.
  delete from public.shared_looks where created_by = caller and expires_at <= now();
  if (select count(*) from public.shared_looks where created_by = caller) >= 20 then
    delete from public.shared_looks
    where code = (select code from public.shared_looks where created_by = caller order by created_at limit 1);
  end if;

  loop
    new_code := '';
    for i in 1..6 loop
      new_code := new_code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.shared_looks where code = new_code);
  end loop;

  insert into public.shared_looks (code, created_by, kind, look)
  values (new_code, caller, look_kind, look_data);
  return new_code;
end;
$$;

create function public.open_look(look_code text)
returns table (kind text, look jsonb, from_name text, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select s.kind, s.look, public.person_name(s.created_by), s.created_at
  from public.shared_looks s
  where s.code = upper(regexp_replace(coalesce(look_code, ''), '[^A-Za-z0-9]', '', 'g'))
    and s.expires_at > now()
    and (s.created_by = (select auth.uid()) or public.shares_burrow_with((select auth.uid()), s.created_by));
$$;

revoke execute on function public.share_look(text, jsonb) from public, anon;
revoke execute on function public.open_look(text) from public, anon;
grant execute on function public.share_look(text, jsonb) to authenticated;
grant execute on function public.open_look(text) to authenticated;
