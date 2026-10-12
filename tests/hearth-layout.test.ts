import { describe, expect, it } from "vitest";

import {
  addItem,
  addNook,
  copyItem,
  locate,
  nookCount,
  defaultHearthLayout,
  EDGE_MAX_SPEED,
  edgeScrollSpeed,
  findFreeSpot,
  hasNook,
  migrateLayout,
  moveItem,
  planMove,
  stickySnap,
  nookLabel,
  overlaps,
  removeNook,
  resizeItem,
  rowsUsed,
  starterItems,
  canNudge,
  itemSpokenName,
  labelIsBold,
  nudgedSpot,
  nudgeItem,
  snapRow,
  type HearthItem,
  type HearthLayout,
} from "../lib/hearth-layout";
import { defaultWidget, widgetShape } from "../lib/widgets";

// The free-form Hearth grid (CORE-006/019): 4 columns, items anywhere, gaps
// allowed, and anything you drop onto slides down out of the way.

const nook = (id: string, x: number, y: number, w = 2, h = 2): HearthItem => ({
  id,
  kind: "nook",
  nookId: id,
  x,
  y,
  w,
  h,
});

const layoutOf = (items: HearthItem[]): HearthLayout => ({ ...defaultHearthLayout, items });

const at = (items: HearthItem[], id: string) => {
  const item = items.find((i) => i.id === id)!;
  return { x: item.x, y: item.y, w: item.w, h: item.h };
};

const noOverlaps = (items: HearthItem[]) =>
  items.every((a, i) => items.every((b, j) => i === j || !overlaps(a, b)));

