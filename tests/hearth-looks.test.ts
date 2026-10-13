import { describe, expect, it } from "vitest";

import type { HearthItem } from "../lib/hearth-layout";
import { lookOf, paintItem, requestPaint, takePaintRequest } from "../lib/hearth-looks";
import { defaultWidget } from "../lib/widgets";

// Copy a look and paste it on other things (CORE-097).

const widget = (extra: Partial<HearthItem> = {}, look: "soft" | "bold" | "outline" = "soft") =>
  ({ id: "w", kind: "widget", widget: { ...defaultWidget("note"), look }, x: 0, y: 0, w: 2, h: 2, ...extra }) as HearthItem;
const tile = (extra: Partial<HearthItem> = {}) => ({ id: "n", kind: "nook", nookId: "gift-nook", x: 2, y: 0, w: 2, h: 2, ...extra }) as HearthItem;
const text = (extra: Partial<HearthItem> = {}) =>
  ({ id: "l", kind: "label", text: "Hi", size: "heading", align: "left", x: 0, y: 2, w: 4, h: 1, ...extra }) as HearthItem;

describe("copying and pasting a look", () => {
  it("gives a widget's whole look to a Nook tile, but leaves the tile's shape", () => {
    const from = widget({ color: "#efd9e4", corners: "round", lift: "floating", border: true }, "bold");
    const painted = paintItem(tile({ shape: "door", corners: "square" }), lookOf(from)!)!;
    expect(painted).toMatchObject({ color: "#efd9e4", corners: "round", lift: "floating", border: true, look: "bold", shape: "door" });
  });

  it("gives a Nook tile's look, shape and all, to another tile", () => {
    const from = tile({ color: "#dfe8d6", shape: "window", look: "outline" });
    expect(paintItem(tile({ id: "other", shape: "arch" }), lookOf(from)!)).toMatchObject({ shape: "window", look: "outline", color: "#dfe8d6" });
  });

  it("gives a Nook tile's material, nameplate and porch light to another tile (CORE-137, 139)", () => {
    const from = tile({ material: "wood", nameplate: true, porchLight: true });
    expect(paintItem(tile({ id: "other" }), lookOf(from)!)).toMatchObject({ material: "wood", nameplate: true, porchLight: true });
    // Pasting a plain tile's look takes them off again.
    const painted = paintItem(from, lookOf(tile({ id: "plain" }))!)!;
    expect(painted.kind === "nook" && [painted.material, painted.nameplate, painted.porchLight]).toEqual([undefined, undefined, undefined]);
  });

  it("a widget's look leaves a Nook tile's material, nameplate and porch light be", () => {
    const painted = paintItem(tile({ material: "felt", nameplate: true, porchLight: true }), lookOf(widget())!)!;
    expect(painted).toMatchObject({ material: "felt", nameplate: true, porchLight: true });
  });

  it("makes things the same, clearing what the copied one doesn't have", () => {
    const plain = widget();
    const fancy = widget({ id: "fancy", color: "#f3e6b8", corners: "round", lift: "floating", border: true }, "bold");
    const painted = paintItem(fancy, lookOf(plain)!)!;
    expect(painted.color).toBeUndefined();
    expect(painted.corners).toBeUndefined();
    expect(painted.kind === "widget" && painted.widget.look).toBe("soft");
  });

  it("a plain Nook tile's look is soft, so pasting it isn't left bold", () => {
    const painted = paintItem(widget({}, "bold"), lookOf(tile())!)!;
    expect(painted.kind === "widget" && painted.widget.look).toBe("soft");
  });

  it("copies how text is written onto other text, but keeps its words and place", () => {
    const from = text({ font: "handwritten", bold: true, decor: "ribbon", letters: "upper", color: "#8a5a3b", size: "title" } as Partial<HearthItem>);
    const painted = paintItem(text({ id: "other", text: "Hello", x: 1, y: 5 }), lookOf(from)!)!;
    expect(painted).toMatchObject({ text: "Hello", x: 1, y: 5, font: "handwritten", bold: true, decor: "ribbon", letters: "upper", color: "#8a5a3b", size: "title" });
  });

  it("doesn't mix text and tile looks", () => {
    expect(paintItem(text(), lookOf(widget())!)).toBeNull();
    expect(paintItem(widget(), lookOf(text())!)).toBeNull();
  });

  it("a Hollow takes just the color; boxes and Trinkets keep their own", () => {
    const hollow = { id: "h", kind: "hollow", name: "Den", look: "house", items: [], x: 0, y: 0, w: 2, h: 2 } as unknown as HearthItem;
    expect(paintItem(hollow, lookOf(widget({ color: "#d9e4ef" }))!)).toMatchObject({ color: "#d9e4ef", look: "house" });
    const rug = { id: "t", kind: "trinket", piece: "rug", x: 0, y: 0, w: 4, h: 1 } as HearthItem;
    expect(paintItem(rug, lookOf(widget({ color: "#d9e4ef" }))!)).toBeNull();
    expect(lookOf(rug)).toBeNull();
  });

  it("hands a look from the widget editor to the Hearth once", () => {
    requestPaint(lookOf(widget())!);
    expect(takePaintRequest()).not.toBeNull();
    expect(takePaintRequest()).toBeNull();
  });
});
