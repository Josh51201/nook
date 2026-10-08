import {
  allItems,
  inScope,
  locate,
  updateItem,
  type HearthItem,
  type HearthLayout,
} from "./hearth-layout";

// Tags and filters (CORE-065): label things (Kids, Home, Gifts) and show or
// hide everything with a tag in one tap. Tags are short words saved on the
// item itself; what's hidden right now is just how the Hearth is drawn.
// Pure helpers, no React.

export const MAX_TAGS_PER_ITEM = 5;
export const MAX_TAG_LENGTH = 16;

export function cleanTag(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").slice(0, MAX_TAG_LENGTH);
}

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

// Every tag in use anywhere (every page, every Hollow), A to Z. "kids" and
// "Kids" are one tag; the first spelling seen is the one kept.
export function allTags(layout: Pick<HearthLayout, "items" | "otherPages">): string[] {
  const seen: string[] = [];
  for (const item of allItems(layout)) {
    for (const tag of item.tags ?? []) if (!seen.some((s) => same(s, tag))) seen.push(tag);
  }
  return seen.sort((a, b) => a.localeCompare(b));
}

export function hasTag(item: HearthItem, tag: string): boolean {
  return (item.tags ?? []).some((t) => same(t, tag));
}

// The item's tags with one added (up to the most allowed) or taken away.
export function withTag(tags: string[] | undefined, raw: string, on: boolean): string[] | undefined {
  const tag = cleanTag(raw);
  const current = tags ?? [];
  let next = current;
  if (!tag) return tags;
  if (on) {
    if (current.some((t) => same(t, tag))) return tags;
    next = current.length >= MAX_TAGS_PER_ITEM ? current : [...current, tag];
  } else {
    next = current.filter((t) => !same(t, tag));
  }
  return next.length ? next : undefined;
}

// Add a tag to all of these, or take it off all of them.
export function tagMany(layout: HearthLayout, ids: string[], tag: string, on: boolean): HearthItem[] {
  let items = layout.items;
  for (const id of ids) {
    const found = locate({ ...layout, items }, id);
    if (!found) continue;
    const tags = withTag(found.item.tags, tag, on);
    items = inScope({ ...layout, items }, found.scope, (inner) => updateItem(inner, id, { tags }));
  }
  return items;
}

// What to draw with some tags switched off: anything with one of them goes.
export function hideTagged(items: HearthItem[], hidden: string[]): HearthItem[] {
  if (!hidden.length) return items;
  return items.filter((item) => !(item.tags ?? []).some((t) => hidden.some((h) => same(h, t))));
}
