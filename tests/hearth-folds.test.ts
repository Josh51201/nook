import { describe, expect, it } from "vitest";

import { foldItems, hiddenBy, isDivider } from "../lib/hearth-folds";
import type { HearthItem } from "../lib/hearth-layout";

// Section dividers (CORE-064).

const card = (id: string, x: number, y: number): HearthItem => ({ id, kind: "nook", nookId: id, x, y, w: 2, h: 2 });
const divider = (id: string, y: number): HearthItem => ({ id, kind: "label", text: id, size: "heading", align: "left", x: 0, y, w: 4, h: 1, divider: true });
const at = (items: HearthItem[], id: string) => items.find((i) => i.id === id);

describe("Section dividers (CORE-064)", () => {
  const items = [card("a", 0, 0), divider("d1", 2), card("b", 0, 3), card("c", 2, 3), divider("d2", 5), card("d", 0, 6)];

  it("changes nothing when nothing is folded", () => {
    expect(foldItems(items, [])).toBe(items);
    expect(isDivider(items[1])).toBe(true);
    expect(isDivider(items[0])).toBe(false);
  });

  it("hides what's under a folded divider, up to the next one, and slides the rest up", () => {
    const shown = foldItems(items, ["d1"]);
    expect(at(shown, "b")).toBeUndefined();
    expect(at(shown, "c")).toBeUndefined();
    expect(at(shown, "a")!.y).toBe(0);
    expect(at(shown, "d1")!.y).toBe(2);
    expect(at(shown, "d2")!.y).toBe(3);
    expect(at(shown, "d")!.y).toBe(4);
  });

  it("a divider with no divider after it hides everything to the end", () => {
    const shown = foldItems(items, ["d2"]);
    expect(shown.map((i) => i.id)).toEqual(["a", "d1", "b", "c", "d2"]);
  });

  it("folds several at once", () => {
    const shown = foldItems(items, ["d1", "d2"]);
    expect(shown.map((i) => i.id)).toEqual(["a", "d1", "d2"]);
    expect(at(shown, "d2")!.y).toBe(3);
  });

  it("doesn't change what's saved, and counts what's hidden", () => {
    foldItems(items, ["d1"]);
    expect(at(items, "b")!.y).toBe(3);
    expect(hiddenBy(items, "d1")).toBe(2);
    expect(hiddenBy(items, "d2")).toBe(1);
    expect(hiddenBy(items, "nope")).toBe(0);
  });

  it("an empty section folds to nothing", () => {
    const two = [divider("x", 0), divider("y", 1), card("z", 0, 2)];
    expect(foldItems(two, ["x"])).toEqual(two);
  });
});
