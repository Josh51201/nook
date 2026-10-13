import type { IconName } from "../components/icon";
import { contrast, deepOf, hexToHsl, hslToHex, isHex, shade } from "./colors";
import type { PatternKey } from "./decor";
import type { LabelFont } from "./fonts";
import type { WidgetKind } from "./widgets";

// What a widget is made of, how its edges are cut, what it's hung up with,
// how far it leans (CORE-122..125), and a print, font and little accent
// (CORE-128). Pure data and drawing maths (no
// React), so it's unit-testable. Drawn by components/hearth/widget-skin.tsx.
//
// A widget's color still matters: it tints the material (the stain on wood,
// the color of felt, a chalkboard's slate). With no color picked, each
// material shows its own natural color.

export type Material =
  | "plain"
  | "paper"
  | "kraft"
  | "notebook"
  | "graph"
  | "index"
  | "chalkboard"
  | "wood"
  | "cork"
  | "felt"
  | "linen"
  | "glass"
  | "tile"
  | "watercolor";
export type Edge = "plain" | "torn" | "scallop" | "stitch" | "stamp" | "ticket" | "wavy";
export type Hanger = "none" | "tape" | "pin" | "magnet" | "clip" | "clothespin" | "nail" | "shelf";
// Degrees; a small lean either way.
export type Tilt = -3 | -1.5 | 0 | 1.5 | 3;

// A wallpaper pattern printed on it, or none.
export type Print = "none" | PatternKey;
// Its words' font: the Hearth text fonts, plus a typewriter and chalk.
export type WidgetFont = LabelFont | "typewriter" | "chalk";
// A little decoration on a corner; "season" changes with the time of year
// (CORE-136).
export type Accent = "none" | "season" | "heart" | "star" | "daisy" | "holly" | "bow" | "mug" | "snowflake" | "leaf" | "pumpkin" | "sun";
// A picture frame around it (CORE-133).
export type Frame = "none" | "wood" | "gold" | "white" | "polaroid";

export type WidgetSkin = {
  material?: Material;
  edge?: Edge;
  hanger?: Hanger;
  tilt?: Tilt;
  print?: Print;
  font?: WidgetFont;
  accent?: Accent;
  frame?: Frame;
  // A band of its deep color across the top, behind the title (CORE-135).
  band?: boolean;
  // A gradient fill on a plain card: a key of decor's gradientPresets, or "none".
  gradient?: string;
};

export const materials: { key: Material; label: string }[] = [
  { key: "plain", label: "Plain" },
  { key: "paper", label: "Paper" },
  { key: "kraft", label: "Kraft paper" },
  { key: "notebook", label: "Notebook" },
  { key: "graph", label: "Graph paper" },
  { key: "index", label: "Index card" },
  { key: "chalkboard", label: "Chalkboard" },
  { key: "wood", label: "Wood" },
  { key: "cork", label: "Cork" },
  { key: "felt", label: "Felt" },
  { key: "linen", label: "Linen" },
  { key: "glass", label: "Frosted glass" },
  { key: "tile", label: "Ceramic tile" },
  { key: "watercolor", label: "Watercolor" },
];

export const edges: { key: Edge; label: string }[] = [
  { key: "plain", label: "Smooth" },
  { key: "torn", label: "Torn" },
  { key: "scallop", label: "Scalloped" },
  { key: "stitch", label: "Stitched" },
  { key: "stamp", label: "Stamp" },
  { key: "ticket", label: "Ticket" },
  { key: "wavy", label: "Wavy" },
];

export const hangers: { key: Hanger; label: string; icon: IconName }[] = [
  { key: "none", label: "Nothing", icon: "close" },
  { key: "tape", label: "Washi tape", icon: "edit" },
  { key: "pin", label: "Pushpin", icon: "pin" },
  { key: "magnet", label: "Magnet", icon: "fridge" },
  { key: "clip", label: "Paperclip", icon: "link" },
  { key: "clothespin", label: "Clothespin", icon: "price" },
  { key: "nail", label: "Nail & twine", icon: "tools" },
  { key: "shelf", label: "On a shelf", icon: "books" },
];

export const prints: { key: Print; label: string }[] = [
  { key: "none", label: "None" },
  { key: "dots", label: "Polka dots" },
  { key: "stripes", label: "Stripes" },
  { key: "gingham", label: "Gingham" },
  { key: "leaves", label: "Leaves" },
  { key: "stars", label: "Stars" },
  { key: "diamonds", label: "Diamonds" },
];

