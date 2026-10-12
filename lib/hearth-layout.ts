import type { IconName } from "../components/icon";
import { deepOf } from "./colors";
import type { CustomTheme, SeasonalThemes } from "./custom-theme";
import type { ShowIn } from "./widget-extras";
import { cubbyStyleInfo, type CubbyFill, type CubbyStyle } from "./cubbies";
import { wallpaperPath, type Ambience, type Corners, type FireSound, type Lift, type PatternKey, type TileShape, type Wallpaper } from "./decor";
import { findNook } from "./nooks";
import { trinketFit, trinketInfo, type TrinketKey } from "./trinkets";
import { defaultWidget, newReminderId, widgetKindInfo, type WidgetConfig, type WidgetLook, type WidgetOf } from "./widgets";

// Pure Hearth layout logic (no React/Supabase, so it's unit-testable).
//
// The Hearth is a free-form grid you design yourself (CORE-006/019): every
// item — a Nook tile, a widget (CORE-018) or a text label — sits at a grid
// position with a size, gaps allowed. Dropping an item on top of others
// slides those others down out of the way. Saved in nook_settings under
// nook = 'hearth'. Removing a Nook tile keeps the Nook's data (re-adding it
// from the Market brings everything back).

export const COLUMNS = 4;

export type GridRect = { x: number; y: number; w: number; h: number };

// `icon` is a person's own pick for a tile or widget (CORE-030); when unset
// it shows the Nook's or widget's usual icon.
// `corners`, `lift` (shadow) and `border` are shape tweaks (CORE-042).
type ItemBase = GridRect & {
  id: string;
  color?: string;
  icon?: IconName;
  corners?: Corners;
  lift?: Lift;
  border?: boolean;
  // Only shown in these months (CORE-053); always shown if unset.
  showIn?: ShowIn;
  // Widgets that share a stack (CORE-050) sit in the same spot and the same
  // size; you swipe between them. Items in one stack have the same id here.
  stack?: string;
  // A stack flips by itself to whichever widget has news (CORE-114) unless
  // this is set on its widgets.
  stackStill?: boolean;
  // Locked in place (CORE-061): can't be dragged, resized or removed until
  // unlocked, and other things move around it.
  locked?: boolean;
  // Short labels (CORE-065) you can show or hide together.
  tags?: string[];
};

// Nook tiles come in the same three looks as widgets (CORE-030).
export type NookItem = ItemBase & { kind: "nook"; nookId: string; label?: string; look?: WidgetLook; shape?: TileShape };
export type WidgetItem = ItemBase & { kind: "widget"; widget: WidgetConfig };
export type LabelItem = ItemBase & {
  kind: "label";
  text: string;
  size: "title" | "heading" | "caption";
  align: "left" | "center" | "right";
  // A full-width divider you can fold shut to hide the section under it
  // (CORE-064).
  divider?: boolean;
  // How it's written (CORE-076): the font, bold or not, CAPITALS, and a
  // little decoration behind or around it.
  font?: LabelFont;
  bold?: boolean;
  // Older text's CAPITALS switch; `letters` replaces it (see labelLook).
  caps?: boolean;
  // "underline" here is older text's underline decoration; underlining is
  // now its own choice so it works with any decoration (see labelLook).
  decor?: LabelDecor;
  // Lettering (CORE-082): italics, how the letters are written, the room
  // between them, an underline and an effect, all on top of any decoration.
  italic?: boolean;
  letters?: LabelLetters;
  spacing?: LabelSpacing;
  underline?: LabelUnderline;
  effect?: LabelEffect;
  // Where it sits up and down in its space (CORE-078). Unset: slim text in
  // the middle, taller text at the bottom (see labelVAlign).
  valign?: LabelVAlign;
  // How far the decoration stretches across its space (CORE-078): 0 hugs the
  // words, 1 reaches edge to edge. Unset is 0.
  span?: number;
  // How far a shaped decoration (pill, patch, ribbon, sign) stretches up and
  // down its space, the same way (CORE-081). The words stay their size,
  // centred inside it. Unset is 0.
  spanY?: number;
};

export type LabelVAlign = "top" | "middle" | "bottom";

export type LabelDecor = "none" | "underline" | "pill" | "stitched" | "ribbon" | "sign" | "flourish";

export type LabelLetters = "typed" | "upper" | "lower" | "title";
export type LabelSpacing = "snug" | "normal" | "airy" | "wide";
export type LabelUnderline = "none" | "line" | "bar" | "wavy";
export type LabelEffect = "none" | "shadow" | "glow" | "letterpress" | "retro";

export const labelLetters: { key: LabelLetters; label: string }[] = [
  { key: "typed", label: "As typed" },
  { key: "upper", label: "CAPITALS" },
  { key: "lower", label: "lowercase" },
  { key: "title", label: "Title Case" },
];
export const labelSpacings: { key: LabelSpacing; label: string }[] = [
  { key: "snug", label: "Snug" },
  { key: "normal", label: "Normal" },
  { key: "airy", label: "Airy" },
  { key: "wide", label: "Wide" },
];
export const labelUnderlines: { key: LabelUnderline; label: string }[] = [
  { key: "none", label: "None" },
  { key: "line", label: "Line" },
  { key: "bar", label: "Soft bar" },
  { key: "wavy", label: "Wavy" },
];
export const labelEffects: { key: LabelEffect; label: string }[] = [
  { key: "none", label: "None" },
  { key: "shadow", label: "Shadow" },
  { key: "glow", label: "Glow" },
  { key: "letterpress", label: "Letterpress" },
  { key: "retro", label: "Retro" },
];

// Text's look with older settings read the new way (CORE-082): the old
// underline decoration is a soft-bar underline with no decoration, and the
// old CAPITALS switch is "CAPITALS" letters. A divider has no decoration or
// underline.
export type LabelLook = {
  decor: LabelDecor;
  underline: LabelUnderline;
  letters: LabelLetters;
  spacing: LabelSpacing;
  effect: LabelEffect;
  italic: boolean;
};
export function labelLook(item: Pick<LabelItem, "decor" | "underline" | "caps" | "letters" | "spacing" | "effect" | "italic" | "divider">): LabelLook {
  const oldUnderline = item.decor === "underline";
  return {
    decor: item.divider || oldUnderline ? "none" : item.decor ?? "none",
    underline: item.divider ? "none" : item.underline ?? (oldUnderline ? "bar" : "none"),
    letters: item.letters ?? (item.caps ? "upper" : "typed"),
    spacing: item.spacing ?? "normal",
    effect: item.effect ?? "none",
    italic: Boolean(item.italic),
  };
}
// The fields to save alongside a lettering or decoration change, so older
// text moves to the new settings without changing how it looks.
export function labelLookUpgrade(item: Pick<LabelItem, "decor" | "underline" | "caps" | "letters">): Partial<LabelItem> {
  const changes: Partial<LabelItem> = {};
  if (item.decor === "underline") {
    changes.decor = "none";
    if (!item.underline) changes.underline = "bar";
  }
  if (item.caps !== undefined) {
    changes.caps = undefined;
    if (!item.letters) changes.letters = item.caps ? "upper" : "typed";
  }
  return changes;
}

