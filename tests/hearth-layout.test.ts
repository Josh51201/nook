import { describe, expect, it } from "vitest";

import {
  addItem,
  addNook,
  defaultHearthLayout,
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
import { defaultWidget } from "../lib/widgets";

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

    const shrunk = resizeItem(layoutOf([widget]), "w", 1, 1);
    expect(at(shrunk, "w")).toMatchObject({ w: 2, h: 2 }); // reminders' minimum
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
    expect(removeNook(layoutOf(once), "gift-nook")).toEqual([]);
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
