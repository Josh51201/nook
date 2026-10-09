# Nook — Requirements (living document)

_Built Hearth requirements: `docs/archive/NOOK_HEARTH_BUILT.md`; built Nooks: `docs/archive/NOOK_NOOKS_BUILT.md`; more fine print in `docs/archive/NOOK_REQUIREMENTS_FULL.md`; past decisions in `docs/NOOK_DECISION_LOG.md`. Don't read those unless you need them._

_Last updated: 2026-10-09 (rev 58)_

## 1. Platform / Shell
- **CORE-001** Nook is a phone app containing many mini-apps ("Nooks") under one account.
- **CORE-002** Users add Nooks to their account; added Nooks appear on the homepage.
- **CORE-003** Nooks can be opened from the homepage and managed (arranged, removed, configured) easily there.
- **CORE-004** Heavy customization throughout ("to your heart's content").
- **CORE-005** Consistent cozy "small nook" naming theme for features and terms.
- **CORE-009** Nooks on the Hearth can be grouped into folders or groups. _(Now done with text labels placed anywhere on the grid (Title/Heading/Caption). Folders are still open.)_
- **CORE-011** Users choose what they get notified about and what's shown on their Hearth. _(Gift Nook notifications are now chosen per person — GIFT-029. Hearth-level choices still later.)_
- **CORE-012** Each Nook has its own settings page for customizing that Nook.
- **CORE-014** Every Nook has a clear way back to the Hearth.
- **CORE-016** Whatever you're typing in is never hidden behind the phone's keyboard, and every keyboard has a way to close it.
- **CORE-021** Nook ships as its own app with its own icon (not inside Expo Go). _(Prepared: icon set drawn (a cozy fireplace in an arch, proposed), app.json and eas.json set up, build guide in docs/BUILDING_THE_APP.md. Needs Josh's Expo and Apple Developer accounts to build — see Q-025.)_
- **CORE-037** Every Nook is named "___ Nook" (Gift Nook, Potluck Nook, …). Each get-together inside the Potluck Nook is still "a Potluck".
- **CORE-015** Nooks are added to the Hearth from a shop-like catalog; the Gift Nook is one of the Nooks you add (nothing is on the Hearth until you add it). Removing a Nook only takes it off the Hearth; its data stays and comes back if you re-add it *(proposed)*. _(Exception, CORE-072: a brand-new Hearth starts with one Greeting widget.)_
- **CORE-067** Every Nook is reachable from one menu, even ones not added to the Hearth, so someone invited to a Gathering (or who joined just for the Gift Nook) knows where to tap. _(Built as a "Nooks" tab in the bottom bar: Nooks with something new sit at the top, a dot on the tab shows news, one tap opens any Nook, and a Nook can be put on the Hearth from there; the tour points at it. Placement and layout are Claude's call, proposed.)_
- **CORE-068** Text size setting (Settings → Text size): Normal (follows the phone), Large, Extra large. Applies everywhere except the Hearth's own tiles, widgets and Hollows, which keep their size so layouts never break. _(Built 2026-10-09. Large/Extra large mean "at least this big", so it never stacks on the phone's own big text.)_
- **CORE-069** A "?" in the header of every screen: a couple of plain sentences about that screen, with buttons to the Help page and to replay the tour. _(Built 2026-10-09: on the Hearth, the tabs and every Nook's screens; form screens that use the header for Save don't have it.)_
- **CORE-070** A Help page (Settings → Help, or from the "?"): tap-to-open answers to common questions, plus replay the tour. _(Built 2026-10-09; the answers are Claude's wording, proposed.)_
- **CORE-071** Friendlier emailed-code sign-in: the phone can offer the code from the email, pasted codes with spaces work, a spam-folder hint, a "Send a new code" button (after a 60-second wait), "Wrong email? Go back", and plain-words errors. _(Built 2026-10-09.)_
- **CORE-072** A brand-new Hearth starts with one Greeting widget across the top (saying "Welcome to your Hearth") and nothing else; it can be edited, moved or removed like any widget. Existing Hearths are untouched. _(Josh 2026-10-09: "maybe with just the Greeting widget at the top". An exception to CORE-015's "nothing on the Hearth until you add it".)_
- **CORE-073** Blank screens point to a first step with a button where there's an obvious one, and small icon buttons have bigger tap areas and spoken labels without changing how anything looks. _(Built 2026-10-09.)_
- **CORE-074** Long menus are organized into sections that open and close, each showing a few words on what's chosen while closed. _(Built 2026-10-09 in Settings, Decorate, the widget editor, the tile options sheet and (Josh asked) "Add to your Hearth", whose Trinkets, Cubbies, widget kinds and Ideas now fold away; which sections start open, and remembering them while the app is open, are Claude's calls, proposed.)_
- **CORE-075** Accessibility round: grey and accent text pass 4.5:1 contrast in every theme (custom ones too); tiles can be moved with arrow buttons (Size & place) and screen-reader actions; Hearth tiles have spoken names; a "Vibrate on taps" switch; the iPhone's Bold Text setting makes Nook's own fonts bolder; leaving a form or editor with unsaved changes asks first; and an offline notice shows when there's no internet. _(Built 2026-10-09.)_
- **CORE-076** Hearth text overhaul: text can be slim (half a row tall; new text starts slim) because the grid now steps in half rows, and it can have its own font (incl. a new Handwritten one), bold, CAPITALS and a decoration (underline, soft pill, stitched, ribbon, wood sign, flourish). Moving with arrows happens on the Hearth itself: a bar docks at the bottom, the tile glows and the page follows it; the widget editor's "Save and move it on your Hearth" opens the same bar. _(Built 2026-10-09; the styles and the bar are Claude's design, proposed. Existing text keeps its full-row height until changed to Slim.)_
- **CORE-077** Hearth text always fits its space: it fills its box, as big as the width and height allow with no fixed top size (no more "R…"); Heading and Caption are the same fill a step smaller (about ¾ and ½), so all three grow/shrink as you resize (live preview while dragging the corner); it wraps onto more lines when the box is tall enough, and decorations scale with the text (tightening up in narrow spaces). _(Built 2026-10-09; sizes and fitting rules are Claude's design, proposed.)_
- **CORE-078** Hearth text options: "Up and down" puts text at the top, middle or bottom of its box (unset keeps slim = middle, taller = bottom), and a "Stretch across" slider stretches a decoration from just around the words to edge to edge. _(Built 2026-10-09; Josh asked for both; option names and slider design are Claude's, proposed.)_
- **CORE-079** See what you're editing: a tile's, text's, Hollow's or decoration's options sheet keeps a live preview pinned at the top (drawn as on the Hearth, on its wallpaper; follows typing and the stretch slider as you drag), and the widget editor's preview now stays pinned while you scroll its settings. Big items shrink to fit. _(Built 2026-10-09; Josh asked for it; the pinned-preview design is Claude's, proposed.)_
- ~~**CORE-080** Hearth text padding slider (room around the words, giving way in tight spots).~~ (dropped 2026-10-09: Josh preferred stretching the banner's height instead — "instead of padding, we just allow them to also change the height of the banner/text"; see CORE-081)
- **CORE-081** "Stretch up and down" slider for shaped decorations (pill, stitched, ribbon, sign): the shape grows taller into its box, from just around the words to top to bottom, like "Stretch across" does sideways; the words keep their size, centred inside. _(Built 2026-10-09; Josh asked for it; slider wording is Claude's, proposed.)_
- **CORE-082** Lettering for Hearth text, in its own "Lettering" section: font, Bold, Italic, Letters (As typed / CAPITALS / lowercase / Title Case), Letter spacing (Snug / Normal / Airy / Wide), Underline (None / Line / Soft bar / Wavy) and Effect (None / Shadow / Glow / Letterpress / Retro). Underline is no longer a decoration, so it combines with any decoration; older underlined or CAPITALS text keeps its look. _(Built 2026-10-09; Josh asked to split underline out and add bold, italics "etc"; the option set and names are Claude's, proposed.)_
- **CORE-083** The color picker's Light / Soft / Rich now change text and Bold-look colors too (they were all turning into the same deep color): Light is dustier, Rich deeper and more vivid; Soft is unchanged. _(Fixed 2026-10-09.)_
- **CORE-084** A decorative box to put behind widgets and tiles, "like a cardboard box" that can be decorated to match your theme. _(Josh asked 2026-10-09. Built as **Cubbies**: 8 styles (cardboard, crate, gift, quilted, frame, scrapbook, frosted glass, shelf) with color, pattern, see-through, corners and shadow; the box frames what's inside and carries it when dragged or tidied. Name, styles and carrying are Claude's, proposed.)_
- **CORE-085** A Cubby mode, so Cubbies can be selected even when they're behind widgets. _(Josh asked 2026-10-09. Built as a "Cubbies" button in Edit: in it, everything else fades and only boxes can be touched; out of it, boxes can't be touched so they never get in the way. Adding or finding a Cubby turns it on, and the Add sheet's Cubbies section explains it. Design is Claude's, proposed.)_

### Still to do from the Hearth rounds
Everything else in CORE-041..066 is built and archived in [archive/NOOK_HEARTH_BUILT.md](archive/NOOK_HEARTH_BUILT.md) — grep it by ID. Josh said yes to every idea in these rounds; details are Claude's proposals until he confirms. Some is paid under Nook Plus (Q-028).
- **CORE-055** Share a look: send a layout or theme to family as a code so they can copy it and then change it.


## 1a. Accounts & Login
- **AUTH-001** Users sign in with their email address, via a one-time code sent to their inbox (no passwords). See Decision Log, Q-015.
- **AUTH-002** While developing in Expo Go, there is an extra email + password "Developer sign-in" so test accounts (made in the Supabase dashboard) can be used without waiting for an emailed code. It never ships: it does not exist in a real release build.

## 1b. Profile
- **PROF-001** Each person has a customizable profile: their name, a picture (a chosen icon or their initials on a chosen color), an optional birthday, and a short "about me". Family in their Burrows can see it; nobody else. They can edit it any time (Settings → Your profile). _(Built — fine print in docs/archive/NOOK_REQUIREMENTS_FULL.md.)_
- **PROF-002** A brand-new person is asked to set up their profile (name required, the rest optional) before they enter the Hearth, instead of showing their email as their name. New accounts start with no name rather than their email.
- **PROF-004** Each person can list their allergies and dietary needs on their profile; a kid's managers set the kid's. Family in their Burrows can see them, like the rest of a profile. (For Potluck warnings — POT-005.) _(The choices — peanuts, tree nuts, dairy, eggs, gluten, shellfish, fish, soy, sesame; vegetarian, vegan, gluten-free, dairy-free, halal, kosher — are proposed.)_
- **PROF-003** A kid's managers can set up the kid's profile too — picture, birthday and "about me" — from Manage. Only their managers can (and their family sees it, like anyone's).
- **PROF-005** Each person can put their mailing address on their profile. It's optional but encouraged. Everyone in their Burrows can see it, except Burrows they choose to leave out (e.g. a work Burrow). It fills in family's Letterbox Nooks and stays current when they move (LET-004). _(Built — fine print in docs/archive/NOOK_REQUIREMENTS_FULL.md.)_

## 1c. Home
- **HOME-001** Your **Home** is the people you live with, shared by every Nook that keeps things for a household (Letterbox now; Pet Care, Yearly Rhythms, House Binder and others later), so it's set up once and every Nook uses it. Each person is in one Home at a time. _(Built — fine print in docs/archive/NOOK_REQUIREMENTS_FULL.md.)_
- **HOME-002** You invite someone you already share a Burrow with; once they accept, you share a Home. The invite arrives in their inbox and on the Home page. _(Moved out of the Letterbox's settings, where it was LET-002.)_
- **HOME-003** If your own Home was only you, everything kept in it comes along when you join another; if you were in a shared one, you just leave it. Leaving gives you your own Home again with a copy of the Letterbox addresses; card history and anything else kept together stays with the people still there.
- **HOME-004** Anyone in a Home can add and change what's kept there. Nobody outside it can see any of it.
- **HOME-005** Each Nook that keeps things in a Home stores them against the Home, so they follow whoever lives there. _(Letterbox did; Pet Care will.)_
- **HOME-006** A Home holds at most 6 people, so one subscription per Home (MON-002) can't quietly cover a whole Burrow. _(Built: enforced in the database for joining and for inviting — pending invites count toward the 6 — and the Home page says when it's full. Someone leaving makes room again.)_

## 2. Built Nooks (requirements archived)
Full requirements for these live in [archive/NOOK_NOOKS_BUILT.md](archive/NOOK_NOOKS_BUILT.md). **Grep it by ID before changing one of these Nooks**; edit requirements there.
- **Sitter Sheet Nook** (SIT-001..013): one page for sitters, shared by a link that runs out. Page hosted on Netlify for now (Q-031).
- **Gift Nook** (GIFT-001..037): wish lists ("Wishbooks") per person across Burrows, Gatherings, claims ("Tucks"), kids' managed profiles. Idea Stash (GIFT-036) built 2026-10-09.
- **Potluck Nook** (POT-001..009): who brings what, RSVPs, allergy warnings.
- **Letterbox Nook** (LET-001..011): holiday cards, addresses, labels, thank-yous.
- **Pet Care Nook** (PET-001..007): feeding, vet/meds, helpers.
- **Rhythms Nook** (RHY-001..008): yearly home chores.
- **GIFT-007 (never break):** the list owner can NEVER see claims on their own gifts — no UI, API, counts, notifications or hints. Enforced by row-level security, with tests.


## 2h. Recipe Box Nook
Josh picked it from the backlog on 2026-10-08 ("Lets do the recipe box") and chose the sharing, recipe parts, ways in and links below. Anything marked _(Proposed)_ is Claude's detail for him to confirm.
- **REC-001** A Recipe Box Nook where each person keeps their own recipes. _(Proposed: free, like the Gift Nook, since it's shared across a family rather than kept in a Home — see Q-028.)_
- **REC-002** Your recipes are shared with family in your Burrows, like Wishbooks: they can see them and save a copy into their own box. _(Josh picked "each person, shared to Burrows".)_ _(Proposed: a recipe can be set to "Just me"; a saved copy says whose box it came from and is yours to change; nobody is told when you save one.)_
- **REC-003** A recipe holds a title, ingredients and steps. _(Proposed: also servings, prep and cook time, notes, the website it came from with its picture, and what's in it, using the same tags as Potluck dishes — POT-004.)_
- **REC-004** Cook mode: big text, the screen stays on, tick off ingredients and steps as you go, and timers. _(Josh picked it.)_ _(Proposed: a step that says "bake 25 minutes" gets a tap-to-start timer, and the phone alerts you when it's done; finishing marks the recipe as made today.)_
- **REC-005** Scale servings: change 4 servings to 8 and the amounts update. _(Josh picked it.)_ _(Proposed: handles whole numbers, decimals and fractions like 1 1/2 or ½; anything it can't read is left as written.)_
- **REC-006** Shelves and search: sort recipes onto Shelves (Dinners, Desserts, Holidays…) and search by name or ingredient. _(Josh picked it.)_ _(Proposed: a recipe can sit on several Shelves; search covers your box and family's.)_
- **REC-007** Type a recipe in with a simple form. _(Josh picked it.)_
- **REC-008** Paste a website link and the recipe is filled in from the page. _(Josh picked it.)_ _(Proposed: read from the recipe data most cooking sites publish; if a site doesn't have it, at least the title and picture come in and the rest is typed.)_
- **REC-009** Potluck: pick a recipe as your Potluck dish. _(Josh picked it.)_ _(Proposed: its name and what's-in-it tags fill in, so Potluck's allergy warnings work (POT-005), and guests who can see the recipe can open it from the dish.)_
- **REC-010** Allergy warnings: a recipe shows whose allergies or diets it clashes with (PROF-004). _(Josh picked it.)_ _(Proposed: checked against everyone in your Burrows, using only the tags the cook set — never guessed from the ingredients.)_
- **REC-011** A Hearth widget. _(Josh picked it.)_ _(Proposed: "Recipe of the day" from your box or one Shelf, changing each day; tapping opens it. The Nook's tile shows how many recipes and what you made last.)_
- **REC-012** _(Proposed.)_ Only you and family in your Burrows can see your recipes, enforced in Postgres, with tests. "Just me" recipes are seen by nobody else. Nobody can change or delete a recipe but its owner.
- **REC-013** Paste a TikTok link to save a recipe from a TikTok video. _(Josh picked it 2026-10-09.)_ _(Proposed: the name and any ingredients come from the caption, and the whole caption goes in the notes. The video's thumbnail is the picture, looked up fresh each time because TikTok's expire. Turning the spoken video into written steps is left for later; it would need an AI service.)_
- **REC-014** Watch the TikTok inside Nook, on the recipe's page and in cook mode, with a button to open it in TikTok. _(Josh picked it 2026-10-09.)_
- _Built 2026-10-09:_ REC-001..014 in `app/recipes`, with the database rules in the `recipe_box` migration. The privacy tests skip until a service key is in `.env.test.local`.

## 2f. Subscription (Nook Plus)
- **MON-001** Nook earns revenue through an App Store subscription. No ads. _(Josh: "I dont want ads so Id rather go subscription based".)_
- **MON-002** A subscription belongs to a **Home** and covers everyone in it, up to the Home's cap of 6 (HOME-006). It never covers a Burrow, so joining someone's Burrow unlocks nothing paid. The paid customization follows the Home too, not the person. _(Josh: "I like the per home idea but yes needs capped at 6".)_
- **MON-003** _(Proposed.)_ Free forever: the Gift Nook, Burrows, the Hearth basics and the inbox, so a whole family can join without paying. Paid: the Home-based Nooks (Pet Care, Rhythms, Letterbox, and later House Binder and Sitter Sheet) plus extra customization (more Hollows and widgets, themes, tile styles). See Q-028.
- **MON-004** _(Proposed.)_ A free trial of about 14–30 days, started through Apple, and a price around $3.99/month or $29.99/year with yearly as the better deal. _(Not built; needs the standalone app build (CORE-021) and RevenueCat. See Q-028.)_
- **MON-005** What's free and what's paid is meant to change over time, so it lives in one place: a single list of paid features, each marked free or Nook Plus. Moving something between free and paid is a one-line change to that list, not a rewrite of the screens. _(Josh: "will add more things that we can change over what is free and what is not later.")_
- **MON-006** _(Proposed.)_ Who has Nook Plus is stored against the Home (an "entitlement" on the Home: on or off, when it ends, and whether it's a trial), not against a person's phone. Anyone in a subscribed Home gets it. The app and the database both check it, the same way Home membership is checked today, so a paid Nook can't be reached by skipping the screen.
- **MON-007** _(Proposed.)_ Any member of a Home can start the subscription. Whoever pays is the Home's **subscriber** and manages it through Apple (change plan, cancel). If they leave the Home or cancel, the rest of the Home keeps access until the paid period ends, then falls back to free, and the Home can start a new subscription whenever. Nothing anyone entered is deleted when Plus ends.
- **MON-008** _(Proposed.)_ When Plus ends, paid Nooks and extras become **read-only** instead of vanishing: you can still see your pets, rhythms and cards, but can't add or change them until you resubscribe. Customization beyond the free limits (extra Hollows, widgets) stays visible but can't be added to. Never taken away without warning.
- **MON-009** _(Proposed.)_ Purchases go through Apple's in-app subscriptions, with RevenueCat in between to track who has what and to tell our database a Home's status changed. Subscribing, restoring a purchase on a new phone, and managing or cancelling are all in the app's Settings, under a "Nook Plus" screen that shows what's included and what it costs.
- **MON-010** _(Proposed.)_ Before launch, the Market shows which Nooks are free and which are Plus, and a paid Nook offers the trial instead of just refusing. The Gift Nook, and anything that lets a whole family join, is never locked behind payment (GIFT-007 is also unaffected: nothing about claims is ever paywalled or revealed).

## 3. Open Questions
- **Q-003** For events about one person (a birthday, a baby shower), does the event show only that person's list, while group events like Christmas show everyone's? Who is the "honoree" of an anniversary (both people)?
  - _Built for now (proposed):_ honorees are optional when creating a Gathering. If any are picked, the Gathering links to their Wishbooks; if none, to everyone in the Burrow. Anniversaries can pick both people.
- **Q-019** What else should the Gift Nook's settings include?
  - _Built so far:_ "Hide gifts that are already taken" *(proposed)*, plus the four notification switches (GIFT-029). Saved to the account, so they follow you to a new phone.
- **Q-020** Deleting an account: Apple's App Store requires apps with sign-up to offer in-app account deletion. When someone deletes their account, what happens to Burrows they started, gifts they've tucked for others, and their Wishbook? (Needed before an App Store release, not before.)

- **Q-023** Emailed sign-in codes: Resend without a verified domain only delivers to its owner's own address, so family members can't receive codes. Which domain should Nook send email from (a domain must be bought, about $10–15/year, then verified in Resend and set as the sender in Supabase)? Needed before anyone besides Josh uses the app.

- **Q-024** Should each Burrow be able to turn automatic Birthday Gatherings off (so far only deleting a single one, which lasts for that year)? And should the 30-day lead time be adjustable?
- **Q-025** The app ID (bundle identifier) is currently `com.josh51201.nook`. It is permanent once the app is published. Should it use the domain Josh buys for email (Q-023) instead?

- **Q-028** Exactly where the free/paid line sits, the price and the trial length (MON-003, MON-004). Decided so far: subscription, no ads, one plan per Home, capped at 6, and the free/paid list is easy to change later (MON-005). The how-it-works details in MON-006..010 are Claude's proposals for Josh to confirm. Not needed until the standalone app build, but the free/paid line should be settled before anyone outside the family uses the app, since taking away something free later upsets people. Also depends on Q-020 (account deletion) and Q-025 (app ID) before an App Store release.
- **Q-031** Where should the Sitter Sheet's web page live? It's one small file. Options: a free static host (Netlify or Cloudflare Pages) now, then the domain bought for email (Q-023) later, e.g. `sitter.<domain>`. Links made before a move stop working, but they only last one stay anyway.

## 4. Decision Log
Lives in [NOOK_DECISION_LOG.md](NOOK_DECISION_LOG.md) (read only when you need the history of a decision). Add new entries there.

## 5. Glossary (naming theme)
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
| A Hearth widget with one recipe a day (REC-011) | Recipe of the day | proposed |
| One recurring chore in the Rhythms Nook | Rhythm | proposed |
| The paid subscription, per Home | Nook Plus | proposed |
| A decorative object placed on the Hearth | Trinket | proposed |
| A decorated box behind widgets that holds them together (CORE-084) | Cubby | proposed |
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
| Gift categories, and recipe categories (REC-006) | Shelves | proposed |
| The Nook shop | The Market | proposed |
| The bottom tab listing every Nook (CORE-067) | Nooks | proposed |
| The page of common questions (CORE-070) | Help | proposed |
| A house/stump on the Hearth you enter to reach its own organized screen | Hollow | approved |

## 6. Nook Backlog
Josh's picks, in no particular order. Names and details are proposed until he confirms them; each will get proper requirement IDs when it's about to be built.
- **Lent Out** — track things you've lent or borrowed (the drill, the casserole dish), to or from whom, with gentle reminders to ask for them back.
- **House Binder** — home info in one place: paint colors, appliance models, warranty dates, filter sizes, trusted contacts like the plumber, and service history.
- **Quote Jar** — save funny things people say, with the date and who said it; a Hearth widget shows a random one each day.
- **Fridge Door** — family sticky notes and doodles, shown as a Hearth widget.
- **Recipe Box** — now being built as the Recipe Box Nook: see section 2h (REC-001..014).
- **Heads-Up Board** — one-tap household status like "on my way", "dinner at 6?" or "need milk"; no location tracking. _(Josh picked it 2026-10-08.)_
- **Sick Day** — log a child's symptoms, temperature and medicine doses with a "next dose safe at…" timer so two parents can't double-dose; could feed the Sitter Sheet. _(Josh picked it 2026-10-08: "sick day nook is also good".)_
- **Subscriptions** — every recurring charge with renewal date, price and a "cancel by" reminder, plus a monthly total. _(Josh picked it 2026-10-08.)_
- **Little Log** — log anything with a date (blood pressure, mileage, a symptom, a mood); you pick the fields and it charts them over time. _(Josh picked it 2026-10-08.)_
- **Trip** — packing list, confirmations, itinerary and a "have I booked the dog sitter?" checklist, with a countdown widget. _(Josh picked it 2026-10-08.)_
- **Idea Stash** — part of the Gift Nook (GIFT-036), not a separate Nook.

Earlier faint, very broad ideas (lower priority, may be dropped): Food tracker, To-do list.

Other ideas Claude mentioned that Josh hasn't picked: Freezer & Pantry (Josh was curious, not yet picked), Hand-Me-Downs, Guest Book, Growth Marks, Kid Art, Gift Closet, Daily Question; Surprise Planner (plan a surprise with a hidden to-do list, hidden from the guest of honor), Keepsakes (letters sealed until a date, e.g. a kid's 18th birthday).

## 7. Up next
Josh's stated priority, in order:
1. **Hearth:** only CORE-055 (share a look) and the fireplace sound (CORE-047) are left.
2. ~~**Recipe Box Nook (REC-001..014)**~~ — built 2026-10-09 (section 2h).
3. **Backlog Nooks** (section 6) — Josh picks the next one.

_Built and done: Hollows, Potluck, Letterbox, Pet Care, Rhythms, Sitter Sheet (page on Netlify for now, Q-031), and Hearth rounds two and three._
