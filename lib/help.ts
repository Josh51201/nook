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
    body: "Your own wish list for family to see. Add things you'd like — you'll never see who tucks (claims) them, so it stays a surprise.",
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
    body: "Their wish list. Tap a gift to tuck it so others know it's taken. They won't ever see that it's been tucked.",
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

// Questions people actually ask, for the Help page (CORE-070).
export type HelpAnswer = { question: string; answer: string };

export const helpAnswers: HelpAnswer[] = [
  {
    question: "Where do I plan a birthday or a game night?",
    answer:
      "In the Gathering Nook. Tap Plan a Gathering, pick who's invited (whole Burrows, or just a few people) and switch on gift lists or a Potluck if it needs them. Everyone invited can say if they're coming.",
  },
  {
    question: "How do I join my family?",
    answer:
      "Ask them to send you a Knock — a short 6-letter code. Open the Burrows tab, type the code in the “Got a code?” box and tap Use code. Their Gatherings and Wishbooks show up straight away.",
  },
  {
    question: "I didn't get my sign-in code",
    answer:
      "Give it a minute, then check your spam or junk folder. Make sure the email address is spelled right — you can go back and try again, or tap Send a new code. The code only works for a short while, so use the newest one.",
  },
  {
    question: "Where did my Nook go?",
    answer:
      "Every Nook lives in the Nooks tab at the bottom, even if it isn't on your Hearth. To put it on your Hearth, tap the + on its icon. Taking a Nook off your Hearth never deletes anything inside it.",
  },
  {
    question: "How do I add a gift to my Wishbook?",
    answer:
      "Open the Gift Nook, tap My Wishbook, then add a gift. Give it a name, and add a link, a price or a note if you like. Your family can then see it and tuck it.",
  },
  {
    question: "Why can't I see who bought mine?",
    answer:
      "That's on purpose! When someone tucks (claims) a gift from your list, you're never told — not in the app, in notices or in counts — so the surprise stays a surprise. Everyone else in your Burrow can see what's been tucked, so nobody buys the same thing.",
  },
  {
    question: "How do I make the text bigger?",
    answer:
      "Open the Settings tab and find Text size. Choose Large or Extra large. (Tiles on your Hearth keep their size so your layout stays as you arranged it — you can make a tile bigger from Edit.)",
  },
  {
    question: "Can I make several tiles look the same?",
    answer:
      "Yes. Tap Edit, then tap the tile, widget or text whose look you like and choose “Copy this look”. Now tap anything else on your Hearth to give it the same color, corners, shadow and style (text gets the same lettering). Tap Done on the bar at the bottom when you're finished. Changed your mind? Undo steps back one tap at a time.",
  },
  {
    question: "How do I move things around on my Hearth?",
    answer:
      "Tap Edit at the top of the Hearth, or hold your finger on any tile. Then drag it to an open spot, or onto something the same size to swap the two (the outline shows what will happen, and nothing else gets pushed around). Want it somewhere that's full? Hold still there for a moment and the things below slide down to make room. Hold a corner, then pull, to resize it. Changed your mind? Undo and Redo are on the bar along the bottom while you edit, and step back as far as you like. Dragging fiddly? Tap the tile while editing, open “Size & place” and tap “Move it with arrows” — a bar of arrows appears and you can watch it step around your Hearth. Tap Done when you're finished.",
  },
  {
    question: "How do I change how the app looks?",
    answer:
      "Open the Settings tab. There you can choose a theme, make your own, change the font and the text size, and even have the theme change with the seasons.",
  },
  {
    question: "How do I copy someone's Hearth, or share mine?",
    answer:
      "On your Hearth, tap Edit, then Share. \"Share mine\" makes a 6-letter code for your theme or your whole Hearth to text to family. \"Use a code\" is where you type one they sent you. A whole Hearth is added to your Scenes, so your own is kept and you can switch back.",
  },
  {
    question: "Who can see the Menu Board?",
    answer:
      "Everyone in your Home sees the same menu and can change it, like the menu mat on a fridge. Nobody outside your Home sees it. Which meals show and which day your week starts are just your own settings.",
  },
  {
    question: "Who can see my grocery lists?",
    answer:
      "A list is just yours unless you share it with your Home (new lists start shared; change it with the gear on the list). The people you live with can add to a shared list, tick things off and take things off. Only you can rename it, stop sharing it or delete it.",
  },
  {
    question: "Who can see my notes?",
    answer:
      "Just you, unless you share one. Open the note, tap Done if you're writing, and pick “Share with my Home” under it. The people you live with can then read it and change the words (handy for a packing list everyone ticks off). Only you can pin it, put it in a folder, stop sharing it or delete it.",
  },
  {
    question: "Can my family see what I log in Little Log?",
    answer:
      "Not unless you share it. Every log starts as just yours. To share one, open it, tap the pencil and pick “Everyone in my Home”: the people you live with can then see it and add to it (handy for a kid's height), but only you can change or remove the log itself.",
  },
];
