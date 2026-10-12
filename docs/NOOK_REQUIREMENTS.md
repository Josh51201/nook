# Nook — Requirements (living document)

_Only what's open, or a rule for the whole app, lives here. Built requirements are archived — grep them by ID, don't read whole files: shell, Hearth and app-wide `CORE-` in `docs/archive/NOOK_HEARTH_BUILT.md`; every built Nook plus `PROF-` and `HOME-` in `docs/archive/NOOK_NOOKS_BUILT.md`; older fine print in `docs/archive/NOOK_REQUIREMENTS_FULL.md`; past decisions in `docs/NOOK_DECISION_LOG.md`. To change a built requirement, edit it in its archive file._

_Last updated: 2026-10-12 (rev 67)_

## 1. Rules for the whole app
- **CORE-001** Nook is a phone app containing many mini-apps ("Nooks") under one account.
- **CORE-002** Users add Nooks to their account; added Nooks appear on the homepage.
- **CORE-003** Nooks can be opened from the homepage and managed (arranged, removed, configured) easily there.
- **CORE-004** Heavy customization throughout ("to your heart's content").
- **CORE-005** Consistent cozy "small nook" naming theme for features and terms.
- **CORE-012** Each Nook has its own settings page for customizing that Nook.
- **CORE-014** Every Nook has a clear way back to the Hearth.
- **CORE-016** Whatever you're typing in is never hidden behind the phone's keyboard, and every keyboard has a way to close it.
- **CORE-037** Every Nook is named "___ Nook" (Gift Nook, Potluck Nook, …). Each get-together inside the Potluck Nook is still "a Potluck".
- **CORE-015** Nooks are added to the Hearth from a shop-like catalog; the Gift Nook is one of the Nooks you add (nothing is on the Hearth until you add it). Removing a Nook only takes it off the Hearth; its data stays and comes back if you re-add it *(proposed)*. _(Exception, CORE-072: a brand-new Hearth starts with one Greeting widget.)_
- **CORE-021** Nook ships as its own app with its own icon (not inside Expo Go). _(Prepared: Josh's own painting of a little cream house with a reading nook (2026-10-12) as the icon, a matching house silhouette for Android's themed and notification icon, a plain cream iPhone launch screen; app ID `app.mynookapp.nook` (Q-025); app.json and eas.json set up; build guide in docs/BUILDING_THE_APP.md. Waiting on Josh's Expo and Apple Developer accounts — see section 9.)_

Everything else in CORE-006..099 is built and archived in [archive/NOOK_HEARTH_BUILT.md](archive/NOOK_HEARTH_BUILT.md): the Hearth, Hollows, widgets, Trinkets, Cubbies, the Fridge door, Edit mode, the Nooks tab and Market, Help, text size, accessibility and Settings → Notifications. Josh said yes to these; details marked proposed are Claude's until he confirms. Some is paid under Nook Plus (Q-028).

## 2. Accounts, profile & Home
- **AUTH-001** Users sign in with their email address, via a one-time code sent to their inbox (no passwords). See Decision Log, Q-015.
- **AUTH-002** While developing in Expo Go, there is an extra email + password "Developer sign-in" so test accounts (made in the Supabase dashboard) can be used without waiting for an emailed code. It never ships: it does not exist in a real release build.
- **AUTH-003** You can delete your account from Settings, and it's gone right away. Burrows you started keep going if other grown-ups are in them (another takes over running it; a Burrow with no one else is deleted), gifts you'd tucked become available again with no notice to the list owner (GIFT-007), your Wishbook and Hearth go with you, and kids only you look after go too (kids another grown-up in their Home can look after stay). _(Josh 2026-10-10; Apple requires it. Built: Settings → Delete account, type DELETE, done in one database step. Its migration still needs running — section 9.)_
- **AUTH-004** A hidden **App Review sign-in** (tap "Welcome to Nook" five times on the sign-in screen) takes an email and password, so Apple's reviewer, who can't open an emailed code, can get in with one demo account. Everyone else signs in with the emailed code (AUTH-001). AUTH-002 (the developer sign-in) is unchanged and still never ships. _(Josh 2026-10-11: "Sure we can do a hidden review". Built; needs the demo account made in Supabase with a password, and its details put in App Store Connect's App Review Information.)_
- **Profile (PROF-001..006)** — name, picture or photo, birthday, about me, allergies and diets, mailing address; seen only by family in your Burrows; kids' set by their grown-ups. Built, archived.
- **Home (HOME-001..011)** — the people you live with: one Home each, at most 6 with kids counting, shared by every Home-based Nook; you invite people you share a Burrow with. Built, archived.

## 3. Built Nooks (requirements archived)
Full requirements live in [archive/NOOK_NOOKS_BUILT.md](archive/NOOK_NOOKS_BUILT.md). **Grep it by ID before changing one of these Nooks**; edit requirements there.
- **Gift Nook** (GIFT-001..040): Wishbooks per person across Burrows and Gatherings, Tucks, kids' managed lists, Idea Stash, "Your shopping" per Gathering.
- **Potluck Nook** (POT-001..009): who brings what and allergy warnings; each Potluck belongs to a Gathering (GATH-004).
- **Letterbox Nook** (LET-001..011): holiday cards, addresses, labels, thank-yous.
- **Pet Care Nook** (PET-001..007): feeding, vet and meds, helpers.
- **Rhythms Nook** (RHY-001..008): yearly home chores.
- **Sitter Sheet Nook** (SIT-001..014): one page for sitters, shared by a link that runs out; page on Netlify for now (Q-031).
- **Recipe Box Nook** (REC-001..014): recipes shared to Burrows, cook mode, scaling, links and TikToks.
- **Subscriptions Nook** (SUB-001..012): recurring charges for the Home, cancel-by reminders, totals.
- **Getaway Nook** (TRIP-001..014): trips for the people going, packing, confirmations, plans, shared costs.
- **Sick Day Nook** (SICK-001..014): symptoms, temperatures and safe dose timing for the Home.
- **Gathering Nook** (GATH-001..010): every get-together, RSVPs, hosts, gift lists and Potlucks, a Hearth widget.
- **Little Log Nook** (LOG-001..010): log anything with a date, with charts; yours unless shared with your Home.
- **Notes Nook** (NOTE-001..010): notes like the phone's Notes app, with checklists; yours unless shared with your Home.
- **Menu Board Nook** (MENU-001..010): the Home's weekly menu, breakfast, lunch and dinner, with Going out, On your own and recipes.
- **Grocery List Nook** (GROC-001..009): several lists, each yours or shared with your Home; add from recipes, the Menu Board and Potlucks (the week of).
- **GIFT-007 (never break):** the list owner can NEVER see claims on their own gifts — no UI, API, counts, notifications or hints. Enforced by row-level security, with tests.

## 4. Nook Plus (not built yet)
- **MON-001** Nook earns revenue through an App Store subscription. No ads. _(Josh: "I dont want ads so Id rather go subscription based".)_
- **MON-002** A subscription belongs to a **Home** and covers everyone in it, up to the Home's cap of 6 (HOME-006). It never covers a Burrow, so joining someone's Burrow unlocks nothing paid. The paid customization follows the Home too, not the person. _(Josh: "I like the per home idea but yes needs capped at 6".)_
- **MON-003** Burrows stay free; Nooks that keep things in a Home are under **Nook Plus**, the one paid plan (Josh 2026-10-09: "keeping burrows free and home under plus would be good, and Nook Plus is fine with me"). _(Proposed how this sorts the Nooks, see Q-028: free are the Gift Nook, Burrows, the Gathering Nook, Potluck, Getaways, the Hearth basics and the inbox; Plus are Pet Care, Rhythms, Letterbox, Sitter Sheet, Sick Day, Subscriptions, Recipe Box, the Home page and the extra customization: more Hollows and widgets, custom themes, tile styles.)_ **Customization (Josh 2026-10-09):** the very basic customization is free, and things like creating your own theme can be behind Plus, so people who don't pay still enjoy the app while the extras are a reason to upgrade and "make their stuff look cool". _(Which customization is free and which is Plus is proposed: see Q-028.)_
- **MON-004** _(Proposed.)_ A free trial of about 14–30 days, started through Apple, and a price around $3.99/month or $29.99/year with yearly as the better deal. _(Not built; needs the standalone app build (CORE-021) and RevenueCat. See Q-028.)_
- **MON-005** What's free and what's paid is meant to change over time, so it lives in one place: a single list of paid features, each marked free or Nook Plus. Moving something between free and paid is a one-line change to that list, not a rewrite of the screens. _(Josh: "will add more things that we can change over what is free and what is not later.")_
- **MON-006** _(Proposed.)_ Who has Nook Plus is stored against the Home (an "entitlement" on the Home: on or off, when it ends, and whether it's a trial), not against a person's phone. Anyone in a subscribed Home gets it. The app and the database both check it, the same way Home membership is checked today, so a paid Nook can't be reached by skipping the screen.
- **MON-007** _(Proposed.)_ Any member of a Home can start the subscription. Whoever pays is the Home's **subscriber** and manages it through Apple (change plan, cancel). If they leave the Home or cancel, the rest of the Home keeps access until the paid period ends, then falls back to free, and the Home can start a new subscription whenever. Nothing anyone entered is deleted when Plus ends.
- **MON-008** _(Proposed.)_ When Plus ends, paid Nooks and extras become **read-only** instead of vanishing: you can still see your pets, rhythms and cards, but can't add or change them until you resubscribe. Customization beyond the free limits (extra Hollows, widgets) stays visible but can't be added to. Never taken away without warning.
- **MON-009** _(Proposed.)_ Purchases go through Apple's in-app subscriptions, with RevenueCat in between to track who has what and to tell our database a Home's status changed. Subscribing, restoring a purchase on a new phone, and managing or cancelling are all in the app's Settings, under a "Nook Plus" screen that shows what's included and what it costs.
- **MON-011** Nook Plus covers the kids in a subscribed Home (HOME-007), and only them: a kid who isn't in the Home doesn't get its Plus. _(Josh: "if they aren't in the home then they won't get the subscription of Nook Plus or Pro if not in the home".)_ _(Not built: Nook Plus itself isn't built yet. "Pro" is Josh's word; whether there's a second tier is part of Q-028.)_
- **MON-010** _(Proposed.)_ Before launch, the Market shows which Nooks are free and which are Plus, and a paid Nook offers the trial instead of just refusing. The Gift Nook, and anything that lets a whole family join, is never locked behind payment (GIFT-007 is also unaffected: nothing about claims is ever paywalled or revealed).

## 5. Open Questions
- **Q-003** For events about one person (a birthday, a baby shower), does the event show only that person's list, while group events like Christmas show everyone's? Who is the "honoree" of an anniversary (both people)?
  - _Built for now (proposed):_ honorees are optional when creating a Gathering. If any are picked, the Gathering links to their Wishbooks; if none, to everyone invited whose Wishbook you can see (GATH-007). Anniversaries can pick both people.
- **Q-019** What else should the Gift Nook's settings include?
  - _Built so far:_ "Hide gifts that are already taken" *(proposed)*, plus the four notification switches (GIFT-029). Saved to the account, so they follow you to a new phone.
- **Q-024** Should each Burrow be able to turn automatic Birthday Gatherings off (so far only deleting a single one, which lasts for that year)? And should the 30-day lead time be adjustable?
- **Q-028** Still open: which individual Nooks and extras are free or Plus (MON-003 lists Claude's proposed sorting), the price and the trial length (MON-004). Decided so far: Burrows free, Home-based Nooks under Nook Plus, a single tier, subscription, no ads, one plan per Home, capped at 6, and the free/paid list is easy to change later (MON-005). The how-it-works details in MON-006..010 are Claude's proposals for Josh to confirm. The Subscriptions Nook (SUB-001) keeps things in a Home, so under MON-003 it would be Plus too (proposed); the Getaway Nook (TRIP-001) shares across Burrows, so it could stay free like the Gift Nook (proposed); the Sick Day Nook (SICK-001) keeps things in a Home, so it would be Plus (proposed). The Menu Board (MENU-001) keeps things in a Home, so it would be Plus; the Grocery List (GROC-001) is per person like Notes (proposed). Not needed until the standalone app build, but the free/paid line should be settled before anyone outside the family uses the app, since taking away something free later upsets people. (Account deletion, Q-020, and the app ID, Q-025, are decided.)
- **Q-031** Where should the Sitter Sheet's web page live? It's one small file. Options: a free static host (Netlify or Cloudflare Pages) now, then the domain bought for email (`mynookapp.app`) later, e.g. `sitter.<domain>`. Links made before a move stop working, but they only last one stay anyway.
- **Q-032** Notices from the Nooks only reach your inbox (and a few alerts set on this phone, like the next sick-day dose). Josh wants them sent as phone notifications. That needs real push notifications: the app has to be built as its own app (Expo Go can't receive them), with Apple/Google push set up, and the database sending a push whenever it adds a notice. Should this be done now, or with the standalone app build (CORE-021, Q-028)? Once on, Settings → Notifications (CORE-090) would also get a "Push to this phone" master switch.

## 6. Decision Log
Lives in [NOOK_DECISION_LOG.md](NOOK_DECISION_LOG.md) (read only when you need the history of a decision). Add new entries there.

## 7. Glossary (naming theme)
| Concept | Name | Status |
|---|---|---|
| A mini-app | Nook | approved |
| How Nooks are named | "___ Nook" (Gift Nook, Potluck Nook, …) | approved |
| The gift-list Nook | Gift Nook | approved |
| The who-brings-what Nook | Potluck Nook | approved |
| The card & contact list Nook | Letterbox Nook | approved |
| The pet-care Nook | Pet Care Nook | approved |
| The yearly-chores Nook | Rhythms Nook | approved |
| The babysitter/house-sitter info Nook | Sitter Sheet Nook | proposed |
| The recipes Nook | Recipe Box Nook | proposed |
| The weekly meal-planning Nook (MENU-001) | Menu Board Nook | approved |
| The Hearth widget with today's meals (MENU-008) | On the menu | proposed |
| The grocery-lists Nook (GROC-001) | Grocery List Nook | approved |
| Ticked-off items while shopping (GROC-004) | In the cart | proposed |
| The recurring-charges Nook | Subscriptions Nook | proposed |
| The Hearth widget with what renews next (SUB-006) | Renewing soon | proposed |
| The trip-planning Nook (TRIP-001) | Getaway Nook | approved |
| One trip in it | a Getaway | approved |
| The ready-made countdown to your next trip (TRIP-010) | Getaway countdown | proposed |
| The sick-day Nook (SICK-001) | Sick Day Nook | approved |
| One illness in it, for one person | a sick spell | proposed |
| Where medicines and their doses are kept (SICK-005) | Medicine cabinet | proposed |
| The Hearth widget with who's sick and when the next dose is OK (SICK-008) | Next dose | proposed |
| A Hearth widget with one recipe a day (REC-011) | Recipe of the day | proposed |
| One recurring chore in the Rhythms Nook | Rhythm | proposed |
| The paid subscription, per Home | Nook Plus | proposed |
| A decorative object placed on the Hearth | Trinket | proposed |
| A decorated box behind widgets that holds them together (CORE-084) | Cubby | proposed |
| Sending your theme or whole Hearth to family as a code (CORE-055) | Share a look | proposed |
| The shared notes-and-doodles widget (CORE-086) | Fridge door (its screen: "the Home fridge" / "the ___ fridge") | proposed |
| A saved whole-Hearth setup | Scene | proposed |
| The pet that lives on your Hearth (CORE-048) | Hearth pet | proposed |
| The Hearth page shared with your Home (CORE-054) | Home page | proposed |
| The people you live with, shared by Nooks | Home | proposed |
| One entry in the Letterbox (one mailing address) | Contact | proposed |
| Homepage | The Hearth | proposed |
| A family group | Burrow | proposed |
| Invite | Knock | proposed |
| A person's wish list | Wishbook | proposed |
| Claiming a gift | Tuck (it's "tucked away") | proposed |
| An event | Gathering | proposed |
| The Nook listing every Gathering (GATH-001) | Gathering Nook | proposed |
| The Hearth widget showing one Gathering all in one (GATH-009) | A Gathering (button: "Put it on my Hearth") | proposed |
| Gift categories, and recipe categories (REC-006) | Shelves | proposed |
| The Nook shop | The Market | proposed |
| The bottom tab listing every Nook (CORE-067) | Nooks | proposed |
| The page of common questions (CORE-070) | Help | proposed |
| A house/stump on the Hearth you enter to reach its own organized screen | Hollow | approved |

## 8. Nook Backlog
Josh's picks, in no particular order. Names and details are proposed until he confirms them; each gets requirement IDs when it's about to be built.
- **Lent Out** — track things you've lent or borrowed (the drill, the casserole dish), to or from whom, with gentle reminders to ask for them back.
- **House Binder** — home info in one place: paint colors, appliance models, warranty dates, filter sizes, trusted contacts like the plumber, and service history.
- **Quote Jar** — save funny things people say, with the date and who said it; a Hearth widget shows a random one each day.
- **Heads-Up Board** — one-tap household status like "on my way", "dinner at 6?" or "need milk"; no location tracking. _(Josh picked it 2026-10-08.)_

_Already built from this list: Fridge Door (CORE-086), Recipe Box, Subscriptions, Trip (Getaway), Sick Day, Little Log and Notes; Idea Stash is part of the Gift Nook (GIFT-036)._

Earlier faint, very broad ideas (lower priority, may be dropped): Food tracker, To-do list.

Other ideas Claude mentioned that Josh hasn't picked: Freezer & Pantry (Josh was curious, not yet picked), Hand-Me-Downs, Guest Book, Growth Marks, Kid Art, Gift Closet, Daily Question; Surprise Planner (plan a surprise with a hidden to-do list, hidden from the guest of honor), Keepsakes (letters sealed until a date, e.g. a kid's 18th birthday).

## 9. Up next
Everything Josh has asked for so far is built.
1. **Josh tries the Menu Board and Grocery List Nooks** and confirms or changes their proposed details (MENU-, GROC- in the Nooks archive). Then he picks the next Nook from the backlog (section 8).
2. **Waiting on Josh** — setup only he can do; Claude walks him through each:
   - Run the newer database migrations in Supabase if they haven't been yet: `delete_account` (AUTH-003), `little_log`, `notes`, `menu_and_groceries` (MENU, GROC).
   - Put a Supabase service key in `.env.test.local` so the privacy tests (GIFT-007 and each Nook's) stop skipping.
   - Make the Expo and Apple Developer accounts so the real app can be built (CORE-021, docs/BUILDING_THE_APP.md).
   - Make the App Review demo account in Supabase and add it to App Store Connect (AUTH-004).
3. **Needs the real app build first:** phone push notifications (Q-032, GIFT-031) and Nook Plus (section 4, Q-028 — settle what's free before families outside Josh's use the app).
4. **Choices still open:** Q-003, Q-019, Q-024, Q-031 (section 5).