describe("Hearth grid", () => {
  it("drops an item exactly where you let go, gaps and all", () => {
    const items = moveItem(layoutOf([nook("a", 0, 0)]), "a", 2, 3);
    expect(at(items, "a")).toEqual({ x: 2, y: 3, w: 2, h: 2 });
  });

  it("keeps items inside the 4 columns", () => {
    expect(at(moveItem(layoutOf([nook("a", 0, 0)]), "a", 3, -2), "a")).toEqual({ x: 2, y: 0, w: 2, h: 2 });
  });

  it("trades places with a same-size thing it's dropped on, and nothing else moves (CORE-091)", () => {
    const layout = layoutOf([nook("a", 0, 4), nook("b", 0, 0), nook("c", 0, 2), nook("d", 2, 0)]);
    const items = moveItem(layout, "a", 0, 0);
    expect(at(items, "a")).toMatchObject({ x: 0, y: 0 });
    expect(at(items, "b")).toMatchObject({ x: 0, y: 4 });
    expect(at(items, "c")).toMatchObject({ x: 0, y: 2 });
    expect(at(items, "d")).toMatchObject({ x: 2, y: 0 });
    expect(noOverlaps(items)).toBe(true);
  });

  it("swaps only when it's mostly over the other thing", () => {
    const layout = layoutOf([nook("a", 0, 4), nook("b", 0, 0)]);
    expect(planMove(layout.items, "a", 0, 1).kind).toBe("swap");
    // Over b by just one column of two: that's not a swap.
    expect(planMove(layout.items, "a", 1, 1).kind).toBe("blocked");
  });

  it("never pushes: no room, and it goes back where it was", () => {
    // A tile half as wide as the one it's dropped on.
    const layout = layoutOf([nook("small", 0, 5, 1, 1), nook("big", 0, 0), nook("under", 0, 2)]);
    expect(planMove(layout.items, "small", 0, 0)).toMatchObject({ kind: "blocked", x: 0, y: 0 });
    expect(moveItem(layout, "small", 0, 0)).toBe(layout.items);
  });

  it("lands in the open spot right there when dropped half a row off", () => {
    const layout = layoutOf([nook("a", 2, 4), nook("top", 0, 0), nook("bottom", 0, 4)]);
    // Rows 2 and 3 are open; a drop at 2.5 overlaps "bottom" by half a row.
    expect(at(moveItem(layout, "a", 0, 2.5), "a")).toMatchObject({ x: 0, y: 2 });
    expect(at(moveItem(layout, "a", 0, 1.5), "a")).toMatchObject({ x: 0, y: 2 });
  });

  it("won't swap with something locked", () => {
    const layout = layoutOf([nook("a", 0, 4), { ...nook("b", 0, 0), locked: true }]);
    expect(moveItem(layout, "a", 0, 0)).toBe(layout.items);
  });

  it("dropping where it already is changes nothing", () => {
    const layout = layoutOf([nook("a", 0, 0)]);
    expect(moveItem(layout, "a", 0, 0)).toBe(layout.items);
  });

  it("leaves items that don't collide alone", () => {
    const items = moveItem(layoutOf([nook("a", 0, 0), nook("b", 2, 5)]), "a", 0, 3);
    expect(at(items, "b")).toEqual({ x: 2, y: 5, w: 2, h: 2 });
  });

  it("resizing pushes neighbours down and respects minimum sizes", () => {
    const widget: HearthItem = { id: "w", kind: "widget", widget: defaultWidget("reminders"), x: 0, y: 0, w: 2, h: 2 };
    const grown = resizeItem(layoutOf([widget, nook("b", 2, 0)]), "w", 4, 3);
    expect(at(grown, "w")).toEqual({ x: 0, y: 0, w: 4, h: 3 });
    expect(at(grown, "b")).toMatchObject({ y: 3 });
    expect(noOverlaps(grown)).toBe(true);

    // Any widget can shrink all the way to a single icon (CORE-030), but no smaller.
    const icon = resizeItem(layoutOf([widget]), "w", 1, 1);
    expect(at(icon, "w")).toMatchObject({ w: 1, h: 1 });
    const tooSmall = resizeItem(layoutOf([widget]), "w", 0, 0);
    expect(at(tooSmall, "w")).toMatchObject({ w: 1, h: 1 });
  });

  it("finds the first free spot for new items", () => {
    expect(findFreeSpot([nook("a", 0, 0)], 2, 2)).toEqual({ x: 2, y: 0 });
    expect(findFreeSpot([nook("a", 0, 0), nook("b", 2, 0)], 4, 1)).toEqual({ x: 0, y: 2 });
    const items = addItem(layoutOf([nook("a", 0, 0, 4, 2)]), { id: "l", kind: "label", text: "Hi", size: "heading", align: "left", w: 4, h: 1 });
    expect(at(items, "l")).toEqual({ x: 0, y: 2, w: 4, h: 1 });
  });

  it("adds and removes Nooks without duplicates", () => {
    const once = addNook(defaultHearthLayout, "gift-nook");
    expect(hasNook(layoutOf(once), "gift-nook")).toBe(true);
    expect(addNook(layoutOf(once), "gift-nook")).toBe(once);
    expect(removeNook(layoutOf(once), "gift-nook").items).toEqual([]);
  });

  it("adds another tile of a Nook only when asked", () => {
    const once = addNook(defaultHearthLayout, "potluck");
    const twice = addNook(layoutOf(once), "potluck", true);
    expect(twice).toHaveLength(2);
    expect(nookCount(layoutOf(twice), "potluck")).toBe(2);
    // Taking the Nook off the Hearth takes every tile of it.
    expect(removeNook(layoutOf(twice), "potluck").items).toEqual([]);
  });

  it("copies a widget into a Hollow as its own thing", () => {
    const list = {
      ...defaultWidget("reminders"),
      kind: "reminders" as const,
      settings: {
        hideDone: false,
        items: [{ id: "r1", text: "Milk", done: false, schedule: { kind: "daily" as const, hour: 9, minute: 0 }, notificationId: "abc" }],
      },
    };
    const layout = layoutOf([
      { id: "w1", kind: "widget", widget: list, x: 0, y: 0, w: 2, h: 2 } as never,
      { id: "h1", kind: "hollow", name: "Kitchen", look: "house", items: [], x: 2, y: 0, w: 2, h: 2 } as never,
    ]);
    const { items, copyId } = copyItem(layout, "w1", "h1");
    expect(copyId).toBeTruthy();
    const copy = locate(layoutOf(items), copyId!);
    expect(copy?.scope).toBe("h1");
    const copied = (copy!.item as { widget: typeof list }).widget.settings.items[0];
    expect(copied.text).toBe("Milk");
    // No shared phone alert, so nothing rings twice.
    expect(copied.notificationId).toBeUndefined();
    expect(copied.schedule).toBeUndefined();
    expect(copied.id).not.toBe("r1");
    // The original is untouched.
    expect(locate(layoutOf(items), "w1")?.item).toEqual(layout.items[0]);
  });

  it("never copies a Hollow", () => {
    const layout = layoutOf([{ id: "h1", kind: "hollow", name: "H", look: "house", items: [], x: 0, y: 0, w: 2, h: 2 } as never]);
    expect(copyItem(layout, "h1", null).copyId).toBeNull();
  });

  it("counts rows in use", () => {
    expect(rowsUsed([nook("a", 0, 0), nook("b", 2, 3)])).toBe(5);
    expect(rowsUsed([])).toBe(0);
  });

  it("uses the Nook's own name unless renamed", () => {
    expect(nookLabel({ id: "x", kind: "nook", nookId: "gift-nook", x: 0, y: 0, w: 2, h: 2, label: " " })).toBe("Gift Nook");
  });
});