// Decorations you can pick ("underline" is now its own choice, CORE-082).
export const labelDecors: { key: LabelDecor; label: string; icon: IconName }[] = [
  { key: "none", label: "Plain", icon: "close" },
  { key: "pill", label: "Soft pill", icon: "category" },
  { key: "stitched", label: "Stitched", icon: "clothes" },
  { key: "ribbon", label: "Ribbon", icon: "gift" },
  { key: "sign", label: "Wood sign", icon: "tree" },
  { key: "flourish", label: "Flourish", icon: "sparkles" },
];

// Plain-text labels are bold unless they're captions (as they always were).
export function labelIsBold(item: Pick<LabelItem, "bold" | "size">) {
  return item.bold ?? item.size !== "caption";
}
// A Hollow (CORE-022..024): a little place on the Hearth that you step
// into. It holds its own grid of items. One level only: a Hollow never
// holds another Hollow.
export type HollowLook = "house" | "stump" | "hill" | "mushroom";
// Decorations for a Hollow (CORE-031).
export type HollowDecor = "none" | "lights" | "snow" | "flowers";
export type HollowItem = ItemBase & {
  kind: "hollow";
  name: string;
  look: HollowLook;
  decor?: HollowDecor;
  // Its own wallpaper (CORE-041); none set means the Hearth's.
  wallpaper?: Wallpaper;
  items: HearthItem[];
};
// A little decoration (CORE-045): can't be tapped, just there. Its `color` is
// the main color of the drawing.
// `rotate` is how many degrees it's turned (CORE-098).
export type TrinketItem = ItemBase & { kind: "trinket"; piece: TrinketKey; flip?: boolean; rotate?: number };
// A Cubby (CORE-084): a decorated box drawn behind everything else, to
// gather the things inside it. Its `color` is the box's main color; a
// pattern can be printed on it, and its fill can let the wallpaper through.
export type CubbyItem = ItemBase & { kind: "cubby"; style: CubbyStyle; pattern?: PatternKey; fill?: CubbyFill };

export const hollowLooks: { look: HollowLook; label: string; icon: IconName; color: string }[] = [
  { look: "house", label: "A little house", icon: "burrow", color: "#f6d9c4" },
  { look: "stump", label: "A tree stump", icon: "leaf", color: "#dfe8d6" },
  { look: "hill", label: "A burrow hill", icon: "tree", color: "#f3e6b8" },
  { look: "mushroom", label: "A mushroom", icon: "sparkles", color: "#efd9e4" },
];

export function hollowLookInfo(look: HollowLook) {
  return hollowLooks.find((info) => info.look === look) ?? hollowLooks[0];
}

export const hollowDecors: { decor: HollowDecor; label: string; icon: IconName }[] = [
  { decor: "none", label: "Plain", icon: "close" },
  { decor: "lights", label: "String lights", icon: "sparkles" },
  { decor: "snow", label: "Snowy", icon: "christmas" },
  { decor: "flowers", label: "Flowers", icon: "flower" },
];
export type HearthItem = NookItem | WidgetItem | LabelItem | HollowItem | TrinketItem | CubbyItem;

// A page of the Hearth (CORE-051), such as "Everyday" and "Holidays". Only
// the page you're on keeps its items in `items` (so every editing helper keeps
// working on `items`); the rest wait in `otherPages` until you swipe to them.
export type HearthPage = { id: string; name: string };

export type HearthLayout = {
  version: 2;
  title: string;
  theme: HearthThemeKey;
  // Switch to Dusk whenever the phone is in dark mode (CORE-032).
  followPhone: boolean;
  // The app's typeface (CORE-035).
  font: FontKey;
  // How big text is across the app, except on the Hearth's own tiles (CORE-068).
  textSize: TextSizeKey;
  // A little vibration on taps (CORE-075).
  haptics: boolean;
  // Behind everything (CORE-041), and the weather in the air (CORE-047).
  wallpaper: Wallpaper;
  ambience: Ambience;
  // The fireplace sound (CORE-047); unset is off.
  fireSound?: FireSound;
  // Themes you've made (CORE-043), and themes that change with the seasons.
  customThemes: CustomTheme[];
  seasonal: SeasonalThemes;
  pages: HearthPage[];
  activePage: string;
  // Hide the page shared with your Home (CORE-054).
  hideHomePage?: boolean;
  otherPages: Record<string, HearthItem[]>;
  items: HearthItem[];
};

export type { FontKey } from "./fonts";
import type { FontKey, LabelFont } from "./fonts";
import type { TextSizeKey } from "./text-size";

// Soft tile colors that all work with dark text, each with a deep partner
// for "bold" widgets and outlines.
export const tilePalette = [
  "#f5ece3", // cream
  "#f6d9c4", // peach
  "#f3e6b8", // honey
  "#dfe8d6", // sage
  "#d9e4ef", // sky
  "#e9e1f2", // lavender
  "#efd9e4", // rose
];
const deepPalette = ["#8a5a3b", "#b0552d", "#9a7a1c", "#4f6b45", "#3f6a96", "#6a4f96", "#a3425f"];

// The deep partner of a soft color: hand-picked for the seven classics,
// worked out for any other color picked (CORE-042).
export function deepColor(soft: string | undefined) {
  const index = tilePalette.indexOf(soft ?? "");
  if (index >= 0) return deepPalette[index];
  return soft && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(soft) ? deepOf(soft) : deepPalette[0];
}

// The four built-in themes have fixed keys; themes you make are added at
// runtime under "custom-…" keys (see components/themed-screen.tsx).
export type HearthThemeKey = string;
export const builtInThemes = ["hearth", "ember", "sage", "dusk"] as const;

export type HearthTheme = {
  label: string;
  background: string;
  text: string;
  muted: string;
  accent: string;
  shade: string;
  glow: string;
  dark: boolean;
};

// `shade` tints the shadows under tiles (as "r, g, b"), and `glow` is the
// firelight behind the top of the Hearth — both chosen per theme so the
// depth reads on light and dark Hearths alike.
export const hearthThemes: Record<HearthThemeKey, HearthTheme> = {
  hearth: {
    label: "Hearth",
    background: "#fbf7f2",
    text: "#222222",
    muted: "#6f6f6f",
    accent: "#8a5a3b",
    shade: "74, 44, 22",
    glow: "#f5b97c",
    dark: false,
  },
  ember: {
    label: "Ember",
    background: "#fbefe4",
    text: "#3a2418",
    muted: "#7e6050",
    accent: "#a04d29",
    shade: "110, 48, 20",
    glow: "#f49a5c",
    dark: false,
  },
  sage: {
    label: "Sage",
    background: "#eef3ea",
    text: "#23301f",
    muted: "#606d5a",
    accent: "#4f6b45",
    shade: "38, 58, 32",
    glow: "#d9e3a4",
    dark: false,
  },
  dusk: {
    label: "Dusk",
    background: "#2a2330",
    text: "#f4ece6",
    muted: "#b9adb4",
    accent: "#f0b98d",
    shade: "0, 0, 0",
    glow: "#f09a52",
    dark: true,
  },
};

