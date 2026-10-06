# Nook — Requirements (living document)

_Last updated: 2026-10-06_

## 1. Platform / Shell
- **CORE-001** Nook is a phone app containing many mini-apps ("Nooks") under one account.
- **CORE-002** Users add Nooks to their account; added Nooks appear on the homepage.
- **CORE-003** Nooks can be opened from the homepage and managed (arranged, removed, configured) easily there.
- **CORE-004** Heavy customization throughout ("to your heart's content").
- **CORE-005** Consistent cozy "small nook" naming theme for features and terms.

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

## 3. Open Questions
- **Q-001** Can someone belong to multiple families (e.g. both sides of the family)? Does one wish list show in all of them, or one list per family?
- **Q-002** Are lists tied to an event (Christmas 2026, Mom's birthday) or is there one ongoing list per person with event tags?
- **Q-003** Event types: holidays everyone exchanges on vs. single-person events (birthday, wedding, baby shower) where only one person's list matters?
- **Q-004** What categories at launch? (Clothes, Money/Gift card, Books, Toys, Experiences, Generic "Other"?) Which fields does each need?
- **Q-005** Can claimers see who else claimed a repeatable gift, and can they leave notes ("got the blue one", "bought, arriving 12/20")?
- **Q-006** Can someone add a gift to another person's list as a suggestion (e.g. for kids)? Should it be hidden from that person?
- **Q-007** Kids / people without phones: can a parent manage a list on someone's behalf?
- **Q-008** Can a claim be released, and is there a "purchased" vs "planning to buy" state?
- **Q-009** What happens when the owner edits or deletes a gift that's already claimed? (Claimers must be notified without the owner learning it was claimed.)
- **Q-010** Invites: link, code, or contacts? Family admins/roles?
- **Q-011** Amazon: links + auto-preview (title/image/price) is easy; deeper integration is limited by Amazon's APIs. Is link-with-preview good enough for v1?
- **Q-012** Platforms: iOS, Android, or both? Preferred stack (React Native/Expo, Flutter, native)? Backend (Supabase, Firebase, custom)?
- **Q-013** After the event, do claims get revealed to the owner or archived?

## 4. Decision Log
_(empty — answers move here with dates)_

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
