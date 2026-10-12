import type { IconName } from "../components/icon";
import { localDay } from "./pets";

// Little Log (LOG-001..010): keep track of anything with a date — a weight,
// blood pressure, a mood, the car's mileage — and see it over time. The
// pure parts live here so they can be tested; loading and saving is in
// little-log-data.ts.

export type LogKind = "number" | "pair" | "scale" | "yesno" | "text";

export type LittleLog = {
  id: string;
  owner_id: string;
  name: string;
  kind: LogKind;
  unit: string | null;
  labels: string[] | null;
  icon: string;
  color: string;
  shared: boolean;
  remind_at: string | null;
  created_at: string;
};

export type LogEntry = {
  id: string;
  log_id: string;
  logged_at: string;
  value: number | null;
  value2: number | null;
  note: string | null;
  written_by: string | null;
};

// LOG-001: what one entry holds.
export const logKinds: { key: LogKind; label: string; hint: string; icon: IconName }[] = [
  { key: "number", label: "A number", hint: "Like a weight, hours of sleep or the car's mileage.", icon: "chart" },
  { key: "pair", label: "Two numbers", hint: "Like blood pressure, 120/80.", icon: "heart" },
  { key: "scale", label: "1 to 5", hint: "Like your mood or how bad a headache was.", icon: "mood" },
  { key: "yesno", label: "Yes or no", hint: "Did it happen today? Like a workout or a migraine.", icon: "check" },
  { key: "text", label: "Just words", hint: "A line or two each time, like a little diary.", icon: "doc" },
];

export function kindInfo(kind: LogKind) {
  return logKinds.find((k) => k.key === kind) ?? logKinds[0];
}

// Colors a log can be. Mid-tone, so the line reads on light and dark pages.
export const logColors = ["#4f7a8c", "#b4553f", "#5f8a4a", "#8a5fa8", "#c08a2e", "#3f7f74", "#b04a6e", "#6b6f7a"];

// LOG-002: ready-made logs, so you don't start from nothing.
export type LogStarter = Pick<LittleLog, "name" | "kind" | "unit" | "labels" | "icon" | "color">;

export const starters: LogStarter[] = [
  { name: "Weight", kind: "number", unit: "lbs", labels: null, icon: "scale", color: "#4f7a8c" },
  { name: "Blood pressure", kind: "pair", unit: "mmHg", labels: ["Top", "Bottom"], icon: "heart", color: "#b04a6e" },
  { name: "Mood", kind: "scale", unit: null, labels: null, icon: "mood", color: "#c08a2e" },
  { name: "Sleep", kind: "number", unit: "hours", labels: null, icon: "bed", color: "#8a5fa8" },
  { name: "Water", kind: "number", unit: "glasses", labels: null, icon: "drop", color: "#3f7f74" },
  { name: "Mileage", kind: "number", unit: "mi", labels: null, icon: "car", color: "#6b6f7a" },
  { name: "Height", kind: "number", unit: "in", labels: null, icon: "ruler", color: "#5f8a4a" },
  { name: "Headache", kind: "scale", unit: null, labels: null, icon: "sick", color: "#b4553f" },
  { name: "Workout", kind: "yesno", unit: null, labels: null, icon: "dumbbell", color: "#5f8a4a" },
  { name: "Journal", kind: "text", unit: null, labels: null, icon: "doc", color: "#8a5fa8" },
];

// Icons a log can wear.
export const logIcons: IconName[] = [
  "chart", "scale", "heart", "mood", "bed", "drop", "car", "ruler", "sick", "dumbbell", "doc", "pill",
  "thermo", "coffee", "food", "bike", "money", "sun", "moon", "leaf", "paw", "kid", "star", "bolt",
];

// What 1..5 means on a scale log.
export const scaleWords = ["Awful", "Not great", "Okay", "Good", "Great"];

export function scaleWord(value: number) {
  return scaleWords[Math.min(5, Math.max(1, Math.round(value))) - 1];
}

// --- Numbers in and out ----------------------------------------------------------

