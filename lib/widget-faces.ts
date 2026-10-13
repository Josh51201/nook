import type { WidgetKind } from "./widgets";

// Faces (CORE-127): different designs of the same widget, like a countdown
// as a tear-off pad or a flip clock. Pure data and helpers (no React), so
// they're unit-testable. Drawn by components/hearth/widget-faces.tsx.
//
// "classic" is how the widget has always looked. A face that's its own frame
// (an embroidery hoop, a felt letter board, a carved sign) leaves out the
// card, so what it's made of and its edges don't apply to it.

export type Face = { key: string; label: string; ownFrame?: boolean };

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

export function faceLabel(widget: { kind: WidgetKind; face?: string }) {
  const key = faceOf(widget);
  return facesFor(widget.kind).find((f) => f.key === key)?.label ?? "";
}

// How a new widget of this kind starts out (CORE-125): a quote in a hoop.
const naturalFaces: Partial<Record<WidgetKind, string>> = { quote: "hoop", menu: "classic", greeting: "classic" };

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
