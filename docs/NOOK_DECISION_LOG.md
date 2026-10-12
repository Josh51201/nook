# Nook — Decision Log









_Newest at the bottom. Josh's words where possible. Split out of the requirements doc so that doc stays small; add new decisions here, and when an Open Question is answered, move it here._









- **2026-10-06 — Q-001 answered:** A person can be in several families. Their list is created outside any family and shows in all of them, with claims visible to all families except the list owner. → GIFT-011, GIFT-012, GIFT-013




- **2026-10-06 — Events:** Families can have multiple events (Christmas, birthdays, anniversary, baby shower, other) with end dates; ended events get archived and eventually go away. → GIFT-014–016




- **2026-10-06 — Login:** Email-based login. → AUTH-001




- **2026-10-06 — Q-012 answered:** Stack approved — Expo (React Native) + TypeScript + Expo Router for the app, Supabase for backend/auth/database, with the owner-can't-see-claims rule (GIFT-007) enforced in Postgres via row-level security. → Q-012, AUTH-001




- **2026-10-06 — Q-015 answered:** Email login via one-time code (OTP), no passwords. Chosen over magic links because magic links need deep-link/universal-link config that's extra setup and flakier in Expo Go during development; a typed code works the same in dev and production. Social sign-in (Apple/Google) deferred, not built this session. → AUTH-001, Q-015




- **2026-10-07 — Q-002 answered:** "A wishbook should be for the whole thing for every event but allow a user to exclude or include certain gifts so that way if they just want money for their bday they can do that and their full list for christmas." → GIFT-017




- **2026-10-07 — Q-010 answered:** Invites are codes, and "being able to send the code out from anyone is fine." Codes expiring after 7 days is still *(proposed)*. The admin-roles part of Q-010 split out as Q-017. → GIFT-018, Q-017




- **2026-10-07 — Q-018 answered:** Yes to tile sizes, colors/themes, folders/groups and widgets: "fully customizable and can create widgets and almost set what they want notified or shown on their hearth." For later, not now. → CORE-007–011




- **2026-10-07 — Hearth customization:** The Hearth will eventually be customizable with drag-and-drop, and that's "the big appeal of the app." → CORE-006, Q-018




- **2026-10-07 — Settings pages:** "A settings page on each nook for more customization, and also settings on the hearth for account info, name setting, and logout and anything important." Also: the Gift Nook needed a way back to the Hearth. → CORE-012, CORE-013, CORE-014, Q-019




- **2026-10-07 — Nook shop + Hearth layout:** "Allow the adding of a nook and have the gift nook be one to add. Almost like a shop." Plus the ability to "change the size of the nook" and "drag and drop it into different sections on the hearth," and "anything that you see worth while to make it more customizable." Claude's added picks, for Josh to confirm: tile colors and custom names, Hearth themes and name, live Gift Nook widget, backlog Nooks shown as "coming soon." → CORE-006–010, CORE-015




- **2026-10-07 — Q-007 answered:** Managed profiles for kids, with hand-off to the kid later; managers are whoever creates it plus people they add; managers see claims on the kid's list. → GIFT-019, GIFT-020, GIFT-021




- **2026-10-07 — Q-006 answered:** Suggestions are allowed on anyone's list and hidden from the owner. → GIFT-022




- **2026-10-07 — Q-008 answered:** Claims can be released (already built) and have Planning → Bought statuses. → GIFT-023




- **2026-10-07 — Q-005 and Q-016 answered:** Givers see each other's names and notes, everywhere (across families). → GIFT-024




- **2026-10-07 — Q-009 answered:** The giver gets a heads-up when a claimed gift is edited or removed. → GIFT-025




- **2026-10-07 — Q-013 answered:** After an event the owner confirms what they got; nothing is revealed; unchecked claims are released after a while. → GIFT-026, Q-022




- **2026-10-07 — Q-014 answered:** Archive at the end date, delete after 90 days. → GIFT-027




- **2026-10-07 — Q-017 answered:** Admins can remove members, rename or delete the family, make others admins, and delete any event. → GIFT-028




- **2026-10-07 — Notifications:** Notify for events coming up, new gifts, changes to a claimed gift, and someone joining; it "should be customizable for gift nook so they can choose what they see." → GIFT-029




- **2026-10-07 — Q-004 answered:** The starter Shelves (Clothes, Money/Gift Card, Books, Toys, Experiences, Other) and their questions are "good for now." → GIFT-003




- **2026-10-07 — Q-011 answered:** Josh liked the suggested link auto-preview; deeper Amazon integration isn't needed for now. → GIFT-030




