# Nook — Requirements for the built Nooks (archive)

_Gift, Potluck, Letterbox, Pet Care and Rhythms Nook requirements, moved out of the working doc on 2026-10-08 because they're built. Look up by ID (e.g. `GIFT-013`) when you work on one of these Nooks; add changes here._

## 2. Gift Nook (first Nook)
- **GIFT-001** Users create families and invite others to join. _(Now in the Burrows tab, shared by every Nook — CORE-025.)_
- **GIFT-002** Users add gifts they want to their own list.
- **GIFT-003** Gifts belong to categories; each category asks the right questions (e.g. Clothes → sizes).
- **GIFT-004** Gifts can include an Amazon link; direct Amazon integration if feasible.
- **GIFT-005** Family members can see each other's gift lists.
- **GIFT-006** Family members can claim a gift on someone else's list.
- **GIFT-007** The list owner can NEVER see claims on their own gifts. (A kid's managers aren't its owner, so they can see claims on the kid's list — GIFT-020. Once the kid takes the list over, GIFT-021, they're the owner and see nothing.)
- **GIFT-008** Everyone else can see what's been claimed on other people's lists.
- **GIFT-009** Gifts are either repeatable (many givers, e.g. money, clothes) or one-and-done (single claim).
- **GIFT-010** Supports many event types, not just Christmas.
- **GIFT-011** A person can belong to several families at once.
- **GIFT-012** A person's wish list is created at the account level, outside any family, and is visible in every family they belong to.
- **GIFT-013** Claims on a gift are shared across all families: if someone in one family claims it, members of every other family the owner belongs to see it as claimed too (the owner still never sees it, per GIFT-007).
- **GIFT-014** A family can have several events at once, e.g. Christmas, a specific person's birthday, an anniversary, a baby shower, or Other.
- **GIFT-015** Each event has an end date.
- **GIFT-016** After an event ends, it is archived and then removed after some period of time (see GIFT-027).
- **GIFT-017** Every event shows a person's whole wish list by default, but the person can include or exclude specific gifts per event (e.g. only money for their birthday, their full list for Christmas).
- **GIFT-018** Any member of a family can invite others by sending them a code (not just admins).
- **GIFT-019** Kids and people without phones get a managed profile: a parent creates it with just a name (no email). It has its own wish list and joins families like anyone else.
- **GIFT-020** A managed profile's creator is its manager and can add other managers (e.g. the other parent). Managers add and edit its gifts. Because the kid can't see anything, managers *can* see what's been claimed on the kid's list, to coordinate. Everyone else just views and claims.
- **GIFT-021** When a kid is older, a manager sends them a hand-off code. The kid signs up with their own email, enters the code, and the whole list moves onto their account. From then on they're the owner (GIFT-007 applies to them) and nobody manages it.
- **GIFT-022** Anyone in a family can suggest a gift on someone else's list. Suggestions are hidden from the list's owner; everyone else sees them and can claim them. A kid's managers see suggestions on the kid's list.
- **GIFT-023** A claim has a status: Planning → Bought. Other givers see it.
- **GIFT-024** Givers see who else is giving a gift and can leave notes ("got the blue one", "arriving 12/20"), across every family the owner is in. The owner never sees any of it.
- **GIFT-025** If the owner edits or removes a gift someone already claimed, the giver gets a heads-up (removed: "Mom removed this from their list" until they dismiss it; edited: "changed since you tucked it"). The owner is never told whether it was claimed.
- **GIFT-026** After an event ends, its honorees (or, with none, everyone; managers answer for kids) are asked "Did you receive any of these?" and check items off themselves. Received one-and-done gifts leave the list; repeatable ones stay. Nothing about who gave what is revealed. Only the owner checking a gift off removes it from their list. A claim made for that event keeps its status (e.g. still shows as Bought to other givers) for 30 days after the event, then is released if the owner didn't check that gift off.
- **GIFT-027** An event is archived at its end date and deleted 90 days later.
- **GIFT-028** Family admins can remove a member, rename or delete the family, make others admins, and delete any event. Other members can only delete events they created. A family always keeps at least one admin.
- **GIFT-029** Notifications, each turned on or off per person in Gift Nook settings: an event coming up, new gifts added, a gift you claimed changed, and someone joined your family. These start as an in-app inbox; phone push notifications come later (GIFT-031).
- **GIFT-031** Notifications are also sent as phone push notifications. (Later — not built yet.)
- **GIFT-032** *(proposed)* An owner can mark a gift ❤️ Most wanted; those show first on their list.
- **GIFT-033** *(proposed)* A gift can have an approximate price, and givers can filter someone's list by budget (under $25 / $50 / $100) and by Shelf.
- **GIFT-034** *(proposed)* Gatherings can be edited after they're planned (date, name, who it's for), with a calendar date picker and an "in 12 days" countdown.
- **GIFT-030** Pasting a link can fill in the gift's name and picture automatically where the shop allows it (Q-011).

