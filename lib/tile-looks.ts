import type { IconName } from "../components/icon";
import { contrast, deepOf, isHex, shade } from "./colors";
import { materialColors } from "./widget-skins";

// Nook tile looks (CORE-137..140). Pure data and helpers (no React), so
// they're unit-testable. Drawn by components/hearth/tile-build.tsx and
// tile-face.tsx.
//
// Widgets are things pinned up on the wall; Nook tiles are parts of the
// house itself: doors, windows and shop fronts, built from painted wood,
// brick, stone, stained glass or tile, plus a few widget materials (wood,
// felt, chalkboard). They never take paper, tape or a tilt, so they always
// read as doorways.

export type TileBuild = "plain" | "painted" | "brick" | "stone" | "stainedglass" | "tile" | "wood" | "felt" | "chalkboard";

export const tileBuilds: { key: TileBuild; label: string }[] = [
  { key: "plain", label: "Plain" },
  { key: "painted", label: "Painted wood" },
  { key: "brick", label: "Brick" },
  { key: "stone", label: "Stone" },
  { key: "stainedglass", label: "Stained glass" },
  { key: "tile", label: "Tile" },
  { key: "wood", label: "Wood" },
  { key: "felt", label: "Felt" },
  { key: "chalkboard", label: "Chalkboard" },
];

// The little things that make a tile a doorway (CORE-139, 140).
export type Doorway = {
  // A brass plate with the Nook's name on it.
  nameplate?: boolean;
  // A lamp by the door that glows when the Nook has news.
  porchLight?: boolean;
  // What's under it: a flower box or a doormat.
  below?: "none" | "flowers" | "doormat";
  // A wreath around its icon: never, by itself in December, or always.
  wreath?: "never" | "december" | "always";
  // The door swings open as you go in (on unless turned off).
  opens?: boolean;
};

export const belowChoices: { key: NonNullable<Doorway["below"]>; label: string; icon: IconName }[] = [
  { key: "none", label: "Nothing", icon: "close" },
  { key: "flowers", label: "Flower box", icon: "flower" },
  { key: "doormat", label: "Doormat", icon: "door" },
];

export const wreathChoices: { key: NonNullable<Doorway["wreath"]>; label: string }[] = [
  { key: "never", label: "Never" },
  { key: "december", label: "In December" },
  { key: "always", label: "Always" },
];

export function doorwayOf(doorway: Doorway | undefined): Required<Doorway> {
  return {
    nameplate: Boolean(doorway?.nameplate),
    porchLight: Boolean(doorway?.porchLight),
    below: doorway?.below ?? "none",
    wreath: doorway?.wreath ?? "never",
    opens: doorway?.opens ?? true,
  };
}

// Is the wreath up today?
export function wreathShows(wreath: Doorway["wreath"], now: Date) {
  if (wreath === "always") return true;
  return wreath === "december" && now.getMonth() === 11;
}

// "Brick · Nameplate · Porch light", for the closed section (CORE-074).
export function doorwaySummary(doorway: Doorway | undefined) {
  const d = doorwayOf(doorway);
  const words: string[] = [];
  if (d.nameplate) words.push("Nameplate");
  if (d.porchLight) words.push("Porch light");
  if (d.below !== "none") words.push(belowChoices.find((b) => b.key === d.below)!.label);
  if (d.wreath === "always") words.push("Wreath");
  if (d.wreath === "december") words.push("Wreath in December");
  if (!d.opens) words.push("Door stays shut");
  return words.join(" · ") || "Nothing added yet";
}

// --- Colors --------------------------------------------------------------------------------

export type BuildColors = {
  base: string;
  ink: string;
  text: string;
  muted: string;
  icon: string;
  badge: string;
  panel: string;
  frameLine: string;
  lantern: string;
  dark: boolean;
};

const lightText = { dark: false, text: "#2a2420", muted: "#5f554d", badge: "rgba(255,255,255,0.72)", panel: "rgba(255,255,255,0.6)", frameLine: "rgba(255,255,255,0.75)", lantern: "#fff3d6" };
const darkText = { dark: true, text: "#fffaf2", muted: "rgba(255,250,242,0.82)", badge: "rgba(255,255,255,0.2)", panel: "rgba(255,255,255,0.14)", frameLine: "rgba(255,255,255,0.3)", lantern: "#ffe6b0" };

// What a tile built from `build` looks like with its color (a soft tint),
// or, with none picked, the Nook's own. Not for "plain", which keeps the
// soft, bold and outline looks.
export function buildColors(build: Exclude<TileBuild, "plain">, color: string): BuildColors {
  const deep = deepOf(isHex(color) ? color : "#d9a38a");
  switch (build) {
    case "painted":
      return { ...lightText, base: color, ink: shade(color, -0.18), icon: deep };
    case "brick": {
      const base = readable(mixed("#b4553c", color, 0.18), "#fffaf2");
      return { ...darkText, base, ink: "#efdcc6", icon: "#fffaf2" };
    }
    case "stone":
      return { ...lightText, base: mixed("#c4beb3", color, 0.15), ink: "#8b8478", icon: deep };
    case "stainedglass":
      return { ...lightText, base: shade(color, 0.45), ink: "#4a4440", icon: deep };
    case "tile": {
      const m = materialColors("tile", color);
      return { ...lightText, base: m.base, ink: m.ink, icon: deep };
    }
    case "wood":
    case "felt":
    case "chalkboard": {
      const m = materialColors(build, color);
      return { ...darkText, base: m.base, ink: m.ink, icon: build === "chalkboard" ? m.accent : "#fffaf2" };
    }
  }
}

// Does the name read clearly on it? (Used by the tests for every color.)
export function buildReadsWell(colors: BuildColors) {
  return contrast(colors.text, colors.base) >= 4.5;
}

function mixed(a: string, b: string, t: number) {
  if (!isHex(b) || b.length !== 7) return a;
  const ch = (hex: string, i: number) => parseInt(hex.slice(1 + i, 3 + i), 16);
  const out = [0, 2, 4].map((i) => Math.round(ch(a, i) * (1 - t) + ch(b, i) * t));
  return `#${out.map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

function readable(base: string, text: string) {
  let out = base;
  for (let i = 0; i < 40 && contrast(text, out) < 5; i++) out = shade(out, -0.04);
  return out;
}

// --- Copy look (CORE-097, 137) -------------------------------------------------------------

// A widget's look and a Nook tile's look only share their color: one's a
// thing pinned up, the other part of the house.
export function sharesOnlyColor(from: "nook" | "widget", to: "nook" | "widget") {
  return from !== to;
}
