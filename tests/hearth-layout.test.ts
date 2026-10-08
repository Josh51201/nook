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
  nookLabel,
  overlaps,
  removeNook,
  resizeItem,
  rowsUsed,
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

  it("slides whatever you drop onto down out of the way, cascading", () => {
    const items = moveItem(layoutOf([nook("a", 0, 4), nook("b", 0, 0), nook("c", 0, 2)]), "a", 0, 0);
    expect(at(items, "a")).toMatchObject({ x: 0, y: 0 });
    expect(at(items, "b")).toMatchObject({ x: 0, y: 2 });
    expect(at(items, "c")).toMatchObject({ x: 0, y: 4 });
    expect(noOverlaps(items)).toBe(true);
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