export const widgetFonts: { key: WidgetFont; label: string }[] = [
  { key: "app", label: "Same as the app" },
  { key: "rounded", label: "Rounded" },
  { key: "storybook", label: "Storybook" },
  { key: "handwritten", label: "Handwritten" },
  { key: "typewriter", label: "Typewriter" },
  { key: "chalk", label: "Chalk" },
  { key: "classic", label: "Classic" },
];

export const accents: { key: Accent; label: string; icon: IconName }[] = [
  { key: "none", label: "None", icon: "close" },
  { key: "season", label: "Follows the season", icon: "leaf" },
  { key: "heart", label: "Heart sticker", icon: "heart" },
  { key: "star", label: "Star sticker", icon: "star" },
  { key: "daisy", label: "Daisy", icon: "flower" },
  { key: "holly", label: "Holly", icon: "christmas" },
  { key: "bow", label: "Bow", icon: "gift" },
  { key: "mug", label: "Cup of cocoa", icon: "coffee" },
  { key: "snowflake", label: "Snowflake", icon: "christmas" },
  { key: "leaf", label: "Autumn leaf", icon: "leaf" },
  { key: "pumpkin", label: "Pumpkin", icon: "food" },
  { key: "sun", label: "Sunshine", icon: "sun" },
];

export const frames: { key: Frame; label: string }[] = [
  { key: "none", label: "None" },
  { key: "wood", label: "Wood" },
  { key: "gold", label: "Gold" },
  { key: "white", label: "White mat" },
  { key: "polaroid", label: "Polaroid" },
];

// What a "Follows the season" accent shows today (northern hemisphere):
// holly in December, a snowflake after, a daisy in spring, sunshine in
// summer, a pumpkin in October and leaves the rest of the autumn.
export function seasonalAccent(now: Date): Exclude<Accent, "none" | "season"> {
  const month = now.getMonth(); // 0 = January
  if (month === 11) return "holly";
  if (month <= 1) return "snowflake";
  if (month <= 4) return "daisy";
  if (month <= 7) return "sun";
  if (month === 9) return "pumpkin";
  return "leaf";
}

// A slight, steady lean for each widget when the Hearth is a messy pinboard
// (CORE-134): the same one every time for the same widget.
const MESSY: Tilt[] = [-3, -1.5, 1.5, 3];

export function messyTilt(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  const lean = MESSY[Math.abs(hash) % MESSY.length];
  return lean * 0.7;
}

export const tilts: { key: Tilt; label: string }[] = [
  { key: -3, label: "Lean left" },
  { key: -1.5, label: "A little left" },
  { key: 0, label: "Straight" },
  { key: 1.5, label: "A little right" },
  { key: 3, label: "Lean right" },
];

// These draw their whole selves (a fridge, a photo frame, a window, a pet's
// bed), so a material or cut edges don't apply; a hanger and tilt still do.
const drawsItself: WidgetKind[] = ["fridge", "frame", "window", "companion"];

export function takesMaterial(kind: WidgetKind) {
  return !drawsItself.includes(kind);
}

// What the skin comes to once anything a widget can't wear is left out.
export function skinFor(kind: WidgetKind, skin: WidgetSkin | undefined): Required<WidgetSkin> {
  const own = takesMaterial(kind);
  return {
    material: own ? skin?.material ?? "plain" : "plain",
    edge: own ? skin?.edge ?? "plain" : "plain",
    hanger: skin?.hanger ?? "none",
    tilt: skin?.tilt ?? 0,
    print: own ? skin?.print ?? "none" : "none",
    font: own ? skin?.font ?? "app" : "app",
    accent: skin?.accent ?? "none",
    frame: own ? skin?.frame ?? "none" : "none",
    band: own ? Boolean(skin?.band) : false,
    gradient: own && (skin?.material ?? "plain") === "plain" ? skin?.gradient ?? "none" : "none",
  };
}

// Is it drawn the old way: a plain card with smooth corners?
export function isPlainCard(skin: Required<WidgetSkin>) {
  return skin.material === "plain" && (skin.edge === "plain" || skin.edge === "stitch") && skin.print === "none" && skin.gradient === "none";
}

