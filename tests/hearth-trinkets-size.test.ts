import { describe, expect, it } from "vitest";

import {
  addItem,
  COLUMNS,
  defaultHearthLayout,
  fitTrinkets,
  migrateLayout,
  resizeItem,
  type HearthItem,
  type HearthLayout,
} from "../lib/hearth-layout";
import { starters } from "../lib/hearth-starters";
import {
  trinketAspect,
  trinketBounds,
  trinketFit,
  trinketSlideOf,
  trinketWidthAt,
  trinkets,
  turnedBy,
} from "../lib/trinkets";

// Trinkets at any size, in their own shape, turned any way (CORE-098).

const layoutOf = (items: HearthItem[]): HearthLayout => ({ ...defaultHearthLayout, items });
const rug = (extra: Partial<HearthItem> = {}) => ({ id: "t", kind: "trinket", piece: "rug", x: 0, y: 0, w: 4, h: 1, ...extra }) as HearthItem;
const plant = (extra: Partial<HearthItem> = {}) => ({ id: "p", kind: "trinket", piece: "plant", x: 1, y: 1, w: 2, h: 2, ...extra }) as HearthItem;

describe("a Trinket's size", () => {
  it("is always its drawing's shape", () => {
    for (const t of trinkets) {
      const fit = trinketFit(t.key, 3.3, 1.7);
      expect(fit.w / fit.h).toBeCloseTo(trinketAspect(t.key), 1);
    }
  });

  it("stays between a smallest and a biggest", () => {
    for (const t of trinkets) {
      const { minW, maxW } = trinketBounds(t.key);
      const tiny = trinketFit(t.key, 0.01, 0.01);
      const huge = trinketFit(t.key, 99, 99);
      expect(tiny.w).toBeCloseTo(minW, 1);
      expect(Math.min(tiny.w, tiny.h)).toBeGreaterThanOrEqual(0.49);
      expect(huge.w).toBeLessThanOrEqual(COLUMNS);
      expect(huge.h).toBeLessThanOrEqual(5.01);
      expect(huge.w).toBeCloseTo(maxW, 1);
    }
  });

  it("takes any size in between, not just whole cells", () => {
    expect(trinketFit("plant", 1.37, 1.37)).toEqual({ w: 1.37, h: 1.37 });
    expect(trinketFit("rug", 3.1, 9)).toEqual({ w: 3.1, h: 0.93 });
  });

  it("a size slider goes from smallest to biggest and back", () => {
    for (const t of trinkets) {
      const { minW, maxW } = trinketBounds(t.key);
      expect(trinketWidthAt(t.key, 0).w).toBeCloseTo(minW, 1);
      expect(trinketWidthAt(t.key, 1).w).toBeCloseTo(maxW, 1);
      expect(trinketSlideOf(t.key, trinketWidthAt(t.key, 0.5).w)).toBeCloseTo(0.5, 1);
    }
  });
});

describe("resizing a Trinket on the Hearth", () => {
  it("goes to any size, keeping its shape", () => {
    const next = resizeItem(layoutOf([plant()]), "p", 1.42, 0.3).find((i) => i.id === "p")!;
    // Asked for less than the smallest it can be (half a cell).
    expect(next.w).toBe(0.5);
    expect(next.w).toBe(next.h);
    const bigger = resizeItem(layoutOf([plant()]), "p", 2.75, 2.75).find((i) => i.id === "p")!;
    expect(bigger).toMatchObject({ w: 2.75, h: 2.75 });
  });

  it("never pushes anything or is pushed", () => {
    const tile = { id: "n", kind: "nook", nookId: "gift-nook", x: 1, y: 1, w: 2, h: 2 } as HearthItem;
    const next = resizeItem(layoutOf([tile, plant()]), "p", 4, 4);
    expect(next.find((i) => i.id === "n")).toMatchObject({ x: 1, y: 1 });
  });

  it("stays on the Hearth", () => {
    const next = resizeItem(layoutOf([plant({ x: 3.5 })]), "p", 4, 4).find((i) => i.id === "p")!;
    expect(next.x + next.w).toBeLessThanOrEqual(COLUMNS);
  });
});

describe("older Trinkets", () => {
  it("are fitted to their drawing, keeping their bottom middle where it was", () => {
    // A rug that was saved as a 4 × 3 box, drawn along the bottom of it.
    const [fitted] = fitTrinkets([rug({ x: 0, y: 2, w: 4, h: 3 })]);
    expect(fitted.w).toBe(4);
    expect(fitted.h).toBeCloseTo(1.2, 2);
    expect(fitted.y + fitted.h).toBeCloseTo(5, 2);
    expect(fitted.x).toBe(0);
    const [narrow] = fitTrinkets([plant({ x: 0, y: 0, w: 1, h: 2 })]);
    expect(narrow).toMatchObject({ w: 1, h: 1, x: 0, y: 1 });
  });

  it("only change once, and leave Trinkets that already fit alone", () => {
    const once = fitTrinkets([rug({ w: 4, h: 3 }), plant()]);
    expect(fitTrinkets(once)).toBe(once);
    const items = [plant()];
    expect(fitTrinkets(items)).toBe(items);
  });

  it("are fitted inside Hollows and on other pages when a Hearth loads", () => {
    const hollow = { id: "h", kind: "hollow", name: "Den", look: "house", x: 0, y: 0, w: 2, h: 2, items: [rug({ w: 4, h: 3 })] } as unknown as HearthItem;
    const loaded = migrateLayout({ ...defaultHearthLayout, items: [hollow], otherPages: { p2: [plant({ w: 1, h: 2 })] }, pages: [...defaultHearthLayout.pages, { id: "p2", name: "More" }] });
    const inner = (loaded.items[0] as unknown as { items: HearthItem[] }).items[0];
    expect(inner.h).toBeCloseTo(1.2, 2);
    expect(loaded.otherPages.p2[0]).toMatchObject({ w: 1, h: 1 });
  });

  it("new ones start at their own shape", () => {
    const [added] = addItem(layoutOf([]), { id: "n", kind: "trinket", piece: "cat", ...trinketFit("cat", 2, 1) }).slice(-1);
    expect(added.w / added.h).toBeCloseTo(trinketAspect("cat"), 1);
  });
});

describe("turning a Trinket", () => {
  it("keeps degrees between 0 and 359", () => {
    expect(turnedBy(undefined)).toBe(0);
    expect(turnedBy(90)).toBe(90);
    expect(turnedBy(360)).toBe(0);
    expect(turnedBy(-30)).toBe(330);
    expect(turnedBy(725.4)).toBe(5);
  });

  it("is just a number saved with the Trinket, and survives moving and resizing", () => {
    const turned = plant({ rotate: 45 } as Partial<HearthItem>);
    const next = resizeItem(layoutOf([turned]), "p", 1.5, 1.5).find((i) => i.id === "p")!;
    expect((next as { rotate?: number }).rotate).toBe(45);
    expect(JSON.parse(JSON.stringify(next)).rotate).toBe(45);
  });
});

describe("starter layouts' Trinkets", () => {
  it("come out fitted to their drawing", () => {
    for (const starter of starters) {
      const items = fitTrinkets(starter.build());
      for (const item of items.filter((i) => i.kind === "trinket")) {
        if (item.kind === "trinket") expect(item.w / item.h).toBeCloseTo(trinketAspect(item.piece), 1);
      }
    }
  });
});
