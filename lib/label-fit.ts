// Sizing text on the Hearth so it always fits its space (CORE-077). Pure (no
// React), so it's unit-testable.
//
// The text is measured once (each word's width, and a space's), in "em":
// widths per 1px of font size. Then for any space and decoration we can work
// out how it wraps at a size, and pick the biggest size that fits both the
// width and the height, wrapping onto more lines when there's room. Only if
// even the smallest size can't fit does it fall back to "…".

import type { LabelFont } from "./fonts";
import type { LabelDecor, LabelItem, LabelVAlign } from "./hearth-layout";

export type TextMeasure = { words: number[]; space: number };

export type Fit = {
  fontSize: number;
  // Lines it wraps onto at that size.
  lines: number;
  // Lines the height has room for (a little slack if the phone wraps
  // slightly differently than we guessed).
  room: number;
  // False when it's at the smallest size and still too long: show "…".
  fits: boolean;
  // The decoration had to tighten up to make room (decorInset).
  snug: boolean;
};

// The room a decoration takes around the text, at a font size: padding on
// each side inside the shape, plus anything outside it (borders, an
// underline, the flourish's sparkles). It grows with the text, so a slim
// pill and a big pill look like the same pill. "Snug" is the tighter version
// used only when the text can't fit otherwise (a narrow space).
export type Inset = { padX: number; padY: number; outerX: number; outerY: number; tail: number; icon: number; gap: number };

export function decorInset(decor: LabelDecor | undefined, fontSize: number, snug = false): Inset {
  const none = { padX: 0, padY: 0, outerX: 0, outerY: 0, tail: 0, icon: 0, gap: 0 };
  const padY = Math.max(2, fontSize * 0.14);
  const k = snug ? 0.6 : 1;
  switch (decor ?? "none") {
    case "underline":
      return { ...none, outerY: Math.max(2, fontSize * 0.1) + Math.max(2, fontSize * 0.08) };
    case "pill":
      return { ...none, padX: Math.max(8 * k, fontSize * 0.55 * k), padY };
    case "stitched":
      return { ...none, padX: Math.max(8 * k, fontSize * 0.5 * k), padY, outerX: 3, outerY: 3 };
    case "ribbon": {
      // The notched tails sit inside the side padding.
      const tail = Math.max(5 * k, fontSize * 0.32 * k);
      return { ...none, padX: tail + Math.max(5 * k, fontSize * 0.3 * k), padY, tail };
    }
    case "sign":
      // Room for the two little nails, plus the darker bottom edge.
      return { ...none, padX: Math.max(9 * k, fontSize * 0.55 * k), padY, outerY: 3 };
    case "flourish": {
      const icon = Math.min(22, Math.max(9 * k, fontSize * 0.6 * k));
      const gap = Math.max(3 * k, fontSize * 0.3 * k);
      return { ...none, outerX: (icon + gap) * 2, icon, gap };
    }
    default:
      return none;
  }
}

export type FitRules = {
  max: number;
  min: number;
  lineHeight: number;
  maxLines: number;
  decor?: LabelDecor;
  // Width kept free beside the text (a divider's line and arrow).
  reserve?: number;
};

// How many lines the words wrap onto at this size, or Infinity if a single
// word is wider than the line.
export function wrapCount(m: TextMeasure, fontSize: number, lineWidth: number): number {
  if (m.words.length === 0) return 1;
  let lines = 1;
  let used = 0;
  for (const em of m.words) {
    const w = em * fontSize;
    if (w > lineWidth) return Infinity;
    if (used === 0) used = w;
    else if (used + m.space * fontSize + w <= lineWidth) used += m.space * fontSize + w;
    else {
      lines += 1;
      used = w;
    }
  }
  return lines;
}

// Edges the words keep from the sides of their space.
export const SIDE_PAD = 4;
// Phones round and kern a little differently than we measure.
const SLACK = 0.96;

export function fitText(m: TextMeasure, box: { width: number; height: number }, rules: FitRules): Fit {
  const roomy = fitWith(m, box, rules, false);
  if (roomy.fits || !rules.decor || rules.decor === "none") return roomy;
  // Too tight with the decoration's usual padding: try it snug.
  const snug = fitWith(m, box, rules, true);
  return snug.fits ? snug : roomy;
}

function fitWith(m: TextMeasure, box: { width: number; height: number }, rules: FitRules, snug: boolean): Fit {
  const top = Math.max(rules.min, rules.max);
  let last: Fit | null = null;
  for (let step = top; step > rules.min - 0.5; step -= Math.max(0.5, step * 0.02)) {
    // The last try is the smallest size exactly.
    const size = Math.max(rules.min, step);
    const inset = decorInset(rules.decor, size, snug);
    const lineWidth = (box.width - SIDE_PAD * 2 - inset.padX * 2 - inset.outerX - (rules.reserve ?? 0)) * SLACK;
    const height = box.height - inset.padY * 2 - inset.outerY;
    const room = Math.min(rules.maxLines, Math.floor(height / (size * rules.lineHeight) + 0.001));
    last = { fontSize: size, lines: Math.max(1, room), room: Math.max(1, room), fits: false, snug };
    if (room < 1 || lineWidth <= 0) continue;
    const lines = wrapCount(m, size, lineWidth);
    if (lines <= room) return { fontSize: size, lines, room, fits: true, snug };
  }
  return last ?? { fontSize: rules.min, lines: 1, room: 1, fits: false, snug };
}

