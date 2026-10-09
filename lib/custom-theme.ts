import { contrast, hexToHsl, hslToHex, isHex, readableOn } from "./colors";
import { seasonOf, type Season } from "./decor";

// Build-your-own themes (CORE-043): pure, so they're unit-testable. A custom
// theme is just a name, light or dark, a background color and an accent
// color; everything else the app needs (text, cards, borders, shadows, the
// firelight) is worked out from those two, so any pair of colors is readable.
// The registry that plugs them into the live theme is in components/themed-screen.tsx.

export type CustomTheme = {
  id: string;
  name: string;
  dark: boolean;
  background: string;
  accent: string;
};

// Themes that change with the time of year (CORE-043). A season with nothing
// picked uses your usual theme.
export type SeasonalThemes = { enabled: boolean; winter?: string; spring?: string; summer?: string; autumn?: string };

export const MAX_CUSTOM_THEMES = 6;

export const themeDefaults = {
  light: { background: "#fbf3e6", accent: "#9a5a2f" },
  dark: { background: "#241f2b", accent: "#e8b07a" },
};

export function newThemeId() {
  return `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

// Worst-case backgrounds an accent has to read against: white buttons text on
// a light theme's accent, and the lightest allowed dark background.
const ACCENT_AGAINST = { light: "#ffffff", dark: "#4a4a3a" };

// An accent that stays readable: darkened (light themes) or lightened (dark
// themes) until it has enough contrast, keeping its hue. Yellows and greens
// are naturally bright, so they come out deeper than they were picked.
export function normalizeAccent(accent: string, dark: boolean): string {
  const color = hexToHsl(isHex(accent) ? accent : dark ? themeDefaults.dark.accent : themeDefaults.light.accent);
  let l = dark ? clamp(color.l, 0.6, 0.85) : clamp(color.l, 0.15, 0.45);
  const s = dark ? clamp(color.s, 0.3, 0.9) : clamp(color.s, 0.25, 0.85);
  const against = dark ? ACCENT_AGAINST.dark : ACCENT_AGAINST.light;
  for (let i = 0; i < 40; i++) {
    const hex = hslToHex(color.h, s, l);
    if (contrast(hex, against) >= 4.8) return hex;
    l = clamp(l + (dark ? 0.01 : -0.01), 0.1, 0.92);
  }
  return hslToHex(color.h, s, l);
}

// Keep a theme's colors in the range where text stays readable: a light
// theme has a light background and a deep accent, a dark one the reverse.
export function normalizeCustomTheme(theme: CustomTheme): CustomTheme {
  const defaults = theme.dark ? themeDefaults.dark : themeDefaults.light;
  const bg = hexToHsl(isHex(theme.background) ? theme.background : defaults.background);
  return {
    ...theme,
    name: theme.name.trim().slice(0, 24) || "My theme",
    background: theme.dark
      ? hslToHex(bg.h, Math.min(bg.s, 0.4), clamp(bg.l, 0.1, 0.2))
      : hslToHex(bg.h, Math.min(bg.s, 0.7), clamp(bg.l, 0.86, 0.98)),
    accent: normalizeAccent(theme.accent, theme.dark),
  };
}

function rgbList(hex: string) {
  const clean = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(clean.slice(i, i + 2), 16)).join(", ");
}

// The whole app palette (the shape of lib/theme.ts's Palette) for a theme.
export function buildPalette(input: CustomTheme) {
  const theme = normalizeCustomTheme(input);
  const bg = hexToHsl(theme.background);
  const accent = hexToHsl(theme.accent);
  const h = bg.h;
  if (theme.dark) {
    return {
      dark: true,
      bark: theme.accent,
      barkSoft: hslToHex(accent.h, 0.2, clamp(bg.l + 0.1, 0, 1)),
      cream: hslToHex(h, bg.s, clamp(bg.l + 0.04, 0, 1)),
      background: theme.background,
      surface: hslToHex(h, bg.s, clamp(bg.l + 0.05, 0, 1)),
      text: hslToHex(h, 0.15, 0.96),
      muted: readableOn(hslToHex(h, 0.1, 0.72), [theme.background, hslToHex(h, bg.s, clamp(bg.l + 0.05, 0, 1))]),
      border: hslToHex(h, bg.s, clamp(bg.l + 0.13, 0, 1)),
      error: "#ff8f80",
      white: "#ffffff",
      onAccent: theme.background,
      heart: "#ff8aa3",
      sun: "#463a2e",
      sky: "#2f3a4b",
      rose: "#4a2d36",
      shade: "0, 0, 0",
    };
  }
  return {
    dark: false,
    bark: theme.accent,
    barkSoft: hslToHex(accent.h, 0.45, 0.9),
    cream: hslToHex(h, bg.s, clamp(bg.l - 0.03, 0, 1)),
    background: theme.background,
    surface: hslToHex(h, bg.s * 0.5, clamp(bg.l + 0.06, 0, 0.995)),
    text: hslToHex(h, 0.25, 0.14),
    muted: readableOn(hslToHex(h, 0.1, 0.45), [
      theme.background,
      hslToHex(h, bg.s * 0.5, clamp(bg.l + 0.06, 0, 0.995)),
      hslToHex(h, bg.s, clamp(bg.l - 0.03, 0, 1)),
    ]),
    border: hslToHex(h, bg.s * 0.8, clamp(bg.l - 0.05, 0, 1)),
    error: "#c0392b",
    white: "#ffffff",
    onAccent: "#ffffff",
    heart: "#c2415a",
    sun: "#fff4d6",
    sky: "#e9f1fb",
    rose: "#fdecea",
    shade: rgbList(hslToHex(accent.h, 0.45, 0.2)),
  };
}

// The Hearth's own view of a theme (lib/hearth-layout.ts's hearthThemes).
export function buildHearthTheme(input: CustomTheme) {
  const theme = normalizeCustomTheme(input);
  const palette = buildPalette(theme);
  const accent = hexToHsl(theme.accent);
  return {
    label: theme.name,
    background: palette.background,
    text: palette.text,
    muted: palette.muted,
    accent: theme.accent,
    shade: palette.shade,
    glow: theme.dark ? theme.accent : hslToHex(accent.h, 0.8, 0.72),
    dark: theme.dark,
  };
}

// --- Which theme to wear right now ---------------------------------------------------

export function seasonalThemeFor(seasonal: SeasonalThemes | undefined, now: Date): string | null {
  if (!seasonal?.enabled) return null;
  const season: Season = seasonOf(now);
  return seasonal[season] ?? null;
}

// The phone's dark mode (if you asked to follow it) wins, then the season's
// theme, then your usual one. A theme that no longer exists falls back
// to the classic Hearth.
export function resolveThemeKey(options: {
  chosen: string;
  followPhone: boolean;
  phoneIsDark: boolean;
  seasonal?: SeasonalThemes;
  now: Date;
  known: ReadonlySet<string>;
}): string {
  const { chosen, followPhone, phoneIsDark, seasonal, now, known } = options;
  if (followPhone && phoneIsDark) return "dusk";
  const seasonal_ = seasonalThemeFor(seasonal, now);
  if (seasonal_ && known.has(seasonal_)) return seasonal_;
  return known.has(chosen) ? chosen : "hearth";
}