// Swings a little in a breeze (CORE-130): anything hung from one point (a
// pin, clothespin, paperclip or nail), when it's raining or leaves are
// falling on the Hearth.
export function swaysIn(ambience: string | null | undefined, skin: Required<WidgetSkin>) {
  const breezy = ambience === "rain" || ambience === "leaves";
  return breezy && (skin.hanger === "pin" || skin.hanger === "clothespin" || skin.hanger === "clip" || skin.hanger === "nail");
}

// --- Natural looks (CORE-125) ----------------------------------------------------------

// How each kind of widget starts out, so a new Hearth isn't a wall of the
// same card: a recipe on an index card, the menu on a chalkboard.
const natural: Partial<Record<WidgetKind, WidgetSkin>> = {
  countdown: { material: "paper", hanger: "pin" },
  gatherings: { material: "paper", hanger: "tape" },
  gathering: { material: "paper", hanger: "pin" },
  reminders: { material: "notebook", hanger: "clip" },
  tucks: { material: "kraft", edge: "torn", hanger: "tape" },
  note: { material: "paper", tilt: -1.5 },
  cards: { material: "paper", edge: "stamp", hanger: "tape" },
  rhythms: { material: "cork" },
  sitter: { material: "index", hanger: "pin" },
  recipe: { material: "index", hanger: "pin", tilt: 1.5 },
  subscriptions: { material: "graph", hanger: "clip" },
  sickday: { material: "index", hanger: "magnet" },
  littlelog: { material: "graph" },
  notes: { material: "notebook", edge: "torn" },
  menu: { material: "chalkboard" },
  groceries: { material: "notebook", edge: "torn", hanger: "magnet" },
  frame: { hanger: "nail" },
  clock: { material: "wood" },
  quote: { material: "linen", edge: "stitch" },
  streak: { material: "felt", edge: "stitch" },
  weather: { material: "glass" },
  week: { material: "graph", hanger: "clip" },
  birthdays: { material: "paper", edge: "scallop", hanger: "tape" },
  getaway: { material: "kraft", edge: "ticket" },
  wishes: { material: "kraft", hanger: "clothespin" },
  gratitude: { material: "glass" },
  turn: { material: "felt", edge: "stitch" },
  greeting: { material: "wood", hanger: "nail" },
};

export function naturalSkin(kind: WidgetKind): WidgetSkin {
  return { ...(natural[kind] ?? {}) };
}

// Ready-made combinations for "Surprise me" (CORE-125): picked by hand so
// every one looks good, rather than thrown together at random.
export const skinIdeas: WidgetSkin[] = [
  { material: "kraft", edge: "torn", hanger: "tape", tilt: -1.5, font: "handwritten" },
  { material: "chalkboard", hanger: "nail", font: "handwritten" },
  { material: "notebook", edge: "torn", hanger: "clip" },
  { material: "index", hanger: "pin", tilt: 1.5, font: "typewriter" },
  { material: "cork", edge: "plain", accent: "star" },
  { material: "felt", edge: "stitch" },
  { material: "linen", edge: "scallop", font: "storybook", accent: "daisy" },
  { material: "paper", edge: "stamp", hanger: "tape", tilt: -1.5 },
  { material: "wood", hanger: "shelf", accent: "mug" },
  { material: "glass" },
  { material: "graph", edge: "wavy", hanger: "magnet" },
  { material: "paper", edge: "ticket", hanger: "clothespin", tilt: 1.5 },
  { material: "paper", print: "gingham", hanger: "pin", accent: "heart" },
  { material: "plain", print: "dots", edge: "scallop", accent: "bow" },
  { material: "tile", frame: "white", accent: "season" },
  { material: "watercolor", edge: "torn", font: "handwritten", hanger: "tape" },
  { material: "chalkboard", frame: "wood", font: "chalk" },
  { material: "plain", gradient: "sunrise", band: true, accent: "sun" },
  { material: "paper", frame: "polaroid", hanger: "pin", tilt: -1.5 },
];

const blank: Required<WidgetSkin> = {
  material: "plain",
  edge: "plain",
  hanger: "none",
  tilt: 0,
  print: "none",
  font: "app",
  accent: "none",
  frame: "none",
  band: false,
  gradient: "none",
};

export function sameSkin(a: WidgetSkin | undefined, b: WidgetSkin | undefined) {
  const x = { ...blank, ...a };
  const y = { ...blank, ...b };
  return (Object.keys(blank) as (keyof WidgetSkin)[]).every((key) => x[key] === y[key]);
}