// What someone typed, as a number: "182.4", "1,204", " 7 ". Null if it isn't one.
export function parseNumber(text: string): number | null {
  const clean = text.trim().replace(/,/g, "");
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(clean)) return null;
  const value = Number(clean);
  return Number.isFinite(value) && Math.abs(value) < 1e9 ? value : null;
}

// Up to 2 decimals, without trailing zeros, with thousands separators.
export function formatNumber(value: number) {
  const rounded = Math.round(value * 100) / 100;
  return rounded.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

// One entry, said the way it reads best: "182.4 lbs", "120/80 mmHg", "4 · Good", "Yes".
export function formatEntry(log: Pick<LittleLog, "kind" | "unit">, entry: Pick<LogEntry, "value" | "value2" | "note">) {
  const unit = log.unit ? ` ${log.unit}` : "";
  switch (log.kind) {
    case "number":
      return entry.value === null ? "" : `${formatNumber(entry.value)}${unit}`;
    case "pair":
      return entry.value === null || entry.value2 === null ? "" : `${formatNumber(entry.value)}/${formatNumber(entry.value2)}${unit}`;
    case "scale":
      return entry.value === null ? "" : `${entry.value} · ${scaleWord(entry.value)}`;
    case "yesno":
      return entry.value === null ? "" : entry.value ? "Yes" : "No";
    case "text":
      return entry.note ?? "";
  }
}

// --- Time ----------------------------------------------------------------------------

export const ranges = [
  { key: "week", label: "Week", days: 7 },
  { key: "month", label: "Month", days: 30 },
  { key: "quarter", label: "3 months", days: 91 },
  { key: "year", label: "Year", days: 365 },
  { key: "all", label: "All", days: null },
] as const;

export type RangeKey = (typeof ranges)[number]["key"];

// Entries inside the range, oldest first (for charts).
export function inRange<T extends Pick<LogEntry, "logged_at">>(entries: T[], range: RangeKey, now = Date.now()): T[] {
  const days = ranges.find((r) => r.key === range)?.days ?? null;
  const from = days === null ? -Infinity : now - days * 864e5;
  return entries
    .filter((e) => {
      const t = new Date(e.logged_at).getTime();
      return t >= from && t <= now + 60_000;
    })
    .sort((a, b) => a.logged_at.localeCompare(b.logged_at));
}

export function newestFirst<T extends Pick<LogEntry, "logged_at">>(entries: T[]): T[] {
  return [...entries].sort((a, b) => b.logged_at.localeCompare(a.logged_at));
}

// "Today", "Yesterday", or "Mon, Oct 6" (with the year if it isn't this one).
export function dayWords(day: string, today = localDay()) {
  if (day === today) return "Today";
  const date = new Date(`${day}T12:00:00`);
  const yesterday = new Date(`${today}T12:00:00`);
  yesterday.setDate(yesterday.getDate() - 1);
  if (day === localDay(yesterday)) return "Yesterday";
  const sameYear = day.slice(0, 4) === today.slice(0, 4);
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }) });
}

