import type { IconName } from "../components/icon";
import { daysToDue, localDay } from "./pets";

// Subscriptions Nook (SUB-001..012): pure helpers, no React or database, so
// they're unit-testable. Screens live in app/subscriptions/, loading in
// lib/subscriptions-data.ts.

export type Category = "streaming" | "music" | "gaming" | "reading" | "apps" | "fitness" | "food" | "home" | "memberships" | "other";

// SUB-007.
export const categories: { key: Category; label: string; icon: IconName }[] = [
  { key: "streaming", label: "Streaming", icon: "play" },
  { key: "music", label: "Music", icon: "music" },
  { key: "gaming", label: "Gaming", icon: "gamepad" },
  { key: "reading", label: "News & reading", icon: "books" },
  { key: "apps", label: "Apps & cloud", icon: "cloud" },
  { key: "fitness", label: "Fitness", icon: "dumbbell" },
  { key: "food", label: "Food & delivery", icon: "food" },
  { key: "home", label: "Home & phone", icon: "bolt" },
  { key: "memberships", label: "Memberships", icon: "cart" },
  { key: "other", label: "Other", icon: "card" },
];

export function categoryInfo(key: string) {
  return categories.find((c) => c.key === key) ?? categories[categories.length - 1];
}

export type Cycle = "weekly" | "monthly" | "quarterly" | "half_yearly" | "yearly";

export const cycles: { key: Cycle; label: string; per: string; short: string; perYear: number }[] = [
  { key: "weekly", label: "Weekly", per: "a week", short: "/wk", perYear: 52 },
  { key: "monthly", label: "Monthly", per: "a month", short: "/mo", perYear: 12 },
  { key: "quarterly", label: "Every 3 months", per: "every 3 months", short: "/3 mo", perYear: 4 },
  { key: "half_yearly", label: "Every 6 months", per: "every 6 months", short: "/6 mo", perYear: 2 },
  { key: "yearly", label: "Yearly", per: "a year", short: "/yr", perYear: 1 },
];

export function cycleInfo(key: string) {
  return cycles.find((c) => c.key === key) ?? cycles[1];
}

// SUB-003: how long before it renews to remind you (null = no reminder).
export const remindChoices: { days: number | null; label: string }[] = [
  { days: null, label: "Off" },
  { days: 1, label: "1 day before" },
  { days: 3, label: "3 days before" },
  { days: 7, label: "A week before" },
  { days: 14, label: "2 weeks before" },
];

export type Status = "active" | "paused" | "cancelled";

export type Subscription = {
  id: string;
  home_id: string;
  name: string;
  category: string;
  price_cents: number;
  cycle: string;
  renews_on: string;
  on_trial: boolean;
  remind_days: number | null;
  private: boolean;
  payer: string | null;
  card_name: string | null;
  card_last4: string | null;
  manage_url: string | null;
  notes: string | null;
  status: Status;
  stopped_on: string | null;
  created_by: string | null;
  created_at: string;
};

// --- Money -------------------------------------------------------------------------------

// "$15.49", "$1,299.00".
export function formatMoney(cents: number) {
  const fixed = (Math.round(cents) / 100).toFixed(2);
  const [whole, part] = fixed.split(".");
  return `$${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${part}`;
}

// What someone typed as a price, in cents: "15.49", "$15.49", "15", ".99",
// "1,299". Nothing usable gives null.
export function parsePrice(text: string): number | null {
  const cleaned = text.replace(/[$,\s]/g, "");
  if (!/^\d*(\.\d{0,2})?$/.test(cleaned) || !/\d/.test(cleaned)) return null;
  const cents = Math.round(Number(cleaned) * 100);
  return Number.isFinite(cents) && cents <= 10_000_000 ? cents : null;
}

// Cents back into what goes in the price box ("15.49", "" for nothing).
export function priceText(cents: number | null | undefined) {
  return cents ? (cents / 100).toFixed(2) : "";
}

// SUB-004: what it costs a month and a year, whatever it bills by.
export function monthlyCents(sub: Pick<Subscription, "price_cents" | "cycle">) {
  return (sub.price_cents * cycleInfo(sub.cycle).perYear) / 12;
}

export function yearlyCents(sub: Pick<Subscription, "price_cents" | "cycle">) {
  return sub.price_cents * cycleInfo(sub.cycle).perYear;
}

// "$15.49 a month", "$139.00 a year".
export function priceWords(sub: Pick<Subscription, "price_cents" | "cycle">) {
  return `${formatMoney(sub.price_cents)} ${cycleInfo(sub.cycle).per}`;
}