- **2026-10-07 — Q-022 answered:** Don't assume a bought gift was given: "still rely on the user to select they received them after the event to then remove from their list rather than rely on the bought, but may still show as bought on their list for like 30 days and then release." → GIFT-026




- **2026-10-07 — Q-021 answered:** "I would want them eventually to push notifications, but we don't have to just yet." Push needs a development build instead of Expo Go plus Apple/Google setup; that step is deferred. → GIFT-031




- **2026-10-07 — Mobile polish:** "There are some parts where the typing keyboard will cover what I am trying to type, like the entering a knock code section. So lets do some mobile improvements and just improvements over the gift nook in general... Add any other details you think would be good." Claude's picks (proposed, for Josh to confirm): Most wanted, price + budget filter, editable Gatherings with a date picker and countdowns, a "Coming up" list, Copy/Share for codes, a "set your name" nudge, haptics, plain-English errors. → CORE-016, GIFT-032–034




- **2026-10-07 — UI overhaul:** "It looks and feels great but very static. Is there a way to add any animations... AI loves to use emojis but didn't know if there was anything better like mui symbols. I just want it to feel nice and flow nice." → CORE-017




- **2026-10-07 — Widgets + design-your-own Hearth:** "Allow the user to create widgets of different kinds on their hearth that is completely customizable on how it's shown and what is shown, so if it's the food one they can set different reminders for uploading their food, or events coming up for holidays, like ones for reminders for events, stuff to buy etc... will let you make the judge of what all." And: "I want the user to be able to design what it looks like, everyone's hearth will look different because they can change it all." → CORE-018, CORE-019




- **2026-10-07 — Developer sign-in:** Signing in as a second test person with "+test" email failed ("error sending confirmation email") because emails only reach the account owner's address. Josh: "sure" to a dev-only password sign-in for testing. → AUTH-002, Q-023




- **2026-10-07 — Profile + widget fixes:** The Inbox widget opened a screen with no way back, and tapping the Countdown widget jumped into the Gift Nook (not wanted). "If it's a user's first time entering Nook, so a new user, it should prompt for their name rather than show their email as their name. A create profile type thing where they can edit things there before entering the hearth. So more profile customization!" → PROF-001, PROF-002, CORE-020




- **2026-10-07 — Next steps chosen:** "How about the nook icon and real app build, the kid profile pictures and the birthday one." → CORE-021, PROF-003, GIFT-035




- **2026-10-07 — More Nooks for the backlog:** After asking for ideas that are "very useful ones that not many people have apps for," Josh picked: potluck, card/contact list, pet care, lent out, yearly rhythms, house binder, sitter sheet, idea stash, quote jar, and fridge door. Idea Stash became a Gift Nook requirement. → Nook Backlog (section 6), GIFT-036




- **2026-10-07 — Hearth organization is next:** "I want to add to the requirements to do next about adding more organization to the hearth, cause right now with all the widgets we add and 4 slots per row, can easily become a very long list of things. So I want to somehow build into this Nook theme and create like houses or stumps to enter that has these user customized/organized screens within with a door animation or something along the lines, so just more built out organization that is user friendly!" → CORE-022, CORE-023, CORE-024, Q-026, section 7




- **2026-10-07 — Q-026 answered:** "I love that! Hollow is a great name for it. But yes I want those to be built out." — approving the name Hollow and Claude's suggested defaults: one level deep (a Hollow holds Nooks, widgets and text but not other Hollows), a house and a stump to start, and a door that swings open as the screen zooms in. → CORE-022, CORE-023, CORE-024




- **2026-10-07 — Burrows tab + first-time tour:** "Move the burrows (family) outside of the gift nook and at a tab that shows up in the bottom, like icons at the bottom of the screen and one is for creating and managing families exactly how it is in the gift nook but this will allow you to manage families for other nooks that require sharing with other people other than just the gift nook. Also it would be nice to have a short tutorial that shows up on users first time enter, just pop ups with some guides pointing at how some of it works with creating icons and creating burrows (families)." The other tabs (Hearth, Settings) and the tour's exact steps are Claude's picks, for Josh to confirm. → CORE-025, CORE-026, GIFT-001, CORE-013, Q-027




- **2026-10-07 — Q-027 answered + tour, inbox, depth:** The tabs stay as built: "I think the way you did it looks great, but maybe we have an inbox in the top right now to show when you have stuff to look at." The tour "looks like a real apps tutorial," but needs to "scroll down to the add button" when widgets push it off screen. And: "I wanna add a little depth as well to the main screen... shadows or something on widgets... to add more pop and depth to the main hearth. I'll let you decide." → CORE-025, CORE-026, CORE-027, CORE-028, Q-027




