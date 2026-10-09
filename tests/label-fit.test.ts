import { describe, expect, it } from "vitest";

import { decorInset, decorMinHeight, decorMinWidth, decorStretchesTall, effectShadow, letterSpacingEm, underlineRoom, estimateMeasure, fitLabel, fitText, labelRules, labelVAlign, wrapCount } from "../lib/label-fit";
import { labelLook, labelLookUpgrade, type LabelItem } from "../lib/hearth-layout";
import { letteringInWords } from "../lib/summaries";

// Sizes on a typical phone: a 4-column grid, cells about 80 wide with 12
// between them, so one column is 80 wide, a slim row 34 tall, a full row 80.
const ONE_COL = 80;
const FULL_WIDTH = 356;
const SLIM = 34;
const ROW = 80;

type Look = Pick<LabelItem, "size" | "caps" | "decor" | "font" | "divider" | "spanY">;

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

describe("Stretching a decoration up and down (CORE-081)", () => {
  const tall = 2 * 92 - 12;

  it("stretches a shaped decoration as far up and down as you ask", () => {
    expect(decorMinHeight({ decor: "sign" }, tall)).toBe(0);
    expect(decorMinHeight({ decor: "stitched", spanY: 0.5 }, tall)).toBe((tall - 2) / 2);
    expect(decorMinHeight({ decor: "ribbon", spanY: 1 }, tall)).toBe(tall - 2);
    expect(decorMinHeight({ decor: "pill", spanY: 4 }, tall)).toBe(tall - 2);
  });

  it("only shaped decorations stretch up and down", () => {
    for (const decor of ["pill", "stitched", "ribbon", "sign"] as const) expect(decorStretchesTall(decor)).toBe(true);
    for (const decor of ["none", "underline", "flourish", undefined] as const) {
      expect(decorStretchesTall(decor)).toBe(false);
      expect(decorMinHeight({ decor, spanY: 1 }, tall)).toBe(0);
    }
    expect(decorMinHeight({ decor: "pill", spanY: 1, divider: true }, tall)).toBe(0);
  });

  it("doesn't change the size of the words", () => {
    const box = { width: FULL_WIDTH, height: tall };
    expect(fit("Holidays", { decor: "sign" }, box).fontSize).toBe(fit("Holidays", { decor: "sign", spanY: 1 }, box).fontSize);
  });
});

describe("Lettering (CORE-082)", () => {
  const box = { width: FULL_WIDTH, height: ROW };

  it("reads older text the new way without changing how it looks", () => {
    const old = labelLook({ decor: "underline", caps: true });
    expect(old).toMatchObject({ decor: "none", underline: "bar", letters: "upper", spacing: "normal", effect: "none", italic: false });
    expect(labelLook({ decor: "ribbon", underline: "wavy" })).toMatchObject({ decor: "ribbon", underline: "wavy" });
    // A divider has no decoration or underline.
    expect(labelLook({ decor: "pill", underline: "line", divider: true })).toMatchObject({ decor: "none", underline: "none" });
  });

  it("moves older settings over when you change the lettering", () => {
    expect(labelLookUpgrade({ decor: "underline", caps: true })).toEqual({ decor: "none", underline: "bar", caps: undefined, letters: "upper" });
    expect(labelLookUpgrade({ decor: "ribbon" })).toEqual({});
  });

  it("an underline works with any decoration, and its room is counted", () => {
    for (const decor of ["pill", "stitched", "ribbon", "sign", "flourish"] as const) {
      const plain = fitLabel(estimateMeasure("Hi", "app"), { size: "title", decor }, box);
      const lined = fitLabel(estimateMeasure("Hi", "app"), { size: "title", decor }, box, { underline: "wavy" });
      expect(lined.fits).toBe(true);
      expect(lined.fontSize).toBeLessThan(plain.fontSize);
      const inset = decorInset(decor, lined.fontSize, lined.snug);
      const under = underlineRoom("wavy", lined.fontSize);
      expect(lined.fontSize * 1.2 + inset.padY * 2 + inset.outerY + under.gap + under.height).toBeLessThanOrEqual(ROW);
    }
  });

  it("wider letter spacing takes more room", () => {
    const look = { letters: "typed" as const };
    expect(letterSpacingEm({ ...look, spacing: "wide" }, "heading")).toBeGreaterThan(letterSpacingEm({ ...look, spacing: "normal" }, "heading"));
    expect(letterSpacingEm({ ...look, spacing: "snug" }, "heading")).toBeLessThan(0);
    expect(letterSpacingEm({ letters: "upper", spacing: "normal" }, "heading")).toBeGreaterThan(0);
  });

  it("each effect draws a shadow that grows with the text, and light text gets dark ones", () => {
    for (const effect of ["shadow", "glow", "letterpress", "retro"] as const) {
      const small = effectShadow(effect, 14, "#3a2a20", undefined, "#8a5a3b");
      const big = effectShadow(effect, 40, "#3a2a20", undefined, "#8a5a3b");
      expect(small.textShadowColor).toBeTruthy();
      // Android needs a radius above 0 to draw any shadow.
      expect(small.textShadowRadius).toBeGreaterThan(0);
      expect(Math.abs(big.textShadowOffset!.height) + big.textShadowRadius!).toBeGreaterThanOrEqual(
        Math.abs(small.textShadowOffset!.height) + small.textShadowRadius!
      );
    }
    expect(effectShadow("letterpress", 20, "#fff7ec", undefined, "#8a5a3b").textShadowColor).toContain("0, 0, 0");
    expect(effectShadow("none", 20, "#3a2a20", undefined, "#8a5a3b")).toEqual({});
  });

  it("sums up the lettering in a few words", () => {
    expect(letteringInWords({ id: "t", kind: "label", x: 0, y: 0, w: 4, h: 1, text: "Hi", size: "caption", align: "left" })).toBe("Same as the app");
    expect(
      letteringInWords({ id: "t", kind: "label", x: 0, y: 0, w: 4, h: 1, text: "Hi", size: "title", align: "left", font: "rounded", italic: true, letters: "title", spacing: "wide", underline: "wavy", effect: "glow" })
    ).toBe("Rounded · Bold · Italic · Title Case · Wide spacing · Wavy underline · Glow");
  });
});