// --- Renewal dates (SUB-001, SUB-003) -------------------------------------------------------

function parts(day: string) {
  return day.split("-").map(Number) as [number, number, number];
}

function addDays(day: string, days: number) {
  const [y, m, d] = parts(day);
  return localDay(new Date(y, m - 1, d + days));
}

// Months move like Postgres's do: the 31st of January plus a month is the
// 28th of February (so the app and the database's daily job agree).
function addMonths(day: string, months: number) {
  const [y, m, d] = parts(day);
  const first = new Date(y, m - 1 + months, 1);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  return localDay(new Date(first.getFullYear(), first.getMonth(), Math.min(d, last)));
}

// The charge after `day`.
export function stepRenewal(day: string, cycle: string) {
  switch (cycle) {
    case "weekly":
      return addDays(day, 7);
    case "monthly":
      return addMonths(day, 1);
    case "quarterly":
      return addMonths(day, 3);
    case "half_yearly":
      return addMonths(day, 6);
    default:
      return addMonths(day, 12);
  }
}

// Where it really stands today. The database rolls a passed renewal
// forward each morning; this does the same on the phone in the meantime,
// so a renewal never shows as "overdue". A trial whose day has passed is a
// paid subscription now.
export function current<T extends Pick<Subscription, "renews_on" | "on_trial" | "cycle">>(sub: T, today: string): T {
  if (sub.renews_on >= today) return sub;
  let next = sub.renews_on;
  while (next < today) next = stepRenewal(next, sub.cycle);
  return { ...sub, renews_on: next, on_trial: false };
}

function formatDay(day: string, withYear = false) {
  const [y, m, d] = parts(day);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(withYear ? { year: "numeric" } : {}),
  });
}

function whenWords(day: string, today: string) {
  const days = daysToDue(day, today);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days <= 14) return `in ${days} days`;
  return `on ${formatDay(day, day.slice(0, 4) !== today.slice(0, 4))}`;
}

// "Renews in 5 days", "Free trial ends tomorrow", "Cancelled Mar 3, 2026".
export function renewWords(sub: Pick<Subscription, "renews_on" | "on_trial" | "cycle" | "status" | "stopped_on">, today: string) {
  if (sub.status !== "active") {
    const verb = sub.status === "paused" ? "Paused" : "Cancelled";
    return sub.stopped_on ? `${verb} ${formatDay(sub.stopped_on, true)}` : verb;
  }
  const now = current(sub, today);
  return `${now.on_trial ? "Free trial ends" : "Renews"} ${whenWords(now.renews_on, today)}`;
}

// The last day to cancel without being charged: the day before it renews.
export function cancelBy(sub: Pick<Subscription, "renews_on" | "on_trial" | "cycle">, today: string) {
  return addDays(current(sub, today).renews_on, -1);
}

export function cancelByWords(sub: Pick<Subscription, "renews_on" | "on_trial" | "cycle">, today: string) {
  const day = cancelBy(sub, today);
  if (day < today) return "Too late to cancel this time — it renews today";
  if (day === today) return "Cancel by the end of today";
  if (day === addDays(today, 1)) return "Cancel by the end of tomorrow";
  return `Cancel by ${formatDay(day, day.slice(0, 4) !== today.slice(0, 4))}`;
}

// "Soon" is the next week.
export function isSoon(sub: Pick<Subscription, "renews_on" | "on_trial" | "cycle">, today: string) {
  return daysToDue(current(sub, today).renews_on, today) <= 7;
}

export function sortByRenewal<T extends Pick<Subscription, "renews_on" | "on_trial" | "cycle" | "name">>(subs: T[], today: string) {
  return [...subs]
    .map((s) => ({ s, day: current(s, today).renews_on }))
    .sort((a, b) => a.day.localeCompare(b.day) || a.s.name.localeCompare(b.s.name))
    .map(({ s }) => s);
}

// The home screen's sections (SUB-001, SUB-010): free trials, renewing in
// the next week, the rest of the month, later, and paused or cancelled.
export function groupSubscriptions<T extends Pick<Subscription, "renews_on" | "on_trial" | "cycle" | "name" | "status" | "stopped_on">>(
  subs: T[],
  today: string
) {
  const groups = { trials: [] as T[], soon: [] as T[], month: [] as T[], later: [] as T[], stopped: [] as T[] };
  for (const s of sortByRenewal(subs, today)) {
    if (s.status !== "active") groups.stopped.push(s);
    else if (current(s, today).on_trial) groups.trials.push(s);
    else {
      const days = daysToDue(current(s, today).renews_on, today);
      if (days <= 7) groups.soon.push(s);
      else if (days <= 31) groups.month.push(s);
      else groups.later.push(s);
    }
  }
  // Most recently stopped first.
  groups.stopped.sort((a, b) => (b.stopped_on ?? "").localeCompare(a.stopped_on ?? ""));
  return groups;
}

