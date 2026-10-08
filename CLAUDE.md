# Nook — Project Rules for Claude

Nook is a phone app that holds many mini-apps ("Nooks") under one account. Full spec, open
questions, decision log, and naming glossary live in [docs/NOOK_REQUIREMENTS.md](docs/NOOK_REQUIREMENTS.md).
**Don't read the whole thing** — it costs a lot of context. Grep it for the IDs/keywords
you need (e.g. `CORE-03`, `GIFT-007`, `Q-028`) and read just those lines or the one section
you're touching. Past decisions are in [docs/NOOK_DECISION_LOG.md](docs/NOOK_DECISION_LOG.md) and
the full "Built" fine print is in `docs/archive/NOOK_REQUIREMENTS_FULL.md`; open those only when
you need that history. Keep new "Built" notes in the main doc to 1–2 short sentences. Josh (the user) has never built a phone app before —
explain setup steps (installs, accounts, keys) in plain language and confirm he's done them
before relying on them.

## Keeping the spec current

Also follow `.claude/skills/nook-requirements/SKILL.md` — it governs how
`docs/NOOK_REQUIREMENTS.md` gets updated. Short version:
- New/changed requirement → add with a stable ID, never renumber. Removed ones get
  `~~struck~~ (dropped YYYY-MM-DD: reason)`.
- An open question gets answered → move it from Open Questions to the Decision Log with the
  date and Josh's own words where possible.
- A new question that blocks or shapes design → add to Open Questions with a `Q-###` id.
- A naming choice → update the Glossary; keep it *(proposed)* until Josh approves it.
- Update the doc **in the same step** as the code change, and tell Josh in 1-2 lines which IDs
  changed. Don't recite the doc back to him.
- Only record what Josh actually decided as a requirement. Claude's own suggestions are
  *(proposed)* or live in Open Questions until he confirms them.
- If a request conflicts with an existing requirement, flag the conflict and ask which wins
  before changing anything.

## Stack (decided — Q-012, see Decision Log)

- **Expo (React Native) + TypeScript + Expo Router** for the app, run via Expo Go during
  development.
- **Supabase** for backend, auth, and Postgres database.
- Email-based login (AUTH-001); exact style (magic link / OTP / password) is Q-015 until
  Josh picks one.

## Non-negotiable: GIFT-007

A list owner must **never** see claims on their own gifts — not in the UI, API responses,
notifications, push payloads, counts, sort order, or "last updated" hints. Enforce this in
Postgres with row-level security, not just app logic. Any code touching claims needs a test
proving the owner's view leaks nothing (no rows, no counts, no derived hints) while other
family members see claims normally.

## Secrets

Never hardcode secrets or API keys. All config (Supabase URL/anon key, etc.) goes in a local
`.env` file (`EXPO_PUBLIC_`-prefixed vars for anything the Expo client needs to read), and
`.env` is gitignored. Only commit `.env.example` with empty/placeholder values.

## Naming theme (Glossary in the requirements doc)

Keep the cozy "small nook" theme in UI copy, screen names, model/table names, and code
identifiers where reasonable: Nook (mini-app), The Hearth (homepage), Burrow (family group),
Knock (invite), Wishbook (wish list), Tuck (claim a gift), Gathering (event), Shelves
(categories). Names marked *(proposed)* in the glossary are fine to use in code, but keep them
marked proposed in the doc until Josh approves — don't silently promote them.

## Git

Set up git, commit at sensible checkpoints (foundation scaffold, auth, Hearth shell, schema,
RLS + tests — not one giant commit). Never commit secrets.
