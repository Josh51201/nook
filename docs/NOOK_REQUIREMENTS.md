# Nook — Requirements (living document)

_Fine print for built features is in `docs/archive/NOOK_REQUIREMENTS_FULL.md`; past decisions in `docs/NOOK_DECISION_LOG.md`. Don't read those unless you need them._

_Last updated: 2026-10-08 (rev 50)_

## 1. Platform / Shell
- **CORE-001** Nook is a phone app containing many mini-apps ("Nooks") under one account.
- **CORE-002** Users add Nooks to their account; added Nooks appear on the homepage.
- **CORE-003** Nooks can be opened from the homepage and managed (arranged, removed, configured) easily there.
- **CORE-004** Heavy customization throughout ("to your heart's content").
- **CORE-005** Consistent cozy "small nook" naming theme for features and terms.
- **CORE-006** The Hearth (homepage) is fully customizable, with drag-and-drop arranging, so each person can set it up however they like (organized or otherwise). This is the app's headline appeal. _(Rebuilt as a free-form grid — see CORE-019.)_
- **CORE-007** Hearth tiles can be resized. _(Built: any size on the grid by dragging a corner, plus quick presets.)_
- **CORE-008** The Hearth can be restyled with colors and themes. _(First version built (proposed details): 7 tile colors, 4 Hearth themes (Hearth, Ember, Sage, Dusk), renaming the Hearth and each tile.)_
- **CORE-009** Nooks on the Hearth can be grouped into folders or groups. _(Now done with text labels placed anywhere on the grid (Title/Heading/Caption). Folders are still open.)_
- **CORE-010** Users can create widgets on the Hearth that show live info from a Nook (e.g. an upcoming Gathering). _(First version built: Wide/Large Gift Nook tiles show upcoming Gatherings, never anything about claims.)_
- **CORE-011** Users choose what they get notified about and what's shown on their Hearth. _(Gift Nook notifications are now chosen per person — GIFT-029. Hearth-level choices still later.)_
- **CORE-012** Each Nook has its own settings page for customizing that Nook.
- **CORE-013** The Hearth has a settings page for account-wide things: account info, setting your name, signing out, and anything else important. _(Now the Settings tab — CORE-025.)_
- **CORE-014** Every Nook has a clear way back to the Hearth.
- **CORE-016** Whatever you're typing in is never hidden behind the phone's keyboard, and every keyboard has a way to close it.
- **CORE-017** The app should feel alive and flow nicely — motion and animation, not static screens — and use a proper icon set instead of emoji. _(Built — fine print in docs/archive/NOOK_REQUIREMENTS_FULL.md.)_
- **CORE-018** Users can add widgets of different kinds to the Hearth, each completely customizable in what it shows and how it looks — e.g. reminders to log food, countdowns to holidays and events, things to buy. _(Built — fine print in docs/archive/NOOK_REQUIREMENTS_FULL.md.)_
- **CORE-020** In Edit mode, tapping a Hearth widget opens its settings. Outside Edit mode it opens the widget to see what's in it (CORE-038); the Inbox widget opens the inbox, Gifts to buy opens your shopping list, and Card season opens the Letterbox's card list. Every Gift Nook screen opened straight from the Hearth has a way back to it.
- **CORE-021** Nook ships as its own app with its own icon (not inside Expo Go). _(Prepared: icon set drawn (a cozy fireplace in an arch, proposed), app.json and eas.json set up, build guide in docs/BUILDING_THE_APP.md. Needs Josh's Expo and Apple Developer accounts to build — see Q-025.)_
- **CORE-022** The Hearth gets built-out organization so it doesn't become one very long list as widgets pile up (a 4-column grid fills fast). Users can place houses or stumps on the Hearth; tapping one **enters** it — with a door-opening animation or similar — into its own user-organized screen. These are called **Hollows**. _(Built — fine print in docs/archive/NOOK_REQUIREMENTS_FULL.md.)_
- **CORE-023** What's inside a house is as customizable as the Hearth itself: Nook tiles, widgets and text laid out however the person likes, with their own drag-and-drop design. _(Built: the inside of a Hollow is the same designable grid as the Hearth — Nooks, widgets, text; add, drag, resize.)_
- **CORE-024** Each house/stump can be customized — its name, its look (house, stump, …), its color — and putting things in or taking them out should be easy and friendly, e.g. dragging a tile or widget onto it. _(Built — fine print in docs/archive/NOOK_REQUIREMENTS_FULL.md.)_
- **CORE-019** Users design their own Hearth layout — everyone's looks different. _(Built — fine print in docs/archive/NOOK_REQUIREMENTS_FULL.md.)_
- **CORE-025** A bar of icons along the bottom of the screen, with a tab for creating and managing families (Burrows) — the same things the Gift Nook offered (start one, join with a Knock, invite, admins, leave, delete) — moved out of the Gift Nook so any Nook that shares with other people can use the same Burrows. _(Built — fine print in docs/archive/NOOK_REQUIREMENTS_FULL.md.)_
- **CORE-026** A short tutorial the first time someone enters: pop-ups with guides pointing at how things work, like adding things to the Hearth and creating Burrows. It shows **only** the very first time someone opens the app, or when they ask for it in Settings — never again on its own. _(Built — fine print in docs/archive/NOOK_REQUIREMENTS_FULL.md.)_
- **CORE-027** An inbox in the top right of the Hearth shows when you have stuff to look at. _(Built — fine print in docs/archive/NOOK_REQUIREMENTS_FULL.md.)_
- **CORE-028** The Hearth gets more depth and pop, so it doesn't look flat. Josh left the how to Claude. _(Built — fine print in docs/archive/NOOK_REQUIREMENTS_FULL.md.)_
- **CORE-029** The Hearth's top bar always stays in view while scrolling, so the inbox and Edit are always reachable. The Hearth's title is more appealing than plain text. And while dragging with a full Hearth, holding an item near the top or bottom of the screen scrolls the page along with it, so it can be dropped anywhere (e.g. onto a Hollow) without letting go. _(Built — fine print in docs/archive/NOOK_REQUIREMENTS_FULL.md.)_
- **CORE-030** Widgets and tiles use their space well instead of leaving it blank — still simple, but more dynamic as they get bigger (like the Gift Nook's big tile with its white panel) — more things can be an icon, and there's more customization in general, so your Hearth feels like your home. Every Nook should show something on its tile when it's big (the Potluck tile was empty). _(Built — fine print in docs/archive/NOOK_REQUIREMENTS_FULL.md.)_
- **CORE-031** Hollows are more exciting and fun. _(Built — fine print in docs/archive/NOOK_REQUIREMENTS_FULL.md.)_
- **CORE-032** Your Hearth theme dresses the whole app — every Nook, Burrows, Settings, sheets and pop-ups — not just the Hearth, and the app supports the phone's dark mode. _(Built — fine print in docs/archive/NOOK_REQUIREMENTS_FULL.md.)_
- **CORE-033** Each Nook's home greets you with some of the Hearth's personality instead of opening straight onto a list. _(Built — fine print in docs/archive/NOOK_REQUIREMENTS_FULL.md.)_
- **CORE-034** Opening a Nook from the Hearth feels like stepping into it, the way Hollows do. _(Built — fine print in docs/archive/NOOK_REQUIREMENTS_FULL.md.)_
- **CORE-035** A cozier font, chosen by Josh after comparing options. _(Built — fine print in docs/archive/NOOK_REQUIREMENTS_FULL.md.)_
- **CORE-036** Nooks are the special thing about the app, so the Nooks you add stand out from widgets on the Hearth. _(Built — fine print in docs/archive/NOOK_REQUIREMENTS_FULL.md.)_
- **CORE-037** Every Nook is named "___ Nook" (Gift Nook, Potluck Nook, …). Each get-together inside the Potluck Nook is still "a Potluck".
- **CORE-038** Outside Edit mode, tapping a widget opens it up to show everything in it, in a useful, good-looking page — especially for widgets shrunk to an icon that show little on the Hearth. Edit mode still opens its settings. _(Built — fine print in docs/archive/NOOK_REQUIREMENTS_FULL.md.)_
- **CORE-039** Widgets can be copied, so the same kind of widget can live in different Hollows or be styled differently. A Nook can be added more than once — on the Hearth and inside Hollows — and every copy opens the same Nook. _(Built — fine print in docs/archive/NOOK_REQUIREMENTS_FULL.md.)_
- **CORE-040** In Edit mode, dragging a widget (or anything on the Hearth) to a trash can deletes it. _(Built — fine print in docs/archive/NOOK_REQUIREMENTS_FULL.md.)_
- **CORE-015** Nooks are added to the Hearth from a shop-like catalog; the Gift Nook is one of the Nooks you add (nothing is on the Hearth until you add it). Removing a Nook only takes it off the Hearth; its data stays and comes back if you re-add it *(proposed)*.

### Hearth customization, round two
Josh wants the Hearth to be truly one of a kind for anyone who puts in the time, and said yes to every idea below ("I love all those options"). None are built yet; every detail is Claude's proposal until Josh confirms it. Some of this is paid under Nook Plus (MON-002, MON-003); where the free/paid line sits is Q-028, but a good free baseline stays.
- **CORE-041** Wallpapers: a pattern, a gradient or your own photo behind the Hearth, and a different one for each Hollow. _(Built — fine print in docs/archive/NOOK_REQUIREMENTS_FULL.md.)_
- **CORE-042** Any color, not just 7: a full color picker for tiles, accents and themes, plus corner roundness, shadow depth and borders. _(Built — fine print in docs/archive/NOOK_REQUIREMENTS_FULL.md.)_
- **CORE-043** Build-your-own themes: pick every color, save it under a name, and optionally let themes switch with the season (a Christmas Hearth in December). _(Built — fine print in docs/archive/NOOK_REQUIREMENTS_FULL.md.)_
- **CORE-044** More shapes for Nook tiles besides the arched alcove, such as a round window, a little door or a hanging sign. _(Built — fine print in docs/archive/NOOK_REQUIREMENTS_FULL.md.)_ Changing shape rebuilds the tile; window bars show only on roughly square tiles.
- **CORE-045** Decor pieces *(proposed name: Trinkets)*: little non-clickable objects placed anywhere on the Hearth or in a Hollow, like a plant, lantern, sleeping cat, rug or stack of books. _(Built — fine print in docs/archive/NOOK_REQUIREMENTS_FULL.md.)_ Josh wants Trinkets to be movable anywhere. _(Built 2026-10-08: Trinkets float. They land exactly where you let go, even between grid cells, can overlap other things, and are never pushed by them or counted as taking up a cell. Tidy up leaves them alone. Stored as two extra decimals per Trinket, about 100 bytes each.)_
- **CORE-046** A photo frame widget showing your own pictures in a frame, rotating through them. _(Built — fine print in docs/archive/NOOK_REQUIREMENTS_FULL.md.)_
- **CORE-047** Ambience that follows the date and time of day (falling leaves, snow, fireflies), plus an optional soft fireplace sound that is off by default. _(Built — fine print in docs/archive/NOOK_REQUIREMENTS_FULL.md.)_
- **CORE-048** A pet that lives on your Hearth, made from the photos in Pet Care (PET-006). Josh wants it to live somewhere or in a widget and venture out onto other widgets and Nooks. _(Built 2026-10-08 (proposed details): a **Hearth pet** widget (Cozy touches) holds its bed; the pet is a Pet Care pet (name, photo as its face, hungry when a meal is late) or one you make up (cat, dog, bunny, bird, fish in a bowl, turtle, hamster, any color). Now and then it hops out to sit on top of other tiles and widgets, sometimes naps there, then goes home; tap it for a heart and a little line. It stays in bed at night, while editing, with Reduce Motion, or if set to stay home. Outline drops the card so the bed sits right on the Hearth.)_
- **CORE-049** More widget kinds: photo, clock/date, weather, quote of the day (pairs with the Quote Jar idea), quick-launch buttons, and a habit streak counter. _(Built — fine print in docs/archive/NOOK_REQUIREMENTS_FULL.md.)_
- **CORE-050** Widget stacks: several widgets in one spot that you swipe through. _(Built 2026-10-08 (proposed details): in a widget's editor, "Stack" puts another widget of any kind in the same spot and size; up to 6. Swipe sideways on it (or tap a dot) to flip through; the stack moves, resizes and sits as one thing. "Take it out of the stack" sets one free. A copy or a move to a Hollow leaves the stack. Edit mode shows one at a time too.)_
- **CORE-051** More than one Hearth page, swiped between, such as "Everyday" and "Holidays". _(Built 2026-10-08 (proposed details): swipe the Hearth sideways, or tap a page name in the strip under the top bar (shown once there are two or more). Edit → **Pages** adds, renames (up to 20 letters) and removes pages, up to 6. Removing a page moves what's on it to the first page. Hollows have just one page. Nooks, photos and the weather town are found across every page.)_ Josh also wants to drag a widget onto a page tab to move it there. _(Built (proposed details): while dragging in Edit, the page tabs light up under your finger; let go on one to move the item there, with "Moved … Undo". In Edit there is also a **New page** tab: drop on it to make a page and move the item onto it. Hollows have no tabs.)_
- **CORE-052** Scenes *(proposed name)*: save a whole Hearth setup and swap it in by hand or on a schedule (Morning, Evening, Christmas). _(Built 2026-10-08 (proposed details): Edit → **Scenes** (Hearth only). A scene saves the whole Hearth — every page and what is on it, the theme, wallpaper and ambience — under a name; up to 6. Scenes work like wardrobes: the Hearth you see is the active scene, and switching stores the one you are leaving back into its scene, so nothing is lost (a Hearth that is not a scene yet is kept as "My Hearth" first). A scene can switch on by itself when you open the Hearth in a time slot — Morning (5 AM–noon), Afternoon, Evening (5–10 PM), Night — and/or some months; the most specific match wins, and one you pick by hand stays until the matching scene changes. Scenes are kept in their own saved row so editing your Hearth does not rewrite them. Fonts and custom themes are not part of a scene.)_
- **CORE-053** Show a widget or tile only sometimes, such as a gift countdown that only appears in November and December. _(Built — fine print in docs/archive/NOOK_REQUIREMENTS_FULL.md.)_
- **CORE-054** A shared Home Hearth: ~~a Hollow~~ a page of the Hearth everyone in your Home (HOME-001, capped at 6) sees and arranges together, like the household bulletin board. It shows up for everyone automatically once a Home has two or more people; each person can hide it for themselves. _(Built 2026-10-08 (proposed details): a **Home** tab with a little house after your own pages, renamable by anyone, not counted in your 6 pages. Anything but a Hollow can go on it (drag onto its tab, or Select → Move), and every page tool works there. Changes show on everyone's phone within a moment, and two people changing different things don't undo each other. Widgets load their contents for whoever is looking, so Gifts to buy shows each person their own list (GIFT-007). Photo frames there copy their pictures to a folder only the Home can see. Theme, wallpaper and Scenes stay yours. Phone alerts on a shared reminders list ring only on the phone that set them.)_
- **CORE-055** Share a look: send a layout or theme to family as a code so they can copy it and then change it.
- **CORE-056** A Weather widget: the weather now and the next few days for a place. _(Built — fine print in docs/archive/NOOK_REQUIREMENTS_FULL.md.)_
- **CORE-057** A Window widget: a little window on the Hearth with the weather outside it. _(Built — fine print in docs/archive/NOOK_REQUIREMENTS_FULL.md.)_ Curtains removed 2026-10-08 (they looked wrong on wide or rectangular windows).
- **CORE-058** Ambience that matches the weather outside. _(Built — fine print in docs/archive/NOOK_REQUIREMENTS_FULL.md.)_
- **CORE-059** The Add sheet groups widgets into categories instead of one long list. _(Built 2026-10-08 (proposed details): From your Nooks, Lists & routines, Time & weather, Cozy touches; Ideas stay at the bottom. Which widget is in which group is one list in `lib/widgets.ts`.)_

### Hearth organization, round three
Josh wants every organization idea below ("I think all of them"). None are built yet; every detail is Claude's proposal until Josh confirms it. Pages, stacks and Scenes were already wanted (CORE-050..052).
- **CORE-060** Select many: in Edit, tap to pick several tiles, widgets and Trinkets, then move, copy, Move to a Hollow, recolor or delete them together. _(Built 2026-10-08 (proposed details): Edit → **Select**, tap things to pick them, then a bar at the bottom offers Move to (the Hearth, a Hollow or another page), Copy, Color and Remove (with Undo). Picking turns off dragging and resizing. Moving several by dragging them together isn't built.)_
- **CORE-061** Lock in place: pin an item so it can't be dragged, resized or deleted by accident; unlock it from its Edit sheet. _(Built 2026-10-08 (proposed details): "Lock in place" in any item's sheet or widget editor, or **Lock** in Select. A locked item shows a little padlock in Edit, can't be dragged, resized or removed (Select-many skips it), and others move around it: dropping something on it lands in the nearest open spot. Copies start unlocked. Tapping it still opens it.)_ Josh also wants the lock right on the item in Edit, like the copy button. _(Built: a padlock button on each item's top-right corner in Edit; one tap locks or unlocks, and a locked item shows it filled in.)_
- **CORE-062** Tidy up: one button closes gaps and lines things up, with an Undo. _(Built 2026-10-08 (proposed details): Edit → **Tidy up** slides everything up to close gaps, keeping each column; locked items stay put and a stack moves as one. Works inside a Hollow too. "Tidied up" with Undo for 5 seconds.)_
- **CORE-063** Find in Edit: a search box that highlights a widget or Nook and opens the Hollow it's in. _(Built 2026-10-08 (proposed details): Edit → **Find** (on the Hearth) searches names on every page and inside every Hollow; best matches first. Tapping a result switches page or steps into the Hollow, scrolls to it and makes it glow.)_
- **CORE-064** Section dividers: a labelled divider you can fold shut to hide the band of the grid under it, until the next divider. _(Built 2026-10-08 (proposed details): in a text label's sheet, "Fold-away divider" makes it full width with a line and an arrow. Tap it outside Edit to fold away everything under it down to the next divider (or the end) — the rest slides up, with "3 hidden" shown. In Edit everything is shown. Folding is only how it is drawn: it is not saved and resets when the app restarts.)_
- **CORE-065** Tags and filters: tag any item (e.g. Kids, Home, Gifts) and show or hide a tag with one tap. _(Built 2026-10-08 (proposed details): up to 5 tags per item (16 letters each), added in an item's sheet, a widget's editor, or for several at once with **Tag** in Select. Once any tag exists, a row of tags sits under the top bar; tap one to hide everything with it, tap again to bring it back, or "Show all". Out of Edit only; hidden things leave an empty space. What is hidden is not saved.)_
- **CORE-066** A page or Hollow holds only so much, so the Hearth stays smooth on older phones. _(Built 2026-10-08 (proposed details; Josh agreed to the numbers): 60 things per page and per Hollow, 40 on the shared Home page; a Trinket counts as half, a stack as one, a Hollow as one. At the limit, adding, copying or moving more in says so and suggests a new page or a Hollow. Hearths already over it are never trimmed and can still shrink or be rearranged. A speed guard, not a storage one; to be re-checked on a real phone.)_

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
- **Gift Nook** (GIFT-001..037): wish lists ("Wishbooks") per person across Burrows, Gatherings, claims ("Tucks"), kids' managed profiles. Idea Stash (GIFT-036) built 2026-10-09.
- **Potluck Nook** (POT-001..009): who brings what, RSVPs, allergy warnings.
- **Letterbox Nook** (LET-001..011): holiday cards, addresses, labels, thank-yous.
- **Pet Care Nook** (PET-001..007): feeding, vet/meds, helpers.
- **Rhythms Nook** (RHY-001..008): yearly home chores.
- **GIFT-007 (never break):** the list owner can NEVER see claims on their own gifts — no UI, API, counts, notifications or hints. Enforced by row-level security, with tests.

## 2g. Sitter Sheet Nook
- **SIT-001** A Sitter Sheet Nook: one page for babysitters, grandparents or house-sitters (allergies, bedtime, house rules, emergency numbers, the doctor) that can be opened by link without the app. _(Josh: "maybe the sitter sheet, that one is pretty useful".)_
- **SIT-002** A sheet belongs to your Home (HOME-001, HOME-005): everyone in the Home can see and edit it. _(Josh picked one per Home.)_
- **SIT-003** Sharing is by a secret link made for a specific stay (start and end dates). It stops working after the end date, and anyone in the Home can turn it off early. _(Josh picked "secret link, expires".)_
- **SIT-004** The sheet mixes sections you type (bedtime, house rules, emergency numbers, doctor) with optional pulls from data already in Nook (e.g. Pet Care feeding and meds, kids' allergies). You choose what to include for each link. _(Josh picked "mix of both".)_
- **SIT-005** The link is read-only: the sitter can't change anything or leave notes, they just text you. _(Josh: "no that can just be texting after that".)_ _(Proposed: every phone number on the page has Call and Text buttons.)_
- **SIT-006** Anything pulled in from other Nooks is optional and off by default; you tick each kid and pet per link. _(Josh: "I wanna stay legal… things can be optional", and left the details to Claude.)_ _(Proposed: kids show only first name, allergies and diets, with no birthdays, photos or last names. Pets show name, food, meals, medications, vet and notes. Only kids managed by someone in the Home and pets in the Home can be picked.)_
- **SIT-007** _(Proposed.)_ The link only exposes what you chose, enforced in Postgres (not just hidden in the screens). An expired, switched-off or made-up link shows nothing. Tests prove it, in the same spirit as GIFT-007. The page tells search engines not to index it, and the secret part of the link never reaches the web host.
- **SIT-008** _(Proposed.)_ A link works from when it's made until the end of its last day (so the sitter can read ahead), and a stay is at most 60 days. You can see how many times it's been opened.
- _Built 2026-10-09:_ the Nook in the Market (sheet, links, "see what they see" preview), the database rules, and the sitter's page in `web/sitter` (`npm run build:sitter`). Waiting on: the page being put on a web host and its address in `.env` as `EXPO_PUBLIC_SITTER_PAGE_URL` (Q-031).

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
| One recurring chore in the Rhythms Nook | Rhythm | proposed |
| The paid subscription, per Home | Nook Plus | proposed |
| A decorative object placed on the Hearth | Trinket | proposed |
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
| Gift categories | Shelves | proposed |
| The Nook shop | The Market | proposed |
| A house/stump on the Hearth you enter to reach its own organized screen | Hollow | approved |

## 6. Nook Backlog
Josh's picks, in no particular order. Names and details are proposed until he confirms them; each will get proper requirement IDs when it's about to be built.
- **Potluck** — now being built: see section 2b (POT-001..009).
- **Card & Contact List** — now being built as the Letterbox Nook: see section 2c (LET-001..011).
- **Pet Care** — now being built as the Pet Care Nook: see section 2d (PET-001..007).
- **Lent Out** — track things you've lent or borrowed (the drill, the casserole dish), to or from whom, with gentle reminders to ask for them back.
- **Yearly Rhythms** — now being built as the Rhythms Nook: see section 2e (RHY-001..008).
- **House Binder** — home info in one place: paint colors, appliance models, warranty dates, filter sizes, trusted contacts like the plumber, and service history.
- **Sitter Sheet** — now being designed as the Sitter Sheet Nook: see section 2g (SIT-001..008). Original idea: one page for babysitters, grandparents or house-sitters: allergies, bedtime, house rules, emergency numbers and the doctor. Shareable by link without them needing the app.
- **Quote Jar** — save funny things people say, with the date and who said it; a Hearth widget shows a random one each day.
- **Fridge Door** — family sticky notes and doodles, shown as a Hearth widget.
- **Idea Stash** — part of the Gift Nook (GIFT-036), not a separate Nook.

Earlier faint, very broad ideas (lower priority, may be dropped): Food tracker, To-do list.

Other ideas Claude mentioned that Josh hasn't picked: Surprise Planner (plan a surprise with a hidden to-do list, hidden from the guest of honor), Keepsakes (letters sealed until a date, e.g. a kid's 18th birthday).

## 7. Up next
Josh's stated priority, in order:
1. ~~**Hearth organization (CORE-022..024)**~~ — built 2026-10-07 as Hollows.
2. ~~**Potluck Nook**~~ — built 2026-10-07 (section 2b).
3. ~~**Letterbox Nook**~~ — built 2026-10-08 (section 2c).
4. ~~**Pet Care Nook**~~ — built 2026-10-08 (section 2d).
5. ~~**Rhythms Nook**~~ — built 2026-10-08 (section 2e).
6. **Sitter Sheet Nook (SIT-001..008)** — built 2026-10-09; needs its web page hosted (Q-031).
7. **Hearth customization, round two (CORE-041..055):** first round built 2026-10-08 — wallpapers + color picker (041, 042), Trinkets + photo frames (045, 046), seasonal ambience (047). CORE-043, 044, 049, 053 and weather (056..058) built too. 048 and 054 built 2026-10-08. Still to do: 055 and the fireplace sound. Organization round three (CORE-060..065): round 1 built 2026-10-08 (pages 051, stacks 050, select-many 060). Round 2 built 2026-10-08: lock (061), tidy up (062), find (063). Round 3 built 2026-10-08: dividers (064), Scenes (052), tags (065).