- **GIFT-035** Each family automatically gets a Birthday Gathering for every member (kids included) who has set a birthday on their profile, created 30 days ahead, once a year, with that person as its honoree. It's created by whichever family phone opens Nook first, so nothing runs in the background. If an admin deletes one, it doesn't come back that year. _(Built — fine print in docs/archive/NOOK_REQUIREMENTS_FULL.md.)_
- **GIFT-036** Idea Stash: a person can keep private notes about other people — things they mentioned liking, gift ideas, sizes — that only they can ever see, and turn an idea into a gift (e.g. a suggestion on that person's list) when ready. _(Built 2026-10-09 (proposed details): **Idea Stash** card on the Gift Nook home, and "My private ideas for ..." on each person's Wishbook page. Notes are about people you share a Burrow with (or kids you manage), either a **gift idea** (title, link, price, details) or a **good to know** note (sizes, favorites). "Suggest" opens the usual gift form filled in, adding an ordinary hidden suggestion (GIFT-022), and the idea shows as suggested. Only the writer can ever read a note (RLS, with a test that the person it is about gets nothing); no notifications, counts or links to the gift.)_

## 2b. Potluck Nook
- **POT-001** A Potluck Nook for who's bringing what to a get-together, so nobody doubles up and nothing's missing. _(Built — fine print in docs/archive/NOOK_REQUIREMENTS_FULL.md.)_
- **POT-002** Every Potluck belongs to a Burrow, and that Burrow's members are who's invited. A Potluck can be tied to a Gathering (e.g. "Christmas at Grandma's" has both gift lists and a potluck) or stand on its own (a friends' or church potluck — make a Burrow for that group).
- **POT-003** The host can list what's needed ("2 sides, 1 dessert, drinks"), and people claim those slots; anyone can also just add a dish they're bringing.
- **POT-004** Dishes can be tagged with what's in them and which diets they suit.
- **POT-005** When a dish clashes with the allergy or diet of someone coming, the Potluck warns about it and names the person ("Contains peanuts — Mia has a peanut allergy").
- **POT-006** People RSVP — Going / Maybe / Can't make it — with how many they're bringing ("+2"), so the host knows how much food is needed. Warnings only count people who are coming. _(Proposed: a kid's managers RSVP for the kid; "Maybe" counts as coming for warnings.)_
- **POT-007** The day before, everyone bringing something gets an inbox reminder ("Tomorrow: you're bringing mashed potatoes"); it can be turned off in Potluck settings.
- **POT-008** Whoever makes a Potluck is its host and can add co-hosts; hosts and co-hosts can change it (slots, date, details). Burrow admins can step in too.

## 2c. Letterbox Nook
- **LET-001** A Letterbox Nook: the holiday card list with addresses — who you sent cards to and who sent you one, each year — that doubles as a contact list for family and friends. _(Built — fine print in docs/archive/NOOK_REQUIREMENTS_FULL.md.)_
- **LET-002** A Letterbox is shared by your Home (HOME-001): once someone shares your Home, it's one card list for both of you, and either of you can mark a card sent.
- **LET-003** Each entry in the Letterbox is a **contact** — one mailing address, like "The Johnson Family" — with the people who live there listed inside. (Renamed from "household" 2026-10-08, now that Home means the people you live with.) One card goes to each. _(Built — fine print in docs/archive/NOOK_REQUIREMENTS_FULL.md.)_
- **LET-004** Addresses come from both places: family members' own profile addresses (PROF-005), which stay up to date, and addresses you type in for anyone not on the app (friends, neighbors, coworkers). _(Built — fine print in docs/archive/NOOK_REQUIREMENTS_FULL.md.)_
- **LET-005** It tracks holiday cards each year: who you sent to and who sent you one, so next year you know who to send to. _(Built — fine print in docs/archive/NOOK_REQUIREMENTS_FULL.md.)_
- **LET-006** It tracks other cards too: birthday, thank-you, sympathy, wedding, graduation and more.
- **LET-007** You can keep photos of cards you receive (like family photo cards). _(Built: take one or pick one from your photos when logging a card; stored privately for your household only.)_
- **LET-008** This year's send list can be turned into printable mailing labels or a list to copy addresses from. _(Built — fine print in docs/archive/NOOK_REQUIREMENTS_FULL.md.)_
- **LET-009** A Hearth widget for card season: how many holiday cards are left to send, opening the list. _(Built — fine print in docs/archive/NOOK_REQUIREMENTS_FULL.md.)_
- **LET-010** A reminder about a week before a contact's birthday, so a card arrives on time. _(Built (proposed details): an inbox notice 7 days ahead, using the birthday on the person's Nook profile if they're linked; can be turned off in Letterbox settings.)_
- **LET-011** Thank-you notes owed: after you mark gifts received in the Gift Nook, the Letterbox lists who you still owe a thank-you note. _(GIFT-007/GIFT-026 mean the app can never say who gave a gift, so you say who each one was from yourself — it's never filled in from tucks. Built (proposed details): received gifts from the last year (yours and kids' you manage) wait under "Who from?"; then they're on a list to tick off as notes get written. "No note needed" clears one, and you can add thank-yous for anything else.)_

## 2d. Pet Care Nook
- **PET-001** A Pet Care Nook for the pets in your Home: nobody feeds twice, and vet visits, vaccines and meds aren't forgotten. _(Built — fine print in docs/archive/NOOK_REQUIREMENTS_FULL.md.)_
- **PET-002** Pets belong to your Home (HOME-001): everyone in it can see and change them. A pet can also have **helpers** — a pet sitter or grandparent you already share a Burrow with — who see just that pet for as long as you allow. _(Proposed: helpers can see everything about the pet and check off meals, walks and the like, but can't change its profile, meals or records; you can set an end date, and they can step away any time. Built: a helper is picked from people you share a Burrow with who aren't already in your Home, for 1–2 weeks, a month, until a date, or until removed; they see the pet in a "Pets you're helping with" list.)_
- **PET-003** Feeding check-offs: you set the meals per pet (e.g. Breakfast, Dinner); each shows done or not for today and resets daily, with who fed it and when. A meal already fed can't be checked off a second time. _(Built — fine print in docs/archive/NOOK_REQUIREMENTS_FULL.md.)_
- **PET-004** Vet visits, vaccines and medications with due dates (and how often they repeat), marked done when they happen. _(Built — fine print in docs/archive/NOOK_REQUIREMENTS_FULL.md.)_
- **PET-005** Quick check-offs for walks, potty breaks, litter changes and treats, with who and when. _(Built: Walk and Potty break for dogs, Litter for cats, rabbits and small pets, Treat for everyone; shown in "Lately" with who and when. History older than 120 days is cleared.)_
- **PET-006** A pet profile and records in one place: photo, breed, birthday, microchip number, vet name and number, food, and notes (allergies and the like). _(Built: photo from camera or library, tap-to-call on the vet's number, age worked out from the birthday.)_
- **PET-007** Reminders: if a meal hasn't been fed by a time you pick, the Home is nudged; a heads-up a week before a vet visit, vaccine or refill is due; and a notice when someone feeds the pet (off by default, since it could get noisy). Each can be turned off in Pet Care settings. _(Built — fine print in docs/archive/NOOK_REQUIREMENTS_FULL.md.)_

## 2e. Rhythms Nook
- **RHY-001** A Rhythms Nook for the chores that come round each year or season (furnace filter, smoke-detector batteries, gutters, flu shots, car registration), so none of them get forgotten. Each chore is a **rhythm** *(proposed)*. _(Built — fine print in docs/archive/NOOK_REQUIREMENTS_FULL.md.)_
- **RHY-002** Rhythms belong to your Home (HOME-001, HOME-005): everyone in it can see, add, change and mark them done.
- **RHY-003** The first time you open it, you pick from a starter list of common chores and set their dates. You can also add your own any time. _(Built — fine print in docs/archive/NOOK_REQUIREMENTS_FULL.md.)_
- **RHY-004** Each rhythm has a next due date and a repeat. Marking it done rolls the date forward. _(Built — fine print in docs/archive/NOOK_REQUIREMENTS_FULL.md.)_
- **RHY-005** A rhythm can have an owner, who is one person in the Home, or nobody so anyone can do it. Anyone can mark it done either way. _(Built: the owner has to live in the Home, enforced in the database. If they leave the Home, their rhythms go back to "anyone".)_
- **RHY-006** A log of who did each rhythm and when. _(Built — fine print in docs/archive/NOOK_REQUIREMENTS_FULL.md.)_
- **RHY-007** Reminders: a heads-up before a rhythm is due, a nudge on the day, a nudge once it's overdue, and a notice when someone does one. Each can be turned on or off in the Rhythms Nook's settings. _(Built — fine print in docs/archive/NOOK_REQUIREMENTS_FULL.md.)_
- **RHY-008** _(Proposed.)_ A "Due soon" Hearth widget, and the Nook's tile, show what's coming up next. Opening the widget shows the full list. _(Built — fine print in docs/archive/NOOK_REQUIREMENTS_FULL.md.)_
