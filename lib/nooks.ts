import type { IconName } from "../components/icon";

// Every Nook that exists or is on the way (CORE-001/002). The Market lists
// these; the Hearth shows the ones a person has added. Unavailable ones come
// from the Nook Backlog in docs/NOOK_REQUIREMENTS.md and show as "coming
// soon".

export type NookDefinition = {
  id: string;
  title: string;
  icon: IconName;
  iconColor: string;
  tagline: string;
  description: string;
  route: string | null;
  available: boolean;
  color: string;
  // Which part of the Market (and the Nooks tab) it sits in.
  aisle: NookAisle;
  // Nooks that share with people use Burrows (CORE-025). Where this Nook
  // shows one Burrow's things, and what it shows there — linked from that
  // Burrow's page.
  burrow?: { route: (burrowId: string) => string; blurb: string };
};

// The Nooks are sorted into a few groups so the Market and the Nooks tab
// stay easy to scan as more Nooks arrive. `short` is the filter chip's name.
export type NookAisle = "together" | "house" | "care" | "kitchen";

export const nookAisles: { id: NookAisle; title: string; short: string; icon: IconName }[] = [
  { id: "together", title: "Family & get-togethers", short: "Family", icon: "group" },
  { id: "house", title: "Around the house", short: "House", icon: "door" },
  { id: "care", title: "Pets & health", short: "Care", icon: "heart" },
  { id: "kitchen", title: "Kitchen", short: "Kitchen", icon: "recipe" },
];

// Whether a Nook matches what someone typed in a search box.
export function nookMatches(nook: NookDefinition, query: string) {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const haystack = `${nook.title} ${nook.tagline} ${nook.description}`.toLowerCase();
  return words.every((word) => haystack.includes(word));
}

// A Nook's name without the trailing "Nook", for small labels under icons.
export function shortNookName(nook: NookDefinition) {
  return nook.title.replace(/ Nook$/, "");
}