describe("Older Hearths (named sections)", () => {
  const v1 = {
    title: "Josh's Hearth",
    theme: "sage" as const,
    version: 2 as const, // defaults merged in by useNookSettings
    items: [],
    sections: [
      { id: "a", title: "Family", tiles: [{ nookId: "gift-nook", size: "small" as const }, { nookId: "to-do", size: "small" as const }] },
      { id: "b", title: "Me", tiles: [{ nookId: "food-tracker", size: "wide" as const, color: "#dfe8d6" }] },
      { id: "c", title: "Empty", tiles: [] },
    ],
  };

  it("turns sections into heading labels with tiles flowing underneath", () => {
    const layout = migrateLayout(v1);
    expect(layout.title).toBe("Josh's Hearth");
    expect(layout.theme).toBe("sage");
    expect(layout.items.map((i) => [i.kind, i.x, i.y, i.w, i.h])).toEqual([
      ["label", 0, 0, 4, 1],
      ["nook", 0, 1, 2, 2],
      ["nook", 2, 1, 2, 2],
      ["label", 0, 3, 4, 1],
      ["nook", 0, 4, 4, 2],
    ]);
    expect(layout.items[4]).toMatchObject({ nookId: "food-tracker", color: "#dfe8d6" });
  });

  it("gives the same ids every time (so every screen agrees)", () => {
    expect(migrateLayout(v1).items.map((i) => i.id)).toEqual(migrateLayout(v1).items.map((i) => i.id));
  });

  it("leaves new-style Hearths alone", () => {
    const items = [nook("a", 1, 1)];
    expect(migrateLayout({ ...defaultHearthLayout, items }).items).toEqual(items);
  });
});

describe("Hearth widgets", () => {
  it("every kind has sensible defaults that fit its minimum size", async () => {
    const { widgetKinds, defaultWidget } = await import("../lib/widgets");
    for (const kind of widgetKinds) {
      const widget = defaultWidget(kind.kind);
      expect(widget.kind).toBe(kind.kind);
      expect(kind.size.w).toBeGreaterThanOrEqual(kind.minSize.w);
      expect(kind.size.h).toBeGreaterThanOrEqual(kind.minSize.h);
    }
  });

  it("ready-made ideas build fresh reminder ids each time", async () => {
    const { widgetTemplates } = await import("../lib/widgets");
    const food = widgetTemplates.find((t) => t.id === "food-log")!;
    const a = food.build();
    const b = food.build();
    expect(a.kind).toBe("reminders");
    if (a.kind === "reminders" && b.kind === "reminders") {
      expect(a.settings.items).toHaveLength(2);
      expect(a.settings.items[0].id).not.toBe(b.settings.items[0].id);
      expect(a.settings.items[0].schedule).toEqual({ kind: "daily", hour: 12, minute: 30 });
    }
  });

  it("describes reminder schedules in plain words", async () => {
    const { describeSchedule } = await import("../lib/widgets");
    expect(describeSchedule({ kind: "daily", hour: 18, minute: 30 })).toMatch(/^Every day at 6:30/);
    expect(describeSchedule({ kind: "weekly", weekday: 1, hour: 9, minute: 0 })).toMatch(/^Every Sunday at 9:00/);
    expect(describeSchedule(undefined)).toBeNull();
  });
});