// A different idea from the one it has now; `roll` is a number in [0, 1).
export function surpriseSkin(kind: WidgetKind, current: WidgetSkin | undefined, roll: number): WidgetSkin {
  const fits = skinIdeas
    .map((idea) => (takesMaterial(kind) ? idea : { hanger: idea.hanger, tilt: idea.tilt, accent: idea.accent }))
    .filter((idea) => !sameSkin(idea, current));
  return { ...fits[Math.min(fits.length - 1, Math.floor(roll * fits.length))] };
}

// "Kraft paper · Washi tape · Leaning", for the closed section (CORE-074).
export function skinSummary(kind: WidgetKind, skin: WidgetSkin | undefined) {
  const s = skinFor(kind, skin);
  const words: string[] = [];
  if (s.material !== "plain") words.push(materials.find((m) => m.key === s.material)!.label);
  if (s.edge !== "plain") words.push(`${edges.find((e) => e.key === s.edge)!.label} edges`);
  if (s.hanger !== "none") words.push(hangers.find((h) => h.key === s.hanger)!.label);
  if (s.print !== "none") words.push(prints.find((p) => p.key === s.print)!.label);
  if (s.font !== "app") words.push(widgetFonts.find((f) => f.key === s.font)!.label);
  if (s.accent !== "none") words.push(accents.find((a) => a.key === s.accent)!.label);
  if (s.frame !== "none") words.push(`${frames.find((f) => f.key === s.frame)!.label} frame`);
  if (s.band) words.push("Two-tone");
  if (s.gradient !== "none") words.push("Gradient");
  if (s.tilt) words.push("Leaning");
  return words.join(" · ");
}

// --- Colors (CORE-122) -------------------------------------------------------------------

export type MaterialColors = {
  // The surface itself.
  base: string;
  // Lines, grain, speckles and weave drawn on it.
  ink: string;
  // Text on it, and quieter text.
  text: string;
  muted: string;
  // Icons and highlights.
  accent: string;
  // Inner panels that hold lists.
  panel: string;
  faint: string;
  // Dark surfaces take light text.
  dark: boolean;
};

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

// The material's color with the widget's own color (a soft tint) worked in.
function tinted(color: string | undefined, fallback: string, s: number, l: number) {
  if (!color || !isHex(color)) return fallback;
  const hsl = hexToHsl(color);
  return hslToHex(hsl.h, hsl.s < 0.08 ? hsl.s : clamp(s, 0, 1), l);
}