export const nookCatalog: NookDefinition[] = [
  {
    id: "gatherings",
    title: "Gathering Nook",
    icon: "celebration",
    iconColor: "#9a5b1c",
    tagline: "Every get-together",
    description:
      "Every get-together you're invited to in one place — a birthday, Christmas, a game night. Invite whole Burrows or just a few people, and everyone can say if they're coming. Add gift lists or a Potluck when it needs them.",
    route: "/gatherings",
    available: true,
    color: "#f3e3c8",
    aisle: "together",
    burrow: {
      route: (burrowId) => `/gatherings?burrowId=${burrowId}`,
      blurb: "Get-togethers this Burrow is invited to",
    },
  },
  {
    id: "gift-nook",
    title: "Gift Nook",
    icon: "gift",
    iconColor: "#a5532f",
    tagline: "Wishbooks & Burrows",
    description:
      "Family wish lists for birthdays, Christmas and more. Tuck away a gift so nobody doubles up — and the person it's for never finds out.",
    route: "/gift-nook",
    available: true,
    color: "#f6d9c4",
    aisle: "together",
    burrow: {
      route: (burrowId) => `/gift-nook/burrow/${burrowId}`,
      blurb: "Gatherings and everyone's Wishbooks",
    },
  },
  {
    id: "potluck",
    title: "Potluck Nook",
    icon: "potluck",
    iconColor: "#4f6b45",
    tagline: "Who's bringing what",
    description:
      "Plan the food for a get-together: what's needed, who's bringing what, who's coming — with a heads-up when a dish clashes with someone's allergy.",
    route: "/potluck",
    available: true,
    color: "#dfe8d6",
    aisle: "together",
    burrow: {
      route: (burrowId) => `/potluck?burrowId=${burrowId}`,
      blurb: "Who's bringing what",
    },
  },
  {
    id: "letterbox",
    title: "Letterbox Nook",
    icon: "mail",
    iconColor: "#a3425f",
    tagline: "Cards & addresses",
    description:
      "Your Home's card list and address book: who you've sent holiday cards to and who sent you one, every birthday coming up, thank-you notes still to write, and labels ready to print.",
    route: "/letterbox",
    available: true,
    color: "#efd9e4",
    aisle: "together",
  },
  {
    id: "pets",
    title: "Pet Care Nook",
    icon: "paw",
    iconColor: "#3f6a96",
    tagline: "Fed the dog?",
    description:
      "Everyone who looks after your pets in one place: check off meals so nobody feeds twice, log walks and litter, keep vet visits, vaccines and medications on schedule, and let a sitter help for a while.",
    route: "/pets",
    available: true,
    color: "#d9e4ef",
    aisle: "care",
  },
  {
    id: "rhythms",
    title: "Rhythms Nook",
    icon: "rhythm",
    iconColor: "#8a6420",
    tagline: "Filters, gutters, flu shots",
    description:
      "The chores your Home does every season or year — furnace filters, smoke detectors, gutters, car registration, flu shots — with a heads-up before each comes round and a log of who did it last.",
    route: "/rhythms",
    available: true,
    color: "#f1e4c8",
    aisle: "house",
  },
  {
    id: "sitter",
    title: "Sitter Sheet Nook",
    icon: "sitter",
    iconColor: "#7a4f8f",
    tagline: "For whoever's looking after things",
    description:
      "One page for babysitters, grandparents and house-sitters: emergency numbers, bedtime, house rules, and the kids' allergies and pets' meals if you want them. Send a link for each stay — no app needed, and it stops working when the stay ends.",
    route: "/sitter",
    available: true,
    color: "#e8dcef",
    aisle: "house",
  },
  {
    id: "recipes",
    title: "Recipe Box Nook",
    icon: "recipe",
    iconColor: "#9a4a2a",
    tagline: "The family cookbook",
    description:
      "Your recipes on Shelves, typed in or pulled from a website link, shared with family in your Burrows. Scale the servings, cook with big text and timers, and see straight away if a dish clashes with someone's allergy.",
    route: "/recipes",
    available: true,
    color: "#f3dccb",
    aisle: "kitchen",
  },
  {
    id: "subscriptions",
    title: "Subscriptions Nook",
    icon: "card",
    iconColor: "#2f6f62",
    tagline: "What renews when",
    description:
      "Every recurring charge in your Home — streaming, apps, the gym, Amazon Prime — with what it all costs a month, a reminder before each one renews or a free trial ends, who pays and on which card, and a running total of what cancelling has saved you.",
    route: "/subscriptions",
    available: true,
    color: "#d6ebe4",
    aisle: "house",
  },
  {
    id: "getaways",
    title: "Getaway Nook",
    icon: "plane",
    iconColor: "#2a7590",
    tagline: "Packed and ready",
    description:
      "Plan a trip with the people going: everyone's packing list, a before-you-go checklist with reminders, flight and hotel confirmations, a day-by-day plan, who paid for what, and a countdown on your Hearth.",
    route: "/getaways",
    available: true,
    color: "#d4eaf1",
    aisle: "together",
  },
  {
    id: "sickday",
    title: "Sick Day Nook",
    icon: "sick",
    iconColor: "#b04a5a",
    tagline: "Who had what, and when",
    description:
      "When someone's sick: log temperatures, symptoms and medicine, with a “next dose OK at…” timer so nobody doubles up. Keep a medicine cabinet with the doses you were told, get a summary to read to the doctor, mark missed school or work days, and let Grandma help while she's watching them.",
    route: "/sickday",
    available: true,
    color: "#f4dde0",
    aisle: "care",
  },
  {
    id: "little-log",
    title: "Little Log",
    icon: "chart",
    iconColor: "#4f7a8c",
    tagline: "Anything, over time",
    description:
      "Keep track of anything with a date — your weight, blood pressure, mood, sleep, the car's mileage, a kid's height — and see it as a chart. Logging takes two taps, a daily reminder keeps you at it, and any log can be shared with your Home.",
    route: "/little-log",
    available: true,
    color: "#d9e6eb",
    aisle: "care",
  },
  {
    id: "notes",
    title: "Notes Nook",
    icon: "note",
    iconColor: "#a07a2c",
    tagline: "Jot it down",
    description:
      "Notes like your phone's own Notes app: the first line is the title, it saves as you type, and checklists tick off with a tap. Pin the ones you need, sort them into folders, search them all, and share any note with your Home — a packing list everyone ticks, the Wi-Fi password.",
    route: "/notes",
    available: true,
    color: "#f3e7c9",
    aisle: "house",
  },
  {
    id: "food-tracker",
    title: "Food Tracker",
    icon: "food",
    iconColor: "#4f7a3f",
    tagline: "What you eat",
    description: "Keep track of meals and food.",
    route: null,
    available: false,
    color: "#dfe8d6",
    aisle: "kitchen",
  },
  {
    id: "to-do",
    title: "To-Do List",
    icon: "todo",
    iconColor: "#3f6a96",
    tagline: "Little lists",
    description: "Simple lists of things to get done.",
    route: null,
    available: false,
    color: "#d9e4ef",
    aisle: "house",
  },
];

export function findNook(id: string) {
  return nookCatalog.find((nook) => nook.id === id);
}
