import type { WidgetKind } from "./widgets";

// Faces (CORE-127): different designs of the same widget, like a countdown
// as a tear-off pad or a flip clock. Pure data and helpers (no React), so
// they're unit-testable. Drawn by components/hearth/widget-faces.tsx.
//
// "classic" is how the widget has always looked. A face that's its own frame
// (an embroidery hoop, a felt letter board, a carved sign) leaves out the
// card, so what it's made of and its edges don't apply to it. Some of those
// (a receipt, a notepad, a recipe card) are paper that `wraps` the widget's
// usual insides, so its list still ticks off as before (CORE-131).

export type Face = { key: string; label: string; ownFrame?: boolean; wraps?: boolean };

export const widgetFaces: Partial<Record<WidgetKind, Face[]>> = {
  countdown: [
    { key: "classic", label: "Calendar page" },
    { key: "tearoff", label: "Tear-off pad" },
    { key: "flip", label: "Flip clock" },
    { key: "chain", label: "Paper chain" },
  ],
  quote: [
    { key: "classic", label: "Plain" },
    { key: "hoop", label: "Embroidery hoop", ownFrame: true },
    { key: "typewriter", label: "Typewriter" },
    { key: "fortune", label: "Fortune slip" },
  ],
  streak: [
    { key: "classic", label: "Number" },
    { key: "candle", label: "Candle" },
    { key: "plant", label: "Growing plant" },
    { key: "jar", label: "Marble jar" },
  ],
  menu: [
    { key: "classic", label: "List" },
    { key: "letterboard", label: "Letter board", ownFrame: true },
  ],
  greeting: [
    { key: "classic", label: "Plain" },
    { key: "bunting", label: "Bunting" },
    { key: "sign", label: "Carved sign", ownFrame: true },
    { key: "neon", label: "Neon sign", ownFrame: true },
    { key: "doormat", label: "Doormat", ownFrame: true },
  ],
  clock: [
    { key: "classic", label: "Plain" },
    { key: "cuckoo", label: "Cuckoo clock", ownFrame: true },
    { key: "words", label: "Word clock" },
    { key: "sundial", label: "Sundial" },
  ],
  getaway: [
    { key: "classic", label: "Plain" },
    { key: "tag", label: "Luggage tag", ownFrame: true },
    { key: "pass", label: "Boarding pass", ownFrame: true },
    { key: "postcard", label: "Postcard", ownFrame: true },
  ],
  recipe: [
    { key: "classic", label: "Plain" },
    { key: "card", label: "Recipe card", ownFrame: true, wraps: true },
  ],
  timer: [
    { key: "classic", label: "Plain" },
    { key: "egg", label: "Egg timer" },
    { key: "hourglass", label: "Hourglass" },
  ],
  gratitude: [
    { key: "classic", label: "Plain" },
    { key: "mason", label: "Mason jar" },
    { key: "cookie", label: "Cookie jar" },
    { key: "bowl", label: "Fishbowl" },
  ],
  turn: [
    { key: "classic", label: "Plain" },
    { key: "wheel", label: "Spinner wheel" },
  ],
  groceries: [
    { key: "classic", label: "Plain" },
    { key: "receipt", label: "Receipt", ownFrame: true, wraps: true },
    { key: "notepad", label: "Notepad", ownFrame: true, wraps: true },
  ],
  reminders: [
    { key: "classic", label: "Plain" },
    { key: "receipt", label: "Receipt", ownFrame: true, wraps: true },
    { key: "notepad", label: "Notepad", ownFrame: true, wraps: true },
  ],
  birthdays: [
    { key: "classic", label: "Plain" },
    { key: "cake", label: "Cake" },
  ],
};

export function facesFor(kind: WidgetKind): Face[] {
  return widgetFaces[kind] ?? [];
}

// The face it shows: its own pick if that's one this kind has, else classic.
export function faceOf(widget: { kind: WidgetKind; face?: string }): string {
  return facesFor(widget.kind).some((f) => f.key === widget.face) ? widget.face! : "classic";
}

// Is it drawn as its own frame, with no card behind it?
export function ownFrame(widget: { kind: WidgetKind; face?: string }) {
  const key = faceOf(widget);
  return facesFor(widget.kind).find((f) => f.key === key)?.ownFrame ?? false;
}

// Is it paper wrapped around the widget's usual insides (a receipt)?
export function wrapsFace(widget: { kind: WidgetKind; face?: string }) {
  const key = faceOf(widget);
  return facesFor(widget.kind).find((f) => f.key === key)?.wraps ?? false;
}

export function faceLabel(widget: { kind: WidgetKind; face?: string }) {
  const key = faceOf(widget);
  return facesFor(widget.kind).find((f) => f.key === key)?.label ?? "";
}

// How a new widget of this kind starts out (CORE-125): a quote in a hoop.
const naturalFaces: Partial<Record<WidgetKind, string>> = { quote: "hoop", menu: "classic", greeting: "classic", gratitude: "mason" };

