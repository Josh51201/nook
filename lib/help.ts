import type { IconName } from "../components/icon";
import { findNook } from "./nooks";

// The "?" help on every screen (CORE-069): one or two plain sentences about
// the screen you're on, and the Help page's answers (CORE-070). Pure (no
// React), so it's unit-testable; components/help-button.tsx shows it.

export type HelpTopic = { title: string; body: string };

// Screens we have something specific to say about, keyed by the first part
// of their path (or the first two, for the Gift Nook's pages). Anything else
// falls back to a line about its Nook (from the Nook catalog) or a general one.
const screens: Record<string, HelpTopic> = {
  hearth: {
    title: "Your Hearth",
    body: "This is home. Tap a tile to open a Nook. Tap Edit (or hold a tile) to move things around, and the bell is your inbox. This help is under Edit too.",
  },
  nooks: {
    title: "Nooks",
    body: "Every Nook is here. Tap one to open it — it doesn't need to be on your Hearth — or search for one by name. Tap + on a Nook to put it on your Hearth. A dot on this tab means one has news for you.",
  },
  burrows: {
    title: "Burrows",
    body: "A Burrow is your family or group. Start one, or type a code from family to join theirs. Every Nook that shares uses these same Burrows.",
  },
  settings: {
    title: "Settings",
    body: "Your profile, how the app looks (theme, text size, font) and your account. You can also replay the little tour from here.",
  },
  inbox: {
    title: "Inbox",
    body: "News from all your Nooks, newest first. Tap one to go to it. Swipe a notice sideways to mark it read or remove it.",
  },
  market: {
    title: "The Market",
    body: "Nooks are sorted into a few groups, with a search box. Tap one to see what it does, and Add to put it on your Hearth as a tile. Taking one off the Hearth never deletes what's inside it.",
  },
  fridge: {
    title: "The fridge",
    body: "Notes and doodles your Home or Burrow stuck up for each other. Tap one to see who left it; each comes down by itself after a day or so.",
  },
  "fridge-note": {
    title: "Stick something up",
    body: "Write on a sticky note or doodle with your finger, pick the paper and how long it stays up. Everyone who shares this fridge gets a little notice.",
  },
  home: {
    title: "Your Home",
    body: "The people you live with. Nooks for the house — cards, pets, chores — share with your Home instead of your whole family.",
  },
  profile: {
    title: "Your profile",
    body: "What your family sees of you: your name, picture (a photo, or an icon on a color) and birthday. Add your birthday and your Burrows get a Birthday Gathering for you.",
  },
  "theme-editor": {
    title: "Make a theme",
    body: "Pick a background and an accent color and the rest is chosen to match. Save it and it's yours to switch to any time.",
  },
  "theme-seasons": {
    title: "Seasonal themes",
    body: "Choose a different theme for each season and Nook will change by itself as the year goes round.",
  },
  widget: {
    title: "Widgets",
    body: "A widget is a little extra on your Hearth — a countdown, a note, reminders. Change how it looks and what it shows here.",
  },
  burrow: {
    title: "A Burrow",
    body: "See who's in this Burrow and invite more people by sending them a Knock (a short code). Admins can manage the group.",
  },
  hollow: {
    title: "A Hollow",
    body: "A Hollow is a little house on your Hearth that holds its own tiles, to keep things tidy. Tap Edit to arrange what's inside.",
  },
  help: {
    title: "Help",
    body: "Answers to common questions. Tap one to open it. You can also replay the little tour from here.",
  },
  "gift-nook/wishbook": {
    title: "My Wishbook",
    body: "Your own wish list for family to see. Add things you'd like. When someone tucks one (says they'll get it), you're never told, so it stays a surprise.",
  },
  "gift-nook/my-tucks": {
    title: "Your tucks",
    body: "The gifts you've tucked away for other people, so nobody doubles up. Only you and the rest of the family can see these — never the person they're for.",
  },
  "gift-nook/stash": {
    title: "Idea Stash",
    body: "A private place to jot down gift ideas for anyone, any time. Nobody else can see it.",
  },
  "gift-nook/gathering": {
    title: "A Gathering's gift lists",
    body: "See whose Wishbooks are part of it and tuck gifts for the people you're buying for. Who's coming is in the Gathering Nook.",
  },
  "gatherings/form": {
    title: "Plan a Gathering",
    body: "Pick who's invited — whole Burrows, or people one by one — and whether it has gift lists or a Potluck. You're a host, and you can add co-hosts.",
  },
  "gift-nook/member": {
    title: "Someone's Wishbook",
    body: "Their wish list. Tap \"Tuck it away\" on a gift to say you'll get it, so nobody else buys it too. They'll never see that it's been tucked.",
  },
};

