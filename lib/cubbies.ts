import type { IconName } from "../components/icon";
import { shade } from "./colors";
import type { Corners } from "./decor";

// Cubbies (CORE-084): decorated boxes that sit behind your widgets and
// tiles, so a few things can be gathered into one box that matches the rest
// of your decorating. A Cubby is drawn a little bigger than its cells, so its
// edge shows in the gaps around whatever is inside it, and dragging it brings
// the things inside along. Drawn by components/hearth/cubby-art.tsx.

export type CubbyStyle = "cardboard" | "crate" | "gift" | "quilted" | "frame" | "scrapbook" | "glass" | "shelf";

// How solid the inside of the box is: "clear" lets the wallpaper through.
export type CubbyFill = "solid" | "soft" | "clear";

export const cubbyStyles: {
  key: CubbyStyle;
  label: string;
  icon: IconName;
  // The main color it comes in, and the corners it starts with.
  color: string;
  corners: Corners;
}[] = [
  { key: "cardboard", label: "Cardboard box", icon: "category", color: "#d9b383", corners: "square" },
  { key: "crate", label: "Wooden crate", icon: "tree", color: "#c99a6b", corners: "square" },
  { key: "gift", label: "Gift box", icon: "gift", color: "#f2c6cf", corners: "square" },
  { key: "quilted", label: "Quilted", icon: "clothes", color: "#dfe8d6", corners: "soft" },
  { key: "frame", label: "Picture frame", icon: "paint", color: "#e3c27a", corners: "square" },
  { key: "scrapbook", label: "Scrapbook page", icon: "doc", color: "#f5ece3", corners: "square" },
  { key: "glass", label: "Frosted glass", icon: "drop", color: "#d9e4ef", corners: "round" },
  { key: "shelf", label: "Shadow box shelf", icon: "books", color: "#e9e1f2", corners: "square" },
];

export function cubbyStyleInfo(key: string | undefined) {
  return cubbyStyles.find((s) => s.key === key) ?? cubbyStyles[0];
}

export const cubbyFills: { key: CubbyFill; label: string; opacity: number }[] = [
  { key: "solid", label: "Solid", opacity: 1 },
  { key: "soft", label: "Soft", opacity: 0.62 },
  { key: "clear", label: "See-through", opacity: 0.26 },
];

export function cubbyFillOpacity(fill: CubbyFill | undefined) {
  return (cubbyFills.find((f) => f.key === fill) ?? cubbyFills[0]).opacity;
}

// How far past its cells a Cubby is drawn on every side, in points: most of
// the gap between cells, so its edge frames what's inside.
export const CUBBY_OUTSET = 9;

// The shades a box uses, worked out from its main color.
export function cubbyShades(color: string) {
  return {
    main: color,
    light: shade(color, 0.4),
    dark: shade(color, -0.28),
    darker: shade(color, -0.5),
  };
}