- **2026-10-07 — Tour only once; depth everywhere:** "The tutorial should only show up on the users first time opening the app, or just when they click on it in the settings. But right now its seeming to do it every time I go back into it." The separate Burrows-tab tour (which popped up again on the first Burrows visit) was folded into the one tour. And: "Is there a way to match that style throughout the app?" → CORE-026, CORE-028




- **2026-10-07 — Potluck next:** After the Burrows tab, tour and depth work, asked what else to do first: "I agree, will let you do what is fit. Dont do the new nook just yet, get these last minute things out of the way first. But think next should be Potluck." Claude made the inbox work across all Nooks. Still waiting on Josh: Q-023 (email domain), Q-025 (app ID), Q-020 (account deletion). → CORE-027, section 7




- **2026-10-07 — Potluck shaped:** Josh's picks: Potlucks can hang off a Gathering *or* stand alone ("Both"); hosts list slots and anyone can also add a dish; allergies and diets live on profiles, dishes are tagged, and clashes are warned about by name; RSVPs with a headcount; every Potluck belongs to a Burrow; a reminder the day before; host plus co-hosts can edit, with Burrow admins able to step in. → POT-001..008, PROF-004




- **2026-10-07 — Hearth top bar, title, and drag-scroll:** "The bar at the top should always remain, so that the inbox and edit are always there. The top should have something more appealing as the title of The Hearth, kind of plain. Also when I am dragging and dropping with a full screen, and I am dragging towards the top or bottom, it needs to scroll with me so that I can drag and drop onto like hollows." → CORE-029




- **2026-10-07 — Livelier widgets, Hollows, customization:** "Make the inside of the widgets a little better, kinda boring, but still like the simpleness but lots of blank space especially when you make them bigger, so maybe more dynamic changes, and like the look of the gift nook when its bigger with the white box... Even the hollow looks great with the animation but maybe something to make it more exciting and fun. And the pot luck nook has nothing on it even when bigger so needs something there. More things should also be allowed to be an icon. I just want more customization in general and just making your hearth your home." Josh left the details to Claude. → CORE-030, CORE-031




- **2026-10-07 — Design pass:** Josh agreed to all four suggestions: the Hearth theme across the whole app plus dark mode, Hearth-like headers on each Nook's home, opening a Nook as if stepping into it, and a cozier font (with options to compare). → CORE-032, CORE-033, CORE-034, CORE-035




- **2026-10-07 — Nooks stand out; naming:** "The Nooks that we create are the special thing about this app so I want those added nooks to stand out amongst the other widgets. Also their names should be better, gift nook is fine... but potluck should at least have Potluck Nook." Josh picked "Potluck Nook" and the rule that every Nook is named "___ Nook". → CORE-036, CORE-037, Glossary




- **2026-10-08 — Open widgets to see what's in them:** "We should be able to open up widgets like the shopping lists, countdown, inbox widget, reminders, etc. on the hearth to open up their open page to view what is in them, especially if they are icons and doesnt show it on home screen... if we arent in edit mode then they should just display whats in them in a nice useful way that also looks real nice." → CORE-020, CORE-038




- **2026-10-08 — Letterbox Nook:** Josh picked the card & contact list as the next Nook and chose: the name Letterbox Nook; shared by a household, invited from your Burrows; one entry per household; addresses from family profiles plus typed-in ones; tracking holiday cards each year, other cards, photos of cards received, and printable labels; nudges for card season, birthday cards and thank-you notes owed. On addresses: "everyone in the burrows but you can choose to not include it to everyone, so like if its a work burrow then you wont want to share it with everyone. And also not everyone HAS to put in an address, but its encouraged." → LET-001..011, PROF-005, Glossary




- **2026-10-08 — Copies of widgets and Nooks:** "The ability to copy a widget so that I can put into different hollows or for people who just want to customize their page their own way, also I feel like you should have the ability to do add multiple nooks on your home pages or drop within hollows but they just go to the same place." No conflicts: a Nook's data lives on the account, not the tile. Copies being independent rather than mirrored is Claude's pick, for Josh to confirm. → CORE-039




- **2026-10-08 — Copy button and drag to trash:** "A copy button from the main page as well when in edit mode rather than having to go into the widget and scroll all the way down." "Also need a drag to a trash functionality in edit mode to delete widgets." "Also needs to say somewhere that the widget was copied (maybe say at the bottom of the page or something to signify it was copied, maybe scroll down to it.)" → CORE-039, CORE-040




- **2026-10-08 — Home, outside the Letterbox:** "I say we change up the households a little bit to be done outside of the letterbox since its going to be used for multiple things. Not sure if it should be done within the Burrows or in another tab or what is best for the app. Will leave you to think of where to best put it." Claude picked a "Your Home" card at the top of the Burrows tab; Josh chose the name "Home" and Pet Care as the next Nook. → HOME-001..005, LET-002, LET-003, Glossary




