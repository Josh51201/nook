// Idea Stash (GIFT-036): pure helpers, no React or database, so they're
// unit-testable. The notes are private to whoever wrote them; the screens
// are app/gift-nook/stash.tsx and stash-form.tsx.

export type IdeaKind = "idea" | "note";

export type Idea = {
  id: string;
  about_id: string;
  kind: IdeaKind;
  title: string;
  notes: string | null;
  url: string | null;
  price: number | null;
  suggested_at: string | null;
  created_at: string;
};

export const IDEA_SELECT = "id, about_id, kind, title, notes, url, price, suggested_at, created_at";

export const ideaKinds: { key: IdeaKind; label: string; hint: string; placeholder: string }[] = [
  { key: "idea", label: "Gift idea", hint: "Something you could get them. Turn it into a suggestion on their list when you're ready.", placeholder: "e.g. The blue teapot she liked" },
  { key: "note", label: "Good to know", hint: "Sizes, favorites, what they mentioned. Stays a note.", placeholder: "e.g. Wears a size 10 shoe" },
];

// Gift ideas not yet turned into a suggestion.
export function isOpenIdea(idea: Pick<Idea, "kind" | "suggested_at">) {
  return idea.kind === "idea" && !idea.suggested_at;
}

// Ideas still to do first, then notes, then ideas already suggested; newest
// first within each.
export function sortIdeas<T extends Idea>(ideas: T[]): T[] {
  const rank = (i: Idea) => (isOpenIdea(i) ? 0 : i.kind === "note" ? 1 : 2);
  return [...ideas].sort((a, b) => rank(a) - rank(b) || b.created_at.localeCompare(a.created_at));
}

// Each person with their notes, the people with the most ideas to do first.
export function groupByPerson(ideas: Idea[]): { aboutId: string; ideas: Idea[]; open: number }[] {
  const byPerson = new Map<string, Idea[]>();
  for (const idea of ideas) byPerson.set(idea.about_id, [...(byPerson.get(idea.about_id) ?? []), idea]);
  return [...byPerson.entries()]
    .map(([aboutId, list]) => ({ aboutId, ideas: sortIdeas(list), open: list.filter(isOpenIdea).length }))
    .sort((a, b) => b.open - a.open || a.aboutId.localeCompare(b.aboutId));
}

// A price typed as "25", "$19.99" or "1,200". Null if blank; undefined if it
// isn't a number.
export function parsePrice(text: string): number | null | undefined {
  const clean = text.trim().replace(/[$,\s]/g, "");
  if (!clean) return null;
  const value = Number(clean);
  return Number.isNaN(value) || value < 0 ? undefined : value;
}
