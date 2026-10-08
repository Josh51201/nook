import { describe, expect, it } from "vitest";

import { addItem, defaultHearthLayout, moveItem, resizeItem, tidyItems, type HearthItem, type HearthLayout } from "../lib/hearth-layout";
import { trinketInfo } from "../lib/trinkets";

// Trinkets float (CORE-045): anywhere, between cells, overlapping, never in the way.

const card = (id: string, x: number, y: number): HearthItem => ({ id, kind: "nook", nookId: id, x, y, w: 2, h: 2 });
const rug = (id: string, x: number, y: number): HearthItem => ({
  id,
  kind: "trinket",
  piece: "cat",
  color: trinketInfo("cat").color,
  x,
  y,
  w: 1,
  h: 1,
});
const layoutOf = (items: HearthItem[]): HearthLayout => ({ ...defaultHearthLayout, items });
const at = (items: HearthItem[], id: string) => items.find((i) => i.id === id)!;

describe("Trinkets go anywhere (CORE-045)", () => {
  it("keeps a position between cells, to the hundredth", () => {
    const moved = moveItem(layoutOf([rug("t", 0, 0)]), "t", 1.3333, 2.5);
    expect([at(moved, "t").x, at(moved, "t").y]).toEqual([1.33, 2.5]);
  });

  it("stays inside the Hearth's edges", () => {
    const moved = moveItem(layoutOf([rug("t", 0, 0)]), "t", 9, -3);
    expect([at(moved, "t").x, at(moved, "t").y]).toEqual([3, 0]);
  });

  it("can sit on top of things without pushing them", () => {
    const layout = layoutOf([card("a", 0, 0), rug("t", 3, 3)]);
    const moved = moveItem(layout, "t", 0.5, 0.5);
    expect([at(moved, "a").x, at(moved, "a").y]).toEqual([0, 0]);
    expect([at(moved, "t").x, at(moved, "t").y]).toEqual([0.5, 0.5]);
  });

  it("is never pushed by something dropped on it", () => {
    const layout = layoutOf([card("a", 3, 3), rug("t", 0.5, 0.5)]);
    const moved = moveItem(layout, "a", 0, 0);
    expect([at(moved, "t").x, at(moved, "t").y]).toEqual([0.5, 0.5]);
    expect([at(moved, "a").x, at(moved, "a").y]).toEqual([0, 0]);
  });

  it("doesn't take up a cell when adding something new", () => {
    const layout = layoutOf([rug("t", 0, 0)]);
    const items = addItem(layout, { id: "n", kind: "nook", nookId: "n", w: 2, h: 2 });
    expect([at(items, "n").x, at(items, "n").y]).toEqual([0, 0]);
  });

  it("is left alone by tidy up, and resizing keeps it in bounds", () => {
    const tidy = tidyItems([card("a", 0, 5), rug("t", 1.4, 6.2)]);
    expect([at(tidy, "t").x, at(tidy, "t").y]).toEqual([1.4, 6.2]);
    expect(at(tidy, "a").y).toBe(0);
    const bigger = resizeItem(layoutOf([rug("t", 3.4, 1.1)]), "t", 2, 2);
    expect(at(bigger, "t").x).toBe(2);
  });
});