describe("Hollows (CORE-022..024)", () => {
  const hollow = (id: string, items: HearthItem[], x = 0, y = 0): HearthItem => ({
    id,
    kind: "hollow",
    name: id,
    look: "house",
    items,
    x,
    y,
    w: 2,
    h: 2,
  });
  const where = async () => await import("../lib/hearth-layout");

  it("finds items wherever they live", async () => {
    const { locate, allItems } = await where();
    const layout = layoutOf([nook("a", 0, 0), hollow("h", [nook("inside", 0, 0)], 2, 0)]);
    expect(locate(layout, "inside")).toMatchObject({ scope: "h" });
    expect(locate(layout, "a")).toMatchObject({ scope: null });
    expect(locate(layout, "nope")).toBeNull();
    expect(allItems(layout).map((i) => i.id)).toEqual(["a", "h", "inside"]);
  });

  it("edits a Hollow's inside without touching the Hearth", async () => {
    const { inScope } = await where();
    const layout = layoutOf([nook("a", 0, 0), hollow("h", [nook("b", 0, 0), nook("c", 0, 2)], 2, 0)]);
    const items = inScope(layout, "h", (inner) => moveItem(inner, "c", 0, 0));
    expect(at(items, "a")).toEqual({ x: 0, y: 0, w: 2, h: 2 });
    const inside = (items.find((i) => i.id === "h") as { items: HearthItem[] }).items;
    expect(at(inside, "c")).toMatchObject({ x: 0, y: 0 });
    expect(at(inside, "b")).toMatchObject({ x: 0, y: 2 }); // pushed down inside the Hollow
  });

  it("moves items into a Hollow and back out again", async () => {
    const { moveToScope, scopeItems, locate } = await where();
    let layout = layoutOf([nook("a", 0, 0, 4, 2), hollow("h", [], 0, 2)]);
    layout = { ...layout, items: moveToScope(layout, "a", "h") };
    expect(layout.items.map((i) => i.id)).toEqual(["h"]);
    expect(scopeItems(layout, "h").map((i) => [i.id, i.x, i.y, i.w, i.h])).toEqual([["a", 0, 0, 4, 2]]);
    layout = { ...layout, items: moveToScope(layout, "a", null) };
    expect(locate(layout, "a")).toMatchObject({ scope: null });
    expect(scopeItems(layout, "h")).toEqual([]);
  });

  it("never puts a Hollow inside a Hollow", async () => {
    const { moveToScope } = await where();
    const layout = layoutOf([hollow("h1", []), hollow("h2", [], 2, 0)]);
    expect(moveToScope(layout, "h1", "h2")).toBe(layout.items);
  });

  it("removing a Hollow moves everything inside back onto the Hearth", async () => {
    const { removeHollow } = await where();
    const layout = layoutOf([nook("a", 0, 0), hollow("h", [nook("b", 0, 0), nook("c", 2, 0)], 2, 0)]);
    const items = removeHollow(layout, "h");
    expect(items.map((i) => i.id).sort()).toEqual(["a", "b", "c"]);
    expect(noOverlaps(items)).toBe(true);
  });

  it("knows a Nook is added even when it's tucked in a Hollow, and removes it from there", async () => {
    const { hasNook, removeNook } = await where();
    const layout = layoutOf([hollow("h", [nook("gift-nook", 0, 0)])]);
    expect(hasNook(layout, "gift-nook")).toBe(true);
    const items = removeNook(layout, "gift-nook").items;
    expect((items[0] as { items: HearthItem[] }).items).toEqual([]);
  });
});

describe("stickySnap (steady outline while dragging, CORE-091)", () => {
  it("stays in its cell until clearly over the next one", () => {
    expect(stickySnap(1.6, 1, 1)).toBe(1);
    expect(stickySnap(1.75, 1, 1)).toBe(2);
    expect(stickySnap(0.4, 1, 1)).toBe(1);
    expect(stickySnap(0.2, 1, 1)).toBe(0);
  });

  it("works in half rows too", () => {
    expect(stickySnap(1.3, 1, 0.5)).toBe(1);
    expect(stickySnap(1.4, 1, 0.5)).toBe(1.5);
  });

  it("jumps straight to a far-away spot", () => {
    expect(stickySnap(3.2, 0, 1)).toBe(3);
  });
});

