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
  // Nooks that share with people use Burrows (CORE-025). Where this Nook
  // shows one Burrow's things, and what it shows there — linked from that
  // Burrow's page.
  burrow?: { route: (burrowId: string) => string; blurb: string };
};

export const nookCatalog: NookDefinition[] = [
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
  },
];

export function findNook(id: string) {
  return nookCatalog.find((nook) => nook.id === id);
}
