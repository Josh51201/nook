# Nook — Requirements (living document)

_Last updated: 2026-10-07 (rev 5)_

## 1. Platform / Shell
- **CORE-001** Nook is a phone app containing many mini-apps ("Nooks") under one account.
- **CORE-002** Users add Nooks to their account; added Nooks appear on the homepage.
- **CORE-003** Nooks can be opened from the homepage and managed (arranged, removed, configured) easily there.
- **CORE-004** Heavy customization throughout ("to your heart's content").
- **CORE-005** Consistent cozy "small nook" naming theme for features and terms.
- **CORE-006** The Hearth (homepage) is fully customizable, with drag-and-drop arranging, so each person can set it up however they like (organized or otherwise). This is the app's headline appeal. (Planned for later; not built yet.)

## 1a. Accounts & Login
- **AUTH-001** Users sign in with their email address, via a one-time code sent to their inbox (no passwords). See Decision Log, Q-015.

## 2. Gift Nook (first Nook)
- **GIFT-001** Users create families and invite others to join.
- **GIFT-002** Users add gifts they want to their own list.
- **GIFT-003** Gifts belong to categories; each category asks the right questions (e.g. Clothes → sizes).
- **GIFT-004** Gifts can include an Amazon link; direct Amazon integration if feasible.
- **GIFT-005** Family members can see each other's gift lists.
- **GIFT-006** Family members can claim a gift on someone else's list.
- **GIFT-007** The list owner can NEVER see claims on their own gifts.
- **GIFT-008** Everyone else can see what's been claimed on other people's lists.
- **GIFT-009** Gifts are either repeatable (many givers, e.g. money, clothes) or one-and-done (single claim).
- **GIFT-010** Supports many event types, not just Christmas.
- **GIFT-011** A person can belong to several families at once.
- **GIFT-012** A person's wish list is created at the account level, outside any family, and is visible in every family they belong to.
- **GIFT-013** Claims on a gift are shared across all families: if someone in one family claims it, members of every other family the owner belongs to see it as claimed too (the owner still never sees it, per GIFT-007).
- **GIFT-014** A family can have several events at once, e.g. Christmas, a specific person's birthday, an anniversary, a baby shower, or Other.
- **GIFT-015** Each event has an end date.
- **GIFT-016** After an event ends, it is archived and then removed after some period of time.
- **GIFT-017** Every event shows a person's whole wish list by default, but the person can include or exclude specific gifts per event (e.g. only money for their birthday, their full list for Christmas).
- **GIFT-018** Any member of a family can invite others by sending them a code (not just admins).

## 3. Open Questions
- **Q-003** For events about one person (a birthday, a baby shower), does the event show only that person's list, while group events like Christmas show everyone's? Who is the "honoree" of an anniversary (both people)?
  - _Built for now (proposed):_ honorees are optional when creating a Gathering. If any are picked, the Gathering links to their Wishbooks; if none, to everyone in the Burrow. Anniversaries can pick both people.
- **Q-004** What categories at launch? (Clothes, Money/Gift card, Books, Toys, Experiences, Generic "Other"?) Which fields does each need?
  - _Built for now (proposed):_ the six placeholder Shelves, asking Clothes → size + color; Money/Gift Card → store + amount; Books → author; Toys → age range; Experiences → where. Clothes and Money default to "many can give" (GIFT-009). All changeable without a migration.
- **Q-005** Can claimers see who else claimed a repeatable gift, and can they leave notes ("got the blue one", "bought, arriving 12/20")?
  - _Built for now (proposed):_ claimers see a count ("2 others are giving this too") but not names; no notes yet.
- **Q-006** Can someone add a gift to another person's list as a suggestion (e.g. for kids)? Should it be hidden from that person?
- **Q-007** Kids / people without phones: can a parent manage a list on someone's behalf?
- **Q-008** Can a claim be released, and is there a "purchased" vs "planning to buy" state?
  - _Built for now (proposed):_ whoever tucked a gift can release it, freeing it for someone else. No "purchased" state yet.
- **Q-009** What happens when the owner edits or deletes a gift that's already claimed? (Claimers must be notified without the owner learning it was claimed.)
  - _Built for now (proposed):_ the owner can edit or delete any gift. Deleting silently removes its tucks; claimers are not notified yet.
- **Q-011** Amazon: links + auto-preview (title/image/price) is easy; deeper integration is limited by Amazon's APIs. Is link-with-preview good enough for v1?
- **Q-013** After an event ends, what happens to its claims? Are claimed one-and-done gifts removed from the owner's list automatically, and does the owner ever get to see who gave what?
- **Q-014** How long after an event ends before it's archived, and how long before it's deleted? Fixed, or set per family?
  - _Built for now (proposed):_ a Gathering shows as Archived once its end date passes. Nothing is auto-deleted until this is answered.
- **Q-017** What, if anything, can family admins do that members can't (remove someone, rename or delete the family)? Whoever starts a family is its admin today, with no extra powers.
- **Q-018** What does Hearth customization include (CORE-006)? E.g. tile sizes, colors/themes, folders or groups of Nooks, widgets showing info from a Nook (like an upcoming Gathering)?
- **Q-016** Since claims are shared across families (GIFT-013), can members of one family see *who* in another family claimed something, or just that it's claimed?
  - _Built for now (proposed):_ names of who tucked a gift aren't shown to anyone, in any Burrow, until this is answered.

## 4. Decision Log
- **2026-10-06 — Q-001 answered:** A person can be in several families. Their list is created outside any family and shows in all of them, with claims visible to all families except the list owner. → GIFT-011, GIFT-012, GIFT-013
- **2026-10-06 — Events:** Families can have multiple events (Christmas, birthdays, anniversary, baby shower, other) with end dates; ended events get archived and eventually go away. → GIFT-014–016
- **2026-10-06 — Login:** Email-based login. → AUTH-001
- **2026-10-06 — Q-012 answered:** Stack approved — Expo (React Native) + TypeScript + Expo Router for the app, Supabase for backend/auth/database, with the owner-can't-see-claims rule (GIFT-007) enforced in Postgres via row-level security. → Q-012, AUTH-001
- **2026-10-06 — Q-015 answered:** Email login via one-time code (OTP), no passwords. Chosen over magic links because magic links need deep-link/universal-link config that's extra setup and flakier in Expo Go during development; a typed code works the same in dev and production. Social sign-in (Apple/Google) deferred, not built this session. → AUTH-001, Q-015
- **2026-10-07 — Q-002 answered:** "A wishbook should be for the whole thing for every event but allow a user to exclude or include certain gifts so that way if they just want money for their bday they can do that and their full list for christmas." → GIFT-017
- **2026-10-07 — Q-010 answered:** Invites are codes, and "being able to send the code out from anyone is fine." Codes expiring after 7 days is still *(proposed)*. The admin-roles part of Q-010 split out as Q-017. → GIFT-018, Q-017
- **2026-10-07 — Hearth customization:** The Hearth will eventually be customizable with drag-and-drop, and that's "the big appeal of the app." → CORE-006, Q-018

## 5. Glossary (naming theme)
| Concept | Name | Status |
|---|---|---|
| A mini-app | Nook | approved |
| Homepage | The Hearth | proposed |
| A family group | Burrow | proposed |
| Invite | Knock | proposed |
| A person's wish list | Wishbook | proposed |
| Claiming a gift | Tuck (it's "tucked away") | proposed |
| An event | Gathering | proposed |
| Gift categories | Shelves | proposed |

## 6. Nook Backlog
- Food tracker Nook
- To-do list Nook