// Part way from one color to another (0 = all `a`, 1 = all `b`).
function mix(a: string, b: string, t: number) {
  const ch = (hex: string, i: number) => parseInt(hex.replace("#", "").slice(i, i + 2), 16);
  const out = [0, 2, 4].map((i) => Math.round(ch(a, i) * (1 - t) + ch(b, i) * t));
  return `#${out.map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

// Kraft paper and cork stay kraft and cork: a picked color only warms or
// cools them a little.
function blushed(natural: string, color: string | undefined) {
  if (!color || !isHex(color) || color.length !== 7) return natural;
  return mix(natural, deepOf(color), 0.22);
}

// Some hues (yellows, greens) are bright even when dark: nudge the surface
// darker, or lighter, until its text reads clearly (CORE-075).
function readableBase(base: string, text: string) {
  const { h, s, l } = hexToHsl(base);
  const darker = contrast(text, "#000000") > contrast(text, "#ffffff");
  let out = base;
  let lightness = l;
  for (let i = 0; i < 60 && contrast(text, out) < 5; i++) {
    lightness = clamp(lightness + (darker ? -0.01 : 0.01), 0, 1);
    out = hslToHex(h, s, lightness);
  }
  return out;
}

export function materialColors(material: Material, color: string | undefined): MaterialColors {
  const light = (base: string, ink: string, text = "#2a2420"): MaterialColors => ({
    base: readableBase(base, text),
    ink,
    text,
    muted: "#5f554d",
    accent: deepOf(color && isHex(color) ? color : base),
    panel: "rgba(255,255,255,0.6)",
    faint: "rgba(255,255,255,0.5)",
    dark: false,
  });
  const dark = (base: string, ink: string, accent?: string): MaterialColors => ({
    base: readableBase(base, "#fffaf2"),
    ink,
    text: "#fffaf2",
    muted: "rgba(255,250,242,0.8)",
    accent: accent ?? "#fffaf2",
    panel: "rgba(255,255,255,0.13)",
    faint: "rgba(255,255,255,0.16)",
    dark: true,
  });
  switch (material) {
    case "paper":
      return light(color && isHex(color) ? shade(color, 0.45) : "#fbf6ea", "#b8a586");
    case "kraft":
      return { ...light(blushed("#d6b88f", color), "#8a6a45", "#33241a"), muted: "#56412f" };
    case "notebook":
      return { ...light(color && isHex(color) ? shade(color, 0.75) : "#fdfcf7", "#9dbbe0", "#26304a"), muted: "#4f5970" };
    case "graph":
      return light(color && isHex(color) ? shade(color, 0.7) : "#fafcf8", "#bcd6cb");
    case "index":
      return light("#fffefa", "#a8c3e2");
    case "chalkboard":
      return dark(tinted(color, "#2f3d36", 0.22, 0.22), "#ffffff", color && isHex(color) ? shade(color, 0.4) : "#f7e9a8");
    case "wood":
      return dark(tinted(color, "#93603a", 0.45, 0.36), "#3d2414");
    case "cork":
      return { ...light(blushed("#c99b66", color), "#7a5532", "#2e1f12"), muted: "#4a3522", panel: "rgba(255,253,246,0.78)" };
    case "felt":
      return dark(tinted(color, "#4f7d60", 0.4, 0.36), "#ffffff");
    case "linen":
      return light(color && isHex(color) ? shade(color, 0.25) : "#efe5d3", "#8f7c62");
    case "glass":
      return { ...light(color && isHex(color) ? shade(color, 0.55) : "#ffffff", "#ffffff"), panel: "rgba(255,255,255,0.55)" };
    case "tile":
      return light(color && isHex(color) ? shade(color, 0.55) : "#f3f6f7", "#b9c6cc");
    case "watercolor":
      return light(color && isHex(color) ? shade(color, 0.7) : "#f7f0f5", deepOf(color && isHex(color) ? color : "#d9b8d2"));
    case "plain":
      return light(color ?? "#f3e7d3", "#000000");
  }
}

// How see-through the surface is: only glass lets the Hearth show through.
export function materialOpacity(material: Material) {
  return material === "glass" ? 0.62 : 1;
}

// Does text on it read clearly? (Used by the tests for every color.)
export function readsWell(colors: MaterialColors) {
  return contrast(colors.text, colors.base) >= 4.5;
}

// --- Cut edges (CORE-123) ----------------------------------------------------------------

// Extra room inside, so words don't run into a cut edge.
export function edgeInset(edge: Edge) {
  return { plain: 0, stitch: 4, torn: 5, scallop: 7, stamp: 4, ticket: 8, wavy: 7 }[edge];
}

type Pt = [number, number];

const f = (n: number) => Math.round(n * 10) / 10;

function roundRect(x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  return [
    `M${f(x + rr)} ${f(y)}`,
    `H${f(x + w - rr)}`,
    `A${f(rr)} ${f(rr)} 0 0 1 ${f(x + w)} ${f(y + rr)}`,
    `V${f(y + h - rr)}`,
    `A${f(rr)} ${f(rr)} 0 0 1 ${f(x + w - rr)} ${f(y + h)}`,
    `H${f(x + rr)}`,
    `A${f(rr)} ${f(rr)} 0 0 1 ${f(x)} ${f(y + h - rr)}`,
    `V${f(y + rr)}`,
    `A${f(rr)} ${f(rr)} 0 0 1 ${f(x + rr)} ${f(y)}`,
    "Z",
  ].join(" ");
}

// A small, steady stand-in for random, so the same widget tears the same way
// every time it's drawn.
function jitter(seed: number) {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

// The four sides, walked clockwise from the top left: where each starts,
// which way it runs, and how long it is.
function sides(x: number, y: number, w: number, h: number): { start: Pt; dir: Pt; len: number }[] {
  return [
    { start: [x, y], dir: [1, 0], len: w },
    { start: [x + w, y], dir: [0, 1], len: h },
    { start: [x + w, y + h], dir: [-1, 0], len: w },
    { start: [x, y + h], dir: [0, -1], len: h },
  ];
}

const along = (p: Pt, d: Pt, t: number): Pt => [p[0] + d[0] * t, p[1] + d[1] * t];
// Outward, for a side walked clockwise (y runs down the screen).
const outward = (d: Pt): Pt => [d[1], -d[0]];

// The outline of a widget with this edge, in a box `w` by `h`. Every point
// stays inside the box. `r` is the corner radius for smooth edges.
export function edgePath(edge: Edge, w: number, h: number, r: number): string {
  switch (edge) {
    case "plain":
    case "stitch":
      return roundRect(0, 0, w, h, r);
    case "scallop": {
      // Little bumps all the way round, like a doily.
      const b = 6;
      const parts: string[] = [`M${b} ${b}`];
      for (const side of sides(b, b, w - 2 * b, h - 2 * b)) {
        const n = Math.max(2, Math.round(side.len / (2 * b)));
        const step = side.len / n;
        for (let i = 1; i <= n; i++) {
          const [px, py] = along(side.start, side.dir, step * i);
          parts.push(`A${f(step / 2)} ${f(step / 2)} 0 0 1 ${f(px)} ${f(py)}`);
        }
      }
      return `${parts.join(" ")} Z`;
    }
    case "stamp": {
      // Round bites all the way round, like a postage stamp's perforations.
      const hole = 3.5;
      const parts: string[] = ["M0 0"];
      for (const side of sides(0, 0, w, h)) {
        const n = Math.max(2, Math.round(side.len / 11));
        const step = side.len / n;
        for (let i = 0; i < n; i++) {
          const mid = step * i + step / 2;
          const [ax, ay] = along(side.start, side.dir, mid - hole);
          const [bx, by] = along(side.start, side.dir, mid + hole);
          const [cx, cy] = along(side.start, side.dir, step * (i + 1));
          parts.push(`L${f(ax)} ${f(ay)}`, `A${hole} ${hole} 0 0 0 ${f(bx)} ${f(by)}`, `L${f(cx)} ${f(cy)}`);
        }
      }
      return `${parts.join(" ")} Z`;
    }
    case "wavy": {
      // Gentle waves, kept in from the edge so their peaks stay inside.
      const a = 3;
      const parts: string[] = [`M${2 * a} ${2 * a}`];
      for (const side of sides(2 * a, 2 * a, w - 4 * a, h - 4 * a)) {
        const n = Math.max(2, Math.round(side.len / 14));
        const step = side.len / n;
        const out = outward(side.dir);
        for (let i = 0; i < n; i++) {
          const sign = i % 2 === 0 ? 1 : -1;
          const [mx, my] = along(side.start, side.dir, step * i + step / 2);
          const [ex, ey] = along(side.start, side.dir, step * (i + 1));
          parts.push(`Q${f(mx + out[0] * 2 * a * sign)} ${f(my + out[1] * 2 * a * sign)} ${f(ex)} ${f(ey)}`);
        }
      }
      return `${parts.join(" ")} Z`;
    }
    case "torn": {
      // Ragged along the top and bottom, straight down the sides.
      const depth = 6;
      const top: string[] = [];
      const bottom: string[] = [];
      const n = Math.max(4, Math.round(w / 7));
      for (let i = 0; i <= n; i++) {
        const x = (w * i) / n;
        top.push(`L${f(x)} ${f(jitter(i + w) * depth)}`);
        bottom.push(`L${f(w - x)} ${f(h - jitter(i + h * 3) * depth)}`);
      }
      return `M0 ${f(jitter(w) * depth)} ${top.join(" ")} ${bottom.join(" ")} Z`;
    }
    case "ticket": {
      // Rounded corners, and a round notch in the middle of each side.
      const rr = Math.min(10, w / 4, h / 4);
      const notch = Math.min(11, h / 5);
      const mid = h / 2;
      return [
        `M${f(rr)} 0`,
        `H${f(w - rr)}`,
        `A${f(rr)} ${f(rr)} 0 0 1 ${f(w)} ${f(rr)}`,
        `V${f(mid - notch)}`,
        `A${f(notch)} ${f(notch)} 0 0 0 ${f(w)} ${f(mid + notch)}`,
        `V${f(h - rr)}`,
        `A${f(rr)} ${f(rr)} 0 0 1 ${f(w - rr)} ${f(h)}`,
        `H${f(rr)}`,
        `A${f(rr)} ${f(rr)} 0 0 1 0 ${f(h - rr)}`,
        `V${f(mid + notch)}`,
        `A${f(notch)} ${f(notch)} 0 0 0 0 ${f(mid - notch)}`,
        `V${f(rr)}`,
        `A${f(rr)} ${f(rr)} 0 0 1 ${f(rr)} 0`,
        "Z",
      ].join(" ");
    }
  }
}

// Every number in a path, so tests can check it stays in its box.
export function pathNumbers(path: string): number[] {
  return (path.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
}
