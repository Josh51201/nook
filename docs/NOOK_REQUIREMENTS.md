# Nook — Requirements (living document)

_Last updated: 2026-10-06 (rev 3)_

## 1. Platform / Shell
- **CORE-001** Nook is a phone app containing many mini-apps ("Nooks") under one account.
- **CORE-002** Users add Nooks to their account; added Nooks appear on the homepage.
- **CORE-003** Nooks can be opened from the homepage and managed (arranged, removed, configured) easily there.
- **CORE-004** Heavy customization throughout ("to your heart's content").
- **CORE-005** Consistent cozy "small nook" naming theme for features and terms.

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

## 3. Open Questions
- **Q-002** Since lists live at the account level, how does a list relate to an event? Does each event show a person's whole list, or do they pick which gifts apply to which event (e.g. a big item for their birthday, small ones for Christmas)?
- **Q-003** For events about one person (a birthday, a baby shower), does the event show only that person's list, while group events like Christmas show everyone's? Who is the "honoree" of an anniversary (both people)?
- **Q-004** What categories at launch? (Clothes, Money/Gift card, Books, Toys, Experiences, Generic "Other"?) Which fields does each need?
- **Q-005** Can claimers see who else claimed a repeatable gift, and can they leave notes ("got the blue one", "bought, arriving 12/20")?
- **Q-006** Can someone add a gift to another person's list as a suggestion (e.g. for kids)? Should it be hidden from that person?
- **Q-007** Kids / people without phones: can a parent manage a list on someone's behalf?
- **Q-008** Can a claim be released, and is there a "purchased" vs "planning to buy" state?
- **Q-009** What happens when the owner edits or deletes a gift that's already claimed? (Claimers must be notified without the owner learning it was claimed.)
- **Q-010** Invites: link, code, or contacts? Family admins/roles?
- **Q-011** Amazon: links + auto-preview (title/image/price) is easy; deeper integration is limited by Amazon's APIs. Is link-with-preview good enough for v1?
- **Q-013** After an event ends, what happens to its claims? Are claimed one-and-done gifts removed from the owner's list automatically, and does the owner ever get to see who gave what?
- **Q-014** How long after an event ends before it's archived, and how long before it's deleted? Fixed, or set per family?
- **Q-016** Since claims are shared across families (GIFT-013), can members of one family see *who* in another family claimed something, or just that it's claimed?

## 4. Decision Log
- **2026-10-06 — Q-001 answered:** A person can be in several families. Their list is created outside any family and shows in all of them, with claims visible to all families except the list owner. → GIFT-011, GIFT-012, GIFT-013
- **2026-10-06 — Events:** Families can have multiple events (Christmas, birthdays, anniversary, baby shower, other) with end dates; ended events get archived and eventually go away. → GIFT-014–016
- **2026-10-06 — Login:** Email-based login. → AUTH-001
- **2026-10-06 — Q-012 answered:** Stack approved — Expo (React Native) + TypeScript + Expo Router for the app, Supabase for backend/auth/database, with the owner-can't-see-claims rule (GIFT-007) enforced in Postgres via row-level security. → Q-012, AUTH-001
- **2026-10-06 — Q-015 answered:** Email login via one-time code (OTP), no passwords. Chosen over magic links because magic links need deep-link/universal-link config that's extra setup and flakier in Expo Go during development; a typed code works the same in dev and production. Social sign-in (Apple/Google) deferred, not built this session. → AUTH-001, Q-015

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