// --- Totals (SUB-004, SUB-007) ---------------------------------------------------------------

export type Totals = {
  // Active and being charged (not on a free trial).
  monthly: number;
  yearly: number;
  count: number;
  // What the free trials will add a month once they start charging.
  trialsMonthly: number;
  trials: number;
};

export function totals(subs: Pick<Subscription, "price_cents" | "cycle" | "renews_on" | "on_trial" | "status">[], today: string): Totals {
  const sum = { monthly: 0, yearly: 0, count: 0, trialsMonthly: 0, trials: 0 };
  for (const s of subs) {
    if (s.status !== "active") continue;
    if (current(s, today).on_trial) {
      sum.trials += 1;
      sum.trialsMonthly += monthlyCents(s);
    } else {
      sum.count += 1;
      sum.monthly += monthlyCents(s);
      sum.yearly += yearlyCents(s);
    }
  }
  return sum;
}

// Each category's share of the monthly total, biggest first.
export function categoryTotals(subs: Pick<Subscription, "price_cents" | "cycle" | "renews_on" | "on_trial" | "status" | "category">[], today: string) {
  const byKey = new Map<string, { monthly: number; count: number }>();
  for (const s of subs) {
    if (s.status !== "active" || current(s, today).on_trial) continue;
    const key = categoryInfo(s.category).key;
    const entry = byKey.get(key) ?? { monthly: 0, count: 0 };
    entry.monthly += monthlyCents(s);
    entry.count += 1;
    byKey.set(key, entry);
  }
  return [...byKey.entries()]
    .map(([key, v]) => ({ ...categoryInfo(key), ...v }))
    .sort((a, b) => b.monthly - a.monthly || a.label.localeCompare(b.label));
}

// --- Paused and cancelled (SUB-010) -----------------------------------------------------------

const DAYS_PER_MONTH = 365.25 / 12;

// What stopping it has saved since the day it stopped, at what it was
// costing then.
export function savedCents(sub: Pick<Subscription, "price_cents" | "cycle" | "status" | "stopped_on">, today: string) {
  if (sub.status === "active" || !sub.stopped_on) return 0;
  const days = Math.max(0, daysToDue(today, sub.stopped_on));
  return Math.round((monthlyCents(sub) * days) / DAYS_PER_MONTH);
}

export function totalSaved(subs: Pick<Subscription, "price_cents" | "cycle" | "status" | "stopped_on">[], today: string) {
  return subs.reduce((sum, s) => sum + savedCents(s, today), 0);
}

// Starting it again: the next charge is the next renewal day from where it
// was, or a cycle from today if that's long gone.
export function resumeDate(sub: Pick<Subscription, "renews_on" | "cycle">, today: string) {
  const next = current({ ...sub, on_trial: false }, today).renews_on;
  return next === today ? stepRenewal(today, sub.cycle) : next;
}

// --- Price history (SUB-008) ---------------------------------------------------------------

export type PriceEntry = {
  id: string;
  subscription_id: string;
  price_cents: number;
  cycle: string;
  changed_on: string;
  changed_by: string | null;
  created_at: string;
};