// The soft, layered shadow that lifts Hearth tiles and widgets off the page
// (CORE-008): a tight contact shadow plus a wide, gentle one, like light
// from above. Dark themes need it stronger to show at all.
// Nook tiles (`raised`) sit a little higher than widgets (CORE-036).
export function tileShadow(themeKey: HearthThemeKey, raised = false) {
  return shadowAtLevel(themeKey, raised ? 2 : 1) as string;
}

// 0 = none, 1 = widgets' usual, 2 = Nook tiles' usual, 3 = floating high.
export function shadowAtLevel(themeKey: HearthThemeKey, level: 0 | 1 | 2 | 3): string | undefined {
  const theme = hearthThemes[themeKey] ?? hearthThemes.hearth;
  const k = theme.dark ? 2.6 : 1;
  const a = (alpha: number) => `rgba(${theme.shade}, ${Math.min(1, alpha * k).toFixed(3)})`;
  if (level === 0) return undefined;
  if (level === 3) return `0px 3px 5px ${a(0.12)}, 0px 18px 30px -6px ${a(0.2)}, 0px 40px 60px -20px ${a(0.32)}`;
  const raised = level === 2;
  if (raised) return `0px 2px 3px ${a(0.1)}, 0px 10px 20px -4px ${a(0.15)}, 0px 26px 40px -16px ${a(0.24)}`;
  return `0px 1px 2px ${a(0.08)}, 0px 6px 14px -2px ${a(0.1)}, 0px 18px 30px -14px ${a(0.16)}`;
}

// A thin lit edge along the top of a tile and a whisper of shade along its
// bottom, drawn inside it, so it looks gently raised rather than flat.
export const tileBevel = "inset 0px 1.5px 0px rgba(255, 255, 255, 0.55), inset 0px -2px 0px rgba(0, 0, 0, 0.04)";

export const defaultHearthLayout: HearthLayout = {
  version: 2,
  title: "The Hearth",
  theme: "hearth",
  followPhone: true,
  font: "classic",
  textSize: "normal",
  haptics: true,
  wallpaper: { kind: "none" },
  ambience: "off",
  customThemes: [],
  seasonal: { enabled: false },
  pages: [{ id: "main", name: "Hearth" }],
  activePage: "main",
  otherPages: {},
  items: [],
};

// What a brand-new Hearth starts with (CORE-072): just a warm hello across
// the top, so the first screen isn't a blank page. Everything else is added
// by the person (CORE-015), and the hello can be moved, changed or removed
// like any widget.
export function starterItems(): HearthItem[] {
  const widget = defaultWidget("greeting");
  const size = widgetKindInfo("greeting").size;
  return [
    {
      id: "starter-greeting",
      kind: "widget",
      widget: widget.kind === "greeting" ? { ...widget, settings: { ...widget.settings, message: "Welcome to your Hearth" } } : widget,
      x: 0,
      y: 0,
      ...size,
    },
  ];
}

// --- Sizes ------------------------------------------------------------------

export const sizePresets: Record<HearthItem["kind"], { label: string; w: number; h: number }[]> = {
  nook: [
    { label: "Icon", w: 1, h: 1 },
    { label: "Small", w: 2, h: 2 },
    { label: "Wide", w: 4, h: 2 },
    { label: "Large", w: 4, h: 3 },
  ],
  widget: [
    { label: "Icon", w: 1, h: 1 },
    { label: "Strip", w: 4, h: 1 },
    { label: "Small", w: 2, h: 2 },
    { label: "Tall", w: 2, h: 4 },
    { label: "Wide", w: 4, h: 2 },
    { label: "Large", w: 4, h: 4 },
  ],
  label: [
    { label: "Slim", w: 4, h: 0.5 },
    { label: "Slim half", w: 2, h: 0.5 },
    { label: "Tall", w: 4, h: 1 },
    { label: "Tall half", w: 2, h: 1 },
  ],
  hollow: [
    { label: "Icon", w: 1, h: 1 },
    { label: "Small", w: 2, h: 2 },
    { label: "Wide", w: 4, h: 2 },
    { label: "Large", w: 4, h: 3 },
  ],
  trinket: [
    { label: "Tiny", w: 1, h: 1 },
    { label: "Small", w: 2, h: 1 },
    { label: "Medium", w: 2, h: 2 },
    { label: "Tall", w: 1, h: 2 },
    { label: "Wide", w: 4, h: 1 },
    { label: "Large", w: 4, h: 3 },
  ],
  cubby: [
    { label: "Narrow", w: 1, h: 2 },
    { label: "Small", w: 2, h: 2 },
    { label: "Wide", w: 4, h: 2 },
    { label: "Tall", w: 2, h: 4 },
    { label: "Large", w: 4, h: 4 },
    { label: "Big", w: 4, h: 6 },
  ],
};

export function minSize(item: HearthItem): { w: number; h: number } {
  if (item.kind === "widget") return widgetKindInfo(item.widget.kind).minSize;
  // Text can be a slim half-row tall (CORE-076).
  if (item.kind === "label") return { w: 1, h: ROW_STEP };
  return { w: 1, h: 1 };
}

// Things sit on half rows (CORE-076), so slim text can take half a row and
// the tiles under it sit right up against it. Widths, and the heights of
// everything but text, are still whole cells.
export const ROW_STEP = 0.5;

export function snapRow(n: number) {
  return Math.round(n / ROW_STEP) * ROW_STEP;
}

// Things that can end on a half row: text, and Cubbies (so a box can wrap
// slim text along with the things under it).
export function usesHalfRows(item: Pick<HearthItem, "kind">) {
  return item.kind === "label" || item.kind === "cubby";
}

// --- Grid geometry ------------------------------------------------------------