// Text half a row tall (or so) is "slim": one line, centred in its space.
export const SLIM_HEIGHT = 50;

// How much of its space each kind of text fills (CORE-077). A title is as big
// as the space allows; a heading and a caption are the same fit, scaled down,
// so all three grow and shrink with the box and a heading never looks like a
// title. `min` is the smallest each may go before "…"; `fontScale` is the
// phone's own text size setting, which raises those smallest sizes.
export const labelFill = {
  title: { share: 1, min: 12, lines: 4 },
  heading: { share: 0.72, min: 11, lines: 6 },
  caption: { share: 0.5, min: 10, lines: 12 },
} as const;
// Even an enormous box stops somewhere.
const BIGGEST = 200;

export function lineHeightFor(font: LabelFont | undefined) {
  // Handwriting has tall loops; give it a touch more room.
  return font === "handwritten" ? 1.25 : 1.2;
}

export function labelRules(
  item: Pick<LabelItem, "size" | "decor" | "font" | "divider">,
  box: { width: number; height: number },
  fontScale = 1
): FitRules {
  const tier = labelFill[item.size];
  const scale = Math.min(1.4, Math.max(1, fontScale));
  const lineHeight = lineHeightFor(item.font);
  const slim = box.height < SLIM_HEIGHT;
  return {
    max: Math.max(tier.min, Math.min(BIGGEST, (box.height - 2) / lineHeight)),
    min: tier.min * Math.min(scale, 1.15),
    lineHeight,
    maxLines: slim || item.divider ? 1 : tier.lines,
    decor: item.divider ? "none" : item.decor,
  };
}

// The size for a piece of Hearth text in its space: the biggest that fills
// it, scaled to the kind of text, then fitted again at that size so the
// lines are right.
export function fitLabel(
  m: TextMeasure,
  item: Pick<LabelItem, "size" | "decor" | "font" | "divider">,
  box: { width: number; height: number },
  options: { fontScale?: number; reserve?: number } = {}
): Fit & { lineHeight: number } {
  const rules = { ...labelRules(item, box, options.fontScale), reserve: options.reserve };
  const fill = fitText(m, box, rules);
  const share = labelFill[item.size].share;
  const fit = share === 1 || !fill.fits ? fill : fitText(m, box, { ...rules, max: Math.max(rules.min, fill.fontSize * share) });
  return { ...fit, lineHeight: rules.lineHeight };
}

// A rough measure from the letters alone, used for the first moment before
// the real one comes back from the phone (and in tests).
export function estimateMeasure(text: string, font: LabelFont | undefined, caps?: boolean, bold?: boolean): TextMeasure {
  const perChar = font === "handwritten" ? 0.42 : font === "storybook" ? 0.58 : 0.54;
  const k = perChar * (caps ? 1.25 : 1) * (bold ? 1.05 : 1) + (caps ? 0.08 : 0);
  return { words: splitWords(text).map((w) => w.length * k), space: 0.27 };
}

export function splitWords(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

// Where text sits up and down (CORE-078): your choice, or by default slim
// text in the middle and taller text at the bottom, like a heading over what
// comes next.
export function labelVAlign(item: Pick<LabelItem, "valign">, height: number): LabelVAlign {
  return item.valign ?? (height < SLIM_HEIGHT ? "middle" : "bottom");
}

// How wide the decoration is drawn (CORE-078): at least `span` of the space
// across, never wider than the space. 0 (or no decoration) leaves it hugging
// the words.
export function decorMinWidth(item: Pick<LabelItem, "span" | "decor" | "divider">, width: number): number {
  if (item.divider || !item.decor || item.decor === "none") return 0;
  const span = Math.min(1, Math.max(0, item.span ?? 0));
  return span * Math.max(0, width - SIDE_PAD * 2);
}

// Decorations with a shape that can be stretched up and down (CORE-081). An
// underline or a flourish has nothing to make taller.
export function decorStretchesTall(decor: LabelDecor | undefined): boolean {
  return decor === "pill" || decor === "stitched" || decor === "ribbon" || decor === "sign";
}

// How tall the decoration is drawn (CORE-081): at least `spanY` of the space
// from top to bottom. The words keep the size the fit gave them; the shape
// just grows into the room around them.
export function decorMinHeight(item: Pick<LabelItem, "spanY" | "decor" | "divider">, height: number): number {
  if (item.divider || !decorStretchesTall(item.decor)) return 0;
  const span = Math.min(1, Math.max(0, item.spanY ?? 0));
  // The 2 points it keeps from the edge it sits against.
  return span * Math.max(0, height - 2);
}
