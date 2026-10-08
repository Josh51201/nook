import type { IconName } from "../components/icon";
import { nookCatalog } from "./nooks";

// Helpers for the clock, quote, quick-launch and habit-streak widgets
// (CORE-049) and for showing things only in some months (CORE-053): pure, so
// they're unit-testable. Drawn by components/hearth/widgets.tsx.

// --- Dates ----------------------------------------------------------------------------

export function dayKey(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Whole days since 1970 for a "YYYY-MM-DD" day (no time zones or daylight
// saving to trip over).
function dayNumber(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
}

function dayFromNumber(n: number) {
  const date = new Date(n * 86400000);
  const pad = (v: number) => String(v).padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function addDays(day: string, days: number) {
  return dayFromNumber(dayNumber(day) + days);
}

// --- Quote of the day ------------------------------------------------------------------

export type QuoteSource = "cozy" | "mine" | "both";

export const MAX_OWN_QUOTES = 50;

// A few warm lines of our own, to start with.
export const cozyQuotes: string[] = [
  "Home is wherever the kettle is on.",
  "A small fire, a good book, nowhere to be.",
  "Be the person who makes the room feel warmer.",
  "Little by little, a nest gets built.",
  "Some days the win is simply coming home.",
  "Soft light, slow morning, nothing to prove.",
  "The best plans fit around a good meal.",
  "Leave a light on for someone.",
  "Collect moments, not clutter.",
  "A full table is a full heart.",
  "Rest is part of the work.",
  "Kindness is the cheapest thing that warms a house.",
  "Every family has its own weather.",
  "Today is a good day to call someone you miss.",
  "Make a little room for joy.",
  "Even the tallest tree started in a nook.",
  "Slow down; the soup is still simmering.",
  "Where there is a blanket, there is a way.",
  "Plant something, even if it's small.",
  "The nicest gift is being remembered.",
  "Stay awhile.",
  "A cozy place is built from small, kind habits.",
  "Fresh bread, open windows, good company.",
  "You are allowed to take the quiet route.",
  "Keep the old stories close and the door open.",
  "Tomorrow can wait until the tea is finished.",
  "Warm hands, warm hearts, warm socks.",
  "Home is a feeling you make for other people.",
  "Notice the small good thing.",
  "Come in, get comfortable, put your feet up.",
];

// One quote per day, the same all day and stepping to the next at midnight.
export function quoteOfDay(pool: string[], now: Date): string | null {
  if (!pool.length) return null;
  const index = dayNumber(dayKey(now)) % pool.length;
  return pool[index];
}

export function quotePool(source: QuoteSource, mine: string[]): string[] {
  const own = mine.map((q) => q.trim()).filter(Boolean);
  if (source === "mine") return own;
  if (source === "both") return [...own, ...cozyQuotes];
  return cozyQuotes;
}

// What you typed in the box (one quote per line) as a clean list.
export function parseQuotes(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, MAX_OWN_QUOTES)
    .map((line) => line.slice(0, 200));
}

// --- Habit streak ----------------------------------------------------------------------

const KEEP_DAYS = 400;

// Days in a row up to today. Today not being done yet doesn't break it: the
// streak holds until the day is over.
export function currentStreak(days: string[], today: string) {
  const done = new Set(days);
  let cursor = done.has(today) ? today : addDays(today, -1);
  let count = 0;
  while (done.has(cursor)) {
    count++;
    cursor = addDays(cursor, -1);
  }
  return count;
}

export function bestStreak(days: string[]) {
  const sorted = [...new Set(days)].map(dayNumber).sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  sorted.forEach((n, i) => {
    run = i > 0 && n === sorted[i - 1] + 1 ? run + 1 : 1;
    best = Math.max(best, run);
  });
  return best;
}

// Tick a day, or untick it if it was already done.
export function toggleDay(days: string[], day: string): string[] {
  if (days.includes(day)) return days.filter((d) => d !== day);
  return [...days, day].sort().slice(-KEEP_DAYS);
}

// The last n days ending today, oldest first.
export function lastDays(n: number, today: string) {
  return Array.from({ length: n }, (_, i) => addDays(today, i - (n - 1)));
}

// --- Quick launch ----------------------------------------------------------------------

export const MAX_LAUNCH_TARGETS = 6;

export type LaunchTarget = { key: string; label: string; icon: IconName; route: string };

const otherTargets: LaunchTarget[] = [
  { key: "inbox", label: "Inbox", icon: "bell", route: "/inbox" },
  { key: "market", label: "Market", icon: "market", route: "/market" },
  { key: "home", label: "Your Home", icon: "hearth", route: "/home" },
  { key: "profile", label: "Profile", icon: "person", route: "/profile" },
];

// Every Nook that's ready to open, plus the app's own places.
export function launchTargets(): LaunchTarget[] {
  const nooks = nookCatalog
    .filter((nook) => nook.available && nook.route)
    .map((nook) => ({ key: nook.id, label: nook.title.replace(/ Nook$/, ""), icon: nook.icon, route: nook.route as string }));
  return [...nooks, ...otherTargets];
}

// The targets picked, in order, that still exist.
export function pickedTargets(keys: string[]): LaunchTarget[] {
  const all = launchTargets();
  return keys.flatMap((key) => all.find((t) => t.key === key) ?? []);
}

// --- Show only sometimes (CORE-053) ------------------------------------------------------

// A range of months (1 = January … 12 = December), both ends included. It can
// wrap around the new year: November to January is { from: 11, to: 1 }.
export type ShowIn = { from: number; to: number };

export const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function inSeason(showIn: ShowIn | undefined, now: Date): boolean {
  if (!showIn) return true;
  const month = now.getMonth() + 1;
  return showIn.from <= showIn.to ? month >= showIn.from && month <= showIn.to : month >= showIn.from || month <= showIn.to;
}

export function showInWords(showIn: ShowIn | undefined) {
  if (!showIn) return "Always";
  const from = monthNames[showIn.from - 1];
  const to = monthNames[showIn.to - 1];
  return showIn.from === showIn.to ? `Only in ${from}` : `${from} to ${to}`;
}