const general: HelpTopic = {
  title: "Need a hand?",
  body: "Tap any tile or card to open it, and the arrow at the top left to go back. The Help page has answers to common questions.",
};

function segments(pathname: string) {
  return pathname.split("?")[0].split("/").filter(Boolean);
}

// The help for a screen, from its path (as `usePathname()` gives it).
export function helpFor(pathname: string): HelpTopic {
  const [first, second] = segments(pathname);
  if (!first) return screens.hearth;
  // Most specific first: "gift-nook/wishbook", then "gift-nook"'s own line,
  // then the Nook's description.
  const specific = second ? screens[`${first}/${second}`] : undefined;
  if (specific) return specific;
  if (screens[first]) return screens[first];
  const nook = findNook(first);
  if (nook) return { title: nook.title, body: nook.description };
  return general;
}

// The Help page (CORE-070, CORE-102): a start for new people, the words the
// app uses, then a few plain questions for each part of the app and each
// Nook. Every answer should make sense to someone who has never opened Nook,
// so a Nook word (Tuck, Burrow…) is either explained in the answer or in
// `helpWords`.

export type HelpAnswer = { question: string; answer: string };

export type HelpSection = {
  id: string;
  title: string;
  icon: IconName;
  // One line under the title: what this part is for.
  blurb: string;
  // The Nook it's about (its id in lib/nooks.ts), so a Nook's "?" can open
  // Help on its own section.
  nook?: string;
  answers: HelpAnswer[];
};

// The words Nook uses, for "Words you'll see".
export const helpWords: { word: string; icon: IconName; meaning: string }[] = [
  { word: "Nook", icon: "nooks", meaning: "A little app inside Nook, like the Gift Nook or the Pet Care Nook. Use as many or as few as you like." },
  { word: "Hearth", icon: "hearth", meaning: "Your home screen. You arrange it with tiles for your favorite Nooks, plus widgets and decorations." },
  { word: "Burrow", icon: "burrow", meaning: "Your family or group, like \"The Smiths\" or \"Book club\". Every Nook that shares with people uses the same Burrows." },
  { word: "Knock", icon: "invite", meaning: "An invite to a Burrow: a short code you send someone so they can join." },
  { word: "Home", icon: "door", meaning: "Just the people you live with (up to 6, kids included). House things like pets, chores and the menu are shared with your Home, not your whole family." },
  { word: "Gathering", icon: "celebration", meaning: "Any get-together: Christmas, a birthday, a game night. It can have gift lists and a Potluck." },
  { word: "Wishbook", icon: "wishbook", meaning: "Your wish list in the Gift Nook. Your Burrows can see it." },
  { word: "Tuck", icon: "tucks", meaning: "Saying \"I'll get this\" about a gift on someone's Wishbook, so nobody else buys it. The person it's for never finds out." },
  { word: "Idea Stash", icon: "suggest", meaning: "Private notes about gift ideas for anyone. Only you can see them." },
  { word: "Nudge", icon: "nudge", meaning: "A friendly reminder you send someone, like \"are you coming?\" It lands in their inbox." },
  { word: "Hollow", icon: "burrow", meaning: "A little house on your Hearth that holds its own tiles, to keep things tidy." },
  { word: "The Market", icon: "market", meaning: "Where you browse every Nook and add the ones you want to your Hearth." },
];