export function naturalFace(kind: WidgetKind): string | undefined {
  return naturalFaces[kind];
}

// A different face from the one it has, for "Surprise me"; `roll` is in [0, 1).
export function surpriseFace(widget: { kind: WidgetKind; face?: string }, roll: number): string | undefined {
  const others = facesFor(widget.kind).filter((f) => f.key !== faceOf(widget));
  if (!others.length) return widget.face;
  return others[Math.min(others.length - 1, Math.floor(roll * others.length))].key;
}

// --- Paper chain (countdown) -----------------------------------------------------------

// One link comes off each day. As many links as fit are drawn; the rest are
// counted ("+12").
export function chainLinks(days: number, fit: number) {
  const links = Math.max(0, days);
  const shown = Math.min(links, Math.max(0, fit));
  return { shown, more: links - shown };
}

// The digits a flip clock shows: at least two, so 7 days reads "07".
export function flipDigits(days: number) {
  return String(Math.max(0, Math.abs(days))).padStart(2, "0").split("");
}

// --- Habit streak faces ------------------------------------------------------------------

// A plant grows a pair of leaves every couple of days, up to six pairs, and
// flowers once the streak reaches a week.
export function plantStage(streak: number) {
  return { pairs: Math.min(6, Math.ceil(Math.max(0, streak) / 2)), flower: streak >= 7, height: Math.min(1, 0.25 + streak * 0.06) };
}

// The candle's flame grows with the streak (and is out if it's broken).
export function flameSize(streak: number, doneToday: boolean) {
  if (streak <= 0) return 0;
  const size = Math.min(1, 0.45 + streak * 0.04);
  return doneToday ? size : size * 0.8;
}

// One marble a day, up to what the jar holds.
export const JAR_HOLDS = 30;

export function jarMarbles(streak: number) {
  return Math.min(JAR_HOLDS, Math.max(0, streak));
}

// --- Fortune slip (quote) ----------------------------------------------------------------

// Six "lucky numbers" for the day, the same all day long.
export function luckyNumbers(date: Date): number[] {
  let seed = date.getFullYear() * 400 + date.getMonth() * 32 + date.getDate();
  const out: number[] = [];
  while (out.length < 6) {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    const n = (seed % 49) + 1;
    if (!out.includes(n)) out.push(n);
  }
  return out;
}

// --- Clock faces (CORE-131) --------------------------------------------------------------

const HOUR_WORDS = ["twelve", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven"];
const PAST = ["", "five past", "ten past", "quarter past", "twenty past", "twenty-five past", "half past"];
const TO = ["", "five to", "ten to", "quarter to", "twenty to", "twenty-five to"];

// The time the way you'd say it, to the nearest five minutes: "ten past
// four", "quarter to five", "six o'clock".
export function clockWords(date: Date): string {
  const steps = Math.round((date.getHours() * 60 + date.getMinutes()) / 5);
  const hour = Math.floor(steps / 12) % 24;
  const five = steps % 12;
  if (five === 0) return `${HOUR_WORDS[hour % 12]} o'clock`;
  if (five <= 6) return `${PAST[five]} ${HOUR_WORDS[hour % 12]}`;
  return `${TO[12 - five]} ${HOUR_WORDS[(hour + 1) % 12]}`;
}

// Where a sundial's shadow points, in degrees from straight up (morning to
// the left, evening to the right), or null when the sun's down.
export function sundialAngle(date: Date): number | null {
  const hour = date.getHours() + date.getMinutes() / 60;
  if (hour < 6 || hour >= 20) return null;
  return Math.max(-90, Math.min(90, (hour - 13) * 15));
}

// --- Kitchen timer faces -------------------------------------------------------------------

// How much of a timer is left, 1 (all of it) down to 0.
export function timeFraction(total: number, left: number) {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(1, left / total));
}

// --- Whose turn? spinner wheel -------------------------------------------------------------

// How far the wheel turns so name `index` of `count` sits under the pointer
// at the top. It always turns forward from `from`, by at least `spins` full
// turns, so landing looks like a spin.
export function wheelAngle(index: number, count: number, from = 0, spins = 0) {
  const slice = 360 / Math.max(1, count);
  const target = -(index + 0.5) * slice;
  const ahead = (((target - from) % 360) + 360) % 360;
  return from + ahead + spins * 360;
}

// --- Gratitude jar --------------------------------------------------------------------------

// One folded slip of paper for each good thing written, up to what fits.
export const SLIPS_HELD = 28;

export function slipCount(lines: number) {
  return Math.min(SLIPS_HELD, Math.max(0, lines));
}

// --- Birthday cake ---------------------------------------------------------------------------

// Candles for the age they're turning: one each up to nine, otherwise a
// number candle for each digit.
export function cakeCandles(turning: number | null | undefined): { count: number; digits: string[] | null } {
  if (!turning || turning < 1) return { count: 3, digits: null };
  if (turning <= 9) return { count: turning, digits: null };
  return { count: 0, digits: String(turning).split("") };
}
