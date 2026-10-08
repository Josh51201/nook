import { describe, expect, it } from "vitest";

import { contrast, hslToHex, pickerHues } from "../lib/colors";
import {
  buildHearthTheme,
  buildPalette,
  normalizeAccent,
  normalizeCustomTheme,
  resolveThemeKey,
  seasonalThemeFor,
  themeDefaults,
  type CustomTheme,
} from "../lib/custom-theme";
import { seasonOf } from "../lib/decor";
import { defaultHearthLayout, migrateLayout } from "../lib/hearth-layout";

const theme = (changes: Partial<CustomTheme> = {}): CustomTheme => ({
  id: "custom-1",
  name: "Mine",
  dark: false,
  background: themeDefaults.light.background,
  accent: themeDefaults.light.accent,
  ...changes,
});

describe("custom themes stay readable (CORE-043)", () => {
  it("any background and accent make text, cards and buttons readable", () => {
    for (const dark of [false, true]) {
      for (const hue of pickerHues) {
        for (const l of dark ? [0.08, 0.14, 0.26, 0.5] : [0.97, 0.9, 0.7, 0.4]) {
          for (const accentL of [0.15, 0.5, 0.85]) {
            const palette = buildPalette(
              theme({ dark, background: hslToHex(hue, 0.9, l), accent: hslToHex((hue + 90) % 360, 0.9, accentL) })
            );
            // Body text on the page and on cards.
            expect(contrast(palette.text, palette.background)).toBeGreaterThan(7);
            expect(contrast(palette.text, palette.surface)).toBeGreaterThan(6.5);
            // Secondary text and the accent as a link on the page.
            expect(contrast(palette.muted, palette.background)).toBeGreaterThan(3.2);
            expect(contrast(palette.bark, palette.background)).toBeGreaterThan(3);
            // Text on an accent button.
            expect(contrast(palette.onAccent, palette.bark)).toBeGreaterThan(4.5);
          }
        }
      }
    }
  });

  it("pulls out-of-range colors back into range", () => {
    const light = normalizeCustomTheme(theme({ background: "#222222", accent: "#ffff00" }));
    expect(contrast(light.background, "#000000")).toBeGreaterThan(15);
    expect(contrast(light.accent, "#ffffff")).toBeGreaterThanOrEqual(4.5);
    const dark = normalizeCustomTheme(theme({ dark: true, background: "#ffffff", accent: "#000033" }));
    expect(contrast(dark.background, "#ffffff")).toBeGreaterThan(10);
    expect(contrast(dark.accent, dark.background)).toBeGreaterThanOrEqual(4.5);
  });

  it("deepens bright accents but leaves already-deep ones alone", () => {
    expect(normalizeAccent("#7a3b1e", false)).toBe(normalizeAccent(normalizeAccent("#7a3b1e", false), false));
    expect(contrast(normalizeAccent("#d4d400", false), "#ffffff")).toBeGreaterThanOrEqual(4.5);
  });

  it("names are trimmed and bad colors fall back to the defaults", () => {
    const clean = normalizeCustomTheme(theme({ name: "   ", background: "nope", accent: "also nope" }));
    expect(clean.name).toBe("My theme");
    expect(clean.background).toMatch(/^#[0-9a-f]{6}$/);
    expect(clean.accent).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("builds the Hearth's view of a theme too", () => {
    const hearth = buildHearthTheme(theme({ name: "Autumn", dark: true }));
    expect(hearth.label).toBe("Autumn");
    expect(hearth.dark).toBe(true);
    expect(hearth.shade).toBe("0, 0, 0");
    expect(buildHearthTheme(theme()).shade).toMatch(/^\d+, \d+, \d+$/);
  });
});

describe("which theme to wear (CORE-043)", () => {
  const known = new Set(["hearth", "ember", "sage", "dusk", "custom-1", "custom-2"]);
  const base = { chosen: "ember", followPhone: false, phoneIsDark: false, now: new Date(2026, 0, 10), known };

  it("seasons run December to February, March to May, and so on", () => {
    expect(seasonOf(new Date(2026, 11, 25))).toBe("winter");
    expect(seasonOf(new Date(2026, 1, 28))).toBe("winter");
    expect(seasonOf(new Date(2026, 2, 1))).toBe("spring");
    expect(seasonOf(new Date(2026, 5, 1))).toBe("summer");
    expect(seasonOf(new Date(2026, 8, 1))).toBe("autumn");
  });

  it("uses your usual theme unless seasons are on", () => {
    expect(resolveThemeKey(base)).toBe("ember");
    expect(resolveThemeKey({ ...base, seasonal: { enabled: false, winter: "sage" } })).toBe("ember");
  });

  it("uses the season's theme, or your usual one for a season with none picked", () => {
    const seasonal = { enabled: true, winter: "custom-1", summer: "sage" };
    expect(resolveThemeKey({ ...base, seasonal })).toBe("custom-1");
    expect(resolveThemeKey({ ...base, seasonal, now: new Date(2026, 6, 4) })).toBe("sage");
    expect(resolveThemeKey({ ...base, seasonal, now: new Date(2026, 3, 4) })).toBe("ember");
    expect(seasonalThemeFor(seasonal, new Date(2026, 0, 10))).toBe("custom-1");
    expect(seasonalThemeFor(undefined, new Date())).toBeNull();
  });

  it("the phone's dark mode wins when you've asked to follow it", () => {
    const seasonal = { enabled: true, winter: "custom-1" };
    expect(resolveThemeKey({ ...base, seasonal, followPhone: true, phoneIsDark: true })).toBe("dusk");
    expect(resolveThemeKey({ ...base, seasonal, followPhone: false, phoneIsDark: true })).toBe("custom-1");
  });

  it("a theme that's been deleted falls back to the classic Hearth", () => {
    expect(resolveThemeKey({ ...base, chosen: "custom-9" })).toBe("hearth");
    expect(resolveThemeKey({ ...base, seasonal: { enabled: true, winter: "custom-9" } })).toBe("ember");
  });
});

describe("saved Hearths", () => {
  it("an older Hearth gets no custom themes and seasons off", () => {
    const migrated = migrateLayout({ title: "Mine", items: [] });
    expect(migrated.customThemes).toEqual([]);
    expect(migrated.seasonal).toEqual({ enabled: false });
    expect(defaultHearthLayout.customThemes).toEqual([]);
  });

  it("keeps the themes you made", () => {
    const mine = theme();
    const migrated = migrateLayout({ customThemes: [mine], seasonal: { enabled: true, winter: mine.id }, items: [] });
    expect(migrated.customThemes).toEqual([mine]);
    expect(migrated.seasonal.winter).toBe(mine.id);
  });
});
