import { describe, expect, it } from "vitest";

import { contrast, pickerColor, pickerGreys, pickerHues, pickerTiers } from "../lib/colors";
import { tilePalette, type WidgetItem } from "../lib/hearth-layout";
import { lookOf, paintItem } from "../lib/hearth-looks";
import {
  messyTilt,
  seasonalAccent,
  edgePath,
  edges,
  isPlainCard,
  materialColors,
  materials,
  naturalSkin,
  pathNumbers,
  readsWell,
  sameSkin,
  skinFor,
  skinIdeas,
  skinSummary,
  surpriseSkin,
  takesMaterial,
} from "../lib/widget-skins";
import { defaultWidget, widgetKinds } from "../lib/widgets";

// Widget looks (CORE-122..126): materials, cut edges, hangers and tilt.

const everyColor = [
  undefined,
  ...tilePalette,
  ...pickerGreys,
  ...pickerHues.flatMap((hue) => pickerTiers.map((_, tier) => pickerColor(hue, tier))),
];

describe("materials", () => {
  it("keep words readable on every material in every color you can pick", () => {
    for (const { key } of materials) {
      for (const color of everyColor) {
        const c = materialColors(key, color);
        expect(readsWell(c), `${key} in ${color ?? "its own color"}`).toBe(true);
        // Quieter text still reads.
        if (!c.muted.startsWith("rgba")) expect(contrast(c.muted, c.base), `${key} muted in ${color}`).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it("dark materials take light text", () => {
    for (const key of ["chalkboard", "wood", "felt"] as const) expect(materialColors(key, undefined).dark).toBe(true);
    for (const key of ["paper", "kraft", "notebook", "index", "cork", "linen", "glass"] as const) expect(materialColors(key, undefined).dark).toBe(false);
  });

  it("a fridge, frame, window or pet bed can't be made of anything, but can still hang and lean", () => {
    const s = skinFor("fridge", { material: "wood", edge: "torn", hanger: "magnet", tilt: 3, print: "dots", font: "handwritten", accent: "holly" });
    expect(s).toEqual({ material: "plain", edge: "plain", hanger: "magnet", tilt: 3, print: "none", font: "app", accent: "holly", frame: "none", band: false, gradient: "none" });
    expect(takesMaterial("note")).toBe(true);
  });

  it("an old widget with no skin is still a plain card", () => {
    const s = skinFor("note", undefined);
    expect(s).toEqual({ material: "plain", edge: "plain", hanger: "none", tilt: 0, print: "none", font: "app", accent: "none", frame: "none", band: false, gradient: "none" });
    expect(isPlainCard(s)).toBe(true);
    // A print is drawn on the card, so it's not plain any more.
    expect(isPlainCard({ ...s, print: "gingham" })).toBe(false);
    expect(isPlainCard({ ...s, edge: "stitch" })).toBe(true);
    expect(isPlainCard({ ...s, edge: "torn" })).toBe(false);
  });
});

describe("cut edges", () => {
  it("stay inside their box at every size", () => {
    for (const { key } of edges) {
      for (const [w, h] of [
        [76, 76],
        [164, 164],
        [340, 76],
        [164, 340],
      ]) {
        const path = edgePath(key, w, h, 24);
        expect(path.startsWith("M"), key).toBe(true);
        expect(path.trim().endsWith("Z"), key).toBe(true);
        // Arc commands carry radii and flags too; none of those exceed the box either.
        for (const n of pathNumbers(path)) {
          expect(n, `${key} ${w}x${h}`).toBeGreaterThanOrEqual(0);
          expect(n, `${key} ${w}x${h}`).toBeLessThanOrEqual(Math.max(w, h));
        }
      }
    }
  });

  it("tear the same way every time", () => {
    expect(edgePath("torn", 164, 164, 24)).toBe(edgePath("torn", 164, 164, 24));
  });
});

describe("natural looks", () => {
  it("every new widget starts in its own look, one it can wear", () => {
    for (const { kind } of widgetKinds) {
      const widget = defaultWidget(kind);
      expect(widget.skin).toEqual(naturalSkin(kind));
      if (!takesMaterial(kind)) expect(widget.skin?.material).toBeUndefined();
    }
  });

  it("aren't all the same", () => {
    const looks = new Set(widgetKinds.map(({ kind }) => naturalSkin(kind).material ?? "plain"));
    expect(looks.size).toBeGreaterThanOrEqual(8);
  });

  it("summarize in a few words", () => {
    expect(skinSummary("tucks", naturalSkin("tucks"))).toBe("Kraft paper · Torn edges · Washi tape");
    expect(skinSummary("note", { tilt: -1.5 })).toBe("Leaning");
    expect(skinSummary("launch", undefined)).toBe("");
    expect(skinSummary("note", { print: "gingham", font: "handwritten", accent: "holly" })).toBe("Gingham · Handwritten · Holly");
  });
});

describe("Surprise me", () => {
  it("always picks something different from what it has", () => {
    for (let i = 0; i < 20; i++) {
      const current = skinIdeas[i % skinIdeas.length];
      const next = surpriseSkin("note", current, i / 20);
      expect(sameSkin(next, current)).toBe(false);
    }
  });

  it("only offers a hanger and lean to widgets that draw themselves", () => {
    for (let i = 0; i < 10; i++) {
      const next = surpriseSkin("frame", undefined, i / 10);
      expect(next.material).toBeUndefined();
      expect(next.edge).toBeUndefined();
    }
  });
});

describe("copy look", () => {
  const widget = (id: string, skin?: WidgetItem["widget"]["skin"]): WidgetItem => ({
    id,
    kind: "widget",
    x: 0,
    y: 0,
    w: 2,
    h: 2,
    widget: { ...defaultWidget("note"), skin },
  });

  it("carries what it's made of, its edges, hanger and tilt to another widget", () => {
    const from = widget("a", { material: "chalkboard", edge: "torn", hanger: "nail", tilt: 3 });
    const painted = paintItem(widget("b", { material: "paper" }), lookOf(from)!) as WidgetItem;
    expect(painted.widget.skin).toEqual({ material: "chalkboard", edge: "torn", hanger: "nail", tilt: 3 });
  });

  it("a plain widget's look makes the other plain too", () => {
    const painted = paintItem(widget("b", { material: "paper" }), lookOf(widget("a", undefined))!) as WidgetItem;
    expect(painted.widget.skin).toBeUndefined();
  });

  it("a Nook tile's look leaves a widget's material alone", () => {
    const tile = { id: "t", kind: "nook" as const, nookId: "gift", x: 0, y: 0, w: 1, h: 1, color: "#f4c2d7" };
    const painted = paintItem(widget("b", { material: "felt" }), lookOf(tile)!) as WidgetItem;
    expect(painted.widget.skin).toEqual({ material: "felt" });
    expect(painted.color).toBe("#f4c2d7");
  });
});

describe("more looks (CORE-132..136)", () => {
  it("a gradient only fills a plain card, and makes it drawn", () => {
    expect(skinFor("note", { gradient: "sunrise" }).gradient).toBe("sunrise");
    expect(skinFor("note", { material: "wood", gradient: "sunrise" }).gradient).toBe("none");
    expect(isPlainCard(skinFor("note", { gradient: "sunrise" }))).toBe(false);
  });

  it("frames and two-tone bands are for widgets that take a material", () => {
    expect(skinFor("note", { frame: "gold", band: true })).toMatchObject({ frame: "gold", band: true });
    expect(skinFor("window", { frame: "gold", band: true })).toMatchObject({ frame: "none", band: false });
  });

  it("the season's accent changes through the year", () => {
    const month = (m: number) => seasonalAccent(new Date(2026, m, 15));
    expect(month(11)).toBe("holly");
    expect(month(0)).toBe("snowflake");
    expect(month(3)).toBe("daisy");
    expect(month(6)).toBe("sun");
    expect(month(9)).toBe("pumpkin");
    expect(month(10)).toBe("leaf");
  });

  it("a messy pinboard leans each widget the same way every time, and only a little", () => {
    expect(messyTilt("w-abc")).toBe(messyTilt("w-abc"));
    const leans = new Set(["a", "b", "c", "d", "e", "f", "g", "h"].map(messyTilt));
    expect(leans.size).toBeGreaterThan(1);
    for (const lean of leans) expect(Math.abs(lean)).toBeLessThanOrEqual(2.1);
  });

  it("summarizes the new choices", () => {
    expect(skinSummary("note", { frame: "polaroid", band: true, gradient: "tea" })).toBe("Polaroid frame · Two-tone · Gradient");
  });
});
