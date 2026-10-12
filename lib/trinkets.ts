import { shade } from "./colors";

// Trinkets (CORE-045): little decorations to scatter on the Hearth or inside
// a Hollow. They can't be tapped; they're there to make the place feel lived
// in. Each is a small drawing (components/hearth/trinket-art.tsx) in a main
// color you choose.

export type TrinketKey =
  | "plant"
  | "lantern"
  | "cat"
  | "rug"
  | "books"
  | "candle"
  | "teacup"
  | "mushrooms"
  | "succulent"
  | "wreath";

export const trinkets: {
  key: TrinketKey;
  label: string;
  // The main color it comes in, and the size it starts at.
  color: string;
  size: { w: number; h: number };
}[] = [
  { key: "plant", label: "Potted plant", color: "#d9a07a", size: { w: 2, h: 2 } },
  { key: "lantern", label: "Lantern", color: "#e9b44c", size: { w: 1, h: 2 } },
  { key: "cat", label: "Sleeping cat", color: "#e8b98a", size: { w: 2, h: 1 } },
  { key: "rug", label: "Rug", color: "#d9826b", size: { w: 4, h: 1 } },
  { key: "books", label: "Stack of books", color: "#8aa9c9", size: { w: 2, h: 1 } },
  { key: "candle", label: "Candle", color: "#f4e6c8", size: { w: 1, h: 1 } },
  { key: "teacup", label: "Cup of tea", color: "#b8d0e0", size: { w: 1, h: 1 } },
  { key: "mushrooms", label: "Mushrooms", color: "#d95f59", size: { w: 2, h: 1 } },
  { key: "succulent", label: "Succulent", color: "#8fbf9a", size: { w: 1, h: 1 } },
  { key: "wreath", label: "Wreath", color: "#6f9a5c", size: { w: 2, h: 2 } },
];

export function trinketInfo(key: string) {
  return trinkets.find((t) => t.key === key) ?? trinkets[0];
}

// The drawing's own shape. A Trinket's box is exactly this shape, so what it
// shows (and its edit buttons) sit snug around the drawing, not around an
// empty cell (CORE-098).
const VIEWBOXES: Partial<Record<TrinketKey, { w: number; h: number }>> = {
  rug: { w: 200, h: 60 },
  cat: { w: 140, h: 90 },
  mushrooms: { w: 140, h: 100 },
  books: { w: 120, h: 90 },
};
export function trinketViewBox(piece: string) {
  return VIEWBOXES[piece as TrinketKey] ?? { w: 100, h: 100 };
}
export function trinketAspect(piece: string) {
  const box = trinketViewBox(piece);
  return box.w / box.h;
}

// How small and how big a Trinket can be, in cells: its shorter side is at
// least half a cell, it's never wider than the Hearth, and never taller than
// five cells.
export const TRINKET_MIN_SIDE = 0.5;
export const TRINKET_MAX_WIDTH = 4;
export const TRINKET_MAX_HEIGHT = 5;

export function trinketBounds(piece: string) {
  const a = trinketAspect(piece);
  return { minW: TRINKET_MIN_SIDE * Math.max(1, a), maxW: Math.min(TRINKET_MAX_WIDTH, TRINKET_MAX_HEIGHT * a) };
}

const hundredths = (n: number) => Math.round(n * 100) / 100;

// The size a Trinket takes in a box of this size: its own shape, as big as
// fits, kept between the smallest and biggest allowed. Anything goes in.
export function trinketFit(piece: string, w: number, h: number): { w: number; h: number } {
  const a = trinketAspect(piece);
  const { minW, maxW } = trinketBounds(piece);
  const width = Math.min(maxW, Math.max(minW, Math.min(w || 0, (h || 0) * a)));
  return { w: hundredths(width), h: hundredths(width / a) };
}

// A size slider's 0..1 and the width it stands for.
export function trinketWidthAt(piece: string, t: number) {
  const { minW, maxW } = trinketBounds(piece);
  return trinketFit(piece, minW + (maxW - minW) * Math.min(1, Math.max(0, t)), Infinity);
}
export function trinketSlideOf(piece: string, w: number) {
  const { minW, maxW } = trinketBounds(piece);
  return Math.min(1, Math.max(0, (w - minW) / (maxW - minW)));
}

// Turned this many degrees, kept to 0..359 (CORE-098).
export function turnedBy(degrees: number | undefined) {
  const d = Math.round(degrees ?? 0) % 360;
  return d < 0 ? d + 360 : d;
}

// The shades a drawing uses, worked out from its main color.
export function trinketShades(color: string) {
  return {
    main: color,
    light: shade(color, 0.45),
    dark: shade(color, -0.3),
    darker: shade(color, -0.55),
  };
}
