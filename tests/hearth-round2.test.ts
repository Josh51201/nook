import { describe, expect, it } from "vitest";

import {
  defaultHearthLayout,
  moveItem,
  resizeItem,
  tidyItems,
  type HearthItem,
  type HearthLayout,
} from "../lib/hearth-layout";
import { findItems } from "../lib/hearth-find";
import { addPage } from "../lib/hearth-pages";
import { lockMany, moveManyToScope, removeMany } from "../lib/hearth-select";
import { addToStack } from "../lib/hearth-stacks";
import { defaultWidget } from "../lib/widgets";

// Round 2 of Hearth organization: lock (CORE-061), tidy up (CORE-062), find (CORE-063).

const nook = (id: string, x: number, y: number, extra: Partial<HearthItem> = {}): HearthItem =>
  ({ id, kind: "nook", nookId: id, x, y, w: 2, h: 2, ...extra }) as HearthItem;
const note = (id: string, x: number, y: number, title = "Note"): HearthItem => {
  const widget = defaultWidget("note");
  return { id, kind: "widget", widget: { ...widget, title }, x, y, w: 2, h: 2 };
};
const layoutOf = (items: HearthItem[]): HearthLayout => ({ ...defaultHearthLayout, items });
const at = (items: HearthItem[], id: string) => items.find((i) => i.id === id)!;

describe("Lock in place (CORE-061)", () => {
  it("a locked item can't be moved or resized", () => {
    const layout = layoutOf([nook("a", 0, 0, { locked: true })]);
    expect(moveItem(layout, "a", 2, 2)).toBe(layout.items);
    expect(resizeItem(layout, "a", 4, 4)).toBe(layout.items);
  });

  it("other things move around a locked item instead of pushing it", () => {
    const layout = layoutOf([nook("lock", 0, 0, { locked: true }), nook("b", 2, 0)]);
    const moved = moveItem(layout, "b", 0, 0);
    const lock = at(moved, "lock");
    const b = at(moved, "b");
    expect([lock.x, lock.y]).toEqual([0, 0]);
    // It landed in the open spot nearest to where it was dropped, not on top.
    expect(b.x === 0 && b.y === 0).toBe(false);
    expect(b.x < lock.x + lock.w && lock.x < b.x + b.w && b.y < lock.y + lock.h && lock.y < b.y + b.h).toBe(false);
  });

  it("an item pushed down never shoves a locked one", () => {
    const layout = layoutOf([nook("top", 0, 0), nook("lock", 0, 2, { locked: true }), nook("c", 2, 2)]);
    const moved = moveItem(layout, "c", 0, 0);
    expect(at(moved, "lock").y).toBe(2);
  });

  it("can't grow into a locked item", () => {
    const layout = layoutOf([nook("a", 0, 0), nook("lock", 2, 0, { locked: true })]);
    expect(resizeItem(layout, "a", 4, 2)).toBe(layout.items);
    expect(at(resizeItem(layout, "a", 2, 3), "a").h).toBe(3);
  });

  it("locks and unlocks several at once, and bulk actions skip locked ones", () => {
    const layout = layoutOf([nook("a", 0, 0), note("b", 2, 0), nook("c", 0, 2)]);
    const locked = lockMany(layout, ["a", "b"], true);
    expect(locked.filter((i) => i.locked).map((i) => i.id)).toEqual(["a", "b"]);
    const withLocks = layoutOf(locked);
    expect(removeMany(withLocks, ["a", "b", "c"]).map((i) => i.id)).toEqual(["a", "b"]);
    const hollow: HearthItem = { id: "h", kind: "hollow", name: "H", look: "house", items: [], x: 0, y: 4, w: 2, h: 2 };
    const inside = moveManyToScope({ ...withLocks, items: [...locked, hollow] }, ["a", "c"], "h");
    expect((inside.find((i) => i.id === "h") as Extract<HearthItem, { kind: "hollow" }>).items.map((i) => i.id)).toEqual(["c"]);
    expect(lockMany(layoutOf(locked), ["a"], false).find((i) => i.id === "a")!.locked).toBeUndefined();
  });
});

describe("Tidy up (CORE-062)", () => {
  it("closes gaps, keeping each item's column", () => {
    const tidy = tidyItems([nook("a", 0, 3), nook("b", 2, 6), note("c", 0, 9)]);
    expect([at(tidy, "a").x, at(tidy, "a").y]).toEqual([0, 0]);
    expect([at(tidy, "b").x, at(tidy, "b").y]).toEqual([2, 0]);
    expect([at(tidy, "c").x, at(tidy, "c").y]).toEqual([0, 2]);
  });

  it("leaves locked items exactly where they are and fits around them", () => {
    const tidy = tidyItems([nook("lock", 0, 4, { locked: true }), nook("a", 0, 8)]);
    expect([at(tidy, "lock").x, at(tidy, "lock").y]).toEqual([0, 4]);
    expect(at(tidy, "a").y).toBe(0);
  });

  it("a stack moves as one, and nothing overlaps", () => {
    const base = layoutOf([note("a", 0, 5), nook("x", 2, 5)]);
    const stacked = addToStack(base, "a", "clock")!;
    const tidy = tidyItems(stacked.items);
    const mates = tidy.filter((i) => i.stack);
    expect(new Set(mates.map((i) => i.y)).size).toBe(1);
    expect(mates[0].y).toBe(0);
  });

  it("is a no-op when already tidy", () => {
    const items = [nook("a", 0, 0), nook("b", 2, 0), note("c", 0, 2)];
    expect(tidyItems(items)).toEqual(items);
  });
});

describe("Find in Edit (CORE-063)", () => {
  it("finds by name on every page and inside Hollows", () => {
    const start = layoutOf([note("n1", 0, 0, "Groceries"), { id: "h", kind: "hollow", name: "Kitchen", look: "house", items: [note("n2", 0, 0, "Grocery coupons")], x: 2, y: 0, w: 2, h: 2 }]);
    const added = addPage(start, "Holidays")!;
    const layout: HearthLayout = { ...start, pages: added.changes.pages, otherPages: { [added.id]: [note("n3", 0, 0, "Gift groceries")] } };
    const found = findItems(layout, "grocer");
    expect(found.map((f) => f.item.id).sort()).toEqual(["n1", "n2", "n3"]);
    const inHollow = found.find((f) => f.item.id === "n2")!;
    expect(inHollow.hollowId).toBe("h");
    expect(inHollow.hollowName).toBe("Kitchen");
    expect(found.find((f) => f.item.id === "n3")!.pageName).toBe("Holidays");
    // Names that start with the search come first.
    expect(found[0].label.toLowerCase().startsWith("grocer")).toBe(true);
  });

  it("finds a Hollow by name, a kind by its kind, and nothing for an empty search", () => {
    const layout = layoutOf([{ id: "h", kind: "hollow", name: "Kitchen", look: "house", items: [], x: 0, y: 0, w: 2, h: 2 }, note("n", 2, 0)]);
    expect(findItems(layout, "kitch")[0].kindLabel).toBe("Hollow");
    expect(findItems(layout, "sticky").map((f) => f.item.id)).toEqual(["n"]);
    expect(findItems(layout, "   ")).toEqual([]);
    expect(findItems(layout, "zzz")).toEqual([]);
  });
});
