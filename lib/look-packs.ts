import type { IconName } from "../components/icon";
import type { HearthItem, WidgetItem } from "./hearth-layout";
import { facesFor, naturalFace } from "./widget-faces";
import { naturalSkin, type WidgetSkin } from "./widget-skins";
import type { WidgetConfig, WidgetKind } from "./widgets";

// Look packs (CORE-129): one tap gives every widget on a page a look that
// goes together, like a Farmhouse kitchen or a Scrapbook. Pure (no React), so
// it's unit-testable. Picked in Edit → Decorate; Undo puts it back.
//
// A pack has a few looks that take turns down the page, so neighbors differ,
// and can give some kinds a face (CORE-127), like the menu on a letter board.
// Widgets keep their colors; packs only change what they're made of and how
// they're hung up.

export type LookPack = {
  id: string;
  label: string;
  blurb: string;
  icon: IconName;
  // Looks that take turns, top to bottom.
  skins?: WidgetSkin[];
  faces?: Partial<Record<WidgetKind, string>>;
  // Each widget's own natural look, or back to plain cards.
  natural?: boolean;
  plain?: boolean;
};

export const lookPacks: LookPack[] = [
  { id: "natural", label: "Each its own", blurb: "Every widget in the look it starts with", icon: "leaf", natural: true },
  {
    id: "farmhouse",
    label: "Farmhouse kitchen",
    blurb: "Wood, chalkboard, gingham and a cup of cocoa",
    icon: "coffee",
    skins: [
      { material: "wood", hanger: "nail", font: "storybook" },
      { material: "chalkboard", font: "handwritten" },
      { material: "paper", print: "gingham", hanger: "pin" },
      { material: "linen", edge: "stitch", accent: "mug" },
    ],
    faces: { menu: "letterboard", greeting: "sign", countdown: "tearoff" },
  },
  {
    id: "grandma",
    label: "Grandma's den",
    blurb: "Doilies, embroidery and storybook letters",
    icon: "flower",
    skins: [
      { material: "linen", edge: "scallop", font: "storybook" },
      { material: "paper", edge: "scallop", font: "storybook", accent: "daisy" },
      { material: "felt", edge: "stitch", font: "storybook" },
      { material: "paper", print: "dots", edge: "wavy", font: "storybook" },
    ],
    faces: { quote: "hoop", countdown: "tearoff", streak: "plant" },
  },
  {
    id: "scrapbook",
    label: "Scrapbook",
    blurb: "Torn paper, washi tape, stickers and a tilt",
    icon: "camera",
    skins: [
      { material: "kraft", edge: "torn", hanger: "tape", tilt: -1.5, font: "handwritten" },
      { material: "notebook", edge: "torn", hanger: "clip", tilt: 1.5, font: "handwritten" },
      { material: "paper", edge: "stamp", hanger: "tape", accent: "heart", font: "handwritten" },
      { material: "index", hanger: "pin", tilt: -1.5, font: "typewriter" },
      { material: "graph", edge: "wavy", hanger: "tape", tilt: 1.5, accent: "star", font: "handwritten" },
    ],
    faces: { countdown: "chain", greeting: "bunting", quote: "typewriter" },
  },
  {
    id: "cabin",
    label: "Cabin",
    blurb: "Wood, felt, cork and candlelight",
    icon: "tree",
    skins: [
      { material: "wood", hanger: "shelf" },
      { material: "felt", edge: "stitch" },
      { material: "cork", hanger: "pin" },
      { material: "kraft", hanger: "clothespin" },
    ],
    faces: { greeting: "sign", streak: "candle", countdown: "flip" },
  },
  {
    id: "holiday",
    label: "Holiday",
    blurb: "Felt, stars, bows and sprigs of holly",
    icon: "christmas",
    skins: [
      { material: "felt", edge: "stitch", accent: "holly" },
      { material: "paper", print: "stars", accent: "bow" },
      { material: "kraft", hanger: "clothespin", accent: "holly" },
      { material: "linen", edge: "scallop", accent: "mug" },
    ],
    faces: { countdown: "chain", greeting: "bunting" },
  },
  { id: "plain", label: "Plain cards", blurb: "Back to simple colored cards", icon: "widgets", plain: true },
];

export function lookPack(id: string) {
  return lookPacks.find((p) => p.id === id);
}

// The look a pack gives the `turn`-th widget down the page.
function dressed(widget: WidgetConfig, pack: LookPack, turn: number): WidgetConfig {
  if (pack.plain) return { ...widget, skin: undefined, face: undefined } as WidgetConfig;
  if (pack.natural) return { ...widget, skin: naturalSkin(widget.kind), face: naturalFace(widget.kind) } as WidgetConfig;
  const skins = pack.skins ?? [];
  const skin = skins.length ? { ...skins[turn % skins.length] } : widget.skin;
  const wanted = pack.faces?.[widget.kind];
  const face = wanted && facesFor(widget.kind).some((f) => f.key === wanted) ? wanted : widget.face;
  return { ...widget, skin, face } as WidgetConfig;
}

// Every widget on the page in the pack's look; nothing else changes. Widgets
// in a stack share a spot, so they share a look too.
export function applyPack(items: HearthItem[], pack: LookPack): HearthItem[] {
  const order = items
    .filter((item): item is WidgetItem => item.kind === "widget")
    .sort((a, b) => a.y - b.y || a.x - b.x);
  const turns = new Map<string, number>();
  let next = 0;
  for (const item of order) {
    const key = item.stack ?? item.id;
    if (!turns.has(key)) turns.set(key, next++);
  }
  return items.map((item) => {
    if (item.kind !== "widget") return item;
    return { ...item, widget: dressed(item.widget, pack, turns.get(item.stack ?? item.id) ?? 0) };
  });
}

export function widgetCount(items: HearthItem[]) {
  return items.filter((item) => item.kind === "widget").length;
}
