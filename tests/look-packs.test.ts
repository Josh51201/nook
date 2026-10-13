import { describe, expect, it } from "vitest";

import type { HearthItem, WidgetItem } from "../lib/hearth-layout";
import { applyPack, lookPack, lookPacks, widgetCount } from "../lib/look-packs";
import { facesFor, naturalFace } from "../lib/widget-faces";
import { naturalSkin, sameSkin, swaysIn, skinFor } from "../lib/widget-skins";
import { defaultWidget, type WidgetKind } from "../lib/widgets";

// Look packs (CORE-129) and swinging in a breeze (CORE-130).

const widget = (id: string, kind: WidgetKind, x: number, y: number, more: Partial<WidgetItem> = {}): WidgetItem => ({
  id,
  kind: "widget",
  x,
  y,
  w: 2,
  h: 2,
  color: "#f4c2d7",
  widget: { ...defaultWidget(kind), skin: { material: "glass" }, face: undefined },
  ...more,
});

const page: HearthItem[] = [
  widget("b", "note", 2, 0),
  widget("a", "countdown", 0, 0),
  widget("c", "greeting", 0, 2),
  { id: "t", kind: "nook", nookId: "gift", x: 2, y: 2, w: 1, h: 1, color: "#cfe6b5" },
  widget("d", "quote", 0, 4),
];

const skinOf = (items: HearthItem[], id: string) => (items.find((i) => i.id === id) as WidgetItem).widget;

describe("look packs", () => {
  it("every pack has a different id, and each face it gives is one that kind has", () => {
    expect(new Set(lookPacks.map((p) => p.id)).size).toBe(lookPacks.length);
    for (const pack of lookPacks) {
      for (const [kind, face] of Object.entries(pack.faces ?? {})) {
        expect(facesFor(kind as WidgetKind).some((f) => f.key === face), `${pack.id} ${kind}`).toBe(true);
      }
    }
  });

  it("dresses every widget, taking turns top to bottom, and leaves everything else alone", () => {
    const pack = lookPack("scrapbook")!;
    const out = applyPack(page, pack);
    // Top row left to right, then down: a, b, c, d.
    expect(sameSkin(skinOf(out, "a").skin, pack.skins![0])).toBe(true);
    expect(sameSkin(skinOf(out, "b").skin, pack.skins![1])).toBe(true);
    expect(sameSkin(skinOf(out, "c").skin, pack.skins![2])).toBe(true);
    expect(sameSkin(skinOf(out, "d").skin, pack.skins![3])).toBe(true);
    expect(out.find((i) => i.id === "t")).toBe(page[3]);
    // Colors stay.
    expect((out[0] as WidgetItem).color).toBe("#f4c2d7");
    // And some kinds get the pack's face.
    expect(skinOf(out, "a").face).toBe("chain");
    expect(skinOf(out, "c").face).toBe("bunting");
    expect(skinOf(out, "b").face).toBeUndefined();
  });

  it("widgets in a stack share a look", () => {
    const stacked = [widget("x", "note", 0, 0, { stack: "s1" }), widget("y", "clock", 0, 0, { stack: "s1" }), widget("z", "note", 2, 0)];
    const pack = lookPack("cabin")!;
    const out = applyPack(stacked, pack);
    expect(skinOf(out, "x").skin).toEqual(skinOf(out, "y").skin);
    expect(sameSkin(skinOf(out, "z").skin, pack.skins![1])).toBe(true);
  });

  it("Each its own gives every widget its natural look; Plain cards takes it all off", () => {
    const natural = applyPack(page, lookPack("natural")!);
    expect(skinOf(natural, "a").skin).toEqual(naturalSkin("countdown"));
    expect(skinOf(natural, "d").face).toBe(naturalFace("quote"));
    const plain = applyPack(natural, lookPack("plain")!);
    for (const id of ["a", "b", "c", "d"]) {
      expect(skinOf(plain, id).skin).toBeUndefined();
      expect(skinOf(plain, id).face).toBeUndefined();
    }
  });

  it("counts the widgets it would dress", () => {
    expect(widgetCount(page)).toBe(4);
  });
});

describe("swinging in a breeze", () => {
  it("only things hung from one point, only in rain or falling leaves", () => {
    const pinned = skinFor("note", { hanger: "pin" });
    expect(swaysIn("rain", pinned)).toBe(true);
    expect(swaysIn("leaves", skinFor("frame", { hanger: "nail" }))).toBe(true);
    expect(swaysIn("snow", pinned)).toBe(false);
    expect(swaysIn(null, pinned)).toBe(false);
    expect(swaysIn("rain", skinFor("note", { hanger: "tape" }))).toBe(false);
    expect(swaysIn("rain", skinFor("note", { hanger: "shelf" }))).toBe(false);
  });
});
