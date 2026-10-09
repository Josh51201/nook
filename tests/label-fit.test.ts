import { describe, expect, it } from "vitest";

import { decorInset, decorMinWidth, estimateMeasure, fitLabel, fitText, labelRules, labelVAlign, wrapCount } from "../lib/label-fit";
import type { LabelItem } from "../lib/hearth-layout";

// Sizes on a typical phone: a 4-column grid, cells about 80 wide with 12
// between them, so one column is 80 wide, a slim row 34 tall, a full row 80.
const ONE_COL = 80;
const FULL_WIDTH = 356;
const SLIM = 34;
const ROW = 80;

type Look = Pick<LabelItem, "size" | "caps" | "decor" | "font" | "divider">;

function fit(text: string, look: Partial<Look>, box: { width: number; height: number }) {
  const item: Look = { size: "title", ...look };
  return fitLabel(estimateMeasure(text, item.font, item.caps, true), item, box);
}

describe("wrapCount (CORE-077)", () => {
  const m = { words: [2, 3, 2], space: 0.3 };
  it("puts everything on one line when it fits", () => {
    expect(wrapCount(m, 10, 100)).toBe(1);
  });
  it("wraps onto more lines when it doesn't", () => {
    expect(wrapCount(m, 10, 55)).toBe(2);
    expect(wrapCount(m, 10, 32)).toBe(3);
  });
  it("says a word that's wider than the line can't fit at all", () => {
    expect(wrapCount(m, 10, 25)).toBe(Infinity);
  });
});

describe("Hearth text always fits (CORE-077)", () => {
  it("shrinks a word to fit a narrow space instead of cutting it to 'R…'", () => {
    for (const decor of ["none", "underline", "pill", "stitched", "ribbon", "sign", "flourish"] as const) {
      for (const height of [SLIM, ROW]) {
        const result = fit("Recipes", { decor }, { width: ONE_COL, height });
        expect(result.fits, `${decor} at ${height}`).toBe(true);
        expect(result.fontSize).toBeGreaterThanOrEqual(12);
      }
    }
  });

  it("keeps a slim pill or ribbon's text a good size when there's width to spare", () => {
    for (const decor of ["pill", "ribbon", "sign", "stitched"] as const) {
      const result = fit("Holidays", { decor }, { width: FULL_WIDTH, height: SLIM });
      expect(result.lines).toBe(1);
      // About as big as the slim space allows, not squeezed.
      expect(result.fontSize).toBeGreaterThan(18);
      const inset = decorInset(decor, result.fontSize, result.snug);
      expect(result.fontSize * 1.2 + inset.padY * 2 + inset.outerY).toBeLessThanOrEqual(SLIM);
    }
  });

  it("grows as you make the space bigger", () => {
    const slim = fit("Our family", {}, { width: FULL_WIDTH, height: SLIM });
    const full = fit("Our family", {}, { width: FULL_WIDTH, height: ROW });
    const narrow = fit("Our family", {}, { width: ONE_COL * 2 + 12, height: ROW });
    expect(full.fontSize).toBeGreaterThan(slim.fontSize);
    expect(narrow.fontSize).toBeLessThan(full.fontSize);
  });

  it("keeps filling the box as it gets bigger, with no fixed top size", () => {
    const sizes = [1, 2, 3].map((rows) => fit("Hi", {}, { width: FULL_WIDTH, height: rows * 92 - 12 }).fontSize);
    for (let i = 1; i < sizes.length; i++) expect(sizes[i]).toBeGreaterThan(sizes[i - 1]);
    // A short title in a two-row box takes up most of its height.
    expect(sizes[1] * 1.2).toBeGreaterThan((2 * 92 - 12) * 0.8);
  });

  it("headings and captions grow with the box too, just a step smaller", () => {
    for (const size of ["heading", "caption"] as const) {
      const small = fit("Hello", { size }, { width: FULL_WIDTH, height: ROW }).fontSize;
      const big = fit("Hello", { size }, { width: FULL_WIDTH, height: 3 * 92 - 12 }).fontSize;
      expect(big).toBeGreaterThan(small * 1.5);
    }
  });

  it("wraps onto a second line when the space is tall enough, rather than going tiny", () => {
    const result = fit("Family recipes", {}, { width: ONE_COL * 2 + 12, height: ROW });
    expect(result.fits).toBe(true);
    expect(result.lines).toBe(2);
    expect(result.fontSize).toBeGreaterThanOrEqual(20);
  });

  it("slim text stays on one line", () => {
    const result = fit("A long caption about the week ahead", { size: "caption" }, { width: FULL_WIDTH, height: SLIM });
    expect(result.lines).toBe(1);
  });

  it("keeps a title bigger than a heading, and a heading bigger than a caption, in the same space", () => {
    for (const height of [SLIM, ROW]) {
      const box = { width: FULL_WIDTH, height };
      const title = fit("Hello", { size: "title" }, box).fontSize;
      const heading = fit("Hello", { size: "heading" }, box).fontSize;
      const caption = fit("Hello", { size: "caption" }, box).fontSize;
      expect(title).toBeGreaterThan(heading);
      expect(heading).toBeGreaterThan(caption);
    }
  });

  it("tightens a decoration only when the text can't fit otherwise", () => {
    expect(fit("Holidays", { decor: "flourish" }, { width: FULL_WIDTH, height: ROW }).snug).toBe(false);
    expect(fit("Recipes", { decor: "flourish" }, { width: ONE_COL, height: SLIM }).snug).toBe(true);
  });

  it("only falls back to '…' when even the smallest size can't fit", () => {
    const result = fit("Supercalifragilisticexpialidocious", { decor: "ribbon" }, { width: ONE_COL, height: SLIM });
    expect(result.fits).toBe(false);
    expect(result.lines).toBe(1);
  });

  it("follows the phone's bigger text setting where there's room", () => {
    // A word that only fits at the smallest size gets a bigger smallest size.
    const long = estimateMeasure("Supercalifragilistic", "app");
    expect(fitLabel(long, { size: "caption" }, { width: ONE_COL, height: ROW }, { fontScale: 1.3 }).fontSize).toBeGreaterThan(
      fitLabel(long, { size: "caption" }, { width: ONE_COL, height: ROW }, { fontScale: 1 }).fontSize
    );
  });

  it("leaves room beside a divider's words for its line and arrow", () => {
    const box = { width: ONE_COL * 2 + 12, height: SLIM };
    const item: Look = { size: "heading", divider: true };
    const rules = { ...labelRules(item, box), reserve: 60 };
    const result = fitText(estimateMeasure("Holidays", "app", false, true), box, rules);
    expect(result.fits).toBe(true);
    expect(result.lines).toBe(1);
  });
});