export function timeWords(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

// When an entry was logged, briefly: "today", "yesterday", "3 days ago", "Oct 6".
export function agoWords(iso: string, today = localDay()) {
  const day = localDay(new Date(iso));
  const days = Math.round((new Date(`${today}T12:00:00`).getTime() - new Date(`${day}T12:00:00`).getTime()) / 864e5);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return dayWords(day, today);
}

// History, newest first, grouped by the day it was logged.
export function groupByDay<T extends Pick<LogEntry, "logged_at">>(entries: T[]): { day: string; entries: T[] }[] {
  const groups: { day: string; entries: T[] }[] = [];
  for (const entry of newestFirst(entries)) {
    const day = localDay(new Date(entry.logged_at));
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.entries.push(entry);
    else groups.push({ day, entries: [entry] });
  }
  return groups;
}

// "20:00" -> "8:00 PM".
export function remindWords(at: string) {
  const [hour, minute] = at.split(":").map(Number);
  const date = new Date(2000, 0, 1, hour, minute);
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

// --- Stats (LOG-004) -----------------------------------------------------------------

export type LogStats = {
  count: number;
  latest: number | null;
  latest2: number | null;
  average: number | null;
  average2: number | null;
  low: number | null;
  high: number | null;
  // Latest minus the first in the range (for numbers and pairs' first value).
  change: number | null;
};

// `entries` oldest first.
export function logStats(entries: Pick<LogEntry, "value" | "value2">[]): LogStats {
  const values = entries.map((e) => e.value).filter((v): v is number => v !== null);
  const values2 = entries.map((e) => e.value2).filter((v): v is number => v !== null);
  const mean = (list: number[]) => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : null);
  return {
    count: entries.length,
    latest: values.length ? values[values.length - 1] : null,
    latest2: values2.length ? values2[values2.length - 1] : null,
    average: mean(values),
    average2: mean(values2),
    low: values.length ? Math.min(...values) : null,
    high: values.length ? Math.max(...values) : null,
    change: values.length > 1 ? values[values.length - 1] - values[0] : null,
  };
}

// "+2.4" / "−1" / "no change".
export function changeWords(change: number) {
  if (Math.abs(change) < 0.005) return "no change";
  return `${change > 0 ? "+" : "−"}${formatNumber(Math.abs(change))}`;
}

// Yes/no logs (LOG-004): the last `days` days, oldest first, each yes, no
// or not logged (the latest entry that day wins).
export function yesNoDays(entries: Pick<LogEntry, "logged_at" | "value">[], days: number, today = localDay()) {
  const byDay = new Map<string, boolean>();
  for (const entry of [...entries].sort((a, b) => a.logged_at.localeCompare(b.logged_at))) {
    if (entry.value !== null) byDay.set(localDay(new Date(entry.logged_at)), entry.value === 1);
  }
  const out: { day: string; state: "yes" | "no" | null }[] = [];
  const cursor = new Date(`${today}T12:00:00`);
  cursor.setDate(cursor.getDate() - (days - 1));
  for (let i = 0; i < days; i++) {
    const day = localDay(cursor);
    const state = byDay.get(day);
    out.push({ day, state: state === undefined ? null : state ? "yes" : "no" });
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

// Days in a row ending today (or yesterday, if today isn't logged yet) that were a yes.
export function yesStreak(days: { state: "yes" | "no" | null }[]) {
  let i = days.length - 1;
  if (i >= 0 && days[i].state === null) i -= 1;
  let streak = 0;
  for (; i >= 0 && days[i].state === "yes"; i--) streak += 1;
  return streak;
}

// --- Charts (LOG-004) ----------------------------------------------------------------

// Round tick values that cover min..max, like 170 / 180 / 190.
export function niceTicks(min: number, max: number, count = 3): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
  if (min === max) {
    const pad = Math.abs(min) > 1 ? Math.abs(min) * 0.05 : 1;
    min -= pad;
    max += pad;
  }
  const rough = (max - min) / Math.max(1, count - 1);
  const power = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * power).find((s) => s >= rough) ?? 10 * power;
  const start = Math.floor(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + step * 0.5 && ticks.length < 8; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  if (ticks[ticks.length - 1] < max) ticks.push(Math.round((ticks[ticks.length - 1] + step) * 1e6) / 1e6);
  return ticks;
}

// Where each entry goes on a chart `width` x `height`, oldest first. Time
// runs left to right (by when it was logged, not evenly spaced); values
// bottom to top over `domain`.
export function chartPoints(
  entries: Pick<LogEntry, "logged_at" | "value" | "value2">[],
  width: number,
  height: number,
  domain: [number, number]
) {
  const times = entries.map((e) => new Date(e.logged_at).getTime());
  const first = Math.min(...times);
  const last = Math.max(...times);
  const span = last - first;
  const [low, high] = domain;
  const y = (v: number) => height - ((v - low) / (high - low || 1)) * height;
  return entries.map((e, i) => ({
    x: span ? ((times[i] - first) / span) * width : width / 2,
    y: e.value === null ? null : y(e.value),
    y2: e.value2 === null ? null : y(e.value2),
  }));
}

// The index of the point nearest `x` (for reading a value off the chart).
export function nearestIndex(points: { x: number }[], x: number) {
  let best = 0;
  for (let i = 1; i < points.length; i++) {
    if (Math.abs(points[i].x - x) < Math.abs(points[best].x - x)) best = i;
  }
  return best;
}
