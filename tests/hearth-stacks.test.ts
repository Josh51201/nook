import { describe, expect, it } from "vitest";

import {
  copyItem,
  defaultHearthLayout,
  moveItem,
  moveToScope,
  removeItem,
  resizeItem,
  type HearthItem,
  type HearthLayout,
} from "../lib/hearth-layout";
import { addToStack, stackMates, stackPosition, unstack, visibleItems } from "../lib/hearth-stacks";
import { defaultWidget } from "../lib/widgets";

// Widget stacks (CORE-050).

const widget = (id: string, x: number, y: number, w = 2, h = 2): HearthItem => ({
  id,
  kind: "widget",
  widget: defaultWidget("note"),
  x,
  y,
  w,
  h,
});
const layoutOf = (items: HearthItem[]): HearthLayout => ({ ...defaultHearthLayout, items });

function stacked() {
  const base = layoutOf([widget("a", 0, 0), widget("other", 2, 0)]);
  const added = addToStack(base, "a", "clock")!;
  return layoutOf(added.items);
}

describe("Widget stacks (CORE-050)", () => {
  it("adds a widget on top of another, same spot and size, sharing a stack", () => {
    const layout = stacked();
    const [a, b] = layout.items.filter((i) => i.stack);
    expect(a.stack).toBe(b.stack);
    expect([a.x, a.y, a.w, a.h]).toEqual([b.x, b.y, b.w, b.h]);
    expect(layout.items.find((i) => i.id === "other")!.stack).toBeUndefined();
  });

  it("shows one widget per stack, choosing by index", () => {
    const layout = stacked();
    expect(visibleItems(layout.items, {}).map((i) => i.id)).toContain("a");
    expect(visibleItems(layout.items, {}).length).toBe(2);
    const stack = layout.items.find((i) => i.id === "a")!.stack!;
    const second = visibleItems(layout.items, { [stack]: 1 }).find((i) => i.stack)!;
    expect(second.id).not.toBe("a");
    // A stale index is kept in range.
    expect(visibleItems(layout.items, { [stack]: 9 }).length).toBe(2);
  });

  it("moves and resizes the whole stack together, pushing others out of the way", () => {
    const layout = stacked();
    const moved = moveItem(layout, "a", 2, 0);
    const mates = moved.filter((i) => i.stack);
    expect(mates.every((i) => i.x === 2 && i.y === 0)).toBe(true);
    // "other" was in that spot, so it slides down below the stack.
    expect(moved.find((i) => i.id === "other")!.y).toBe(2);
    const bigger = resizeItem(layout, "a", 4, 3);
    expect(bigger.filter((i) => i.stack).every((i) => i.w === 4 && i.h === 3)).toBe(true);
  });

  it("stacked widgets never push each other down", () => {
    const layout = stacked();
    const settled = moveItem(layout, "other", 0, 0);
    const mates = settled.filter((i) => i.stack);
    expect(new Set(mates.map((i) => i.y)).size).toBe(1);
  });

  it("a stack down to one widget stops being a stack", () => {
    const layout = stacked();
    const mate = layout.items.find((i) => i.stack && i.id !== "a")!;
    const left = removeItem(layout, mate.id);
    expect(left.every((i) => !i.stack)).toBe(true);
  });

  it("takes a widget out of its stack to its own spot", () => {
    const layout = stacked();
    const mate = layout.items.find((i) => i.stack && i.id !== "a")!;
    const items = unstack(layout, mate.id);
    expect(items.every((i) => !i.stack)).toBe(true);
    const out = items.find((i) => i.id === mate.id)!;
    const a = items.find((i) => i.id === "a")!;
    expect(out.x === a.x && out.y === a.y).toBe(false);
  });

  it("a copy or a move to a Hollow doesn't stay in the stack", () => {
    const hollow: HearthItem = { id: "h", kind: "hollow", name: "H", look: "house", items: [], x: 0, y: 4, w: 2, h: 2 };
    const layout = layoutOf([...stacked().items, hollow]);
    const { items, copyId } = copyItem(layout, "a", null);
    expect(items.find((i) => i.id === copyId)!.stack).toBeUndefined();
    const moved = moveToScope(layout, "a", "h");
    const inside = (moved.find((i) => i.id === "h") as Extract<HearthItem, { kind: "hollow" }>).items;
    expect(inside[0].stack).toBeUndefined();
  });

  it("knows a widget's place in its stack", () => {
    const layout = stacked();
    const a = layout.items.find((i) => i.id === "a")!;
    expect(stackPosition(layout.items, a)).toEqual([0, 2]);
    expect(stackPosition(layout.items, layout.items.find((i) => i.id === "other")!)).toBeNull();
    expect(stackMates(layout.items, a)).toHaveLength(2);
  });
});
