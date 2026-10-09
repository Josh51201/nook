import type { IconName } from "../components/icon";
import { daysToDue, localDay } from "./pets";

// Getaway Nook (TRIP-001..014): pure helpers, no React or database, so
// they're unit-testable. Screens live in app/getaways/, loading in
// lib/getaways-data.ts.

export type Kind = "beach" | "mountains" | "city" | "camping" | "family" | "road" | "cruise" | "park" | "other";

export const kinds: { key: Kind; label: string; icon: IconName }[] = [
  { key: "beach", label: "Beach", icon: "sun" },
  { key: "mountains", label: "Mountains", icon: "tree" },
  { key: "city", label: "City", icon: "globe" },
  { key: "camping", label: "Camping", icon: "flame" },
  { key: "family", label: "Visiting family", icon: "burrow" },
  { key: "road", label: "Road trip", icon: "car" },
  { key: "cruise", label: "Cruise", icon: "sailboat" },
  { key: "park", label: "Theme park", icon: "star" },
  { key: "other", label: "Other", icon: "plane" },
];

export function kindInfo(key: string) {
  return kinds.find((k) => k.key === key) ?? kinds[kinds.length - 1];
}

export type Getaway = {
  id: string;
  title: string;
  place: string | null;
  kind: string;
  starts_on: string;
  ends_on: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
};

export type Traveler = { getaway_id: string; profile_id: string; added_by: string | null };

export type Item = {
  id: string;
  getaway_id: string;
  kind: "pack" | "todo";
  text: string;
  for_person: string | null;
  due_on: string | null;
  done_at: string | null;
  done_by: string | null;
  created_at: string;
};

export type BookingKind = "flight" | "stay" | "car" | "train" | "event" | "other";

export type Booking = {
  id: string;
  getaway_id: string;
  kind: BookingKind;
  title: string;
  code: string | null;
  starts_on: string;
  starts_time: string | null;
  ends_on: string | null;
  ends_time: string | null;
  place: string | null;
  url: string | null;
  notes: string | null;
  created_at: string;
};

export type Plan = {
  id: string;
  getaway_id: string;
  on_day: string;
  at_time: string | null;
  title: string;
  place: string | null;
  notes: string | null;
  created_at: string;
};

export type Cost = {
  id: string;
  getaway_id: string;
  what: string;
  amount_cents: number;
  paid_by: string;
  split_among: string[];
  spent_on: string;
  is_payback: boolean;
  created_at: string;
};

export type PackList = { id: string; name: string; items: string[] };

// --- Dates (TRIP-001, TRIP-010) -------------------------------------------------------------

function parts(day: string) {
  return day.split("-").map(Number) as [number, number, number];
}

export function addDays(day: string, days: number) {
  const [y, m, d] = parts(day);
  return localDay(new Date(y, m - 1, d + days));
}

function shortDay(day: string, withYear = false) {
  const [y, m, d] = parts(day);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: "short", day: "numeric", ...(withYear ? { year: "numeric" } : {}) });
}

