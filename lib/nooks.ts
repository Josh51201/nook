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
    title: "Potluck",
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
