import { findFreeSpot, newItemId, type HearthItem, type HearthLayout } from "./hearth-layout";
import { HOME_PAGE } from "./home-hearth";

// Pages of the Hearth (CORE-051). Pure helpers, no React: each returns the
// changes to save. The page you're on keeps its items in `layout.items`;
// the others wait in `layout.otherPages`.

export const MAX_PAGES = 6;

// Your own pages; the page shared with your Home (CORE-054) doesn't count.
const ownPages = (layout: HearthLayout) => layout.pages.filter((p) => p.id !== HOME_PAGE).length;

type PageChanges = Pick<HearthLayout, "pages" | "activePage" | "otherPages" | "items">;

// Every page's items, including the one you're on.
function itemsByPage(layout: HearthLayout): Record<string, HearthItem[]> {
  return { ...layout.otherPages, [layout.activePage]: layout.items };
}

// Split a full set of pages back into "the active one" and "the rest".
function pack(pages: HearthLayout["pages"], activePage: string, byPage: Record<string, HearthItem[]>): PageChanges {
  const otherPages: HearthLayout["otherPages"] = {};
  for (const page of pages) if (page.id !== activePage) otherPages[page.id] = byPage[page.id] ?? [];
  return { pages, activePage, otherPages, items: byPage[activePage] ?? [] };
}

export function switchPage(layout: HearthLayout, pageId: string): PageChanges | null {
  if (pageId === layout.activePage || !layout.pages.some((p) => p.id === pageId)) return null;
  return pack(layout.pages, pageId, itemsByPage(layout));
}

// A new empty page that you stay off (for dropping an item onto "New page").
export function addEmptyPage(layout: HearthLayout): { id: string; changes: Pick<HearthLayout, "pages" | "otherPages"> } | null {
  if (ownPages(layout) >= MAX_PAGES) return null;
  const id = newItemId("p");
  return {
    id,
    changes: {
      pages: [...layout.pages, { id, name: `Page ${ownPages(layout) + 1}` }],
      otherPages: { ...layout.otherPages, [id]: [] },
    },
  };
}

// A new empty page, which you're taken to.
export function addPage(layout: HearthLayout, name: string): { changes: PageChanges; id: string } | null {
  if (ownPages(layout) >= MAX_PAGES) return null;
  const id = newItemId("p");
  const pages = [...layout.pages, { id, name: cleanName(name) || `Page ${ownPages(layout) + 1}` }];
  return { id, changes: pack(pages, id, { ...itemsByPage(layout), [id]: [] }) };
}

export function renamePage(layout: HearthLayout, pageId: string, name: string): Pick<HearthLayout, "pages"> {
  const clean = cleanName(name);
  return { pages: layout.pages.map((p) => (p.id === pageId && clean ? { ...p, name: clean } : p)) };
}

// Taking a page away never deletes what's on it (like removing a Hollow):
// everything moves to the first page that's left, in free spots.
export function removePage(layout: HearthLayout, pageId: string): PageChanges | null {
  if (pageId === HOME_PAGE || ownPages(layout) < 2 || !layout.pages.some((p) => p.id === pageId)) return null;
  const pages = layout.pages.filter((p) => p.id !== pageId);
  const byPage = itemsByPage(layout);
  const target = pages[0].id;
  let landed = byPage[target] ?? [];
  for (const item of byPage[pageId] ?? []) {
    const { x: _x, y: _y, ...rest } = item;
    landed = [...landed, { ...rest, ...findFreeSpot(landed, item.w, item.h) } as HearthItem];
  }
  delete byPage[pageId];
  byPage[target] = landed;
  return pack(pages, layout.activePage === pageId ? target : layout.activePage, byPage);
}

// Neighbouring page for a swipe: +1 is the next page, -1 the one before.
export function neighbourPage(layout: HearthLayout, step: 1 | -1): string | null {
  const index = layout.pages.findIndex((p) => p.id === layout.activePage);
  return layout.pages[index + step]?.id ?? null;
}

function cleanName(name: string) {
  return name.trim().slice(0, 20);
}
