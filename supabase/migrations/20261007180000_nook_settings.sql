-- Per-person settings for the Hearth and each Nook (CORE-012/013). One row
-- per (person, nook); `nook` is 'hearth' or a Nook key like 'gift-nook'.
-- Stored on the account (not the phone) so settings follow you to a new
-- device. Free-form jsonb so adding a setting never needs a migration —
-- the Hearth layout/widgets (CORE-006..011) can live here later too.
--
-- GIFT-007: nothing stored here may ever change what an owner can see
-- about claims on their own gifts. Claim visibility is enforced by RLS on
-- public.claims, which no setting can override.

create table public.nook_settings (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  nook text not null,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (profile_id, nook)
);

alter table public.nook_settings enable row level security;

create policy "nook_settings are private to their owner" on public.nook_settings
  for all using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));
