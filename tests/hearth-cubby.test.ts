import { describe, expect, it } from "vitest";

import {
  addItem,
  cubbyContents,
  defaultHearthLayout,
  itemSpokenName,
  moveItem,
  nudgeItem,
  planMove,
  resizeItem,
  tidyItems,
  type HearthItem,
  type HearthLayout,
} from "../lib/hearth-layout";
import { spaceLoad } from "../lib/hearth-limits";
import { cubbyFillOpacity, cubbyStyleInfo } from "../lib/cubbies";

// Cubbies (CORE-084): decorated boxes behind your things, which carry what's
// inside them when they move.

const nook = (id: string, x: number, y: number, w = 2, h = 2, locked?: boolean): HearthItem => ({
  id,
  kind: "nook",
  nookId: id,
  x,
  y,
  w,
  h,
  ...(locked ? { locked } : {}),
});
const cubby = (id: string, x: number, y: number, w: number, h: number): HearthItem => ({ id, kind: "cubby", style: "cardboard", x, y, w, h });
const layoutOf = (items: HearthItem[]): HearthLayout => ({ ...defaultHearthLayout, items });
const at = (items: HearthItem[], id: string) => {
  const item = items.find((i) => i.id === id)!;
  return { x: item.x, y: item.y, w: item.w, h: item.h };
};

describe("what's in a Cubby", () => {
  it("is everything wholly inside it, but not things half in or locked", () => {
    const box = cubby("box", 0, 0, 4, 2);
    const items = [box, nook("a", 0, 0), nook("b", 2, 0), nook("half", 2, 1), nook("locked", 0, 0, 1, 1, true)];
    expect(cubbyContents(items, box as never).map((i) => i.id)).toEqual(["a", "b"]);
  });
});

describe("adding a Cubby", () => {
  it("never lands on top of another Cubby", () => {
    const first = addItem(layoutOf([]), { id: "one", kind: "cubby", style: "crate", w: 4, h: 2 });
    const second = addItem(layoutOf(first), { id: "two", kind: "cubby", style: "gift", w: 4, h: 2 });
    expect(at(second, "one")).toMatchObject({ x: 0, y: 0 });
    expect(at(second, "two")).toMatchObject({ x: 0, y: 2 });
  });
});

describe("moving a Cubby", () => {
  it("carries a smaller Cubby inside it, but not one the same size", () => {
    const items = [cubby("big", 0, 0, 4, 4), cubby("small", 0, 0, 2, 2), cubby("twin", 0, 0, 4, 4)];
    const next = moveItem(layoutOf(items), "big", 0, 5);
    expect(at(next, "small")).toMatchObject({ y: 5 });
    expect(at(next, "twin")).toMatchObject({ y: 0 });
  });

  it("brings what's inside along", () => {
    const items = [cubby("box", 0, 0, 4, 2), nook("a", 0, 0), nook("b", 2, 0)];
    const next = moveItem(layoutOf(items), "box", 0, 3);
    expect(at(next, "box")).toEqual({ x: 0, y: 3, w: 4, h: 2 });
    expect(at(next, "a")).toEqual({ x: 0, y: 3, w: 2, h: 2 });
    expect(at(next, "b")).toEqual({ x: 2, y: 3, w: 2, h: 2 });
  });

  it("goes back where it was if what's inside would land on something, pushing nothing (CORE-091)", () => {
    const layout = layoutOf([cubby("box", 0, 0, 2, 2), nook("a", 0, 0), nook("below", 0, 3)]);
    expect(planMove(layout.items, "box", 0, 3).kind).toBe("blocked");
    expect(moveItem(layout, "box", 0, 3)).toBe(layout.items);
  });

  it("goes back too if what's inside would land on something locked", () => {
    const layout = layoutOf([cubby("box", 0, 0, 2, 2), nook("a", 0, 0), nook("stay", 0, 3, 2, 2, true)]);
    expect(moveItem(layout, "box", 0, 3)).toBe(layout.items);
  });

  it("an empty box goes anywhere, even behind things", () => {
    const items = [cubby("box", 0, 4, 2, 2), nook("a", 0, 0)];
    expect(at(moveItem(layoutOf(items), "box", 0, 0), "box")).toMatchObject({ x: 0, y: 0 });
    expect(at(moveItem(layoutOf(items), "box", 0, 0), "a")).toMatchObject({ x: 0, y: 0 });
  });

  it("snaps to cells and half rows, and stays on the grid", () => {
    const items = [cubby("box", 0, 0, 2, 2)];
    expect(at(moveItem(layoutOf(items), "box", 3.4, 1.6), "box")).toMatchObject({ x: 2, y: 1.5 });
  });

  it("moves with the arrows too, a half row at a time", () => {
    const items = [cubby("box", 0, 0, 2, 2), nook("a", 0, 0)];
    const next = nudgeItem(layoutOf(items), "box", "down");
    expect(at(next, "box")).toMatchObject({ y: 0.5 });
    expect(at(next, "a")).toMatchObject({ y: 0.5 });
  });
});

describe("a Cubby among other things", () => {
  it("is never pushed out of the way by things dropped on it, and never pushes", () => {
    const items = [cubby("box", 0, 0, 4, 2), nook("a", 2, 4)];
    const next = moveItem(layoutOf(items), "a", 0, 0);
    expect(at(next, "box")).toEqual({ x: 0, y: 0, w: 4, h: 2 });
    expect(at(next, "a")).toMatchObject({ x: 0, y: 0 });
    const grown = resizeItem(layoutOf(next), "box", 4, 4);
    expect(at(grown, "a")).toMatchObject({ x: 0, y: 0 });
  });

  it("can be a half row taller, to hold slim text", () => {
    const items = [cubby("box", 0, 0, 4, 2)];
    expect(at(resizeItem(layoutOf(items), "box", 4, 2.4), "box")).toMatchObject({ h: 2.5 });
  });

  it("follows its things when the Hearth is tidied", () => {
    const items = [cubby("box", 0, 2.5, 4, 3), nook("a", 0, 3), nook("b", 2, 3)];
    const next = tidyItems(items);
    expect(at(next, "a")).toMatchObject({ y: 0 });
    // It had half a row above its things and half below, and keeps that room.
    expect(at(next, "box")).toEqual({ x: 0, y: 0, w: 4, h: 2.5 });
  });

  it("is a light decoration for the page limit", () => {
    expect(spaceLoad([cubby("a", 0, 0, 2, 2), cubby("b", 2, 0, 2, 2)])).toBe(1);
  });

  it("is read out as a decoration, by its style", () => {
    expect(itemSpokenName(cubby("box", 0, 0, 2, 2))).toBe("Cardboard box, decoration");
  });
});

describe("Cubby styles", () => {
  it("falls back to the cardboard box for an unknown style", () => {
    expect(cubbyStyleInfo("nope").key).toBe("cardboard");
  });

  it("lets the wallpaper through more as the fill gets clearer", () => {
    expect(cubbyFillOpacity(undefined)).toBe(1);
    expect(cubbyFillOpacity("soft")).toBeLessThan(1);
    expect(cubbyFillOpacity("clear")).toBeLessThan(cubbyFillOpacity("soft"));
  });
});
