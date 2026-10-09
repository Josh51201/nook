import type { HearthItem, HearthLayout } from "./hearth-layout";
import { HOME_PAGE } from "./home-hearth";

// How much fits on one page or in one Hollow (CORE-066). Every tile, widget
// and Trinket is drawn live with its own drag gesture, so a very long page
// gets choppy on older phones; this is a speed guard, not a storage one.
// Pure helpers, no React, so they're unit-testable.

export const PAGE_LIMIT = 60;
// The page shared with your Home is redrawn on everyone's phone whenever it
// changes, so it holds fewer.
export const HOME_PAGE_LIMIT = 40;
// Trinkets and Cubbies are light decorations, so two count as one.
const TRINKET_WEIGHT = 0.5;

// How much of the space these items use. A stack is one spot (CORE-050), and
// a Hollow counts once, whatever is inside it.
export function spaceLoad(items: HearthItem[]): number {
  const stacks = new Set<string>();
  let load = 0;
  for (const item of items) {
    if (item.stack) {
      if (stacks.has(item.stack)) continue;
      stacks.add(item.stack);
    }
    load += item.kind === "trinket" || item.kind === "cubby" ? TRINKET_WEIGHT : 1;
  }
  return load;
}

export type Space = { key: string; name: string; load: number; limit: number; where: "page" | "hollow" | "home" };

type Spaces = Pick<HearthLayout, "items" | "otherPages" | "pages" | "activePage">;

// Every page and every Hollow, with how full it is.
export function spacesOf(layout: Spaces): Space[] {
  const out: Space[] = [];
  const visit = (pageId: string, items: HearthItem[]) => {
    const page = layout.pages.find((p) => p.id === pageId);
    const home = pageId === HOME_PAGE;
    out.push({ key: `page:${pageId}`, name: page?.name ?? "this page", load: spaceLoad(items), limit: home ? HOME_PAGE_LIMIT : PAGE_LIMIT, where: home ? "home" : "page" });
    for (const item of items) {
      if (item.kind === "hollow") {
        out.push({ key: `hollow:${item.id}`, name: item.name, load: spaceLoad(item.items), limit: PAGE_LIMIT, where: "hollow" });
      }
    }
  };
  visit(layout.activePage, layout.items);
  for (const [pageId, items] of Object.entries(layout.otherPages ?? {})) visit(pageId, items);
  return out;
}

// The first place that a change would push over its limit, or null. Only a
// place that grew can block, so something already over (from before there
// was a limit) can still shrink, be rearranged or have things taken out.
export function overflowing(before: Spaces, after: Spaces): Space | null {
  const was = new Map(spacesOf(before).map((s) => [s.key, s.load]));
  return spacesOf(after).find((s) => s.load > s.limit && s.load > (was.get(s.key) ?? 0)) ?? null;
}

export function fullMessage(space: Space) {
  const what = space.where === "hollow" ? `“${space.name}”` : space.where === "home" ? `The “${space.name}” page` : `The “${space.name}” page`;
  return {
    title: space.where === "hollow" ? `${what} is full` : `${what} is full`,
    body:
      space.where === "hollow"
        ? "A Hollow holds up to " + space.limit + " things so it stays smooth. Start another Hollow, or take something out."
        : space.where === "home"
          ? `The shared page holds up to ${space.limit} things, since everyone's phone redraws it. Take something off it to add more.`
          : `A page holds up to ${space.limit} things so it stays smooth. Start a new page, or tuck some things into a Hollow.`,
  };
}
