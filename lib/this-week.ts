import type { IconName } from "../components/icon";
import { addDays, dayWords } from "./menu-board";

// This week (CORE-105): one agenda for the coming days that mixes every
// Nook — Gatherings, birthdays, chores, pet visits, renewals, trips and
// dinners — grouped by day. Each Nook's loader (lib/this-week-data.ts) turns
// its own things into entries; this sorts them into days. Pure (no React or
// database), so it's unit-testable.

export type WeekSource = "gatherings" | "birthdays" | "chores" | "pets" | "renewals" | "trips" | "meals";

// In the order they're listed within a day.
export const weekSources: { key: WeekSource; label: string; icon: IconName }[] = [
  { key: "gatherings", label: "Gatherings", icon: "celebration" },
  { key: "birthdays", label: "Birthdays", icon: "birthday" },
  { key: "trips", label: "Getaways", icon: "plane" },
  { key: "chores", label: "Chores", icon: "rhythm" },
  { key: "pets", label: "Pet care", icon: "paw" },
  { key: "renewals", label: "Renewals", icon: "card" },
  { key: "meals", label: "Dinners", icon: "potluck" },
];

export type WeekEntry = {
  // YYYY-MM-DD; anything overdue is shown on today, marked overdue.
  day: string;
  source: WeekSource;
  title: string;
  // A short second line: a time, "trial ends", "day 2 of 5".
  detail?: string | null;
  icon: IconName;
  // Where tapping it goes.
  route: string;
  overdue?: boolean;
};

export type WeekDay = { day: string; label: string; entries: WeekEntry[] };

export const weekLengths = [3, 7, 14] as const;

const sourceOrder = (source: WeekSource) => weekSources.findIndex((s) => s.key === source);

// Today and the `days - 1` days after it, only the days with something on,
// soonest first. Overdue things land on today. The same thing from two Nooks
// (a birthday and its Birthday Gathering) shows once.
export function buildWeek(entries: WeekEntry[], today: string, days: number, skip: WeekSource[] = []): WeekDay[] {
  const last = addDays(today, Math.max(1, days) - 1);
  const byDay = new Map<string, WeekEntry[]>();
  const seen = new Set<string>();
  const sorted = [...entries].sort((a, b) => sourceOrder(a.source) - sourceOrder(b.source) || a.title.localeCompare(b.title));
  for (const entry of sorted) {
    if (skip.includes(entry.source)) continue;
    const overdue = entry.overdue || entry.day < today;
    const day = entry.day < today ? today : entry.day;
    if (day > last) continue;
    const key = `${day}|${entry.title.trim().toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const list = byDay.get(day) ?? [];
    list.push(overdue ? { ...entry, day, overdue: true } : { ...entry, day });
    byDay.set(day, list);
  }
  return [...byDay.keys()]
    .sort()
    .map((day) => ({
      day,
      label: dayWords(day, today),
      // Overdue first on today, then in the usual order.
      entries: (byDay.get(day) ?? []).sort((a, b) => Number(Boolean(b.overdue)) - Number(Boolean(a.overdue))),
    }));
}

export function weekCount(week: WeekDay[]) {
  return week.reduce((sum, day) => sum + day.entries.length, 0);
}

// "Day 2 of 5" for a trip that's on, counting from its first day.
export function tripDayWords(startsOn: string, endsOn: string, today: string) {
  const dayMs = 86400000;
  const at = (day: string) => Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)));
  const total = Math.round((at(endsOn) - at(startsOn)) / dayMs) + 1;
  const now = Math.round((at(today) - at(startsOn)) / dayMs) + 1;
  return `Day ${now} of ${total}`;
}
