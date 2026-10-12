import { describe, expect, it } from "vitest";

import {
  addItem,
  defaultHearthLayout,
  isFloating,
  moveItem,
  nudgeItem,
  overlaps,
  resizeItem,
  tidyItems,
  type HearthItem,
  type HearthLayout,
  type Nudge,
} from "../lib/hearth-layout";

// However things are moved, swapped, nudged, resized and tidied, nothing on
// the Hearth ever ends up on top of something else (CORE-091). Trinkets and
// Cubbies float, so they're allowed to overlap.

function random(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function stuckTogether(items: HearthItem[]) {
  const solid = items.filter((item) => !isFloating(item));
  for (let i = 0; i < solid.length; i++) {
    for (let j = i + 1; j < solid.length; j++) {
      const a = solid[i];
      const b = solid[j];
      if (a.stack && a.stack === b.stack) continue;
      if (overlaps(a, b)) return `${a.id} and ${b.id}`;
    }
  }
  return null;
}

function startingHearth(rand: () => number): HearthLayout {
  let layout: HearthLayout = { ...defaultHearthLayout, items: [] };
  for (let i = 0; i < 14; i++) {
    const pick = rand();
    const id = `i${i}`;
    const item =
      pick < 0.25
        ? { id, kind: "label" as const, text: "Hi", size: "heading" as const, align: "left" as const, w: 1 + Math.floor(rand() * 4), h: rand() < 0.5 ? 0.5 : 1 }
        : pick < 0.35
        ? { id, kind: "cubby" as const, style: "crate" as const, w: 2, h: 2 }
        : { id, kind: "nook" as const, nookId: id, w: 1 + Math.floor(rand() * 2), h: 1 + Math.floor(rand() * 2) };
    layout = { ...layout, items: addItem(layout, item) };
  }
  // A couple of things locked in place (CORE-061).
  layout.items = layout.items.map((item, i) => (i % 6 === 5 ? { ...item, locked: true } : item));
  return layout;
}

const ways: Nudge[] = ["up", "down", "left", "right"];

describe("arranging never leaves things stuck in each other", () => {
  for (let seed = 1; seed <= 40; seed++) {
    it(`random arranging #${seed}`, () => {
      const rand = random(seed);
      let layout = startingHearth(rand);
      expect(stuckTogether(layout.items)).toBeNull();
      for (let step = 0; step < 60; step++) {
        const item = layout.items[Math.floor(rand() * layout.items.length)];
        const action = rand();
        let next: HearthItem[];
        if (action < 0.55) next = moveItem(layout, item.id, Math.floor(rand() * 4), Math.floor(rand() * 20) / 2);
        else if (action < 0.75) next = nudgeItem(layout, item.id, ways[Math.floor(rand() * 4)]);
        else if (action < 0.95) next = resizeItem(layout, item.id, 1 + Math.floor(rand() * 4), 1 + Math.floor(rand() * 3));
        else next = tidyItems(layout.items);
        const stuck = stuckTogether(next);
        expect(stuck, `step ${step}: ${stuck}`).toBeNull();
        // Locked things never move.
        for (const before of layout.items.filter((i) => i.locked)) {
          const after = next.find((i) => i.id === before.id)!;
          expect([after.x, after.y, after.w, after.h]).toEqual([before.x, before.y, before.w, before.h]);
        }
        layout = { ...layout, items: next };
      }
    });
  }
});
