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
