---
name: nook-requirements
description: Keeps the requirements, decisions, open questions, and naming glossary for Josh's "Nook" phone app (a many-apps-in-one app of mini-apps called Nooks, starting with a family gift-list Nook) up to date as the project evolves. Use this skill whenever Nook, a Nook, the gift Nook, the homepage/Hearth, families/Burrows, gift claiming, or any feature idea, change, or question about the Nook app comes up, in chat or in Claude Code, even if the user doesn't ask to "update requirements". Also use it before writing or changing Nook code so work matches the agreed spec.
---

# Nook Requirements Keeper

Nook is a phone app that holds many small apps ("Nooks") under one account. Nooks appear on a
homepage where they can be opened, rearranged, and managed, and everything is customizable.
The first Nook is a family gift-list tool; later ones may be food trackers, to-do lists, etc.

The goal of this skill: one living source of truth, so nothing gets lost the way it did in
Josh's family text chains.

## The living document

The spec lives in `NOOK_REQUIREMENTS.md`. Start from `references/requirements.md` (the seed copy)
the first time.

- **In Claude Code:** keep it at `docs/NOOK_REQUIREMENTS.md` in the repo. Read it before any
  feature work. Edit it in the same change as the code when behavior changes.
- **In claude.ai chat:** the Project's copy is the source of truth. If one is attached, read it.
  When something changes, give Josh the updated file (or just the changed sections if small)
  so he can replace the Project copy.

**Keep it small (Claude Code):** the doc is big, so don't read it end to end. Grep for the IDs or
keywords you need and read only that section. Decisions go in `docs/NOOK_DECISION_LOG.md`, not in
the main doc. When something is built, leave the requirement with a 1–2 sentence "Built" note;
long detail goes in `docs/archive/NOOK_REQUIREMENTS_FULL.md` only if it's worth keeping.

## When to update

Update whenever the conversation produces any of these:
1. **A new or changed requirement** → add to the right section with a stable ID (e.g. `GIFT-014`).
   Never renumber existing IDs; mark removed ones `~~struck~~ (dropped YYYY-MM-DD: reason)`.
2. **A decision** (an open question gets answered) → move it from Open Questions to the
   Decision Log with the date and the answer in Josh's words where possible.
3. **A new question** that blocks or shapes design → add to Open Questions with an ID (`Q-###`).
4. **A naming choice** → update the Glossary. Proposed names stay marked *(proposed)* until
   Josh approves them.
5. **A new Nook idea** → add a short entry under "Nook Backlog".

Only record what Josh actually said or decided as a requirement. Claude's suggestions go in
Open Questions or are marked *(proposed)* until he confirms them.

## How to work

- After updating, tell Josh in one or two lines what changed (IDs touched). Don't recite the doc.
- If a request conflicts with an existing requirement, point out the conflict and ask which wins
  before changing anything.
- Ask at most one or two open questions at a time, prioritizing ones that block current work.
- Keep the cozy, small-nook naming theme in UI copy, screen names, and model names (see Glossary).

## Privacy rule that must never break

In the gift Nook, a list owner must never be able to see claims on their own gifts: not in the
UI, not in API responses, not in notifications, push payloads, counts, sort order, or "last
updated" hints. Any code touching claims needs a test proving the owner's view leaks nothing.