// One subscription's prices, newest first.
export function priceHistory<T extends PriceEntry>(entries: T[], subscriptionId: string) {
  return entries
    .filter((e) => e.subscription_id === subscriptionId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

function monthYear(day: string) {
  const [y, m] = parts(day);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

// "Went up from $15.49 to $17.99 in March 2026", from newest-first history.
// Compared a month at a time, so switching monthly to yearly isn't "up".
export function lastChangeWords(history: Pick<PriceEntry, "price_cents" | "cycle" | "changed_on">[]) {
  if (history.length < 2) return null;
  const [now, before] = history;
  const was = monthlyCents(before);
  const is = monthlyCents(now);
  const verb = is > was ? "Went up" : is < was ? "Went down" : "Changed";
  const from = now.cycle === before.cycle ? formatMoney(before.price_cents) : priceWords(before);
  const to = now.cycle === before.cycle ? formatMoney(now.price_cents) : priceWords(now);
  return `${verb} from ${from} to ${to} in ${monthYear(now.changed_on)}`;
}

// --- Who pays and which card (SUB-005) --------------------------------------------------------

// Just the 4 digits, from whatever was typed ("1234", "•• 1234").
export function cleanLast4(text: string) {
  const digits = text.replace(/\D/g, "");
  return digits.length === 4 ? digits : null;
}

// A card nickname can't hold a card number (the database refuses 5+ digits
// in a row too).
export function looksLikeCardNumber(text: string) {
  return /\d{5,}/.test(text.replace(/[\s-]/g, ""));
}

// "Chase Visa ••1234", "Card ending 1234", "Chase Visa".
export function cardWords(sub: Pick<Subscription, "card_name" | "card_last4">) {
  const name = sub.card_name?.trim();
  if (name && sub.card_last4) return `${name} ••${sub.card_last4}`;
  if (sub.card_last4) return `Card ending ${sub.card_last4}`;
  return name || null;
}

// --- Manage or cancel (SUB-009) ----------------------------------------------------------------

// Billed through the phone's store? These open its subscription list.
export const storeLinks = [
  { label: "Through Apple", url: "https://apps.apple.com/account/subscriptions" },
  { label: "Through Google Play", url: "https://play.google.com/store/account/subscriptions" },
];

export function normalizeLink(url: string) {
  const trimmed = url.trim();
  if (!trimmed) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

// --- Quick picks (proposed) ---------------------------------------------------------------------

// Common ones, so typing "Net" offers Netflix with its category and usual
// billing filled in. No prices: they change too often to keep right.
export const quickPicks: { name: string; category: Category; cycle: Cycle }[] = [
  { name: "Netflix", category: "streaming", cycle: "monthly" },
  { name: "Disney+", category: "streaming", cycle: "monthly" },
  { name: "Hulu", category: "streaming", cycle: "monthly" },
  { name: "Max", category: "streaming", cycle: "monthly" },
  { name: "Peacock", category: "streaming", cycle: "monthly" },
  { name: "Paramount+", category: "streaming", cycle: "monthly" },
  { name: "YouTube Premium", category: "streaming", cycle: "monthly" },
  { name: "YouTube TV", category: "streaming", cycle: "monthly" },
  { name: "Apple TV+", category: "streaming", cycle: "monthly" },
  { name: "Spotify", category: "music", cycle: "monthly" },
  { name: "Apple Music", category: "music", cycle: "monthly" },
  { name: "SiriusXM", category: "music", cycle: "monthly" },
  { name: "Xbox Game Pass", category: "gaming", cycle: "monthly" },
  { name: "PlayStation Plus", category: "gaming", cycle: "yearly" },
  { name: "Nintendo Switch Online", category: "gaming", cycle: "yearly" },
  { name: "Audible", category: "reading", cycle: "monthly" },
  { name: "Kindle Unlimited", category: "reading", cycle: "monthly" },
  { name: "Newspaper", category: "reading", cycle: "monthly" },
  { name: "iCloud+", category: "apps", cycle: "monthly" },
  { name: "Apple One", category: "apps", cycle: "monthly" },
  { name: "Google One", category: "apps", cycle: "monthly" },
  { name: "Microsoft 365", category: "apps", cycle: "yearly" },
  { name: "Gym", category: "fitness", cycle: "monthly" },
  { name: "Peloton", category: "fitness", cycle: "monthly" },
  { name: "DoorDash DashPass", category: "food", cycle: "monthly" },
  { name: "Uber One", category: "food", cycle: "monthly" },
  { name: "Meal kit", category: "food", cycle: "weekly" },
  { name: "Internet", category: "home", cycle: "monthly" },
  { name: "Phone plan", category: "home", cycle: "monthly" },
  { name: "Home security", category: "home", cycle: "monthly" },
  { name: "Amazon Prime", category: "memberships", cycle: "yearly" },
  { name: "Costco", category: "memberships", cycle: "yearly" },
  { name: "Sam's Club", category: "memberships", cycle: "yearly" },
  { name: "Walmart+", category: "memberships", cycle: "yearly" },
];

// Picks that start with (or contain a word starting with) what's typed,
// leaving out ones already in the Nook.
export function matchingPicks(query: string, existingNames: string[], limit = 6) {
  const q = query.trim().toLowerCase();
  const have = new Set(existingNames.map((n) => n.trim().toLowerCase()));
  return quickPicks
    .filter((p) => !have.has(p.name.toLowerCase()))
    .filter((p) => !q || p.name.toLowerCase().split(/[\s+]+/).some((word) => word.startsWith(q)) || p.name.toLowerCase().startsWith(q))
    .filter((p) => p.name.toLowerCase() !== q)
    .slice(0, limit);
}