export function weekdayWords(day: string) {
  const [y, m, d] = parts(day);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

// "Oct 20 – 27", "Oct 30 – Nov 2", "Dec 30, 2026 – Jan 2, 2027", "Oct 20".
export function rangeWords(startsOn: string, endsOn: string, today = localDay()) {
  if (startsOn === endsOn) return shortDay(startsOn, startsOn.slice(0, 4) !== today.slice(0, 4));
  const sameYear = startsOn.slice(0, 4) === endsOn.slice(0, 4);
  const showYear = !sameYear || startsOn.slice(0, 4) !== today.slice(0, 4);
  if (sameYear && startsOn.slice(5, 7) === endsOn.slice(5, 7)) {
    return `${shortDay(startsOn)} – ${parts(endsOn)[2]}${showYear ? `, ${endsOn.slice(0, 4)}` : ""}`;
  }
  return `${shortDay(startsOn, showYear)} – ${shortDay(endsOn, showYear)}`;
}

export function tripDays(g: Pick<Getaway, "starts_on" | "ends_on">) {
  return daysToDue(g.ends_on, g.starts_on) + 1;
}

export type TripState = "upcoming" | "now" | "past";

export function tripState(g: Pick<Getaway, "starts_on" | "ends_on">, today: string): TripState {
  if (today < g.starts_on) return "upcoming";
  if (today > g.ends_on) return "past";
  return "now";
}

// "In 12 days", "Tomorrow", "Starts today", "Day 3 of 7", "Ended yesterday".
export function whenWords(g: Pick<Getaway, "starts_on" | "ends_on">, today: string) {
  const state = tripState(g, today);
  if (state === "upcoming") {
    const days = daysToDue(g.starts_on, today);
    return days === 1 ? "Tomorrow" : `In ${days} days`;
  }
  if (state === "now") {
    if (today === g.starts_on) return "Starts today";
    return `Day ${daysToDue(today, g.starts_on) + 1} of ${tripDays(g)}`;
  }
  const ago = daysToDue(today, g.ends_on);
  return ago === 1 ? "Ended yesterday" : `Ended ${shortDay(g.ends_on, g.ends_on.slice(0, 4) !== today.slice(0, 4))}`;
}

// Happening now, coming up (soonest first), and past (latest first).
export function groupGetaways<T extends Pick<Getaway, "starts_on" | "ends_on" | "title">>(trips: T[], today: string) {
  const groups = { now: [] as T[], upcoming: [] as T[], past: [] as T[] };
  for (const t of trips) groups[tripState(t, today) === "now" ? "now" : tripState(t, today)].push(t);
  const soonest = (a: T, b: T) => a.starts_on.localeCompare(b.starts_on) || a.title.localeCompare(b.title);
  groups.now.sort(soonest);
  groups.upcoming.sort(soonest);
  groups.past.sort((a, b) => b.ends_on.localeCompare(a.ends_on));
  return groups;
}

// The one to count down to: one happening now, else the next.
export function nextGetaway<T extends Pick<Getaway, "starts_on" | "ends_on" | "title">>(trips: T[], today: string) {
  const groups = groupGetaways(trips, today);
  return groups.now[0] ?? groups.upcoming[0] ?? null;
}

// --- Packing (TRIP-003) -------------------------------------------------------------------

// Whose list: a person's id, or "shared".
export type ListOwner = string | "shared";

export function packingFor<T extends Pick<Item, "kind" | "for_person" | "created_at">>(items: T[], owner: ListOwner) {
  return items
    .filter((i) => i.kind === "pack" && (owner === "shared" ? i.for_person === null : i.for_person === owner))
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

// Packed out of how many: one list, or (no owner) what's yours plus the
// shared list.
export function packProgress(items: Pick<Item, "kind" | "for_person" | "done_at">[], owner?: ListOwner) {
  const lines = items.filter(
    (i) =>
      i.kind === "pack" &&
      (owner === undefined ? true : owner === "shared" ? i.for_person === null : i.for_person === owner)
  );
  return { done: lines.filter((i) => i.done_at).length, total: lines.length };
}

// What's left for one person to pack: their list and the shared one.
export function leftToPack(items: Pick<Item, "kind" | "for_person" | "done_at">[], person: string) {
  return items.filter((i) => i.kind === "pack" && !i.done_at && (i.for_person === null || i.for_person === person)).length;
}

// Lines from a saved list that aren't already on this one (ignoring case).
export function newLines(existing: string[], incoming: string[]) {
  const have = new Set(existing.map((t) => t.trim().toLowerCase()));
  const out: string[] = [];
  for (const raw of incoming) {
    const text = raw.trim().slice(0, 100);
    if (!text || have.has(text.toLowerCase())) continue;
    have.add(text.toLowerCase());
    out.push(text);
  }
  return out;
}

// TRIP-008: ready-made lists to start from. Wording is Claude's (proposed).
export const builtInLists: { name: string; icon: IconName; items: string[] }[] = [
  {
    name: "The basics",
    icon: "clothes",
    items: ["Shirts", "Pants or shorts", "Underwear", "Socks", "Pajamas", "Jacket", "Shoes", "Phone charger", "Medicine", "Glasses or contacts"],
  },
  {
    name: "Toiletries",
    icon: "drop",
    items: ["Toothbrush", "Toothpaste", "Deodorant", "Shampoo", "Hairbrush", "Razor", "Sunscreen", "Lip balm"],
  },
  {
    name: "Beach",
    icon: "sun",
    items: ["Swimsuit", "Beach towel", "Sunscreen", "Sunglasses", "Sun hat", "Flip-flops", "Beach bag", "Water bottles", "Snacks", "Beach toys"],
  },
  {
    name: "Camping",
    icon: "flame",
    items: ["Tent", "Sleeping bags", "Pillows", "Flashlight", "Lantern", "Camp chairs", "Cooler", "Matches or lighter", "Bug spray", "First-aid kit", "Cookware", "Rain jackets"],
  },
  {
    name: "Flying",
    icon: "plane",
    items: ["IDs / passports", "Boarding passes", "Headphones", "Neck pillow", "Snacks", "Empty water bottle", "Tablet & shows downloaded", "Pen"],
  },
  {
    name: "Little ones",
    icon: "baby",
    items: ["Diapers", "Wipes", "Bottles", "Formula or snacks", "Pacifier", "Favorite stuffed animal", "Stroller", "Car seat", "Night light", "Change of clothes in the carry-on"],
  },
  {
    name: "Road trip",
    icon: "car",
    items: ["Snacks", "Drinks", "Car charger", "Phone mount", "Playlist or audiobook", "Trash bags", "Paper towels", "Blanket", "Car games"],
  },
];

// --- Before you go (TRIP-006) ------------------------------------------------------------

// Not done first (soonest do-by date, then undated), then done.
export function sortTodos<T extends Pick<Item, "due_on" | "done_at" | "created_at">>(todos: T[]) {
  return [...todos].sort((a, b) => {
    if (!!a.done_at !== !!b.done_at) return a.done_at ? 1 : -1;
    if (a.due_on !== b.due_on) {
      if (!a.due_on) return 1;
      if (!b.due_on) return -1;
      return a.due_on.localeCompare(b.due_on);
    }
    return a.created_at.localeCompare(b.created_at);
  });
}

export function dueWords(dueOn: string | null, today: string) {
  if (!dueOn) return null;
  const days = daysToDue(dueOn, today);
  if (days === 0) return "Do today";
  if (days === 1) return "Do by tomorrow";
  if (days < 0) return days === -1 ? "Was due yesterday" : `Was due ${shortDay(dueOn)}`;
  if (days <= 6) return `Do in ${days} days`;
  return `Do by ${shortDay(dueOn, dueOn.slice(0, 4) !== today.slice(0, 4))}`;
}

// Common ones, offered as one-tap ideas, with how many days before you
// leave they're worth doing. Wording is Claude's (proposed).
export const todoIdeas: { text: string; daysBefore: number }[] = [
  { text: "Book the pet sitter", daysBefore: 21 },
  { text: "Hold the mail", daysBefore: 7 },
  { text: "Ask a neighbor to keep an eye out", daysBefore: 7 },
  { text: "Check passports and IDs", daysBefore: 30 },
  { text: "Refill prescriptions", daysBefore: 7 },
  { text: "Pay bills that come due while we're away", daysBefore: 5 },
  { text: "Arrange plant watering", daysBefore: 5 },
  { text: "Tell the bank we're traveling", daysBefore: 3 },
  { text: "Download maps and shows", daysBefore: 1 },
  { text: "Charge everything", daysBefore: 1 },
  { text: "Take out the trash", daysBefore: 0 },
  { text: "Turn down the heat or AC", daysBefore: 0 },
];

// An idea's do-by date: that many days before the trip, but not in the past.
export function ideaDue(daysBefore: number, startsOn: string, today: string) {
  const day = addDays(startsOn, -daysBefore);
  return day < today ? today : day;
}

// --- Confirmations and the day-by-day plan (TRIP-004, TRIP-005) -------------------------------

export const bookingKinds: { key: BookingKind; label: string; icon: IconName; start: string; end: string }[] = [
  { key: "flight", label: "Flight", icon: "plane", start: "Departs", end: "Arrives" },
  { key: "stay", label: "Place to stay", icon: "bed", start: "Check in", end: "Check out" },
  { key: "car", label: "Rental car", icon: "car", start: "Pick up", end: "Drop off" },
  { key: "train", label: "Train or bus", icon: "train", start: "Departs", end: "Arrives" },
  { key: "event", label: "Tickets", icon: "star", start: "Starts", end: "Ends" },
  { key: "other", label: "Other", icon: "doc", start: "Starts", end: "Ends" },
];

export function bookingInfo(key: string) {
  return bookingKinds.find((k) => k.key === key) ?? bookingKinds[bookingKinds.length - 1];
}

// "14:30:00" → "2:30 PM".
export function timeWords(time: string | null) {
  if (!time) return null;
  const [h, m] = time.split(":").map(Number);
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

export type DayEntry = {
  key: string;
  time: string | null;
  title: string;
  sub: string | null;
  icon: IconName;
  // What to open: a confirmation or a plan.
  bookingId?: string;
  planId?: string;
};

export type ItineraryDay = { day: string; label: string; entries: DayEntry[] };

// Every day of the trip (plus any day outside it that has something on),
// each with its confirmations and plans in time order; all-day ones first.
export function itinerary(
  trip: Pick<Getaway, "starts_on" | "ends_on">,
  bookings: Booking[],
  plans: Plan[]
): ItineraryDay[] {
  const byDay = new Map<string, DayEntry[]>();
  const add = (day: string, entry: DayEntry) => byDay.set(day, [...(byDay.get(day) ?? []), entry]);

  for (const b of bookings) {
    const info = bookingInfo(b.kind);
    const twoEnds = b.ends_on && (b.ends_on !== b.starts_on || b.kind === "stay" || b.kind === "car");
    add(b.starts_on, {
      key: `${b.id}-start`,
      time: b.starts_time,
      title: twoEnds ? `${info.start}: ${b.title}` : b.title,
      sub: [b.code ? `Confirmation ${b.code}` : null, b.place].filter(Boolean).join(" · ") || null,
      icon: info.icon,
      bookingId: b.id,
    });
    if (b.ends_on && twoEnds) {
      add(b.ends_on, { key: `${b.id}-end`, time: b.ends_time, title: `${info.end}: ${b.title}`, sub: null, icon: info.icon, bookingId: b.id });
    }
  }
  for (const p of plans) {
    add(p.on_day, { key: p.id, time: p.at_time, title: p.title, sub: p.place, icon: "place", planId: p.id });
  }

  const days = new Set(byDay.keys());
  for (let d = trip.starts_on; d <= trip.ends_on; d = addDays(d, 1)) days.add(d);

  return [...days].sort().map((day) => {
    const inTrip = day >= trip.starts_on && day <= trip.ends_on;
    const label = inTrip
      ? `Day ${daysToDue(day, trip.starts_on) + 1} · ${weekdayWords(day)}`
      : `${day < trip.starts_on ? "Before" : "After"} · ${weekdayWords(day)}`;
    const entries = (byDay.get(day) ?? []).sort((a, b) => {
      if (a.time === b.time) return a.title.localeCompare(b.title);
      if (!a.time) return -1;
      if (!b.time) return 1;
      return a.time.localeCompare(b.time);
    });
    return { day, label, entries };
  });
}

// --- Shared costs (TRIP-009) ---------------------------------------------------------------

// Each person's share of one cost, in cents, adding up exactly: any
// leftover cents go to the first people in the split.
export function shares(cost: Pick<Cost, "amount_cents" | "split_among">) {
  const people = [...new Set(cost.split_among)];
  const base = Math.floor(cost.amount_cents / people.length);
  const extra = cost.amount_cents - base * people.length;
  return new Map(people.map((p, i) => [p, base + (i < extra ? 1 : 0)]));
}

// Where everyone stands: positive means they're owed, negative means they
// owe. `coveredBy` hands a kid's share to the grown-up who covers it.
export function balances(costs: Pick<Cost, "amount_cents" | "split_among" | "paid_by">[], coveredBy?: Map<string, string>) {
  const out = new Map<string, number>();
  const bump = (person: string, cents: number) => {
    const who = coveredBy?.get(person) ?? person;
    out.set(who, (out.get(who) ?? 0) + cents);
  };
  for (const c of costs) {
    bump(c.paid_by, c.amount_cents);
    for (const [person, share] of shares(c)) bump(person, -share);
  }
  return out;
}

export type Transfer = { from: string; to: string; cents: number };

// The fewest paybacks that settle everyone up: whoever owes most pays
// whoever's owed most, and so on.
export function settleUp(balance: Map<string, number>): Transfer[] {
  const owes = [...balance].filter(([, c]) => c < 0).map(([p, c]) => ({ p, c: -c }));
  const owed = [...balance].filter(([, c]) => c > 0).map(([p, c]) => ({ p, c }));
  const transfers: Transfer[] = [];
  const biggest = (list: { p: string; c: number }[]) => list.sort((a, b) => b.c - a.c || a.p.localeCompare(b.p));
  while (owes.length && owed.length) {
    biggest(owes);
    biggest(owed);
    const from = owes[0];
    const to = owed[0];
    const cents = Math.min(from.c, to.c);
    transfers.push({ from: from.p, to: to.p, cents });
    from.c -= cents;
    to.c -= cents;
    if (!from.c) owes.shift();
    if (!to.c) owed.shift();
  }
  return transfers;
}

// What the trip cost, not counting paybacks.
export function totalSpent(costs: Pick<Cost, "amount_cents" | "is_payback">[]) {
  return costs.reduce((sum, c) => sum + (c.is_payback ? 0 : c.amount_cents), 0);
}
