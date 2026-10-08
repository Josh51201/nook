import { describe, expect, it } from "vitest";

import { defaultHearthLayout, findHollow, type HearthItem, type HearthLayout } from "../lib/hearth-layout";
import { addPage } from "../lib/hearth-pages";
import { copyMany, moveManyToPage, moveManyToScope, recolorMany, removeMany } from "../lib/hearth-select";
import { defaultWidget } from "../lib/widgets";

// Select many (CORE-060).

const nook = (id: string, x: number, y: number): HearthItem => ({ id, kind: "nook", nookId: id, x, y, w: 2, h: 2 });
const note = (id: string, x: number, y: number): HearthItem => ({ id, kind: "widget", widget: defaultWidget("note"), x, y, w: 2, h: 2 });
const hollow: HearthItem = { id: "h", kind: "hollow", name: "Stuff", look: "house", items: [], x: 0, y: 4, w: 2, h: 2 };
const layoutOf = (items: HearthItem[]): HearthLayout => ({ ...defaultHearthLayout, items });

describe("Select many (CORE-060)", () => {
  it("moves several into a Hollow, none left behind and none overlapping", () => {
    const layout = layoutOf([nook("a", 0, 0), note("b", 2, 0), nook("c", 0, 2), hollow]);
    const items = moveManyToScope(layout, ["a", "b"], "h");
    const inside = (findHollow({ ...layout, items }, "h")!).items;
    expect(inside.map((i) => i.id).sort()).toEqual(["a", "b"]);
    expect(items.filter((i) => i.kind !== "hollow").map((i) => i.id)).toEqual(["c"]);
    expect(new Set(inside.map((i) => `${i.x},${i.y}`)).size).toBe(2);
  });

  it("never puts a Hollow inside a Hollow", () => {
    const layout = layoutOf([nook("a", 0, 0), hollow, { ...hollow, id: "h2", name: "Other", x: 2, y: 4 }]);
    const items = moveManyToScope(layout, ["a", "h2"], "h");
    expect(findHollow({ ...layout, items }, "h")!.items.map((i) => i.id)).toEqual(["a"]);
    expect(items.some((i) => i.id === "h2")).toBe(true);
  });

  it("copies several, leaving the originals", () => {
    const layout = layoutOf([nook("a", 0, 0), note("b", 2, 0), hollow]);
    const { items, copyIds } = copyMany(layout, ["a", "b", "h"], null);
    expect(copyIds).toHaveLength(2); // the Hollow can't be copied
    expect(items).toHaveLength(layout.items.length + 2);
  });

  it("removes several, and a Hollow's contents are kept", () => {
    const withStuff: HearthItem = { ...hollow, items: [note("inner", 0, 0)] } as HearthItem;
    const layout = layoutOf([nook("a", 0, 0), note("b", 2, 0), withStuff]);
    const items = removeMany(layout, ["a", "h"]);
    expect(items.map((i) => i.id).sort()).toEqual(["b", "inner"]);
  });

  it("gives them all one color", () => {
    const layout = layoutOf([nook("a", 0, 0), note("b", 2, 0), nook("c", 0, 2)]);
    const items = recolorMany(layout, ["a", "c"], "#d9e4ef");
    expect(items.filter((i) => i.color === "#d9e4ef").map((i) => i.id)).toEqual(["a", "c"]);
    expect(items.find((i) => i.id === "b")!.color).toBeUndefined();
  });

  it("sends several to another page", () => {
    const start = layoutOf([nook("a", 0, 0), note("b", 2, 0), nook("c", 0, 2)]);
    const added = addPage(start, "Holidays")!;
    // Back on the first page, so Holidays is "another" page.
    const layout: HearthLayout = { ...start, pages: added.changes.pages, otherPages: added.changes.otherPages };
    const moved = moveManyToPage(layout, ["a", "b"], added.id)!;
    expect(moved.items.map((i) => i.id)).toEqual(["c"]);
    expect(moved.otherPages[added.id].map((i) => i.id)).toEqual(["a", "b"]);
    expect(moveManyToPage(layout, ["a"], layout.activePage)).toBeNull();
  });
});