export const helpSections: HelpSection[] = [
  {
    id: "start",
    title: "New here? Start here",
    icon: "sparkles",
    blurb: "What Nook is and the first few things to do.",
    answers: [
      {
        question: "What is Nook?",
        answer:
          "One app with lots of little apps inside it, called Nooks: family wish lists, planning get-togethers, a pet feeding chart, a grocery list and more. You sign in once and your family joins once, and every Nook can use the same people.",
      },
      {
        question: "What should I do first?",
        answer:
          "1. Fill in your profile: your name and a picture, and your birthday if you like. 2. Join your family: ask them for a Knock code and type it in the Burrows tab, or start a Burrow and send them one. 3. Open the Nooks tab and try a Nook. The Gift Nook is a good start. Everything else can wait.",
      },
      {
        question: "What are the tabs along the bottom?",
        answer:
          "Hearth is your home screen. Nooks lists every Nook, one tap to open. Burrows is your family and groups (and your Home). Settings has your profile, how the app looks, notifications and your account.",
      },
      {
        question: "Do I have to put a Nook on my Hearth to use it?",
        answer:
          "No. Every Nook opens from the Nooks tab. Putting one on your Hearth just gives it a tile there, so it's one tap from home. Taking it off never deletes anything inside it.",
      },
      {
        question: "Someone invited me to something. Where is it?",
        answer:
          "Open the Nooks tab: anything waiting for you is at the top, under \"Waiting for you\". The bell on your Hearth is your inbox, with every notice from every Nook.",
      },
      {
        question: "I didn't get my sign-in code",
        answer:
          "Give it a minute, then check your spam or junk folder. Make sure the email address is spelled right. You can go back and try again, or tap Send a new code. The code only works for a short while, so use the newest one.",
      },
    ],
  },
  {
    id: "people",
    title: "Family, Burrows & your Home",
    icon: "group",
    blurb: "Who you share with, and how to bring people in.",
    answers: [
      {
        question: "What's the difference between a Burrow and a Home?",
        answer:
          "A Burrow is a family or group: your side of the family, your in-laws, a friend group. You can be in as many as you like. Your Home is just the people you live with, and you're in one at a time. Family things (Wishbooks, Gatherings, recipes) are shared with your Burrows. House things (pets, chores, the menu, subscriptions) are shared with your Home.",
      },
      {
        question: "How do I join my family?",
        answer:
          "Ask someone in the family to send you a Knock: a short code. Open the Burrows tab, type it in the \"Got a code?\" box and tap Use code. Their Gatherings and Wishbooks show up straight away.",
      },
      {
        question: "How do I invite someone?",
        answer:
          "Open the Burrows tab, tap the Burrow, then Send a Knock (invite). Text them the code. Anyone in a Burrow can invite, not just whoever started it.",
      },
      {
        question: "How do I share a Home with someone I live with?",
        answer:
          "They need to be in one of your Burrows first. Then open the Burrows tab, tap Your Home and invite them. Once they say yes, you share Home things like pets, chores and the Menu Board. A Home holds up to 6 people, kids included.",
      },
      {
        question: "How do I add my kids?",
        answer:
          "Open the Burrows tab, tap Your Home, then Add a kid. Kids don't need a phone or an email: you look after their profile and Wishbook, answer invites for them, and can add another grown-up to help. When they're older and get their own phone, a hand-off code moves everything onto their own account.",
      },
      {
        question: "Who can see my profile?",
        answer:
          "Only people who share a Burrow with you: your name, picture, birthday and \"about me\", plus your allergies and address if you add them. You can leave your address out of a Burrow you choose, like a work one.",
      },
    ],
  },
  {
    id: "hearth",
    title: "Your Hearth",
    icon: "hearth",
    blurb: "Arranging and decorating your home screen.",
    answers: [
      {
        question: "How do I move things around on my Hearth?",
        answer:
          "Tap Edit at the top of the Hearth, or hold your finger on any tile (holding a Hollow peeks inside first; just keep your finger moving to pick it up). Then drag it to an open spot, or onto something the same size to swap the two (the outline shows what will happen, and nothing else gets pushed around). Want it somewhere that's full? Hold still there for a moment and the things below slide down to make room. Hold a corner, then pull, to resize it. Changed your mind? Undo and Redo are on the bar along the bottom while you edit. Dragging fiddly? Tap the tile while editing, open \"Size & place\" and tap \"Move it with arrows\". Tap Done when you're finished.",
      },
      {
        question: "How do I add a widget or a decoration?",
        answer:
          "Tap Edit, then Add on the bar at the bottom. Widgets show something live, like a countdown, today's menu or what's left on your grocery list. Decorate has little drawings to dress up your Hearth.",
      },
      {
        question: "What are the little red dots on my Hearth?",
        answer:
          "A dot means something in it is new: a notice from that Nook you haven't read yet, or a note on a Fridge door. A Hollow gets a dot when anything inside it has one, and so does a page's name at the top. The dots go away once you've read those notices (in the Nook, or in your inbox).",
      },
      {
        question: "Can I see inside a Hollow without going in?",
        answer:
          "Yes. Hold your finger on the Hollow for a moment and a card shows what's inside, with anything new. Tap \"Go in\" to step inside, or tap outside the card to close it.",
      },
      {
        question: "Why did my widget stack turn by itself?",
        answer:
          "A stack turns to whichever of its widgets has something new for you, like a dose that's OK again or a chore that's overdue, then goes back to the one you picked once you've seen it. Swipe it back yourself any time. Don't want it to? Tap Edit, tap the stack, open \"Copy & stack\" and turn off \"Flip to what needs you\".",
      },
      {
        question: "Can I make a widget look like chalkboard, wood or paper?",
        answer:
          "Yes. Tap Edit, tap the widget, and open \"How it looks\". Some widgets have more than one Design: a countdown can be a tear-off pad, a flip clock or a paper chain, and a quote an embroidery hoop. In Simple, pick what it's made of (paper, kraft, notebook, chalkboard, wood, cork, felt, glass and more), its color, what it's hung up with (tape, a pin, a magnet, a nail and twine…) and a little tilt. \"Surprise me\" tries a new combination each tap, and \"Natural look\" puts it back how it started. \"A little extra\" adds a sticker, a daisy, holly, a bow or a cup of cocoa. More has its lettering, a print, its edges (torn, scalloped, stitched, stamp, ticket, wavy), corners, shadow and border.",
      },
      {
        question: "Can I make all my widgets match at once?",
        answer:
          "Yes. Tap Edit, then Decorate, and open \"Widget looks\". Pick a look pack, like Farmhouse kitchen, Scrapbook or Cabin, and every widget on that page gets a look that goes together. They keep their colors. Tap Undo on the message at the bottom if you'd rather not, or pick \"Plain cards\" to go back to simple cards.",
      },
      {
        question: "Can I make several tiles look the same?",
        answer:
          "Yes. Tap Edit, then tap the tile, widget or text whose look you like and choose \"Copy this look\". Now tap anything else on your Hearth to give it the same color, corners, shadow and style. Widgets also pass on what they're made of, their edges, hanger and tilt to other widgets. Tap Done on the bar at the bottom when you're finished.",
      },
      {
        question: "How do I copy someone's Hearth, or share mine?",
        answer:
          "On your Hearth, tap Edit, then Share. \"Share mine\" makes a 6-letter code for your theme or your whole Hearth to text to family. \"Use a code\" is where you type one they sent you. A whole Hearth is added to your Scenes, so your own is kept and you can switch back.",
      },
      {
        question: "How do I change how the app looks?",
        answer:
          "Open the Settings tab. There you can choose a theme, make your own, change the font and the text size, and even have the theme change with the seasons.",
      },
      {
        question: "How do I make the text bigger?",
        answer:
          "Open the Settings tab and find Text size. Choose Large or Extra large. (Tiles on your Hearth keep their size so your layout stays as you arranged it. You can make a tile bigger from Edit.)",
      },
    ],
  },
  {
    id: "notices",
    title: "Notices & nudges",
    icon: "bell",
    blurb: "Your inbox, choosing what you hear about, and reminding people.",
    answers: [
      {
        question: "Where do notices show up?",
        answer:
          "In your inbox: the bell on your Hearth, and the bell inside each Nook for just that Nook. A dot on the Nooks tab means something's waiting. Phone notifications (the kind that buzz when the app is closed) are on the way; for now, check in now and then.",
      },
      {
        question: "How do I choose what I'm told about?",
        answer:
          "Settings → Notifications lists every notice from every Nook, each with its own switch. Each Nook's own settings (the gear inside it) has the same switches.",
      },
      {
        question: "How do I remind someone about something?",
        answer:
          "Look for the Nudge button (a little waving hand). On someone's Wishbook you can ask them for more ideas. If you're hosting a Gathering, you can nudge anyone who hasn't said if they're coming, and on a Potluck, anyone coming who hasn't picked a dish. On a Getaway task or a Rhythm that's someone else's, you can remind them. You can add a short note. It lands in their inbox, and you can nudge each person once a day.",
      },
      {
        question: "Can I stop getting nudges?",
        answer: "Yes: Settings → Notifications → Nudges. Whoever sends one is never told you've turned them off.",
      },
    ],
  },
  {
    id: "gift-nook",
    nook: "gift-nook",
    title: "Gift Nook",
    icon: "gift",
    blurb: "Family wish lists, where nobody doubles up and the surprise is kept.",
    answers: [
      {
        question: "How does the Gift Nook work?",
        answer:
          "Everyone keeps a wish list, called a Wishbook, that their Burrows can see. When you decide to get someone a gift from theirs, you tap \"Tuck it away — I'll get this\". Everyone else then sees it's taken, so nobody buys the same thing. The person it's for never sees any of this, so it stays a surprise.",
      },
      {
        question: "How do I add a gift to my Wishbook?",
        answer:
          "Open the Gift Nook, tap My Wishbook, then Add a gift. Give it a name, and add a link, a price, sizes or a note if you like. Pasting a shop link can fill in the name and picture for you. Mark the ones you want most with a heart and they show first.",
      },
      {
        question: "Why can't I see who's getting me what?",
        answer:
          "That's on purpose! When family tuck a gift from your Wishbook (that's how they say \"I'll get this\"), you're never told: not in the app, in notices or in counts. Your Wishbook looks exactly the same either way, so the surprise stays a surprise. Everyone else in your Burrows can see what's been tucked, so nobody buys the same thing twice.",
      },
      {
        question: "How do I tuck a gift for someone?",
        answer:
          "Open their Wishbook (from a Gathering, or from your Burrow) and tap \"Tuck it away — I'll get this\" on the gift. You can mark it bought later, add a note for the other givers (\"got the blue one\"), or release it if you change your mind. \"Your tucks\" lists everything you're getting.",
      },
      {
        question: "Can I suggest a gift for someone?",
        answer:
          "Yes. On their Wishbook, tap Suggest a gift. Everyone else sees it and can tuck it, but the person it's for doesn't. For ideas you want to keep to yourself, use \"My private ideas\" (your Idea Stash), which only you can ever see.",
      },
      {
        question: "Can I see the list for just one occasion?",
        answer:
          "Yes. Open the Gathering (like Christmas) and tap Gift lists. You'll see only what each person picked for it, plus \"Your shopping\": who you've got a gift for and who you still need one for. Not getting someone a gift this time? Say so on their Wishbook and they move out of \"Still need\" (only you see that).",
      },
      {
        question: "How do kids' Wishbooks work?",
        answer:
          "A parent makes a Wishbook for a kid (Make a Wishbook for a kid in the Gift Nook, or Add a kid on your Home page) and adds the gifts. Because the kid isn't the one looking, their grown-ups can see what's been tucked, to help coordinate. Once the kid takes the list over on their own phone, they see nothing, like anyone else.",
      },
      {
        question: "What happens after the day?",
        answer:
          "After a Gathering ends, you're asked which gifts you received, and you tick them off yourself. Nothing tells you who gave what. Received gifts leave your Wishbook, and the Letterbox Nook can list the thank-you notes to write.",
      },
    ],
  },
  {
    id: "gatherings",
    nook: "gatherings",
    title: "Gathering Nook",
    icon: "celebration",
    blurb: "Every get-together you're invited to, and planning your own.",
    answers: [
      {
        question: "How do I plan a birthday or a game night?",
        answer:
          "Open the Gathering Nook and tap Plan a Gathering. Pick the day, who's invited (whole Burrows, or just a few people), and switch on gift lists or a Potluck if it needs them. You're the host, and you can add co-hosts.",
      },
      {
        question: "How do I say if I'm coming?",
        answer:
          "Open the Gathering and pick Going, Maybe or Can't make it under \"Are you coming?\". Bringing others? Add them so the host knows how many. You answer for kids you look after too.",
      },
      {
        question: "Why is there a Gathering I didn't make?",
        answer:
          "Every Burrow gets a Birthday Gathering for each person who's added their birthday to their profile, a month ahead. Anyone invited can change it, and an admin of the Burrow can delete it.",
      },
      {
        question: "Who can change a Gathering?",
        answer:
          "Its hosts: whoever planned it and any co-hosts they added. Everyone else can see it and answer. Hosts can also nudge people who haven't answered yet.",
      },
      {
        question: "Can I put a Gathering on my Hearth?",
        answer:
          "Yes. Open it and tap \"Put it on my Hearth\" at the top. You get a widget with the day, who's coming, your gift shopping and the Potluck all in one.",
      },
    ],
  },
  {
    id: "potluck",
    nook: "potluck",
    title: "Potluck Nook",
    icon: "potluck",
    blurb: "Who's bringing what to eat.",
    answers: [
      {
        question: "How do I sign up to bring something?",
        answer:
          "Open the Potluck. Under \"What's needed\", tap \"I'll bring this\" on what the host asked for, or tap Add a dish for anything else. Tag what's in it (nuts, dairy…) so anyone with an allergy is looked after.",
      },
      {
        question: "What are the warnings on a dish?",
        answer:
          "If a dish's tags clash with the allergy or diet of someone coming, the Potluck says so and names them (\"Contains peanuts: Mia has a peanut allergy\"). People add their allergies and diets on their profile.",
      },
      {
        question: "How do I start a Potluck?",
        answer:
          "Every Potluck belongs to a Gathering, so its guests are the Gathering's guests. When you plan a Gathering, switch on the Potluck, or open one you host and tap Add a Potluck. Then list what's needed, like 2 sides and a dessert.",
      },
      {
        question: "Can I put my dish's shopping on a grocery list?",
        answer:
          "Yes. Once you've picked a dish, tap \"Shopping for your dish\". What you need waits on your grocery list and joins it the week of the Potluck.",
      },
    ],
  },
  {
    id: "letterbox",
    nook: "letterbox",
    title: "Letterbox Nook",
    icon: "mail",
    blurb: "Your Home's card list and address book.",
    answers: [
      {
        question: "What's the Letterbox for?",
        answer:
          "Holiday cards and addresses. It remembers who you sent cards to and who sent you one each year, keeps everyone's address, reminds you of birthdays, and makes mailing labels. Your Home shares one Letterbox.",
      },
      {
        question: "Where do the addresses come from?",
        answer:
          "Family who add an address to their profile show up by themselves and stay up to date when they move. For anyone else (friends, neighbors) you type the address in.",
      },
      {
        question: "What are the thank-you notes?",
        answer:
          "After you tick off gifts you received in the Gift Nook, the Letterbox lists the thank-you notes still to write. You say who each gift was from, because the app never knows who gave what.",
      },
    ],
  },
  {
    id: "getaways",
    nook: "getaways",
    title: "Getaway Nook",
    icon: "plane",
    blurb: "Trips, planned with the people going.",
    answers: [
      {
        question: "Who can see a Getaway?",
        answer: "Only the people going. Whoever starts it picks them from their Home and Burrows, and anyone going can bring more people.",
      },
      {
        question: "What can I keep in a Getaway?",
        answer:
          "Packing lists (one each, plus a shared one), flight and hotel confirmations, a day-by-day plan, a before-you-go checklist with reminders, and who paid for what, with who owes whom at the end.",
      },
      {
        question: "Can someone look after the house or pets while we're away?",
        answer:
          "Yes. From the Getaway you can make a Sitter Sheet link for those dates in one tap, and let a sitter help in Pet Care until you're back.",
      },
    ],
  },
  {
    id: "pets",
    nook: "pets",
    title: "Pet Care Nook",
    icon: "paw",
    blurb: "Feeding, walks and vet visits, shared with your Home.",
    answers: [
      {
        question: "How does feeding work?",
        answer:
          "Set each pet's meals, like Breakfast and Dinner. Whoever feeds them taps it, and everyone sees it's done (and who did it), so nobody feeds twice. It starts fresh every day. Give a meal a time and your Home hears about it if it hasn't been fed by then.",
      },
      {
        question: "Can a pet sitter or grandparent help?",
        answer:
          "Yes. Add them as a helper on the pet (they need to be in one of your Burrows). They see just that pet and can check off meals and walks, for as long as you choose.",
      },
      {
        question: "Does it remind me about the vet?",
        answer: "Yes. Add vet visits, vaccines and medicines with their due dates, and you get a heads-up a week before each one.",
      },
    ],
  },
  {
    id: "sickday",
    nook: "sickday",
    title: "Sick Day Nook",
    icon: "sick",
    blurb: "Temperatures and medicine when someone's poorly.",
    answers: [
      {
        question: "How does the next-dose timer work?",
        answer:
          "Save each medicine once in the medicine cabinet, with the dose and the hours between doses from the label or your doctor. When you give a dose, a timer shows when the next one is OK, for everyone in your Home, so two people can't double up.",
      },
      {
        question: "What can I show the doctor?",
        answer:
          "Open the sick spell and tap the doctor summary: when it started, temperatures, symptoms and every dose, ready to read out or share.",
      },
      {
        question: "Can Grandma help while she's watching them?",
        answer: "Yes. Add her as a helper on that sick spell. She can log temperatures and doses until the day you pick, or until they're better.",
      },
    ],
  },
  {
    id: "little-log",
    nook: "little-log",
    title: "Little Log",
    icon: "chart",
    blurb: "Keep track of anything over time, as a chart.",
    answers: [
      {
        question: "What can I log?",
        answer:
          "Anything with a date: your weight, blood pressure, mood, sleep, the car's mileage, a kid's height. Start from a ready-made one or make your own, then tap + to log in a couple of taps. A daily reminder can keep you at it.",
      },
      {
        question: "Can my family see what I log in Little Log?",
        answer:
          "Not unless you share it. Every log starts as just yours. To share one, open it, tap the pencil and pick \"Everyone in my Home\". The people you live with can then see it and add to it (handy for a kid's height), but only you can change or remove the log itself.",
      },
    ],
  },
  {
    id: "rhythms",
    nook: "rhythms",
    title: "Rhythms Nook",
    icon: "rhythm",
    blurb: "The chores that come round each season or year.",
    answers: [
      {
        question: "What's a rhythm?",
        answer:
          "A chore that comes round again: the furnace filter, smoke alarm batteries, gutters, a flu shot. Give it a due date and how often it repeats. When it's done, tap Done today and the next date is worked out for you.",
      },
      {
        question: "Whose job is it?",
        answer:
          "Anyone's, unless you give it to one person in your Home. Anyone can still mark it done, and the log shows who did it last. If it's someone else's, you can tap Remind to nudge them.",
      },
    ],
  },
  {
    id: "sitter",
    nook: "sitter",
    title: "Sitter Sheet Nook",
    icon: "sitter",
    blurb: "One page for babysitters, without them needing the app.",
    answers: [
      {
        question: "How does the sitter see it?",
        answer:
          "Fill in your sheet (bedtime, house rules, emergency numbers), then make a link for a stay and text it to them. It opens in their phone's web browser, no app needed, and stops working when the stay ends. You can turn it off early.",
      },
      {
        question: "What does the sitter see?",
        answer:
          "Only what you tick for that link. Kids' allergies, pets' meals and door codes are all off unless you tick them. You can preview exactly what they'll see before you send it.",
      },
    ],
  },
  {
    id: "subscriptions",
    nook: "subscriptions",
    title: "Subscriptions Nook",
    icon: "card",
    blurb: "Every recurring charge, and a reminder before it renews.",
    answers: [
      {
        question: "What does it remind me about?",
        answer:
          "A few days before something renews, and before a free trial ends, so there's time to cancel. You pick how many days ahead for each one.",
      },
      {
        question: "Who can see our subscriptions?",
        answer:
          "Your Home shares them, so you can see the whole household's total. Mark any one \"Just me\" and nobody else sees it. Only the card's name and last 4 digits are kept, never the full number.",
      },
    ],
  },
  {
    id: "notes",
    nook: "notes",
    title: "Notes Nook",
    icon: "note",
    blurb: "Notes and checklists, like your phone's Notes app.",
    answers: [
      {
        question: "How do I write a note?",
        answer:
          "Start a new note and type. The first line is the title, and it saves as you go, so there's no Save button. Tap Checklist to add tick boxes.",
      },
      {
        question: "Who can see my notes?",
        answer:
          "Just you, unless you share one. Open the note, tap Done if you're writing, and pick \"Share with my Home\" under it. The people you live with can then read it and change the words (handy for a packing list everyone ticks off). Only you can pin it, put it in a folder, stop sharing it or delete it.",
      },
    ],
  },
  {
    id: "recipes",
    nook: "recipes",
    title: "Recipe Box Nook",
    icon: "recipe",
    blurb: "The family cookbook.",
    answers: [
      {
        question: "How do I add a recipe?",
        answer:
          "Type it in, or paste a link from a cooking website (or a TikTok) and it fills itself in. Put it on Shelves like Dinners or Holidays to find it again.",
      },
      {
        question: "Who can see my recipes?",
        answer:
          "Family in your Burrows can see them and save a copy into their own box. Set a recipe to \"Just me\" to keep it to yourself. Only you can change your own recipes.",
      },
      {
        question: "What's cook mode?",
        answer:
          "Big text, the screen stays on, and you tick off ingredients and steps as you go. A step that says \"bake 25 minutes\" gets a timer you can start with a tap.",
      },
    ],
  },
  {
    id: "menu-board",
    nook: "menu-board",
    title: "Menu Board Nook",
    icon: "menuBoard",
    blurb: "The week's meals for your Home.",
    answers: [
      {
        question: "Who can see the Menu Board?",
        answer:
          "Everyone in your Home sees the same menu and can change it, like the menu mat on a fridge. Nobody outside your Home sees it. Which meals show and which day your week starts are just your own settings.",
      },
      {
        question: "Can it make my shopping list?",
        answer: "Yes. Pick meals from the Recipe Box, then tap \"Shop for this week\" to tick what you need and put it on a grocery list.",
      },
    ],
  },
  {
    id: "groceries",
    nook: "groceries",
    title: "Grocery List Nook",
    icon: "cart",
    blurb: "Lists for every store, shared with your Home if you like.",
    answers: [
      {
        question: "Who can see my grocery lists?",
        answer:
          "A list is just yours unless you share it with your Home (new lists start shared; change it with the gear on the list). The people you live with can add to a shared list, tick things off and take things off. Only you can rename it, stop sharing it or delete it.",
      },
      {
        question: "How do I shop with it?",
        answer:
          "Things are sorted by aisle. Tap one to put it in the cart, and Clear the cart when you're done. If two of you shop from a shared list, you see each other's ticks as they happen.",
      },
    ],
  },
  {
    id: "account",
    title: "Your account",
    icon: "person",
    blurb: "Signing in, your profile and leaving.",
    answers: [
      {
        question: "How do I sign in on a new phone?",
        answer:
          "Type your email address and you'll get a code. There's no password to remember. Everything you've made is kept on your account, so it's all there on the new phone.",
      },
      {
        question: "How do I change my name or picture?",
        answer: "Settings → Your profile. You can use a photo, or an icon on a color.",
      },
      {
        question: "How do I delete my account?",
        answer:
          "Settings → Delete account. It's gone right away. Burrows you started keep going if others are in them, and gifts you'd tucked become free for someone else (with no notice to the person they were for).",
      },
    ],
  },
];

// Every answer, for search.
export const helpAnswers: (HelpAnswer & { section: string })[] = helpSections.flatMap((s) =>
  s.answers.map((a) => ({ ...a, section: s.id }))
);

// Answers with every word typed in them, ones whose question matches first.
export function searchHelp(query: string) {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const has = (text: string) => words.every((word) => text.toLowerCase().includes(word));
  const found = helpAnswers.filter((a) => has(`${a.question} ${a.answer}`));
  return [...found.filter((a) => has(a.question)), ...found.filter((a) => !has(a.question))];
}

// The section for the screen a "?" was tapped on: that Nook's, or the
// Hearth's, the people's or the inbox's. Null anywhere else.
export function helpSectionFor(pathname: string): string | null {
  const [first] = segments(pathname);
  if (!first || ["hearth", "hollow", "widget", "market", "fridge", "fridge-note"].includes(first)) return "hearth";
  if (["burrows", "burrow", "home", "profile"].includes(first)) return "people";
  if (["inbox", "notifications"].includes(first)) return "notices";
  return helpSections.some((s) => s.nook === first) ? first : null;
}
