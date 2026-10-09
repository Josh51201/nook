# Nook — Requirements (living document)

_Built Hearth requirements: `docs/archive/NOOK_HEARTH_BUILT.md`; built Nooks: `docs/archive/NOOK_NOOKS_BUILT.md`; more fine print in `docs/archive/NOOK_REQUIREMENTS_FULL.md`; past decisions in `docs/NOOK_DECISION_LOG.md`. Don't read those unless you need them._

_Last updated: 2026-10-09 (rev 65)_

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
- **CORE-069** A "?" in the header of every screen: a couple of plain sentences about that screen, with buttons to the Help page and to replay the tour. _(Built 2026-10-09: on the tabs and every Nook's screens; form screens that use the header for Save don't have it. On the Hearth and in Hollows it's a Help button with the Edit tools instead, so the header has room for your name — Josh 2026-10-09: "the names get cut off on the hearth page at the very top ... maybe move that to somewhere less important".)_
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
- **CORE-086** A **Fridge door** widget that "fairly resembles a fridge", connected to your Home or a Burrow, where everyone can share a message that lasts "a day or whatever" before it's deleted. On the Home page it's automatically the Home's fridge; a new note shows a little icon on the Home page's tab and a notice in the inbox. _(Josh asked 2026-10-09. Built: notes written on sticky-note paper or finger-drawn doodles, held by magnets on an enamel door with a handle and label-maker title; each stays up a day, 3 days or a week (writer picks), then the database takes it down. Tapping opens the whole fridge to read, add or take down notes. Who can take a note down (Josh 2026-10-09: "that sounds right to me"): only its writer on a Burrow fridge; the writer or anyone in the Home on the Home fridge. The tab icon is a tiny note under a magnet, on any page whose fridge has news, and clears once you've looked. Notices can be switched off on the fridge screen. The look, the doodles and the lengths are Claude's, proposed; free like other widgets, proposed.)_
- **CORE-087** Text at the top of a Nook is never cut off with no way to read it, on any phone or text size. _(Josh asked 2026-10-09. Built: the header under a Nook's title wraps onto more lines instead of trailing off, as do long names on pet, person and sick-day pages.)_
- **CORE-088** The Nooks tab and the Market stay easy to scan as more Nooks are added, instead of one long scroll. _(Josh asked 2026-10-09. Built, design Claude's, proposed: both have a "Find a Nook" search; the Nooks tab shows Nooks as a small icon grid (a + on an icon puts it on the Hearth); the Market groups Nooks into Family & get-togethers, Around the house, Pets & health and Kitchen, with filter chips, and each is a short row that opens to show what it does.)_
- **CORE-090** One place in Settings to manage every Nook's notifications, instead of opening each Nook, "to send to the phone notifications", with the same switches still inside each Nook (Josh 2026-10-09). _(Built as Settings → Notifications: one fold-away section per Nook with its switches, a "Turn all on/off", and a summary like "3 of 4 on". It uses the very same saved settings as each Nook's own screen, so changing one changes the other. Today the switches choose which notices reach your inbox, plus the few alerts set on this phone; sending to the phone from the server is Q-032.)_

### Hearth rounds
All of CORE-041..066 is built and archived in [archive/NOOK_HEARTH_BUILT.md](archive/NOOK_HEARTH_BUILT.md) — grep it by ID (the last two, CORE-047's fireplace sound and CORE-055 share a look, were finished 2026-10-09). Josh said yes to every idea in these rounds; details are Claude's proposals until he confirms. Some is paid under Nook Plus (Q-028).


## 1a. Accounts & Login
- **AUTH-001** Users sign in with their email address, via a one-time code sent to their inbox (no passwords). See Decision Log, Q-015.
- **AUTH-002** While developing in Expo Go, there is an extra email + password "Developer sign-in" so test accounts (made in the Supabase dashboard) can be used without waiting for an emailed code. It never ships: it does not exist in a real release build.

## 1b. Profile
- **PROF-001** Each person has a customizable profile: their name, a picture (a chosen icon or their initials on a chosen color), an optional birthday, and a short "about me". Family in their Burrows can see it; nobody else. They can edit it any time (Settings → Your profile). _(Built — fine print in docs/archive/NOOK_REQUIREMENTS_FULL.md.)_
- **PROF-002** A brand-new person is asked to set up their profile (name required, the rest optional) before they enter the Hearth, instead of showing their email as their name. New accounts start with no name rather than their email.
- **PROF-004** Each person can list their allergies and dietary needs on their profile; a kid's managers set the kid's. Family in their Burrows can see them, like the rest of a profile. (For Potluck warnings — POT-005.) _(The choices — peanuts, tree nuts, dairy, eggs, gluten, shellfish, fish, soy, sesame; vegetarian, vegan, gluten-free, dairy-free, halal, kosher — are proposed.)_
- **PROF-003** A kid's managers can set up the kid's profile too — picture, birthday and "about me" — from Manage. Only their managers can (and their family sees it, like anyone's).
- **PROF-005** Each person can put their mailing address on their profile. It's optional but encouraged. Everyone in their Burrows can see it, except Burrows they choose to leave out (e.g. a work Burrow). It fills in family's Letterbox Nooks and stays current when they move (LET-004). _(Built — fine print in docs/archive/NOOK_REQUIREMENTS_FULL.md.)_
- **PROF-006** A profile picture can be an uploaded photo (taken or chosen from the phone), or still the icon/initials on a color. _(Josh asked 2026-10-09. Built: "Add a photo" on your profile and on a kid's (by their grown-ups); the color and icon stay as the fallback. Whoever can see the profile can see the photo, nobody else; a kid keeps their photo when they take over their profile. Details are Claude's, proposed.)_

## 1c. Home
- **HOME-001** Your **Home** is the people you live with, shared by every Nook that keeps things for a household (Letterbox now; Pet Care, Yearly Rhythms, House Binder and others later), so it's set up once and every Nook uses it. Each person is in one Home at a time. _(Built — fine print in docs/archive/NOOK_REQUIREMENTS_FULL.md.)_
- **HOME-002** You invite someone you already share a Burrow with; once they accept, you share a Home. The invite arrives in their inbox and on the Home page. _(Moved out of the Letterbox's settings, where it was LET-002.)_
- **HOME-003** If your own Home was only you, everything kept in it comes along when you join another; if you were in a shared one, you just leave it. Leaving gives you your own Home again with a copy of the Letterbox addresses; card history and anything else kept together stays with the people still there.
- **HOME-004** Anyone in a Home can add and change what's kept there. Nobody outside it can see any of it.
- **HOME-005** Each Nook that keeps things in a Home stores them against the Home, so they follow whoever lives there. _(Letterbox did; Pet Care will.)_
- **HOME-006** A Home holds at most 6 people, so one subscription per Home (MON-002) can't quietly cover a whole Burrow. _(Built: enforced in the database for joining and for inviting — pending invites count toward the 6 — and the Home page says when it's full. Someone leaving makes room again.)_
- **HOME-007** A kid's profile is tied to their parents' Home, and kids count toward its 6 just like grown-ups. A kid is in one Home at a time. _(Josh: "tie a kids account to the parents ... still a max of six per household, so even kids on parents accounts still count"; picked "One Home only".)_ Home Nooks (Sitter Sheet, Sick Day) use the kids in the Home.
- **HOME-008** "Add a kid" on the Home page makes their profile and Wishbook and puts them in the Home; the Gift Nook's button does the same. _(Josh picked "Home page + Gift Nook".)_ _(Proposed: a "Lives in your Home" switch, on to start, for someone without a phone who lives elsewhere.)_
- **HOME-009** Kid profiles made before this are asked about once: the Home page lists the kids you look after with a "Lives here" button, and nobody is added by guesswork. _(Josh picked "Ask once".)_
- **HOME-010** When a kid gets their own phone, the hand-off code (GIFT-021) moves their account off the parents: they keep their place in the Home, and everything that was theirs comes with them. _(Josh: "if they get their own phone can share the code to move their account off the parents, exactly like the wishlist"; picked "Stay in the Home".)_ _(Proposed: Wishbook, Burrows, Gatherings, picture, birthday, allergies, Potlucks, Getaways and sick days; parents stop managing them.)_
- **HOME-011** _(Proposed.)_ Moving Homes: a Home that was only yours brings its kids; leaving a shared one takes the kids only you look after there, and kids with another of their grown-ups staying behind stay. A move that would put a Home over 6 is refused.
- _Built 2026-10-09:_ HOME-007..011 in the `home_kids` migration and the Home page's Kids section. The tests skip until a service key is in `.env.test.local`.

## 2. Built Nooks (requirements archived)
Full requirements for these live in [archive/NOOK_NOOKS_BUILT.md](archive/NOOK_NOOKS_BUILT.md). **Grep it by ID before changing one of these Nooks**; edit requirements there.
- **Sitter Sheet Nook** (SIT-001..014): one page for sitters, shared by a link that runs out. Page hosted on Netlify for now (Q-031).
- **Gift Nook** (GIFT-001..040): wish lists ("Wishbooks") per person across Burrows, Gatherings, claims ("Tucks"), kids' managed profiles. Idea Stash (GIFT-036) built 2026-10-09.
  - **GIFT-038** On a Gathering with lots of people (like Christmas), see who you've tucked a gift for *for that Gathering*, and filter to the people you still need one for (Josh). _(Built, proposed details: a "Your shopping" card with a progress bar and Still need / Got one / Not getting / Everyone filters, starting on Still need; each person says what you're giving, or that a gift you tucked is for another Gathering. Only you see it.)_
  - **GIFT-039** Say "I'm not getting them a gift" for one Gathering, so they stop showing in Still need (Josh). _(Built, proposed details: private to you, never seen by them or anyone else, no notice; on the Gathering's list and on their Wishbook when opened from it; a gift tucked for them later counts anyway.)_
  - **GIFT-040** _(Proposed.)_ Each of your tucks says which Gathering it's for, and one tap counts it for a different Gathering you're both invited to (a gift tucked before Christmas was planned).
- **Potluck Nook** (POT-001..009): who brings what, RSVPs, allergy warnings. Since GATH-004 a Potluck is part of a Gathering and uses its guests, hosts and RSVPs.
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

## 2i. Subscriptions Nook
Josh picked it from the backlog on 2026-10-08 and on 2026-10-09 chose who sees it and every part below ("lets do the subscription nook"). Anything marked _(Proposed)_ is Claude's detail for him to confirm.
- **SUB-001** A Subscriptions Nook listing every recurring charge with its price, how often it bills and when it next renews. _(Proposed: the date moves on by itself after each charge; typing a name offers common ones (Netflix, Spotify, Costco…) that fill in the kind and usual billing, never a price.)_
- **SUB-002** Shared with your Home, and any single one can be "Just me". _(Josh picked "Home, with Just me option".)_ _(Proposed: anyone in the Home can change a shared one; only whoever added one can make it Just me; a Just me one isn't in anyone else's totals.)_
- **SUB-003** Cancel-by reminders: an inbox reminder a few days before it renews, and a "free trial ends" date so you can cancel before the first charge. _(Josh picked it.)_ _(Proposed: each one picks Off, 1, 3, 7 or 14 days (3 to start); trial and yearly/3-/6-monthly reminders are on, weekly/monthly ones off unless turned on in settings; it goes to whoever pays, or everyone in the Home if nobody's picked; the page shows "cancel by" the day before.)_
- **SUB-004** Totals: what it all costs a month and a year, each one counted the same way whatever it bills by. _(Josh picked it.)_ _(Proposed: free trials aren't counted until they charge, shown as "$X more a month after trials".)_
- **SUB-005** Who pays and which card: a person in the Home, and the card's name plus its last 4 digits, never the full number. _(Josh picked it.)_ _(Proposed: the database refuses a full card number.)_
- **SUB-006** A Hearth widget showing what renews next and the monthly total; tapping it opens the Nook. _(Josh picked it.)_ _(Proposed: called "Renewing soon"; can show just yours or hide the total; the Nook's tile shows the total and next renewals too.)_
- **SUB-007** Categories, with a total for each. _(Josh picked it.)_ _(Proposed list: Streaming, Music, Gaming, News & reading, Apps & cloud, Fitness, Food & delivery, Home & phone, Memberships, Other.)_
- **SUB-008** Price history: changing the price keeps the old one, e.g. "went up from $15.49 to $17.99 in March". _(Josh picked it.)_ _(Proposed: written by the database with who changed it, so it can't be made up.)_
- **SUB-009** Save the website where you manage or cancel it; one tap opens it. _(Josh picked it.)_ _(Proposed: "Through Apple" / "Through Google Play" shortcuts open the phone's store subscriptions.)_
- **SUB-010** Paused or cancelled ones move to a "Paused & cancelled" list instead of being deleted, with a running total of what stopping has saved. _(Josh picked it.)_ _(Proposed: counted from the day it stopped at the price then; "I started it again" picks the next renewal day.)_
- **SUB-011** _(Proposed.)_ Subscriptions follow the Home (HOME-003, HOME-005): a Home that was only yours brings them along when you join another; leaving takes your Just me ones with you and stops you being the payer of shared ones.
- **SUB-012** _(Proposed.)_ Nobody outside the Home can see any of them, and nobody but its owner can see, change or count a Just me one, enforced in Postgres, with tests.
- _Built 2026-10-09:_ SUB-001..012 in `app/subscriptions`, with the database rules in the `subscriptions` migration. The privacy tests skip until a service key is in `.env.test.local`.

## 2j. Getaway Nook
The backlog's "Trip" Nook. Josh picked it on 2026-10-09 ("lets do the trip nook next, maybe a better name for it too"), chose the name, who sees it and every part below. Anything marked _(Proposed)_ is Claude's detail for him to confirm.
- **TRIP-001** A Getaway Nook where each trip is "a Getaway", with a name, place, kind (beach, mountains, road trip…) and dates. _(Josh picked the name "Getaway Nook".)_
- **TRIP-002** A Getaway is seen only by the people going, picked from your Home and your Burrows. _(Josh picked "The people going".)_ _(Proposed: anyone going can bring more people; you can take yourself off, whoever started it can take anyone off, and a kid's managers can take the kid off; kids can be added so they have packing lists.)_
- **TRIP-003** Packing lists: each person going has their own, plus a shared one, ticked off as you pack. _(Josh picked it.)_
- **TRIP-004** Confirmations: flights, places to stay, rental cars, trains and tickets, with confirmation numbers (tap to copy), times, address and link. _(Josh picked it.)_
- **TRIP-005** A day-by-day plan, filled in from the confirmations (a flight on its day, check-in and check-out) plus anything you add. _(Josh picked it.)_
- **TRIP-006** A before-you-go checklist ("book the dog sitter", "hold the mail"), each with a do-by day and a reminder. _(Josh picked it.)_ _(Proposed: each can say who's doing it; one-tap ideas come with a sensible do-by day.)_
- **TRIP-007** _(Proposed.)_ Everyone going can add and change the lists, confirmations, plans and costs; only whoever started a Getaway can delete it.
- **TRIP-008** Reusable packing lists: save a list and start the next trip from it, with a few ready-made ones. _(Josh picked it.)_ _(Proposed: saved lists are just yours; ready-made: The basics, Toiletries, Beach, Camping, Flying, Little ones, Road trip.)_
- **TRIP-009** Shared costs: who paid for what, and who owes whom at the end. _(Josh picked it.)_ _(Proposed: split between everyone going unless changed; the fewest paybacks are suggested and "Mark paid" records one; a kid's share is added to their grown-up's.)_
- **TRIP-010** A countdown widget ("12 days until the beach") on the Hearth; tapping it opens the trip. _(Josh picked it.)_ _(Proposed: built into the Countdown widget as "A Getaway" (one, or whichever's next), with a ready-made "Getaway countdown" in Add → Ideas; the Nook's tile shows the next Getaway and what's left to pack.)_
- **TRIP-011** _(Proposed.)_ Inbox notices when someone adds you to a Getaway, the morning a before-you-go task is due, and the day before you leave (with what's left to pack); each can be switched off in the Nook's settings.
- **TRIP-012** Sitter Sheet & Pet Care link: from a Getaway, make a Sitter Sheet link for its dates in one tap. _(Josh picked it.)_ _(Proposed: also a button per pet to let a sitter help in Pet Care until the last day; a link already made for those days is shown.)_
- **TRIP-013** _(Proposed.)_ Nobody but the people going can see or change anything about a Getaway, enforced in Postgres, with tests. Costs can only be paid by and split between people going.
- **TRIP-014** _(Proposed.)_ Leaving takes your own packing list with you, tasks you were doing go back to "anyone", and costs stay so the sums add up; when the last person leaves, the Getaway is deleted.
- _Built 2026-10-09:_ TRIP-001..014 in `app/getaways`, with the database rules in the `getaways` migration. The privacy tests skip until a service key is in `.env.test.local`.

## 2k. Sick Day Nook
Josh picked it from the backlog on 2026-10-09 ("lets do the sick day nook next"), kept the name, chose who sees it and every part below. Anything marked _(Proposed)_ is Claude's detail for him to confirm.
- **SICK-001** A Sick Day Nook: when someone in the Home is sick, log symptoms, temperatures and medicine doses, with a "next dose OK at…" timer so two people can't double-dose. _(Josh kept the name "Sick Day Nook".)_ _(Proposed: anyone in the Home can be the sick one, grown-ups and the kids it looks after; each illness is "a sick spell" with what it is, when it started and notes; one at a time per person.)_
- **SICK-002** Seen by your Home, plus helpers. _(Josh picked "Home, plus helpers".)_ _(Proposed: a helper is someone from your Burrows who doesn't live with you, added to one sick spell until a day you pick or until they're better (access stops the day after "Feeling better"); they can log temperatures, symptoms and doses, and see the medicine cabinet, but can't change the spell or the cabinet.)_
- **SICK-003** _(Proposed.)_ Temperatures (°F or °C, a setting; where it was taken) and symptoms from one-tap picks or typed, plus notes, each with who logged it and when (now, or earlier). A fever is 100.4 °F / 38 °C.
- **SICK-004** _(Proposed.)_ Doses with a "next dose OK at…" timer. The database refuses a dose that's too soon (the gap since the last one, or the most a day), and two phones tapping "Give" at once can't both get through. "Give it anyway" (when the doctor says so) goes through, marked as given early.
- **SICK-005** A medicine cabinet. _(Josh picked it.)_ _(Proposed: each medicine saved once with the dose, hours between doses and most a day from the label or doctor, and what's in it; medicines sharing an ingredient count together (Tylenol and NyQuil are both acetaminophen); one can be saved for a single person; Nook never works out a dose.)_
- **SICK-006** A temperature chart. _(Josh picked it.)_ _(Proposed: one line over the sick spell with the fever line marked; tap to read a value.)_
- **SICK-007** A doctor summary. _(Josh picked it.)_ _(Proposed: when it started, allergies, highest and latest temperature, symptoms, every dose and notes, as text to read out, copy or share.)_
- **SICK-008** A Hearth widget. _(Josh picked it.)_ _(Proposed: "Next dose": who's sick, their latest temperature, and each medicine counting down to OK; the Nook's tile shows the same.)_
- **SICK-009** A dose-ready alert. _(Josh picked it.)_ _(Proposed: an alert on the phone that gave the dose, plus an inbox notice, when the gap is up; also a notice to the rest of the Home when someone gives a dose, and to a helper when they're added. Each can be switched off.)_
- **SICK-010** Sitter Sheet link. _(Josh picked it.)_ _(Proposed: a "Sick day" tick on a link, off by default; for kids on that link who are sick now, the sitter's page shows what it is, the latest temperature, and each medicine with when it was last given and when the next is OK. Read-only (SIT-005), with no notes or who gave what.)_
- **SICK-011** Illness history. _(Josh picked it.)_ _(Proposed: "Feeling better" ends a sick spell and keeps it, by person, until deleted; it shows "Last had strep in March" next time.)_
- **SICK-012** Missed days. _(Josh picked it.)_ _(Proposed: school, daycare or work; tick the days on the sick spell; a ready-to-send note for school or work.)_
- **SICK-013** _(Proposed.)_ Nobody outside the Home or a sick spell's active helpers can see anything about it, and doses are only written by the database's dose check, enforced in Postgres, with tests. A sitter link shows the sick part only when ticked, and only for kids on it.
- **SICK-014** _(Proposed.)_ A Home that was only yours brings its sick spells and cabinet along when you join another (HOME-003, HOME-005); leaving a shared one takes your own sick spells and the medicines saved just for you. Kids' spells stay.
- _Built 2026-10-09:_ SICK-001..014 in `app/sickday`, with the database rules in the `sick_day` migration (the dose-ready inbox notice needs pg_cron). The privacy tests skip until a service key is in `.env.test.local`.

## 2l. Gathering Nook
Josh asked 2026-10-09 for an easier place to see and plan Gatherings ("right now the only way to see and create gatherings is within the pot luck and its kinda hidden if its just a game night or something and not food"), and picked each choice below. Anything marked _(Proposed)_ is Claude's detail for him to confirm.
- **GATH-001** One place that lists every Gathering you're invited to, with a way to plan one. _(Josh picked "its own Nook".)_ _(Proposed: the "Gathering Nook", grouped This week / Coming up / Recently, each showing what you answered and whether it has gift lists or a Potluck; a Hearth tile; each Burrow's page links to its Gatherings.)_
- **GATH-002** A Gathering can be any get-together, not just a gift one, like a game night. _(Proposed kinds: Christmas, Birthday, A meal, Game night, Party, Anniversary, Baby shower, Other; a day with an optional time, a place and notes.)_
- **GATH-003** Invite several Burrows, or just specific people, picked from your Burrows with a Burrow filter "to keep it organized" (Josh). _(Proposed: a whole Burrow includes anyone who joins it later; you can only invite your own Burrows and people you share one with; a kid's grown-ups see a Gathering the kid is invited to.)_
- **GATH-004** When planning, choose what it has: gift lists (the Gift Nook) and/or a Potluck, and the Gathering takes you to them (Josh). A Potluck's guests are its Gathering's guests (Josh picked "Same as the Gathering"); this changes POT-002. _(Proposed: every Potluck now belongs to a Gathering, so planning one from the Potluck Nook plans a Gathering with food; each existing Potluck on its own got a Gathering of its own.)_
- **GATH-005** Only the hosts (whoever planned it, plus co-hosts they add) change or delete it; guests see it and answer. _(Josh picked "Its hosts".)_ _(Proposed: an admin of an invited Burrow can step in; automatic Birthday Gatherings have no hosts, so anyone invited can change them, as before.)_
- **GATH-006** Every Gathering has RSVPs: Going, Maybe, Can't make it, shared with its Potluck. _(Josh picked "Yes, on every Gathering".)_ _(Proposed: extra guests count toward "coming"; you answer for kids you look after.)_
- **GATH-007** _(Proposed.)_ GIFT-007 is unchanged: inviting someone from another Burrow never shows them anyone's Wishbook or tucks. The Gift Nook shows only the Wishbooks of guests you share a Burrow with. Guests see each other's names and pictures on the guest list (photos only for people they share a Burrow with).
- **GATH-008** _(Proposed.)_ Inbox notices when you're invited, when the day, time or place changes (not if you said no), a week and a day before, and (for hosts) when someone answers. Each can be switched off in the Nook's settings; automatic birthday ones stay quiet. The Gift Nook's two Gathering switches moved here.
- **GATH-009** At the top of a Gathering, an option to put it on your Hearth, where it shows its details "all in one": the day and place, RSVPs, gifts and Potluck info; tapping it opens the Gathering (Josh). There's also a widget that can show your available Gatherings (Josh). _(Built 2026-10-09 as the "A Gathering" widget, proposed: your answer and who's coming, your own gift shopping for it (GIFT-038, never tucks on your gifts — GIFT-007), what you're bringing and open Potluck spots. In Add → From your Nooks it can be one Gathering or "Whichever's next".)_
- **GATH-010** A Gathering widget "needs to do something when the Gathering is over" (Josh). _(Built, proposed: you choose Take it off my Hearth (the default; it goes the day after, or if the Gathering is deleted), Switch to my next one, or Keep it up (shows how many came). Never automatic on the shared Home page.)_
- _Built 2026-10-09:_ GATH-001..008 in `app/gatherings`, with the database rules in the `gatherings` migration. The privacy tests (including GIFT-007 for guests from other Burrows) skip until a service key is in `.env.test.local`.

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
- **MON-011** Nook Plus covers the kids in a subscribed Home (HOME-007), and only them: a kid who isn't in the Home doesn't get its Plus. _(Josh: "if they aren't in the home then they won't get the subscription of Nook Plus or Pro if not in the home".)_ _(Not built: Nook Plus itself isn't built yet. "Pro" is Josh's word; whether there's a second tier is part of Q-028.)_
- **MON-010** _(Proposed.)_ Before launch, the Market shows which Nooks are free and which are Plus, and a paid Nook offers the trial instead of just refusing. The Gift Nook, and anything that lets a whole family join, is never locked behind payment (GIFT-007 is also unaffected: nothing about claims is ever paywalled or revealed).

## 3. Open Questions
- **Q-003** For events about one person (a birthday, a baby shower), does the event show only that person's list, while group events like Christmas show everyone's? Who is the "honoree" of an anniversary (both people)?
  - _Built for now (proposed):_ honorees are optional when creating a Gathering. If any are picked, the Gathering links to their Wishbooks; if none, to everyone invited whose Wishbook you can see (GATH-007). Anniversaries can pick both people.
- **Q-019** What else should the Gift Nook's settings include?
  - _Built so far:_ "Hide gifts that are already taken" *(proposed)*, plus the four notification switches (GIFT-029). Saved to the account, so they follow you to a new phone.
- **Q-020** Deleting an account: Apple's App Store requires apps with sign-up to offer in-app account deletion. When someone deletes their account, what happens to Burrows they started, gifts they've tucked for others, and their Wishbook? (Needed before an App Store release, not before.)

- **Q-023** Emailed sign-in codes: Resend without a verified domain only delivers to its owner's own address, so family members can't receive codes. Which domain should Nook send email from (a domain must be bought, about $10–15/year, then verified in Resend and set as the sender in Supabase)? Needed before anyone besides Josh uses the app.

- **Q-024** Should each Burrow be able to turn automatic Birthday Gatherings off (so far only deleting a single one, which lasts for that year)? And should the 30-day lead time be adjustable?
- **Q-025** The app ID (bundle identifier) is currently `com.josh51201.nook`. It is permanent once the app is published. Should it use the domain Josh buys for email (Q-023) instead?

- **Q-028** Exactly where the free/paid line sits, the price and the trial length (MON-003, MON-004). Decided so far: subscription, no ads, one plan per Home, capped at 6, and the free/paid list is easy to change later (MON-005). The how-it-works details in MON-006..010 are Claude's proposals for Josh to confirm. The Subscriptions Nook (SUB-001) keeps things in a Home, so under MON-003 it would be Plus too (proposed); the Getaway Nook (TRIP-001) shares across Burrows, so it could stay free like the Gift Nook (proposed); the Sick Day Nook (SICK-001) keeps things in a Home, so it would be Plus (proposed). Not needed until the standalone app build, but the free/paid line should be settled before anyone outside the family uses the app, since taking away something free later upsets people. Also depends on Q-020 (account deletion) and Q-025 (app ID) before an App Store release.
- **Q-031** Where should the Sitter Sheet's web page live? It's one small file. Options: a free static host (Netlify or Cloudflare Pages) now, then the domain bought for email (Q-023) later, e.g. `sitter.<domain>`. Links made before a move stop working, but they only last one stay anyway.
- **Q-032** Notices from the Nooks only reach your inbox (and a few alerts set on this phone, like the next sick-day dose). Josh wants them sent as phone notifications. That needs real push notifications: the app has to be built as its own app (Expo Go can't receive them), with Apple/Google push set up, and the database sending a push whenever it adds a notice. Should this be done now, or with the standalone app build (Q-025, Q-028)? Once on, Settings → Notifications (CORE-090) would also get a "Push to this phone" master switch.

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

## 6. Nook Backlog
Josh's picks, in no particular order. Names and details are proposed until he confirms them; each will get proper requirement IDs when it's about to be built.
- **Lent Out** — track things you've lent or borrowed (the drill, the casserole dish), to or from whom, with gentle reminders to ask for them back.
- **House Binder** — home info in one place: paint colors, appliance models, warranty dates, filter sizes, trusted contacts like the plumber, and service history.
- **Quote Jar** — save funny things people say, with the date and who said it; a Hearth widget shows a random one each day.
- **Fridge Door** — now built as the Fridge door widget: see CORE-086.
- **Recipe Box** — now being built as the Recipe Box Nook: see section 2h (REC-001..014).
- **Heads-Up Board** — one-tap household status like "on my way", "dinner at 6?" or "need milk"; no location tracking. _(Josh picked it 2026-10-08.)_
- **Sick Day** — now built as the Sick Day Nook: see section 2k (SICK-001..014).
- **Subscriptions** — now built as the Subscriptions Nook: see section 2i (SUB-001..012).
- **Little Log** — log anything with a date (blood pressure, mileage, a symptom, a mood); you pick the fields and it charts them over time. _(Josh picked it 2026-10-08.)_
- **Trip** — now built as the Getaway Nook: see section 2j (TRIP-001..014).
- **Idea Stash** — part of the Gift Nook (GIFT-036), not a separate Nook.

Earlier faint, very broad ideas (lower priority, may be dropped): Food tracker, To-do list.

Other ideas Claude mentioned that Josh hasn't picked: Freezer & Pantry (Josh was curious, not yet picked), Hand-Me-Downs, Guest Book, Growth Marks, Kid Art, Gift Closet, Daily Question; Surprise Planner (plan a surprise with a hidden to-do list, hidden from the guest of honor), Keepsakes (letters sealed until a date, e.g. a kid's 18th birthday).

## 7. Up next
Josh's stated priority, in order:
1. ~~**Hearth:** CORE-055 (share a look) and the fireplace sound (CORE-047)~~ — built 2026-10-09; the Hearth rounds are done.
2. ~~**Recipe Box Nook (REC-001..014)**~~ — built 2026-10-09 (section 2h).
3. **Backlog Nooks** (section 6) — Josh picks the next one. Subscriptions, Getaway (Trip) and Sick Day built 2026-10-09 (sections 2i, 2j, 2k).

_Built and done: Hollows, Potluck, Letterbox, Pet Care, Rhythms, Sitter Sheet (page on Netlify for now, Q-031), and Hearth rounds two and three._
