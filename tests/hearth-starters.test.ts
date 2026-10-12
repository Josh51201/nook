import { describe, expect, it } from "vitest";

import {
  COLUMNS,
  defaultHearthLayout,
  isFloating,
  minSize,
  overlaps,
  starterItems,
  type HearthItem,
  type HearthLayout,
} from "../lib/hearth-layout";
import { MAX_PAGES } from "../lib/hearth-pages";
import { isFreshPage, starters, startFrom } from "../lib/hearth-starters";
import { HOME_PAGE } from "../lib/home-hearth";
import { findNook } from "../lib/nooks";

// Starter layouts (CORE-096).

const layoutOf = (items: HearthItem[], extra: Partial<HearthLayout> = {}): HearthLayout => ({ ...defaultHearthLayout, items, ...extra });

describe("starter layouts", () => {
  for (const starter of starters) {
    describe(starter.name, () => {
      const items = starter.build();

      it("fits the grid, with nothing on top of anything else", () => {
        for (const item of items) {
          expect(item.x).toBeGreaterThanOrEqual(0);
          expect(item.x + item.w).toBeLessThanOrEqual(COLUMNS);
          expect(item.y).toBeGreaterThanOrEqual(0);
        }
        const solid = items.filter((item) => !isFloating(item));
        for (let i = 0; i < solid.length; i++) {
          for (let j = i + 1; j < solid.length; j++) expect(overlaps(solid[i], solid[j]), `${i} and ${j}`).toBe(false);
        }
      });

      it("uses sizes each thing can really be", () => {
        for (const item of items) {
          const min = minSize(item);
          expect(item.w).toBeGreaterThanOrEqual(min.w);
          expect(item.h).toBeGreaterThanOrEqual(min.h);
        }
      });

      it("only puts out Nooks that exist and can be opened", () => {
        for (const item of items.filter((i) => i.kind === "nook")) {
          const info = item.kind === "nook" ? findNook(item.nookId) : undefined;
          expect(info, item.kind === "nook" ? item.nookId : "").toBeDefined();
          expect(info!.available).toBe(true);
          expect(info!.route).toBeTruthy();
        }
      });

      it("makes fresh ids every time, so it can be used twice", () => {
        const again = starter.build();
        const ids = new Set(items.map((i) => i.id));
        expect(again.some((i) => ids.has(i.id))).toBe(false);
        expect(new Set(again.map((i) => i.id)).size).toBe(again.length);
      });
    });
  }

  it("includes a Christmas one", () => {
    expect(starters.some((s) => s.id === "christmas")).toBe(true);
  });
});

describe("starting from a layout", () => {
  it("becomes the page when the Hearth is brand new (just the welcome)", () => {
    const layout = layoutOf(starterItems());
    expect(isFreshPage(layout)).toBe(true);
    const result = startFrom(layout, "christmas")!;
    expect(result.newPage).toBe(false);
    expect(result.changes.items!.length).toBeGreaterThan(5);
    // A fresh Hearth gets the look too.
    expect(result.changes.ambience).toBe("snow");
  });

  it("comes in as a new page when there's already something here, replacing nothing", () => {
    const mine = { id: "mine", kind: "nook", nookId: "gift-nook", x: 0, y: 0, w: 2, h: 2 } as HearthItem;
    const layout = layoutOf([mine]);
    const result = startFrom(layout, "christmas")!;
    expect(result.newPage).toBe(true);
    expect(result.changes.pages!.length).toBe(layout.pages.length + 1);
    expect(result.changes.pages![result.changes.pages!.length - 1].name).toBe("Christmas");
    // What was here waits on its own page; the new page is the one shown.
    expect(Object.values(result.changes.otherPages!).flat()).toContainEqual(mine);
    expect(result.changes.activePage).not.toBe(layout.activePage);
    // The look is left alone, since it would change every page.
    expect(result.changes.ambience).toBeUndefined();
  });

  it("never replaces the page shared with your Home", () => {
    const layout = layoutOf([], { activePage: HOME_PAGE, pages: [...defaultHearthLayout.pages, { id: HOME_PAGE, name: "Home" }] });
    expect(isFreshPage(layout)).toBe(false);
    expect(startFrom(layout, "family")!.newPage).toBe(true);
  });

  it("says so when there's no room for another page", () => {
    const pages = Array.from({ length: MAX_PAGES }, (_, i) => ({ id: `p${i}`, name: `Page ${i}` }));
    const mine = { id: "mine", kind: "nook", nookId: "gift-nook", x: 0, y: 0, w: 2, h: 2 } as HearthItem;
    const layout = layoutOf([mine], { pages, activePage: "p0", otherPages: Object.fromEntries(pages.slice(1).map((p) => [p.id, []])) });
    expect(startFrom(layout, "home")).toBeNull();
  });
});