export function overlaps(a: GridRect, b: GridRect) {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

export function rowsUsed(items: GridRect[]) {
  return items.reduce((max, item) => Math.max(max, item.y + item.h), 0);
}

// Trinkets (CORE-045) float: they can sit anywhere, between the grid's
// cells, overlap things, and are never pushed out of the way or push others.
// Their x and y are in cells but may have decimals. Cubbies (CORE-084) float
// the same way, behind everything, but snap to cells.
export function isFloating(item: HearthItem) {
  return item.kind === "trinket" || item.kind === "cubby";
}

// What's in a Cubby: everything (but itself) that sits wholly inside its
// cells. Locked things stay where they are, so they aren't carried, and so
// does a Cubby as big as this one (two boxes in one spot can be pulled apart).
export function cubbyContents(items: HearthItem[], cubby: GridRect & { id: string }): HearthItem[] {
  const area = cubby.w * cubby.h;
  const inside = (item: HearthItem) =>
    item.x >= cubby.x - 0.01 &&
    item.y >= cubby.y - 0.01 &&
    item.x + item.w <= cubby.x + cubby.w + 0.01 &&
    item.y + item.h <= cubby.y + cubby.h + 0.01;
  return items.filter(
    (item) => item.id !== cubby.id && !item.locked && !(item.kind === "cubby" && item.w * item.h >= area) && inside(item)
  );
}

const hundredths = (n: number) => Math.round(n * 100) / 100;

// A Trinket's box is the shape of its drawing, at any size between its
// smallest and biggest (CORE-098), kept where its bottom middle was.
export function fitTrinket<T extends HearthItem>(item: T): T {
  if (item.kind !== "trinket") return item;
  const fit = trinketFit(item.piece, item.w, item.h);
  if (fit.w === item.w && fit.h === item.h) return item;
  return {
    ...item,
    w: fit.w,
    h: fit.h,
    x: hundredths(Math.max(0, Math.min(COLUMNS - fit.w, item.x + (item.w - fit.w) / 2))),
    y: hundredths(Math.max(0, item.y + (item.h - fit.h))),
  };
}

// Every Trinket in these, including inside Hollows, fitted to its drawing.
export function fitTrinkets(items: HearthItem[]): HearthItem[] {
  let changed = false;
  const next = items.map((item) => {
    const fitted = item.kind === "hollow" ? { ...item, items: fitTrinkets(item.items) } : fitTrinket(item);
    if (item.kind === "hollow" ? fitted.kind === "hollow" && fitted.items.some((inner, i) => inner !== item.items[i]) : fitted !== item) {
      changed = true;
      return fitted;
    }
    return item;
  });
  return changed ? next : items;
}

// A whole Hearth with its Trinkets fitted, on every page.
function fitAllTrinkets(layout: HearthLayout): HearthLayout {
  const otherPages: HearthLayout["otherPages"] = {};
  for (const [id, items] of Object.entries(layout.otherPages)) otherPages[id] = fitTrinkets(items);
  return { ...layout, items: fitTrinkets(layout.items), otherPages };
}

function clampRect<T extends HearthItem>(item: T): T {
  if (item.kind === "trinket") {
    const fit = trinketFit(item.piece, item.w, item.h);
    const x = Math.max(0, Math.min(COLUMNS - fit.w, hundredths(item.x)));
    return { ...item, x, y: Math.max(0, hundredths(item.y)), ...fit };
  }
  const min = minSize(item);
  const w = Math.max(min.w, Math.min(COLUMNS, Math.round(item.w)));
  const h = Math.max(min.h, Math.min(8, usesHalfRows(item) ? snapRow(item.h) : Math.round(item.h)));
  const x = Math.max(0, Math.min(COLUMNS - w, Math.round(item.x)));
  const y = Math.max(0, snapRow(item.y));
  return { ...item, x, y, w, h };
}

// Slide anything overlapping the item that just moved (or grew) downward,
// cascading, until nothing overlaps. Items only ever move down, so this
// always finishes; gaps elsewhere are left exactly as the person made them.
// Several items can stay put at once (what a Cubby just carried).
export function settle(items: HearthItem[], fixedId: string | string[]): HearthItem[] {
  const result = items.map((item) => ({ ...item }));
  const ids = new Set(Array.isArray(fixedId) ? fixedId : [fixedId]);
  if (!result.some((item) => ids.has(item.id))) return result;
  // Widgets in a stack (CORE-050) are one thing: they don't push each other,
  // and they move as a group.
  const stacks = new Set(result.filter((item) => ids.has(item.id) && item.stack).map((item) => item.stack));
  const isFixed = (item: HearthItem) =>
    ids.has(item.id) || (!!item.stack && stacks.has(item.stack)) || Boolean(item.locked);
  const order = () =>
    [...result].sort((a, b) => (isFixed(a) ? 0 : 1) - (isFixed(b) ? 0 : 1) || a.y - b.y || a.x - b.x);

  for (let guard = 0; guard < 500; guard++) {
    let moved = false;
    const sorted = order();
    for (let i = 1; i < sorted.length; i++) {
      const item = sorted[i];
      if (isFixed(item)) continue;
      for (let j = 0; j < i; j++) {
        const above = sorted[j];
        if (isFloating(item) || isFloating(above)) continue;
        if (overlaps(item, above) && !(item.stack && item.stack === above.stack)) {
          item.y = above.y + above.h;
          moved = true;
          if (item.stack) for (const mate of result) if (mate.stack === item.stack) mate.y = item.y;
        }
      }
    }
    if (!moved) break;
  }
  return result;
}

// First spot (top to bottom, left to right) where a w×h item fits.
export function findFreeSpot(items: GridRect[], w: number, h: number): { x: number; y: number } {
  for (let y = 0; ; y += ROW_STEP) {
    for (let x = 0; x + w <= COLUMNS; x++) {
      const candidate = { x, y, w, h };
      if (!items.some((item) => overlaps(item, candidate))) return { x, y };
    }
  }
}

export function newItemId(prefix = "i") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

// --- Editing ----------------------------------------------------------------------

// The item, and anything stacked with it (CORE-050), which goes along.
function withStackMates(items: HearthItem[], id: string) {
  const stack = items.find((item) => item.id === id)?.stack;
  return (item: HearthItem) => item.id === id || (!!stack && item.stack === stack);
}

// What letting go of a dragged item at x, y does (CORE-091). Nothing else on
// the page is ever pushed: it lands in an open spot (a drop half a row off
// lands in the open spot right there), swaps places with a same-size thing
// it's mostly over, or, with no room, goes back where it was. `x`/`y` is
// where it ends up; for "blocked" it's the spot that had no room.
export type MovePlan =
  | { kind: "place"; x: number; y: number }
  | { kind: "swap"; x: number; y: number; withIds: string[]; to: { x: number; y: number } }
  | { kind: "blocked"; x: number; y: number };

export function planMove(items: HearthItem[], id: string, x: number, y: number, { fit = true } = {}): MovePlan {
  const moving = items.find((item) => item.id === id);
  if (!moving) return { kind: "blocked", x, y };
  const target = clampRect({ ...moving, x, y });
  const blocked: MovePlan = { kind: "blocked", x: target.x, y: target.y };
  if (moving.locked) return blocked;
  // A Cubby goes anywhere, but what it carries needs room where it lands.
  if (moving.kind === "cubby") {
    const carried = cubbyContents(items, moving).filter((item) => !isFloating(item));
    const ids = new Set(carried.map((item) => item.id));
    const dx = target.x - moving.x;
    const dy = target.y - moving.y;
    const lands = carried.map((item) => ({ ...item, x: item.x + dx, y: item.y + dy }));
    const others = items.filter((item) => !ids.has(item.id) && !isFloating(item));
    return lands.some((rect) => others.some((other) => overlaps(other, rect))) ? blocked : { kind: "place", x: target.x, y: target.y };
  }
  if (isFloating(moving)) return { kind: "place", x: target.x, y: target.y };

  const goes = withStackMates(items, id);
  const others = items.filter((item) => !goes(item) && !isFloating(item));
  const hits = others.filter((other) => overlaps(other, target));
  if (!hits.length) return { kind: "place", x: target.x, y: target.y };
  // Just a little off: the open spot half a row up or down.
  if (fit) {
    for (const step of [-ROW_STEP, ROW_STEP]) {
      const near = { ...target, y: target.y + step };
      if (near.y >= 0 && !others.some((other) => overlaps(other, near))) return { kind: "place", x: near.x, y: near.y };
    }
  }
  // Mostly over one thing its own size (a stack counts as one): trade places.
  const other = hits[0];
  const unit = others.filter((item) => item.id === other.id || (!!other.stack && item.stack === other.stack));
  const oneThing = hits.every((hit) => unit.includes(hit));
  const sameSize = other.w === moving.w && other.h === moving.h;
  if (oneThing && sameSize && !unit.some((item) => item.locked) && overlapArea(other, target) * 2 >= target.w * target.h) {
    const rest = others.filter((item) => !unit.includes(item));
    const there = { ...target, x: other.x, y: other.y };
    const back = { ...other, x: moving.x, y: moving.y };
    if (!rest.some((item) => overlaps(item, there) || overlaps(item, back))) {
      return { kind: "swap", x: other.x, y: other.y, withIds: unit.map((item) => item.id), to: { x: moving.x, y: moving.y } };
    }
  }
  return blocked;
}

function overlapArea(a: GridRect, b: GridRect) {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return Math.max(0, w) * Math.max(0, h);
}

// Dropped by hand (CORE-091): see planMove. Unchanged (the same array) when
// it goes back where it was. A locked item (CORE-061) never moves.
export function moveItem(layout: HearthLayout, id: string, x: number, y: number, options?: { fit?: boolean }): HearthItem[] {
  const moving = layout.items.find((item) => item.id === id);
  const plan = planMove(layout.items, id, x, y, options);
  if (!moving || plan.kind === "blocked" || (plan.x === moving.x && plan.y === moving.y)) return layout.items;
  if (moving.kind === "cubby") return carryCubby(layout.items, moving, plan.x, plan.y);
  const goes = withStackMates(layout.items, id);
  const swapped = new Set(plan.kind === "swap" ? plan.withIds : []);
  return layout.items.map((item) =>
    goes(item)
      ? { ...item, x: plan.x, y: plan.y }
      : swapped.has(item.id) && plan.kind === "swap"
      ? { ...item, ...plan.to }
      : item
  );
}

// A Cubby and everything in it, moved together.
function carryCubby(items: HearthItem[], cubby: CubbyItem, x: number, y: number): HearthItem[] {
  const placed = clampRect({ ...cubby, x, y });
  const dx = placed.x - cubby.x;
  const dy = placed.y - cubby.y;
  const carried = new Set(cubbyContents(items, cubby).map((item) => item.id));
  return items.map((item) =>
    item.id === cubby.id
      ? placed
      : carried.has(item.id)
      ? { ...item, x: hundredths(item.x + dx), y: hundredths(item.y + dy) }
      : item
  );
}

// Making room on purpose: holding a dragged item still over a filled spot
// (CORE-092), or an arrow step with no room (CORE-075/076). It goes there
// anyway, and what it lands on slides down out of the way.
// Nothing can be dropped on a locked item: it lands in the nearest open spot.
export function pushItem(layout: Pick<HearthLayout, "items">, id: string, x: number, y: number): HearthItem[] {
  const moving = layout.items.find((item) => item.id === id);
  if (!moving || moving.locked) return layout.items;
  if (moving.kind === "cubby") return moveCubby(layout, moving, x, y);
  // A Trinket just goes where it was put.
  if (isFloating(moving)) {
    const placed = clampRect({ ...moving, x, y });
    return layout.items.map((item) => (item.id === id ? placed : item));
  }
  const goes = withStackMates(layout.items, id);
  let target = clampRect({ ...moving, x, y });
  const obstacles = layout.items.filter((item) => item.locked && !goes(item) && !isFloating(item));
  if (obstacles.some((item) => overlaps(item, target))) {
    const spot = nearestOpenSpot(obstacles, target);
    target = { ...target, ...spot };
  }
  const items = layout.items.map((item) => (goes(item) ? { ...item, x: target.x, y: target.y } : item));
  return settle(items, id);
}

export function resizeItem(layout: HearthLayout, id: string, w: number, h: number): HearthItem[] {
  const resizing = layout.items.find((item) => item.id === id);
  if (!resizing || resizing.locked) return layout.items;
  const goes = withStackMates(layout.items, id);
  const next = clampRect({ ...resizing, w, h });
  // Growing into a locked item isn't allowed.
  if (!isFloating(resizing) && layout.items.some((item) => item.locked && !goes(item) && !isFloating(item) && overlaps(item, next))) {
    return layout.items;
  }
  const items = layout.items.map((item) => (goes(item) ? { ...item, w: next.w, h: next.h, x: next.x, y: next.y } : item));
  return settle(items, id);
}

// A Cubby (CORE-084) brings what's inside it along, and anything where they
// land slides down out of the way. If what's inside would land on something
// locked, the box goes on its own.
function moveCubby(layout: Pick<HearthLayout, "items">, cubby: CubbyItem, x: number, y: number): HearthItem[] {
  const placed = clampRect({ ...cubby, x, y });
  const dx = placed.x - cubby.x;
  const dy = placed.y - cubby.y;
  const contents = cubbyContents(layout.items, cubby);
  const carried = new Set(contents.map((item) => item.id));
  const shifted = contents.map((item) => ({ ...item, x: hundredths(item.x + dx), y: hundredths(item.y + dy) }));
  const blocked = shifted.some(
    (item) =>
      !isFloating(item) &&
      layout.items.some((other) => other.locked && !carried.has(other.id) && !isFloating(other) && overlaps(other, item))
  );
  if (blocked || !shifted.length) return layout.items.map((item) => (item.id === cubby.id ? placed : item));
  const moved = new Map(shifted.map((item) => [item.id, item]));
  const items = layout.items.map((item) => (item.id === cubby.id ? placed : moved.get(item.id) ?? item));
  return settle(items, [...carried]);
}

// The open spot closest to where an item was dropped, given things that
// can't be pushed out of the way.
function nearestOpenSpot(obstacles: GridRect[], want: GridRect): { x: number; y: number } {
  const bottom = Math.max(want.y, rowsUsed(obstacles)) + 1;
  let best = { x: want.x, y: want.y };
  let bestDistance = Infinity;
  for (let y = 0; y <= bottom; y += ROW_STEP) {
    for (let x = 0; x + want.w <= COLUMNS; x++) {
      if (obstacles.some((o) => overlaps(o, { x, y, w: want.w, h: want.h }))) continue;
      const distance = (x - want.x) ** 2 + (y - want.y) ** 2;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = { x, y };
      }
    }
  }
  return best;
}