describe("Where text sits and how far its decoration stretches (CORE-078)", () => {
  it("sits where you choose, or by default slim in the middle and taller at the bottom", () => {
    expect(labelVAlign({}, SLIM)).toBe("middle");
    expect(labelVAlign({}, ROW)).toBe("bottom");
    expect(labelVAlign({ valign: "top" }, ROW)).toBe("top");
    expect(labelVAlign({ valign: "middle" }, ROW)).toBe("middle");
    expect(labelVAlign({ valign: "bottom" }, SLIM)).toBe("bottom");
  });

  it("stretches a decoration as far across as you ask, up to edge to edge", () => {
    expect(decorMinWidth({ decor: "sign" }, FULL_WIDTH)).toBe(0);
    expect(decorMinWidth({ decor: "stitched", span: 0.5 }, FULL_WIDTH)).toBe((FULL_WIDTH - 8) / 2);
    expect(decorMinWidth({ decor: "ribbon", span: 1 }, FULL_WIDTH)).toBe(FULL_WIDTH - 8);
    expect(decorMinWidth({ decor: "pill", span: 3 }, FULL_WIDTH)).toBe(FULL_WIDTH - 8);
  });

  it("has nothing to stretch without a decoration, or on a divider", () => {
    expect(decorMinWidth({ decor: "none", span: 1 }, FULL_WIDTH)).toBe(0);
    expect(decorMinWidth({ span: 1 }, FULL_WIDTH)).toBe(0);
    expect(decorMinWidth({ decor: "pill", span: 1, divider: true }, FULL_WIDTH)).toBe(0);
  });
});
