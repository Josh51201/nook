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

// What a trinket can be resized to.
export const trinketSizes: { label: string; w: number; h: number }[] = [
  { label: "Tiny", w: 1, h: 1 },
  { label: "Small", w: 2, h: 1 },
  { label: "Medium", w: 2, h: 2 },
  { label: "Tall", w: 1, h: 2 },
  { label: "Wide", w: 4, h: 1 },
  { label: "Large", w: 4, h: 3 },
];

// The shades a drawing uses, worked out from its main color.
export function trinketShades(color: string) {
  return {
    main: color,
    light: shade(color, 0.45),
    dark: shade(color, -0.3),
    darker: shade(color, -0.55),
  };
}