// Tidy up (CORE-062): everything slides up to close the gaps, keeping its
// column, and nothing overlaps. Locked items stay exactly where they are,
// and a stack moves as one.
export function tidyItems(items: HearthItem[]): HearthItem[] {
  const result = items.map((item) => ({ ...item }));
  // What each Cubby holds before tidying, so it can follow its things after.
  const held = result
    .filter((item) => item.kind === "cubby" && !item.locked)
    .map((cubby) => ({
      cubby,
      contents: cubbyContents(result, cubby)
        .filter((item) => !isFloating(item))
        .map((item) => ({ item, y: item.y })),
    }));
  // Trinkets float, so tidying leaves them where they are.
  const placed: HearthItem[] = result.filter((item) => item.locked && !isFloating(item));
  const rest = result.filter((item) => !item.locked && !isFloating(item)).sort((a, b) => a.y - b.y || a.x - b.x);
  const stackRow = new Map<string, number>();
  for (const item of rest) {
    const known = item.stack ? stackRow.get(item.stack) : undefined;
    if (known !== undefined) {
      item.y = known;
      placed.push(item);
      continue;
    }
    let y = 0;
    while (placed.some((other) => overlaps({ x: item.x, y, w: item.w, h: item.h }, other))) y += ROW_STEP;
    item.y = y;
    if (item.stack) stackRow.set(item.stack, y);
    placed.push(item);
  }
  // A Cubby moves and stretches with its things, keeping the room it had
  // above and below them.
  for (const { cubby, contents } of held) {
    if (!contents.length) continue;
    const top = Math.min(...contents.map((c) => c.y));
    const bottom = Math.max(...contents.map((c) => c.y + c.item.h));
    const newTop = Math.min(...contents.map((c) => c.item.y));
    const newBottom = Math.max(...contents.map((c) => c.item.y + c.item.h));
    const y = snapRow(Math.max(0, cubby.y + newTop - top));
    cubby.h = Math.min(8, Math.max(1, snapRow(cubby.y + cubby.h + newBottom - bottom - y)));
    cubby.y = y;
  }
  return result;
}