describe("edgeScrollSpeed (auto-scroll while dragging)", () => {
  const top = 120;
  const bottom = 760;

  it("stays still when the finger is away from both edges", () => {
    expect(edgeScrollSpeed(400, top, bottom)).toBe(0);
  });

  it("scrolls down near the bottom, faster the closer it gets, and up near the top", () => {
    const gentle = edgeScrollSpeed(bottom - 60, top, bottom);
    const fast = edgeScrollSpeed(bottom - 5, top, bottom);
    expect(gentle).toBeGreaterThan(0);
    expect(fast).toBeGreaterThan(gentle);
    expect(edgeScrollSpeed(top + 20, top, bottom)).toBeLessThan(0);
  });

  it("tops out at the maximum, even with the finger past the edge", () => {
    expect(edgeScrollSpeed(bottom + 300, top, bottom)).toBe(EDGE_MAX_SPEED);
    expect(edgeScrollSpeed(top - 300, top, bottom)).toBe(-EDGE_MAX_SPEED);
  });

  it("does nothing until the scrolling area has been measured", () => {
    expect(edgeScrollSpeed(10, 0, 0)).toBe(0);
  });
});

describe("widgetShape (widgets laid out for their size)", () => {
  // A 4-column grid on a typical phone: one cell is about 78px, two about 168.
  const cell = 78;
  const two = 168;
  const four = 350;
  const three = 258;

  it("a single cell is an icon, a one-row widget is a strip", () => {
    expect(widgetShape(cell, cell)).toBe("icon");
    expect(widgetShape(cell, two)).toBe("icon");
    expect(widgetShape(four, cell)).toBe("strip");
    expect(widgetShape(two, cell)).toBe("strip");
  });

  it("bigger widgets get room to breathe", () => {
    expect(widgetShape(two, two)).toBe("small");
    expect(widgetShape(four, two)).toBe("wide");
    expect(widgetShape(two, four)).toBe("tall");
    expect(widgetShape(four, three)).toBe("large");
    expect(widgetShape(four, four)).toBe("large");
  });
});

describe("starterItems", () => {
  it("is just a Greeting widget across the top, and nothing else", () => {
    const items = starterItems();
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ kind: "widget", x: 0, y: 0, w: 4, h: 1 });
    expect(items[0].kind === "widget" && items[0].widget.kind).toBe("greeting");
    // No Nook tiles are added for anyone (CORE-015).
    expect(items.some((item) => item.kind === "nook")).toBe(false);
  });

  it("fits on a Hearth page, and new things still find a free spot below it", () => {
    const layout: HearthLayout = { ...defaultHearthLayout, items: starterItems() };
    const next = addItem(layout, { id: "n1", kind: "nook", nookId: "gift-nook", w: 2, h: 2 });
    const added = next.find((item) => item.id === "n1")!;
    expect(overlaps(added, next[0])).toBe(false);
  });

  it("leaves the default layout empty, so an existing empty Hearth stays empty", () => {
    expect(defaultHearthLayout.items).toEqual([]);
    expect(migrateLayout({ items: [] }).items).toEqual([]);
  });
});

