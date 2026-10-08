import type { IconName } from "../components/icon";

// Hearth decoration (CORE-041, 047): wallpapers and ambience. Pure data and
// helpers (no React), so they're unit-testable. Drawn by
// components/hearth/wallpaper.tsx and ambience.tsx.

// --- Wallpapers (CORE-041) -----------------------------------------------------------

export type PatternKey = "dots" | "stripes" | "gingham" | "leaves" | "stars" | "diamonds";

export const patterns: { key: PatternKey; label: string }[] = [
  { key: "dots", label: "Polka dots" },
  { key: "stripes", label: "Stripes" },
  { key: "gingham", label: "Gingham" },
  { key: "leaves", label: "Leaves" },
  { key: "stars", label: "Stars" },
  { key: "diamonds", label: "Diamonds" },
];

export type GradientDirection = "down" | "diagonal";

// A wallpaper never fights the theme: patterns and gradients are washed over
// the theme's own background and photos are dimmed, so text stays readable on
// light and dark Hearths alike. `{ kind: "none" }` is plain; in a Hollow, no
// wallpaper at all (undefined) means "same as the Hearth".
export type Wallpaper =
  | { kind: "none" }
  | { kind: "pattern"; pattern: PatternKey; color: string }
  | { kind: "gradient"; from: string; to: string; direction: GradientDirection }
  | { kind: "photo"; path: string; dim: number };

export const gradientPresets: { key: string; label: string; from: string; to: string }[] = [
  { key: "sunrise", label: "Sunrise", from: "#f9c9a3", to: "#f4a6c0" },
  { key: "meadow", label: "Meadow", from: "#cfe6b5", to: "#a5d5c8" },
  { key: "twilight", label: "Twilight", from: "#b9a8e6", to: "#f4b5a0" },
  { key: "tea", label: "Tea", from: "#ecd9b6", to: "#d2b48a" },
  { key: "lagoon", label: "Lagoon", from: "#a9d6e5", to: "#b7e4c7" },
  { key: "blossom", label: "Blossom", from: "#f4c2d7", to: "#dcc0ee" },
];

export const photoDims: { dim: number; label: string }[] = [
  { dim: 0.6, label: "Soft" },
  { dim: 0.4, label: "Medium" },
  { dim: 0.18, label: "Clear" },
];

export const defaultWallpaper: Wallpaper = { kind: "none" };

// What a space shows: its own wallpaper, or (a Hollow with none set) the Hearth's.
export function effectiveWallpaper(hearth: Wallpaper | undefined, own: Wallpaper | undefined, inHollow: boolean): Wallpaper {
  if (inHollow && own) return own;
  return hearth ?? defaultWallpaper;
}

export function wallpaperPath(wallpaper: Wallpaper | undefined) {
  return wallpaper?.kind === "photo" ? wallpaper.path : null;
}

// --- Ambience (CORE-047) -------------------------------------------------------------

export type AmbienceKind = "leaves" | "snow" | "petals" | "fireflies" | "motes";
export type Ambience = "off" | "auto" | AmbienceKind;

export const ambiences: { key: Ambience; label: string; icon: IconName }[] = [
  { key: "off", label: "Off", icon: "close" },
  { key: "auto", label: "Follow the season", icon: "sparkles" },
  { key: "leaves", label: "Falling leaves", icon: "leaf" },
  { key: "snow", label: "Snow", icon: "christmas" },
  { key: "petals", label: "Blossom petals", icon: "flower" },
  { key: "fireflies", label: "Fireflies", icon: "star" },
  { key: "motes", label: "Sunbeam dust", icon: "sun" },
];

// Night is fireflies; by day it follows the season (northern hemisphere):
// snow in winter, petals in spring, drifting dust in the sun of summer,
// leaves in autumn.
export function autoAmbience(now: Date): AmbienceKind {
  const hour = now.getHours();
  if (hour >= 21 || hour < 5) return "fireflies";
  const month = now.getMonth(); // 0 = January
  if (month === 11 || month <= 1) return "snow";
  if (month <= 4) return "petals";
  if (month <= 7) return "motes";
  return "leaves";
}

// What to actually show right now, or nothing.
export function activeAmbience(mode: Ambience | undefined, now: Date): AmbienceKind | null {
  if (!mode || mode === "off") return null;
  return mode === "auto" ? autoAmbience(now) : mode;
}

export function ambienceLabel(mode: Ambience | undefined) {
  return ambiences.find((a) => a.key === mode)?.label ?? "Off";
}

// --- Shape: corners, shadow, border (CORE-042) -----------------------------------------

export type Corners = "square" | "soft" | "round";
export type Lift = "flat" | "soft" | "raised" | "floating";

export const cornerChoices: { key: Corners; label: string }[] = [
  { key: "square", label: "Square" },
  { key: "soft", label: "Soft" },
  { key: "round", label: "Round" },
];

export const liftChoices: { key: Lift; label: string }[] = [
  { key: "flat", label: "Flat" },
  { key: "soft", label: "Soft" },
  { key: "raised", label: "Raised" },
  { key: "floating", label: "Floating" },
];

// Corner radius in points for a rectangular tile or widget.
export function cornerRadius(corners: Corners | undefined, width: number, height: number) {
  const base = corners === "square" ? 10 : corners === "round" ? 38 : 24;
  return Math.max(0, Math.min(base, Math.min(width, height) / 2));
}

// Which shadow level an item rests on: its own pick, or the usual for its kind
// (Nook tiles sit higher than widgets).
export function liftLevel(lift: Lift | undefined, isNook: boolean): 0 | 1 | 2 | 3 {
  switch (lift) {
    case "flat":
      return 0;
    case "soft":
      return 1;
    case "raised":
      return 2;
    case "floating":
      return 3;
    default:
      return isNook ? 2 : 1;
  }
}