// A stack that's down to one widget isn't a stack any more.
export function normalizeStacks(items: HearthItem[]): HearthItem[] {
  const counts = new Map<string, number>();
  for (const item of items) if (item.stack) counts.set(item.stack, (counts.get(item.stack) ?? 0) + 1);
  if (![...counts.values()].some((n) => n < 2)) return items;
  return items.map((item) => {
    if (!item.stack || (counts.get(item.stack) ?? 0) >= 2) return item;
    const { stack: _stack, stackStill: _still, ...rest } = item;
    return rest as HearthItem;
  });
}

export function updateItem(layout: HearthLayout, id: string, changes: Partial<HearthItem>): HearthItem[] {
  return layout.items.map((item) => (item.id === id ? ({ ...item, ...changes } as HearthItem) : item));
}

export function removeItem(layout: HearthLayout, id: string): HearthItem[] {
  return normalizeStacks(layout.items.filter((item) => item.id !== id));
}

// Adds at the first free spot of its size.
export function addItem(
  layout: HearthLayout,
  item:
    | Omit<NookItem, "x" | "y">
    | Omit<WidgetItem, "x" | "y">
    | Omit<LabelItem, "x" | "y">
    | Omit<HollowItem, "x" | "y">
    | Omit<TrinketItem, "x" | "y">
    | Omit<CubbyItem, "x" | "y">
): HearthItem[] {
  // A new Cubby keeps clear of other Cubbies as well, so boxes never land
  // on top of each other.
  const spot = findFreeSpot(
    layout.items.filter((other) => !isFloating(other) || (item.kind === "cubby" && other.kind === "cubby")),
    item.w,
    item.h
  );
  return [...layout.items, { ...item, ...spot } as HearthItem];
}

// --- Photos (CORE-041, CORE-046) -------------------------------------------------------

// Every photo the Hearth uses, wherever it is: the wallpapers (Hearth and
// Hollows) and Photo frame widgets. A photo is only deleted from storage once
// nothing in this set shows it.
export function photoPathsInUse(layout: Pick<HearthLayout, "wallpaper" | "items"> & { otherPages?: HearthLayout["otherPages"] }): Set<string> {
  const used = new Set<string>();
  const hearthPhoto = wallpaperPath(layout.wallpaper);
  if (hearthPhoto) used.add(hearthPhoto);
  const walk = (items: HearthItem[]) => {
    for (const item of items) {
      if (item.kind === "hollow") {
        const own = wallpaperPath(item.wallpaper);
        if (own) used.add(own);
        walk(item.items);
      } else if (item.kind === "widget" && item.widget.kind === "frame") {
        for (const path of item.widget.settings.photos) used.add(path);
      }
    }
  };
  walk(everyTopLevel({ items: layout.items, otherPages: layout.otherPages ?? {} }));
  return used;
}

// --- Nooks -------------------------------------------------------------------------

// Looks inside Hollows too, so a Nook tucked into one still counts as added.
export function hasNook(layout: HearthLayout, nookId: string) {
  return allItems(layout).some((item) => item.kind === "nook" && item.nookId === nookId);
}

// How many tiles of one Nook are out, wherever they are (CORE-039).
export function nookCount(layout: HearthLayout, nookId: string) {
  return allItems(layout).filter((item) => item.kind === "nook" && item.nookId === nookId).length;
}

// The first tile comes from the Market; `another` adds one more on purpose
// (every tile opens the same Nook — CORE-039).
export function addNook(layout: HearthLayout, nookId: string, another = false): HearthItem[] {
  if (!another && hasNook(layout, nookId)) return layout.items;
  return addItem(layout, { id: newItemId("n"), kind: "nook", nookId, w: 2, h: 2 });
}

// A copy of a Nook tile, widget or text — never a Hollow — on the Hearth
// (null) or in a Hollow, at the first free spot there (CORE-039). The copy
// is its own thing from then on. A reminder list is copied without its
// phone alerts, so nothing rings twice.
export function copyItem(layout: HearthLayout, id: string, to: Scope): { items: HearthItem[]; copyId: string | null } {
  const found = locate(layout, id);
  if (!found || found.item.kind === "hollow" || (to && !findHollow(layout, to))) {
    return { items: layout.items, copyId: null };
  }
  // A copy stands on its own: it doesn't join the stack it was copied from.
  const { x: _x, y: _y, id: _id, stack: _stack, stackStill: _still, locked: _locked, ...rest } = JSON.parse(JSON.stringify(found.item)) as HearthItem;
  if (rest.kind === "widget" && rest.widget.kind === "reminders") {
    rest.widget.settings.items = rest.widget.settings.items.map(({ notificationId: _n, schedule: _s, ...reminder }) => ({
      ...reminder,
      id: newReminderId(),
    }));
  }
  const copyId = newItemId(rest.kind === "nook" ? "n" : rest.kind === "widget" ? "w" : rest.kind === "trinket" ? "t" : rest.kind === "cubby" ? "b" : "l");
  return { items: inScope(layout, to, (inner) => addItem(inner, { ...rest, id: copyId } as never)), copyId };
}

