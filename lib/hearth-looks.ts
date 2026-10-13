import type { Corners, Lift, TileShape } from "./decor";
import type { HearthItem, LabelItem } from "./hearth-layout";
import type { WidgetConfig, WidgetLook } from "./widgets";
import type { WidgetSkin } from "./widget-skins";
import { sharesOnlyColor, type Doorway, type TileBuild } from "./tile-looks";

// Copy a look, paste it on other things (CORE-097). Pure helpers, no React.
//
// A tile or widget's look is its color, corners, shadow, outline and style
// (soft, bold or outline), and a Nook tile's shape; a widget's also what
// it's made of, its edges, its hanger and its lean (CORE-122..124), and a
// Nook tile's what it's built from and its doorway (CORE-137, 139). A widget
// and a Nook tile only pass each other their color: one's a thing pinned up,
// the other part of the house. Text's look is how it's
// written. Things of a kind share all of it; a Hollow just takes the color;
// text only takes text's look, since a tile's soft color would be too pale
// to read as words. Boxes and Trinkets keep their own looks.

const TEXT_KEYS = ["size", "font", "bold", "caps", "decor", "italic", "letters", "spacing", "underline", "effect", "span", "spanY"] as const;
type TextKey = (typeof TEXT_KEYS)[number];

export type Look =
  | {
      kind: "tile";
      color?: string;
      corners?: Corners;
      lift?: Lift;
      border?: boolean;
      // Soft, bold or outline.
      style?: WidgetLook;
      // Only when it came from a Nook tile; other things leave a tile's shape be.
      shape?: TileShape | null;
      // Only when it came from a widget; set (even to undefined) means "paste it".
      skin?: WidgetSkin;
      // Where it came from: a widget and a Nook tile only share their color.
      from: "nook" | "widget";
      build?: TileBuild;
      doorway?: Doorway;
    }
  | ({ kind: "text"; color?: string } & Pick<LabelItem, TextKey>)
  | { kind: "color"; color?: string };

// The look of something, or null if it doesn't have one to share.
export function lookOf(item: HearthItem): Look | null {
  if (item.kind === "widget") {
    return { kind: "tile", from: "widget", color: item.color, corners: item.corners, lift: item.lift, border: item.border, style: item.widget.look, skin: item.widget.skin };
  }
  if (item.kind === "nook") {
    return {
      kind: "tile",
      from: "nook",
      color: item.color,
      corners: item.corners,
      lift: item.lift,
      border: item.border,
      style: item.look ?? "soft",
      shape: item.shape ?? null,
      build: item.build,
      doorway: item.doorway,
    };
  }
  if (item.kind === "label") {
    const look: Look = { kind: "text", color: item.color, size: item.size };
    for (const key of TEXT_KEYS) (look as Record<string, unknown>)[key] = item[key];
    return look;
  }
  if (item.kind === "hollow") return { kind: "color", color: item.color };
  return null;
}

// What pasting `look` makes of `item`, or null if this kind doesn't take it.
export function paintItem(item: HearthItem, look: Look): HearthItem | null {
  if (look.kind === "tile" && (item.kind === "widget" || item.kind === "nook") && sharesOnlyColor(look.from, item.kind)) {
    return { ...item, color: look.color };
  }
  if (item.kind === "widget" && look.kind === "tile") {
    const widget = { ...item.widget, look: look.style ?? item.widget.look, skin: "skin" in look ? look.skin : item.widget.skin } as WidgetConfig;
    return { ...item, color: look.color, corners: look.corners, lift: look.lift, border: look.border, widget };
  }
  if (item.kind === "nook" && look.kind === "tile") {
    return {
      ...item,
      color: look.color,
      corners: look.corners,
      lift: look.lift,
      border: look.border,
      look: look.style,
      shape: look.shape === undefined ? item.shape : look.shape ?? undefined,
      build: look.build,
      doorway: look.doorway,
    };
  }
  if (item.kind === "label" && look.kind === "text") {
    const next: LabelItem = { ...item, color: look.color };
    for (const key of TEXT_KEYS) (next as Record<string, unknown>)[key] = look[key];
    return next;
  }
  if (item.kind === "hollow" && look.kind !== "text") return { ...item, color: look.color ?? item.color };
  return null;
}

// "Copy look" in the widget editor: it saves and goes back, leaving this so
// the Hearth opens straight into pasting it (like requestMove).
let pending: Look | null = null;

export function requestPaint(look: Look) {
  pending = look;
}

// The waiting look, if any; taking it clears it.
export function takePaintRequest(): Look | null {
  const look = pending;
  pending = null;
  return look;
}
