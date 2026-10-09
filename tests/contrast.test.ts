import { describe, expect, it } from "vitest";

import { contrast, hslToHex, pickerHues, readableOn } from "../lib/colors";
import { buildPalette, type CustomTheme } from "../lib/custom-theme";
import { hearthThemes } from "../lib/hearth-layout";

// CORE-075: everyday text must be easy to read — 4.5:1 or better.

describe("readableOn", () => {
  it("leaves a color that already reads well alone", () => {
    expect(readableOn("#222222", ["#ffffff"])).toBe("#222222");
  });

  it("darkens a faint grey on a light background until it passes", () => {
    const fixed = readableOn("#aaaaaa", ["#fbf7f2", "#ffffff"]);
    expect(contrast(fixed, "#fbf7f2")).toBeGreaterThanOrEqual(4.5);
    expect(contrast(fixed, "#ffffff")).toBeGreaterThanOrEqual(4.5);
  });

  it("lightens a dim color on a dark background until it passes", () => {
    const fixed = readableOn("#555555", ["#2a2330"]);
    expect(contrast(fixed, "#2a2330")).toBeGreaterThanOrEqual(4.5);
  });
});

describe("built-in themes", () => {
  it("have grey and accent text that passes on their background", () => {
    for (const [key, theme] of Object.entries(hearthThemes)) {
      expect(contrast(theme.muted, theme.background), `${key} muted`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(theme.accent, theme.background), `${key} accent`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(theme.text, theme.background), `${key} text`).toBeGreaterThanOrEqual(7);
    }
  });
});

describe("themes people make", () => {
  const make = (background: string, dark: boolean): CustomTheme => ({
    id: "custom-x",
    name: "Test",
    dark,
    background,
    accent: dark ? "#f0b98d" : "#8a5a3b",
  });

  it("always get grey text that passes on the background and on cards", () => {
    for (const hue of pickerHues) {
      for (const [l, dark] of [
        [0.97, false],
        [0.9, false],
        [0.86, false],
        [0.15, true],
        [0.2, true],
      ] as const) {
        const palette = buildPalette(make(hslToHex(hue, 0.5, l), dark));
        expect(contrast(palette.muted, palette.background), `hue ${hue} l ${l}`).toBeGreaterThanOrEqual(4.5);
        expect(contrast(palette.muted, palette.surface), `hue ${hue} l ${l} card`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});