// Takes every tile of a Nook off the Hearth, on every page and in every Hollow.
export function removeNook(layout: HearthLayout, nookId: string): { items: HearthItem[]; otherPages: HearthLayout["otherPages"] } {
  return removeEverywhere(layout, (item) => item.kind === "nook" && item.nookId === nookId);
}

// Every widget for one Gathering (GATH-009), on any page or in any Hollow.
export function gatheringWidgets(layout: Pick<HearthLayout, "items" | "otherPages">, gatheringId?: string) {
  return allItems(layout).filter(
    (item): item is WidgetItem & { widget: WidgetOf<"gathering"> } =>
      item.kind === "widget" &&
      item.widget.kind === "gathering" &&
      Boolean(item.widget.settings.gatheringId) &&
      (!gatheringId || item.widget.settings.gatheringId === gatheringId)
  );
}

// Takes off everything `isIt` matches, on every page and in every Hollow.
export function removeEverywhere(
  layout: Pick<HearthLayout, "items" | "otherPages">,
  isIt: (item: HearthItem) => boolean
): { items: HearthItem[]; otherPages: HearthLayout["otherPages"] } {
  const clean = (items: HearthItem[]) =>
    normalizeStacks(
      items
        .filter((item) => !isIt(item))
        .map((item) => (item.kind === "hollow" ? { ...item, items: normalizeStacks(item.items.filter((inner) => !isIt(inner))) } : item))
    );
  const otherPages: HearthLayout["otherPages"] = {};
  for (const [id, items] of Object.entries(layout.otherPages ?? {})) otherPages[id] = clean(items);
  return { items: clean(layout.items), otherPages };
}

export function nookLabel(item: NookItem) {
  return item.label?.trim() || findNook(item.nookId)?.title || "Nook";
}

// A tile's name as people see it.
export function itemDisplayName(item: HearthItem): string {
  switch (item.kind) {
    case "nook":
      return nookLabel(item);
    case "widget":
      return item.widget.title?.trim() || widgetKindInfo(item.widget.kind).label;
    case "hollow":
      return item.name;
    case "label":
      return item.text;
    case "trinket":
      return trinketInfo(item.piece).label;
    case "cubby":
      return cubbyStyleInfo(item.style).label;
  }
}

// What a screen reader says for a tile (CORE-075): its name and what it is.
export function itemSpokenName(item: HearthItem): string {
  const name = itemDisplayName(item);
  if (item.kind === "widget") return `${name}, widget`;
  if (item.kind === "hollow") return `${name}, Hollow`;
  if (item.kind === "trinket" || item.kind === "cubby") return `${name}, decoration`;
  return name;
}

// Moving without dragging (CORE-075): one step in a direction, for the
// arrow buttons and screen readers. Which ways it can go from where it is.
export type Nudge = "up" | "down" | "left" | "right";

const nudgeSteps: Record<Nudge, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

export function canNudge(item: GridRect & { locked?: boolean }, way: Nudge): boolean {
  if (item.locked) return false;
  if (way === "up") return item.y > 0;
  if (way === "left") return item.x > 0;
  if (way === "right") return item.x + item.w < COLUMNS;
  return true;
}

// Where one step that way lands (unchanged if it can't go).
// Text moves up and down by half rows; everything else by whole ones.
export function nudgedSpot(item: GridRect & { locked?: boolean; kind?: string }, way: Nudge): { x: number; y: number } {
  if (!canNudge(item, way)) return { x: item.x, y: item.y };
  const step = item.kind === "label" || item.kind === "cubby" ? ROW_STEP : 1;
  return { x: item.x + nudgeSteps[way].dx, y: Math.max(0, item.y + nudgeSteps[way].dy * step) };
}

// One step: into the open spot there, or trading places with a same-size
// neighbour; failing both, it pushes what's there down (CORE-091).
export function nudgeItem(layout: HearthLayout, id: string, way: Nudge): HearthItem[] {
  const item = layout.items.find((other) => other.id === id);
  if (!item || !canNudge(item, way)) return layout.items;
  const spot = nudgedSpot(item, way);
  const plan = planMove(layout.items, id, spot.x, spot.y, { fit: false });
  if (plan.kind === "blocked") return pushItem(layout, id, spot.x, spot.y);
  return moveItem(layout, id, spot.x, spot.y, { fit: false });
}

// Snapping while dragging (CORE-091): the outline stays in its cell until the
// item is clearly over the next one, so it doesn't flicker between two spots
// (or land half a row off) when the finger is near a line. In steps of `step`.
export const SNAP_HOLD = 0.2;
export function stickySnap(exact: number, current: number, step: number) {
  "worklet";
  if (Math.abs(exact - current) <= step * (0.5 + SNAP_HOLD)) return current;
  return Math.round(exact / step) * step;
}

function trinketColorFallback(item: TrinketItem) {
  return trinketInfo(item.piece).color;
}

export function itemColor(item: HearthItem) {
  if (item.color) return item.color;
  if (item.kind === "hollow") return hollowLookInfo(item.look).color;
  if (item.kind === "nook") return findNook(item.nookId)?.color ?? tilePalette[0];
  if (item.kind === "trinket") return trinketColorFallback(item);
  if (item.kind === "cubby") return cubbyStyleInfo(item.style).color;
  return tilePalette[0];
}

// --- Older Hearths -------------------------------------------------------------------

type V1Tile = { nookId: string; size: "small" | "wide" | "large"; color?: string; label?: string };
type V1Section = { id: string; title: string; tiles: V1Tile[] };

// The first Hearth stored named sections of tiles. Turn that into the grid:
// each section title becomes a heading label, its tiles flow underneath.
// Always at least one page, a real active page, and no stray page contents.
function normalizePages(saved: Partial<HearthLayout>) {
  const pages = Array.isArray(saved.pages) && saved.pages.length > 0 ? saved.pages : defaultHearthLayout.pages;
  const activePage = pages.some((p) => p.id === saved.activePage) ? (saved.activePage as string) : pages[0].id;
  const otherPages: Record<string, HearthItem[]> = {};
  for (const page of pages) {
    if (page.id !== activePage) otherPages[page.id] = saved.otherPages?.[page.id] ?? [];
  }
  return { pages, activePage, otherPages };
}

