import { describe, expect, it } from "vitest";

import {
  addNook,
  defaultHearthLayout,
  hasNook,
  moveTile,
  removeNook,
  tileLabel,
  updateTile,
  type HearthLayout,
} from "../lib/hearth-layout";

// The Hearth's layout rules (CORE-002/003/006-009). Pure functions, so
// these run without Supabase or a phone.

const layout: HearthLayout = {
  title: "Test Hearth",
  theme: "hearth",
  sections: [
    {
      id: "a",
      title: "Family",
      tiles: [
        { nookId: "gift-nook", size: "small" },
        { nookId: "to-do", size: "wide" },
      ],
    },
    { id: "b", title: "Me", tiles: [{ nookId: "food-tracker", size: "small" }] },
  ],
};

const ids = (l: HearthLayout["sections"]) => l.map((s) => s.tiles.map((t) => t.nookId));

describe("Hearth layout", () => {
  it("adding a Nook puts it at the end of the first section", () => {
    const sections = addNook(defaultHearthLayout, "gift-nook");
    expect(ids(sections)).toEqual([["gift-nook"]]);
    expect(sections[0].tiles[0].size).toBe("small");
  });

  it("adding a Nook that's already there changes nothing", () => {
    expect(addNook(layout, "gift-nook")).toBe(layout.sections);
  });

  it("adding a Nook to a Hearth with no sections creates one", () => {
    const sections = addNook({ ...layout, sections: [] }, "gift-nook");
    expect(ids(sections)).toEqual([["gift-nook"]]);
  });

  it("removing a Nook takes its tile off the Hearth", () => {
    const sections = removeNook(layout, "to-do");
    expect(ids(sections)).toEqual([["gift-nook"], ["food-tracker"]]);
    expect(hasNook({ ...layout, sections }, "to-do")).toBe(false);
  });

  it("moves a tile to another section at a position", () => {
    expect(ids(moveTile(layout, "gift-nook", "b", 0))).toEqual([["to-do"], ["gift-nook", "food-tracker"]]);
    expect(ids(moveTile(layout, "gift-nook", "b", 1))).toEqual([["to-do"], ["food-tracker", "gift-nook"]]);
  });

  it("reorders a tile within its own section", () => {
    expect(ids(moveTile(layout, "gift-nook", "a", 1))).toEqual([["to-do", "gift-nook"], ["food-tracker"]]);
  });

  it("clamps an out-of-range index to the end", () => {
    expect(ids(moveTile(layout, "gift-nook", "b", 99))).toEqual([["to-do"], ["food-tracker", "gift-nook"]]);
  });

  it("never duplicates or loses a tile when moving", () => {
    const sections = moveTile(layout, "to-do", "b", 0);
    expect(sections.flatMap((s) => s.tiles).map((t) => t.nookId).sort()).toEqual(
      ["food-tracker", "gift-nook", "to-do"]
    );
  });

  it("ignores moves of a Nook that isn't on the Hearth", () => {
    expect(moveTile(layout, "nope", "b", 0)).toBe(layout.sections);
  });

  it("updates one tile's size/color/name without touching others", () => {
    const sections = updateTile(layout, "gift-nook", { size: "large", color: "#dfe8d6", label: "Gifts" });
    expect(sections[0].tiles[0]).toEqual({ nookId: "gift-nook", size: "large", color: "#dfe8d6", label: "Gifts" });
    expect(sections[0].tiles[1]).toBe(layout.sections[0].tiles[1]);
  });

  it("falls back to the Nook's own name when the custom one is blank", () => {
    expect(tileLabel({ nookId: "gift-nook", size: "small", label: "  " })).toBe("Gift Nook");
    expect(tileLabel({ nookId: "gift-nook", size: "small", label: "Gifts" })).toBe("Gifts");
  });
});