- **2026-10-08 — Pet Care Nook:** Josh picked Pet Care next. Sharing: Home plus helpers. Tracks: feeding check-offs, vet/vaccines/meds, walks and potty/litter, and a pet profile with records. Feeding: set meals per pet. Nudges: meal not fed yet, vet and vaccine due dates, and fed notices. → PET-001..007




- **2026-10-08 — Rhythms Nook:** Yearly Rhythms is next ("Yes I agree"). Josh picked: the name Rhythms Nook; a starter list to pick from; an optional owner per chore; and all four reminders (heads-up, due day, overdue, someone did it), but "they should all be optional and a toggle in the individual nook settings." → RHY-001..008, Glossary, section 7




- **2026-10-08 — Subscription:** Josh wants App Store revenue without ads, so a subscription. On one person covering a Home: "if you add in a whole burrow of 20+ people who get everything for free seems broken." Then: "I like the per home idea but yes needs capped at 6." So the plan is per Home, covers the Home only (never a Burrow), customization follows the Home, and a Home holds at most 6. The free/paid line, price and trial are still Claude's suggestions. → MON-001..004, HOME-006, Q-028, Glossary




- **2026-10-08 — Subscription setup recorded:** Josh asked to put in how the subscription will be set up now, with free/paid changeable later: "will add more things that we can change over what is free and what is not later." Recorded MON-005 (one editable free/paid list) as his; MON-006..010 (entitlement on the Home, who subscribes, read-only when it ends, Apple + RevenueCat, Market labels) are Claude's proposals. → MON-005..010, Q-028




- **2026-10-08 — Hearth customization, round two:** After Claude laid out ideas in five groups (look, cozy extras, widgets, layout, sharing), Josh: "I love all those options." Recorded all of them as wanted; details are proposed and none are built. Claude's suggested first round: wallpapers and the color picker, Trinkets and photo frames, seasonal ambience. → CORE-041..055, Glossary




- **2026-10-08 — Hearth customization, first round:** Josh: "sure first round". Built CORE-041, 042, 045, 046 and 047. Claude's calls, for Josh to confirm: ambience is off by default, the fireplace sound is left for later, and colors are always light tints (Bold gives the deep version).




- **2026-10-08 — Themes and tile shapes:** Josh: "lets start the next specs you named". Built CORE-043 and CORE-044 next. Claude's calls, for Josh to confirm: a theme is just a background and an accent (the rest is worked out so it stays readable), 6 themes at most, and the seasons are northern-hemisphere.




- **2026-10-08 — More widgets and seasonal showing:** Built CORE-049 and CORE-053 in the same push. Claude's calls, for Josh to confirm: weather is left for later (it needs location and an outside service), the quote list is 30 of our own lines, and out-of-season things leave an empty space rather than closing the gap.




- **2026-10-08 — Weather, a window, and weather in the air:** Josh: "continue with the weather effects and adding a window widget and stuff for seeing outside of it some weather effects as well." Built CORE-056, 057 and 058. Claude's calls, for Josh to confirm: you type a town rather than Nook using the phone's location (no permission prompt, nothing sent but the town), the weather comes from Open-Meteo (free, no key), °F by default, and "Match the weather" follows the town on your Weather or live Window widget. → CORE-049, CORE-056..058




- **2026-10-08 — Hearth organization, round three:** Claude suggested more ways to keep a full Hearth tidy (pages, stacks, Scenes, select-many, lock, tidy up, find, dividers, tags). Josh: "I think all of them". Recorded as wanted, nothing built; order is still to be agreed. → CORE-050..052, CORE-060..065



- **2026-10-08 — Organization round 1:** Josh: "yes round one". Built pages, widget stacks and select-many. Claude's calls, for Josh to confirm: up to 6 pages and 6 per stack, removing a page moves its contents to the first page (like Hollows), a stack is made from a widget's editor, and select-many can move, copy, recolor and remove but not drag as a group. → CORE-050, CORE-051, CORE-060


- **2026-10-08 — Organization round 2:** Josh: "lets do round 2". Built lock in place, tidy up and find. Claude's calls, for Josh to confirm: a locked item is protected from dragging, resizing and removing but not from being recolored or copied, a drop onto a locked item lands in the nearest open spot, tidy up keeps each item's column, and Find is on the Hearth only. → CORE-061, CORE-062, CORE-063

