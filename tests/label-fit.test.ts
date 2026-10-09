import { describe, expect, it } from "vitest";

import { decorInset, estimateMeasure, fitText, labelRules, wrapCount } from "../lib/label-fit";
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
  return fitText(estimateMeasure(text, item.font, item.caps, true), box, labelRules(item, box));
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
    const box = { width: FULL_WIDTH, height: ROW };
    const normal = fitText(estimateMeasure("Hi", "app"), box, labelRules({ size: "caption" }, box, 1));
    const bigger = fitText(estimateMeasure("Hi", "app"), box, labelRules({ size: "caption" }, box, 1.3));
    expect(bigger.fontSize).toBeGreaterThan(normal.fontSize);
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
