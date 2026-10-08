import {
  addItem,
  copyItem,
  inScope,
  locate,
  moveToScope,
  removeHollow,
  removeItem,
  updateItem,
  type HearthItem,
  type HearthLayout,
  type Scope,
} from "./hearth-layout";

// Select many (CORE-060): act on several tiles, widgets and Trinkets at once.
// Pure helpers, no React. Each works on a layout and returns what to save.
// Hollows can be picked too, but never go inside another Hollow.

// Locked items (CORE-061) stay where they are: leave them out.
export function notLocked(layout: HearthLayout, ids: string[]): string[] {
  return ids.filter((id) => !locate(layout, id)?.item.locked);
}

// Locks them all, or unlocks them all.
export function lockMany(layout: HearthLayout, ids: string[], locked: boolean): HearthItem[] {
  let items = layout.items;
  for (const id of ids) {
    const found = locate({ ...layout, items }, id);
    if (!found) continue;
    items = inScope({ ...layout, items }, found.scope, (inner) => updateItem(inner, id, { locked: locked || undefined }));
  }
  return items;
}

// Moves them all to the Hearth (null) or into a Hollow, at free spots.
export function moveManyToScope(layout: HearthLayout, ids: string[], to: Scope): HearthItem[] {
  let items = layout.items;
  for (const id of notLocked(layout, ids)) items = moveToScope({ ...layout, items }, id, to);
  return items;
}

// A copy of each (never of a Hollow) in `to`. Returns the new ids.
export function copyMany(layout: HearthLayout, ids: string[], to: Scope): { items: HearthItem[]; copyIds: string[] } {
  let items = layout.items;
  const copyIds: string[] = [];
  for (const id of ids) {
    const done = copyItem({ ...layout, items }, id, to);
    items = done.items;
    if (done.copyId) copyIds.push(done.copyId);
  }
  return { items, copyIds };
}

// Takes them all away. A Hollow's contents move back onto the Hearth, like
// removing a Hollow does.
export function removeMany(layout: HearthLayout, ids: string[]): HearthItem[] {
  let items = layout.items;
  for (const id of notLocked(layout, ids)) {
    const found = locate({ ...layout, items }, id);
    if (!found) continue;
    items =
      found.item.kind === "hollow"
        ? removeHollow({ ...layout, items }, id)
        : inScope({ ...layout, items }, found.scope, (inner) => removeItem(inner, id));
  }
  return items;
}

// One color for all of them (a Hollow, tile, widget, text or Trinket).
export function recolorMany(layout: HearthLayout, ids: string[], color: string | undefined): HearthItem[] {
  let items = layout.items;
  for (const id of ids) {
    const found = locate({ ...layout, items }, id);
    if (!found) continue;
    items = inScope({ ...layout, items }, found.scope, (inner) => updateItem(inner, id, { color }));
  }
  return items;
}

// Sends them to another page of the Hearth (CORE-051), at free spots there.
export function moveManyToPage(
  layout: HearthLayout,
  ids: string[],
  pageId: string
): { items: HearthItem[]; otherPages: HearthLayout["otherPages"] } | null {
  if (pageId === layout.activePage || !layout.pages.some((p) => p.id === pageId)) return null;
  let items = layout.items;
  let target = layout.otherPages[pageId] ?? [];
  for (const id of notLocked(layout, ids)) {
    const found = locate({ ...layout, items }, id);
    if (!found) continue;
    items = inScope({ ...layout, items }, found.scope, (inner) => removeItem(inner, id));
    const { x: _x, y: _y, stack: _stack, ...rest } = found.item;
    target = addItem({ ...layout, items: target }, rest as never);
  }
  return { items, otherPages: { ...layout.otherPages, [pageId]: target } };
}