- **2026-10-08 — Drag to a page, lock button on the item:** Josh: "you should be able to drag widgets to the page tabs up top and it will move there. And the lock in place should also be on the edit mode on the widget itself like the copy button." Built both. Claude's call, for Josh to confirm: a "New page" tab appears while editing so you can drop onto it to start a page. → CORE-051, CORE-061
- **2026-10-08 — Organization round 3, and Trinkets anywhere:** Josh: "yes I like that, and I also think the trinkets should be able to be moved anywhere", and asked whether that makes storage more expensive. Built dividers, Scenes, tags, and free-floating Trinkets. Measured: about 18 KB for a Hearth of 100 items, and about 100 bytes per Trinket. Claude's calls, for Josh to confirm: Scenes are kept in their own saved row (up to 6) and work like wardrobes, folding and hidden tags are not saved, and a scene's schedule is by time of day and months, checked when the Hearth opens (nothing runs in the background). → CORE-045, CORE-052, CORE-064, CORE-065
- **2026-10-08 — The Hearth pet:** Josh: "lets do the pet on your hearth, whether it lives somewhere or in a widget and can venture out onto other widgets/nooks would be real cute!" Built as a widget that is the pet's bed, with the pet hopping out onto other tiles and widgets. Claude's calls, for Josh to confirm: the name "Hearth pet"; it can be a Pet Care pet or a made-up one; the Pet Care photo becomes its face on a drawn body; it sleeps in bed from 10 PM to 6 AM; it waits at home by an empty bowl when a meal with a reminder time is late; it never visits the top row (it would be cut off) or Trinkets and text; it doesn't go into Hollows. → CORE-048, Glossary
- **2026-10-08 — Shared Home Hearth is a page:** Josh: "lets work on a shared home hearth option (maybe a page)". Asked page or Hollow (CORE-054 said Hollow): Josh picked a page, and that it shows up for everyone in the Home automatically (each person can hide it). Claude's calls, for Josh to confirm: it appears once a Home has 2+ people, anyone in the Home can rename it, it doesn't count toward your 6 pages, Hollows can't go on it, theme/wallpaper/Scenes stay personal, and photos on it are visible to the whole Home. → CORE-054, Glossary
- **2026-10-08 — Page size limits:** Josh asked whether pages should ever have a maximum before needing another page or Hollows; Claude proposed ~60 per page and Hollow, 40 on the Home page, Trinkets half. Josh: "sure that sounds good for those numbers". Claude's calls: existing Hearths are never trimmed, and the numbers should be re-checked on a real phone. → CORE-066
- **2026-10-09 — Idea Stash:** Josh asked what it was, then: "lets do the gift stash". Built as spec'd in GIFT-036. Claude's calls, for Josh to confirm: two kinds of note (gift idea, and good-to-know for sizes and likes); notes are only about people you share a Burrow with or kids you manage; "Suggest" reuses the gift form and the existing hidden suggestion; and a suggested idea stays in the list marked done. → GIFT-036
- **2026-10-09 — Using the inbox more:** Josh felt only Burrows and the Gift Nook send inbox notices. Claude reviewed every Nook and listed gaps; Josh: "You can start the notices". Built the first batch: new Gathering (GIFT-037) and Potluck invites, changes, RSVPs and dishes (POT-009). Claude's calls, for Josh to confirm: RSVP and dish notices are off by default, the person who made a change is never told, and automatic birthday Gatherings stay quiet. Still to do: Letterbox (card season, thank-yous owed) and a bundled Home page notice. Open worry: the timed notices need pg_cron switched on in Supabase. → GIFT-037, POT-009
- **2026-10-09 — Sitter Sheet Nook:** Josh: "maybe the sitter sheet, that one is pretty useful I feel". He picked: a secret link per stay that expires (and can be switched off early); a mix of typed sections and data pulled from other Nooks, chosen per link; one sheet per Home. Claude's calls, for Josh to confirm: the name "Sitter Sheet Nook", read-only link, database-enforced exposure. → SIT-001..004, Glossary
- **2026-10-09 — Sitter Sheet answers (Q-029, Q-030):** Read-only or sitter notes back? Josh: "no that can just be texting after that". Which Home data can be pulled in? Josh: "i wanna stay legal so if its not to invlude that kind of information then whatever, I will leave it up to you, but things can be optional." Claude's calls, for Josh to confirm: every pull is off by default and picked per link; kids show first name, allergies and diets only; links last at most 60 days and work from when they're made. → SIT-005..008
- **2026-10-09 — Sitter Sheet, round two:** Josh: "can you add more stuff to the sitter sheet nook? Its kinda plain and does nothing on the main page". Claude offered four additions; Josh picked all of them: a daily routine, opened and ending notices, presets and "same as last time", and house info (Wi-Fi, where things are, codes). Claude's calls, for Josh to confirm: notices go to whoever made the link; codes are never ticked by a preset and are hidden on the page until tapped; a Hearth tile and a "Sitter links" widget. → SIT-009..013
- **2026-10-09 — Recipe Box Nook:** Josh: "Lets do the recipe box". He picked: each person's recipes shared to their Burrows (like Wishbooks), cook mode, scaling servings, Shelves and search, typing in and pasting a website link, and links to Potluck, allergy warnings and a Hearth widget. He didn't pick the family-history extras (handwritten card photo, story) or reading a photo of a card. Claude's calls, for Josh to confirm: "Just me" recipes, step timers, free under Nook Plus. → REC-001..012
- **2026-10-09 — TikTok recipes:** Josh: "is there a way to post a tiktok for a recipe or is that too complicated?" Claude offered three levels; Josh: "1 and 2 work then!" That means saving a TikTok on a recipe (name and ingredients from its caption) and watching it inside Nook. Turning the video into written steps (needs an AI service and a server) is not being built. YouTube and Instagram were asked about but not answered. → REC-013, REC-014
- **2026-10-09 — One menu with every Nook (CORE-067):** Josh: "if you dont add all your nooks and invited to an event, then new people may be confused where to click on it. So havent all the nooks on one menu might be best. I will let you decide if the best place is at the bottom or somethign else but feel like its needed. Probably overwhelming for first time users especially if a family is primarily getting the app to use lets say the gift nook". Claude put it in a fourth bottom tab, "Nooks" (proposed), between Hearth and Burrows. The Market stays for arranging the Hearth.
- **2026-10-09 — Tour updated for newcomers (CORE-026):** Josh: "can the tutorial be updated with any new stuff that would help newcomers, including the new nooks tab". Claude's call (proposed): the tour now visits the Nooks tab and opens it, adds Your Home on the Burrows tab, and moves Hearth decorating to the end as optional.
- **2026-10-09 — Tour approved, plus a send-off:** Josh on the new tour order: "perfect!!" Then: "add one more thing on the tutorial at the end that just says to go at it and enjoy the app ... something along those lines about customzing to their hearts content". Added a last "Make yourself at home" step, and the final button now says "Let's go" (Claude's wording).
- **2026-10-09 — Easier for first-timers and older users (CORE-068..073):** Claude suggested ten ideas; Josh: "on the biggest wins, we should do them all, as long as the text size setting wont mess up any formatting anywhere, especcially on the hearth pages" (text size, a "?" on every screen, a Help page, better empty screens). Small wins: "5, 7 but maybe with just the Greeting widget at the top, 9 as long again as it doesnt mess with the formatting anywhere" (friendlier code entry, a starter Hearth, bigger tap targets). Not picked: 6 (a "Join my family" start), 8 (a "Keep it simple" switch), 10 (Undo instead of Are you sure). To protect layouts, text size skips the Hearth's tiles/widgets/Hollows, and tap targets only got bigger invisible touch areas.
- **2026-10-09 — Menus in open/close sections (CORE-074):** Josh: "add more organization within different menus, like decorating or editing widgets or the setting menu into drop downs, they are getting long and would be better if they were in categories that could close and open ... will let you be the perosn with the best design choice". Claude's design (proposed): each section is a card with an icon, a name and a summary of the current choice; the main section starts open (What it shows, How it looks, Wallpaper), the rest start closed; open/closed is remembered while the app is open.
- **2026-10-09 — Accessibility round (CORE-075):** Claude suggested seven things (contrast, moving tiles without dragging, screen-reader names on tiles, a vibration switch, Bold Text support, "Discard your changes?", an offline notice); Josh: "all of those please". Claude's calls (proposed): Ember's accent went a shade deeper and the greys in Hearth, Ember and Sage a shade darker; the offline note is honest that changes won't save until you're back (there's no offline queue).
- **2026-10-09 — Hearth text overhaul + watchable moves (CORE-076):** Josh: "could also use a good text overhaul for the heart, cause at the moment it takes up a whole square height ... not much customization I can do with the text apart from position and color, so I will let you decide". And: "the arrow buttons are within the edit modality and cant see it as it moves ... people will want to see the hearth page and follow the widget as it moves stuff around". Claude's design (proposed): half-row grid so text can be slim; text fonts (adds Caveat handwriting), bold, capitals and six decorations; a docked arrow bar on the Hearth with the moving tile glowing and the page scrolling to follow.
- **2026-10-09 — Fridge door (CORE-086):** Josh: "we should add a fridge widget that can connect to a burrow or household so that everyone can share a message that lasts a day or whatever before being deleted ... It can also go on the Home page which automatically connects to the home and when someone posts a message will show a little icon on the Home page tab ... and maybe in the inbox as well ... should fairly resemble a fridge". Asked who can take a note down (only the writer on a Burrow fridge, anyone in the Home on the Home fridge), Josh: "that sounds right to me". The look, doodles and the day / 3 days / week choices are Claude's, proposed.
- **2026-10-09 — Subscriptions Nook (SUB-001..012):** Josh: "lets do the subscription nook". Asked who sees them, he picked "Home, with Just me option"; from the parts offered he picked all eight: cancel-by reminders, totals, who pays and which card, a Hearth widget, categories, price history, a manage/cancel link and a paused/cancelled list. Claude's details (reminder defaults and who gets them, the category list, quick picks, how savings are counted, the widget's name) are proposed. → SUB-001..012, Q-028
- **2026-10-09 — Getaway Nook (TRIP-001..014):** Josh: "lets do the trip nook next, maybe a better name for it too". Offered Getaway, Suitcase, Wander or keeping Trip, he picked "Getaway Nook" (each trip is "a Getaway"). Who sees one: "The people going" (picked from your Home and Burrows). Parts: all four from the backlog (packing list, confirmations, itinerary, before-you-go checklist) and all four extras (countdown widget, reusable packing lists, shared costs, Sitter Sheet & Pet Care link). Claude's details (who can add or remove people, the ready-made lists and ideas, notices, how paybacks and kids' shares work, the countdown living in the Countdown widget) are proposed. → TRIP-001..014, Q-028
- **2026-10-09 — Sick Day Nook (SICK-001..014):** Josh: "lets do the sick day nook next, or something that fits ours naming". Offered Mending, Sick Day, Sniffles or Chicken Soup, he kept "Sick Day Nook". Who sees it: "Home, plus helpers". Parts: all eight offered (medicine cabinet, temperature chart, doctor summary, Hearth widget, dose-ready alert, Sitter Sheet link, illness history, missed days). Claude's details (one sick spell at a time per person, the database refusing too-soon doses with "Give it anyway", ingredients counting together, helper access ending the day after they're better, the notices and their defaults, what the sitter sees, kids in two Homes kept apart) are proposed. → SICK-001..014, Q-028, Q-032
- **2026-10-09 — Kids in a Home (HOME-007..011, MON-011):** Josh: "the thing missing in this app is the ability to create kid accounts ... to connect things like the sitter and sick and gift nook together is to tie a kids account to the parents, and if they get their own phone can share the code to move their account off the parents, exactly like the wishlist. But still a max of six per household, so even kids on parents accounts still count." Asked, he picked: one Home per kid; after the hand-off they stay in the Home; existing kids are asked about once ("Lives here"), and "if they aren't in the home then they won't get the subscription of Nook Plus or Pro"; "Add a kid" on the Home page and in the Gift Nook. One Home per kid also settles Q-032 (dose timers across two Homes): there's only ever one. Claude's details (the "Lives in your Home" switch, what moves at hand-off, kids moving with the grown-up who looks after them) are proposed. → HOME-007..011, MON-011, GIFT-021, SIT-006, Q-032
- **2026-10-09 — Gathering Nook (GATH-001..008):** Josh: "we need a way to more easily see and create gatherings, whether this is another nook or on burrows or something. But a place that lists out all gatherings, will take you to gift nook/pot luck if applicable, will be a choice created when creating a gathering. There should also be a way to select multiple burrows, or just specific people, filtered by burrows to keep it organized." Asked four questions, he picked: its own Nook; a Gathering's Potluck invites the same people as the Gathering (changes POT-002, which said a Potluck is for one Burrow); only its hosts change it; RSVPs on every Gathering.
- **2026-10-09 — Shopping for big Gatherings (GIFT-038..040):** Josh: "especially for like christmas ones, where it can be a big burrow and have to get a gift for everyone, if you got a gift for them and be able to filter by those that i havent claimed a gift for yet on that event ... sometimes its for a different event so want to better distinguish if i bought a gift for that particular event for each person or an option saying i am not getting them a gift so they dont keep showing up in the need to get a gift filtering." Built as asked; layout and the "count it for this Gathering" move are Claude's, proposed.
- **2026-10-09 — Free vs Nook Plus (MON-003, Q-028):** Claude proposed free forever for what a whole family joins (Gift Nook, Burrows, Gatherings, Hearth basics, inbox), one Nook Plus plan per Home for the Home-based Nooks and extra customization, about $3.99/month or $29.99/year with a 14–30 day trial. Josh: "I think keeping burrows free and home under plus would be good, and Nook Plus is fine with me". Decided: Burrows free, Home under Nook Plus, one tier called Nook Plus. Still proposed: the price, trial length, and exactly which Nooks sort where.
- **2026-10-09 — Basic customization free (MON-003):** Josh: "It should also be the very basic customization that is under free and even like create your own theme can be behind plus, I want users to use it if they dont want to pay but also incentivize them to upgrade for more stuff and make their stuff look cool". Decided: basic customization is free; extras such as your own themes are Plus. Which exact items is still proposed.
- **2026-10-10 — Sign-in emails go to everyone (Q-023, AUTH-001):** Josh chose `mynookapp.app` (over `nookapp.com.co`, which Claude advised against: looks like a typo, weaker email trust). Verified in Resend, set as Supabase's SMTP sender, and a test code reached a second address. The two code emails were redesigned to match the app (cream and bark, Dusk colors in dark mode, no emoji, one fluid column for any phone width).
- **2026-10-10 — Deleting your account (AUTH-003, Q-020):** Apple requires in-app deletion. Josh took the recommended answer to all four questions: a Burrow you started with others still in it is handed to another grown-up (deleted only if no one else is in it); gifts you'd tucked are freed up again; kids only you look after go with you, kids another grown-up in their Home can look after stay; and it deletes right away (no 14-day wait). Claude's details (type DELETE to confirm, a preview of exactly what goes, photos cleaned up first, tidy-up of empty Burrows and Homes) are proposed.
- **2026-10-11 — App ID changed (Q-025):** Josh: "should the id be something a little different since I dont really want my bday in it". The old ID `com.josh51201.nook` had his birthday in it, so both the iPhone and Android IDs are now `app.mynookapp.nook` (the email domain, backwards). The exact ID is Claude's pick (proposed); it must be final before the first build, because it can't change once the app is on a store.
- **2026-10-11 — App Store name:** plain "Nook" was already taken on the App Store (Barnes & Noble's NOOK app). Josh: "Went with Nook: Home & Life Hub", because Nook is "a personal custom organization app", not only a family app. The name under the icon on phones stays "Nook". Worth a short trademark check before a public launch.
- **2026-10-11 — Getting past Apple's review (AUTH-004):** Apple's reviewer can't receive an emailed code. Josh first asked why family can't just use the email code (they can; only the reviewer can't), then chose: "Sure we can do a hidden review" (over adding family as App Store Connect users). Claude's details (five taps on the title, a separate password sign-in, AUTH-002 left alone) are proposed.
- **2026-10-12 — Moving things on the Hearth (Q-033):** Josh found that moving one thing on a long page moved everything below it, and asked whether to stop things moving until room is made. Claude offered four parts. Josh: "yes do 1, 3, 4 first": no pushing on drop (open spot, same-size swap, or back home), Undo for moves and resizes, steadier snapping. Hold-to-push (part 2) comes later. Josh doesn't pick things up by accident, so the hold before a pickup stays as it is. He asked for a wider look too: "things getting stuck in each other" turned out to be a tile left drawn where it was dropped when the drop didn't land, and "picked up when I scroll" was the corner resize handles. Both fixed. → CORE-091, CORE-092
- **2026-10-12 — UX round before new Nooks:** Asked for UX improvements before adding more. Claude offered nine. Josh: "lets do 3, 4, 5 first, then secondly I would like to do 6 (includign one for like christmas cause some people might get the app for the gift and gathering stuff), and then 8." Not picked for now: friendlier error messages, Undo instead of delete confirmations, choosing the app icon, phone home-screen widgets. → CORE-092, CORE-094..097
- **2026-10-12 — Little Log and Notes (Q-034):** Josh asked for Little Log, plus notes "like the ios note app", either inside it or as a separate Nook. Claude suggested two Nooks, with logs and notes private by default and shareable with the Home. Josh: "two nooks are fine, and I agree to the number 2 assumptions". Little Log first, then Notes. → LOG-001..010, NOTE-001..010
- **2026-10-12 — Menu Board and Grocery List Nooks:** Josh: "i wanted a nook for meal planning ... kinda like the mats you can erase and write on and put on the fridge ... the house all shares the weekly menu or if its a your on your own thing", with recipes from the Recipe Box, plus "a grocery shopping list type of nook that connects all three", adding from recipes, at will, and from the Potluck ("probably like the week of ... up to you"). He picked the names Menu Board Nook and Grocery List Nook, "several lists but can choose whether to share them", and Potluck shopping that "Waits until the week of". → MENU-001..010, GROC-001..009
- **2026-10-12 — Nudges (CORE-101):** Josh: "i would like a way added to ping someone to add more to their christmas list or ping someone to rsvp etc. Places where someone would need to send a reminder or ping someone for something would be nice". Claude built a one-tap Nudge for Wishbooks, Gathering RSVPs, Potluck dishes, Getaway tasks and Rhythms, with set wording (no typed message), host-only for RSVPs and dishes, once a day, and an off switch. All proposed until Josh tries it.