export function migrateLayout(saved: Partial<HearthLayout> & { sections?: V1Section[] }): HearthLayout {
  const base = {
    ...defaultHearthLayout,
    title: saved.title ?? defaultHearthLayout.title,
    theme: saved.theme ?? defaultHearthLayout.theme,
    followPhone: saved.followPhone ?? defaultHearthLayout.followPhone,
    font: saved.font ?? defaultHearthLayout.font,
    textSize: saved.textSize ?? defaultHearthLayout.textSize,
    haptics: saved.haptics ?? defaultHearthLayout.haptics,
    wallpaper: saved.wallpaper ?? defaultHearthLayout.wallpaper,
    ambience: saved.ambience ?? defaultHearthLayout.ambience,
    fireSound: saved.fireSound,
    customThemes: saved.customThemes ?? defaultHearthLayout.customThemes,
    seasonal: saved.seasonal ?? defaultHearthLayout.seasonal,
    hideHomePage: saved.hideHomePage,
    ...normalizePages(saved),
  };
  // Saved settings are merged over defaults (items: []), so an old Hearth
  // shows up as "sections present, no items".
  const hasItems = Array.isArray(saved.items) && saved.items.length > 0;
  if (hasItems || !Array.isArray(saved.sections)) return fitAllTrinkets({ ...base, items: saved.items ?? [] });

  const sizes = { small: { w: 2, h: 2 }, wide: { w: 4, h: 2 }, large: { w: 4, h: 3 } };
  const items: HearthItem[] = [];
  let y = 0;
  for (const section of saved.sections) {
    if (section.title?.trim() && section.tiles.length) {
      // Stable ids (not random) so every screen converts to the same items.
      items.push({ id: `l-${section.id}`, kind: "label", text: section.title, size: "heading", align: "left", x: 0, y, w: 4, h: 1 });
      y += 1;
    }
    let x = 0;
    let rowHeight = 0;
    for (const tile of section.tiles) {
      const { w, h } = sizes[tile.size] ?? sizes.small;
      if (x + w > COLUMNS) {
        y += rowHeight;
        x = 0;
        rowHeight = 0;
      }
      items.push({ id: `n-${tile.nookId}`, kind: "nook", nookId: tile.nookId, color: tile.color, label: tile.label, x, y, w, h });
      x += w;
      rowHeight = Math.max(rowHeight, h);
    }
    y += rowHeight;
  }
  return { ...base, items };
}

// --- Hollows (CORE-022..024) -------------------------------------------------
//
// A "scope" is where an item lives: null = the Hearth itself, or a Hollow's
// id. Every editing helper above works on a layout's `items`; inScope() runs
// one of them against a Hollow's inside instead, and returns the Hearth's
// updated top-level items either way.

export type Scope = string | null;

export function hollowsOf(layout: HearthLayout): HollowItem[] {
  return layout.items.filter((item): item is HollowItem => item.kind === "hollow");
}

export function findHollow(layout: HearthLayout, hollowId: string) {
  return hollowsOf(layout).find((hollow) => hollow.id === hollowId) ?? null;
}

// Everything, wherever it lives.
export function allItems(layout: Pick<HearthLayout, "items" | "otherPages">): HearthItem[] {
  return everyTopLevel(layout).flatMap((item) => (item.kind === "hollow" ? [item, ...item.items] : [item]));
}

// The top level of every page, not just the one you're on (CORE-051).
export function everyTopLevel(layout: Pick<HearthLayout, "items" | "otherPages">): HearthItem[] {
  return [...layout.items, ...Object.values(layout.otherPages ?? {}).flat()];
}

export function scopeItems(layout: HearthLayout, scope: Scope): HearthItem[] {
  return scope ? findHollow(layout, scope)?.items ?? [] : layout.items;
}

export function inScope(layout: HearthLayout, scope: Scope, edit: (inner: HearthLayout) => HearthItem[]): HearthItem[] {
  if (!scope) return edit(layout);
  return layout.items.map((item) =>
    item.kind === "hollow" && item.id === scope ? { ...item, items: edit({ ...layout, items: item.items }) } : item
  );
}

// Where an item lives, and the item itself.
export function locate(layout: HearthLayout, id: string): { item: HearthItem; scope: Scope } | null {
  for (const item of layout.items) {
    if (item.id === id) return { item, scope: null };
    if (item.kind === "hollow") {
      const inner = item.items.find((i) => i.id === id);
      if (inner) return { item: inner, scope: item.id };
    }
  }
  return null;
}

// Move an item to the Hearth (null) or into a Hollow, at the first free spot
// there, keeping its size. Hollows can't go inside Hollows.
export function moveToScope(layout: HearthLayout, id: string, to: Scope): HearthItem[] {
  const found = locate(layout, id);
  if (!found || found.scope === to) return layout.items;
  if (to && found.item.kind === "hollow") return layout.items;
  if (to && !findHollow(layout, to)) return layout.items;

  const removed = { ...layout, items: inScope(layout, found.scope, (inner) => removeItem(inner, id)) };
  const { x: _x, y: _y, stack: _stack, stackStill: _still, ...rest } = found.item;
  return inScope(removed, to, (inner) => addItem(inner, rest as Omit<HearthItem, "x" | "y"> as never));
}

// Taking a Hollow away never deletes what's in it: everything inside moves
// back onto the Hearth, in free spots.
export function removeHollow(layout: HearthLayout, hollowId: string): HearthItem[] {
  const hollow = findHollow(layout, hollowId);
  if (!hollow) return layout.items;
  let next: HearthLayout = { ...layout, items: removeItem(layout, hollowId) };
  for (const inner of hollow.items) {
    const { x: _x, y: _y, ...rest } = inner;
    next = { ...next, items: addItem(next, rest as never) };
  }
  return next.items;
}

// Auto-scroll while dragging (CORE-029): how many pixels per frame to scroll
// the page when a finger is at `fingerY` and the scrolling area spans
// `top`..`bottom` on screen. Negative scrolls up, 0 means the finger is not
// near an edge. Speeds up the closer to (or beyond) the edge it gets.
export const EDGE_ZONE = 150;
export const EDGE_MAX_SPEED = 16;

export function edgeScrollSpeed(fingerY: number, top: number, bottom: number) {
  "worklet";
  if (bottom <= top) return 0;
  const intoTop = (top + EDGE_ZONE - fingerY) / EDGE_ZONE;
  const intoBottom = (fingerY - (bottom - EDGE_ZONE)) / EDGE_ZONE;
  // Eased, and not rounded to whole pixels, so the page speeds up smoothly
  // as the finger goes further in instead of in steps.
  if (intoTop > 0) return -(Math.min(1, intoTop) ** 1.5) * EDGE_MAX_SPEED;
  if (intoBottom > 0) return (Math.min(1, intoBottom) ** 1.5) * EDGE_MAX_SPEED;
  return 0;
}

// While dragging, the trash can (CORE-040) sits at the bottom of the screen,
// and a finger over it doesn't scroll. So the bottom scrolling zone ends at
// the top of the can instead: the whole zone sits above it, and beside it is
// past the edge (full speed).
export function edgeScrollBottom(bottom: number, trashTop: number | null) {
  "worklet";
  return trashTop === null ? bottom : Math.min(bottom, trashTop);
}