describe("moving without dragging", () => {
  const tile = (x: number, y: number, extra: Partial<HearthItem> = {}) =>
    ({ id: "t", kind: "nook", nookId: "gift-nook", x, y, w: 2, h: 2, ...extra }) as HearthItem;

  it("knows which ways a tile can go", () => {
    expect(canNudge(tile(0, 0), "up")).toBe(false);
    expect(canNudge(tile(0, 0), "left")).toBe(false);
    expect(canNudge(tile(0, 0), "right")).toBe(true);
    expect(canNudge(tile(2, 0), "right")).toBe(false);
    expect(canNudge(tile(0, 0), "down")).toBe(true);
    expect(canNudge(tile(1, 1, { locked: true }), "down")).toBe(false);
  });

  it("moves one step into open space", () => {
    const layout: HearthLayout = { ...defaultHearthLayout, items: [tile(0, 0)] };
    expect(nudgeItem(layout, "t", "right").find((i) => i.id === "t")!).toMatchObject({ x: 1, y: 0 });
  });

  it("trades places with a same-size neighbour (CORE-091)", () => {
    const layout: HearthLayout = {
      ...defaultHearthLayout,
      items: [tile(0, 0), { id: "o", kind: "nook", nookId: "potluck", x: 2, y: 0, w: 2, h: 2 } as HearthItem],
    };
    const items = nudgeItem(layout, "t", "right");
    expect(items.find((i) => i.id === "t")!).toMatchObject({ x: 2, y: 0 });
    expect(items.find((i) => i.id === "o")!).toMatchObject({ x: 0, y: 0 });
  });

  it("with no room, it still goes, pushing what's in the way down", () => {
    const layout: HearthLayout = {
      ...defaultHearthLayout,
      items: [tile(0, 0), { id: "o", kind: "nook", nookId: "potluck", x: 2, y: 0, w: 1, h: 1 } as HearthItem],
    };
    const items = nudgeItem(layout, "t", "right");
    const moved = items.find((i) => i.id === "t")!;
    const other = items.find((i) => i.id === "o")!;
    expect(moved.x).toBe(1);
    expect(overlaps(moved, other)).toBe(false);
  });

  it("does nothing when it can't go that way", () => {
    const layout: HearthLayout = { ...defaultHearthLayout, items: [tile(0, 0)] };
    expect(nudgeItem(layout, "t", "up")).toBe(layout.items);
  });

  it("gives every kind of tile a spoken name", () => {
    expect(itemSpokenName(tile(0, 0))).toBe("Gift Nook");
    expect(itemSpokenName({ id: "h", kind: "hollow", name: "Kids", look: "house", x: 0, y: 0, w: 1, h: 1, items: [] } as unknown as HearthItem)).toBe("Kids, Hollow");
    expect(itemSpokenName({ id: "w", kind: "widget", widget: defaultWidget("clock"), x: 0, y: 0, w: 2, h: 2 } as HearthItem)).toContain("widget");
  });
});

describe("half rows and slim text (CORE-076)", () => {
  const slim = { id: "l", kind: "label", text: "Gifts", size: "heading", align: "left", x: 0, y: 0, w: 4, h: 0.5 } as HearthItem;
  const tile = (id: string, x: number, y: number) => ({ id, kind: "nook", nookId: "gift-nook", x, y, w: 2, h: 2 }) as HearthItem;

  it("snaps to half rows", () => {
    expect(snapRow(0.3)).toBe(0.5);
    expect(snapRow(1.2)).toBe(1);
    expect(snapRow(1.26)).toBe(1.5);
  });

  it("lets a new tile sit right under slim text, with no gap", () => {
    expect(findFreeSpot([slim], 2, 2)).toEqual({ x: 0, y: 0.5 });
  });

  it("keeps text slim, and tiles whole, when resized", () => {
    const layout: HearthLayout = { ...defaultHearthLayout, items: [slim, tile("t", 0, 1)] };
    expect(resizeItem(layout, "l", 4, 0.5).find((i) => i.id === "l")!.h).toBe(0.5);
    expect(resizeItem(layout, "t", 2, 1.5).find((i) => i.id === "t")!.h).toBe(2);
  });

  it("moves to half rows, right up against what's under it", () => {
    const layout: HearthLayout = { ...defaultHearthLayout, items: [slim, tile("t", 0, 0.5)] };
    const items = moveItem(layout, "l", 0, 2.5);
    const text = items.find((i) => i.id === "l")!;
    const under = items.find((i) => i.id === "t")!;
    expect(text.y).toBe(2.5);
    expect(under.y).toBe(0.5);
    // Dropped on the tile, it goes back instead of pushing it (CORE-091).
    expect(moveItem(layout, "l", 0, 1.5)).toBe(layout.items);
  });

  it("steps text by half rows and tiles by whole ones", () => {
    expect(nudgedSpot({ ...slim, y: 1 }, "up")).toEqual({ x: 0, y: 0.5 });
    expect(nudgedSpot(tile("t", 0, 2), "up")).toEqual({ x: 0, y: 1 });
    expect(nudgedSpot(tile("t", 0, 0.5), "up")).toEqual({ x: 0, y: 0 });
  });

  it("bolds headings but not captions unless asked", () => {
    expect(labelIsBold({ size: "heading" })).toBe(true);
    expect(labelIsBold({ size: "caption" })).toBe(false);
    expect(labelIsBold({ size: "caption", bold: true })).toBe(true);
  });
});
