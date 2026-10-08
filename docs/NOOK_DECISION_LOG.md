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
