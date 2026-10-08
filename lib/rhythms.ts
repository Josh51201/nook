import type { IconName } from "../components/icon";
import { daysToDue, localDay } from "./pets";

// Rhythms Nook (RHY-001..008): pure helpers, no React or database, so
// they're unit-testable. Screens live in app/rhythms/, loading in
// lib/rhythms-data.ts.

export type Area = "heating" | "safety" | "indoors" | "outdoors" | "car" | "health" | "paperwork" | "other";

export const areas: { key: Area; label: string; icon: IconName }[] = [
  { key: "heating", label: "Heating & cooling", icon: "thermo" },
  { key: "safety", label: "Safety", icon: "shield" },
  { key: "indoors", label: "Around the house", icon: "tools" },
  { key: "outdoors", label: "Outdoors", icon: "tree" },
  { key: "car", label: "Car", icon: "car" },
  { key: "health", label: "Health", icon: "heart" },
  { key: "paperwork", label: "Paperwork", icon: "doc" },
  { key: "other", label: "Other", icon: "rhythm" },
];

export function areaInfo(key: string) {
  return areas.find((a) => a.key === key) ?? areas[areas.length - 1];
}

// RHY-004. Stored as months so "yearly" lands on the same day each year.
export const repeatChoices: { months: number | null; label: string; short: string }[] = [
  { months: 1, label: "Monthly", short: "every month" },
  { months: 3, label: "Every 3 months", short: "every 3 months" },
  { months: 6, label: "Every 6 months", short: "twice a year" },
  { months: 12, label: "Yearly", short: "every year" },
  { months: 24, label: "Every 2 years", short: "every 2 years" },
  { months: null, label: "Once", short: "just once" },
];

export function repeatWords(months: number | null) {
  return repeatChoices.find((c) => c.months === months)?.short ?? `every ${months} months`;
}

// --- Starter list (RHY-003) -------------------------------------------------------------

export type Starter = {
  title: string;
  area: Area;
  months: number | null;
  // The month (1–12) it usually falls in, if it has a season.
  season?: number;
};

export const starterRhythms: Starter[] = [
  { title: "Change the furnace filter", area: "heating", months: 3 },
  { title: "Service the furnace", area: "heating", months: 12, season: 9 },
  { title: "Service the air conditioner", area: "heating", months: 12, season: 4 },
  { title: "Clean the dryer vent", area: "heating", months: 12 },
  { title: "Test smoke & CO detectors", area: "safety", months: 1 },
  { title: "Replace smoke detector batteries", area: "safety", months: 12, season: 11 },
  { title: "Check the fire extinguisher", area: "safety", months: 12 },
  { title: "Restock the first-aid kit", area: "safety", months: 12 },
  { title: "Replace the fridge water filter", area: "indoors", months: 6 },
  { title: "Flush the water heater", area: "indoors", months: 12 },
  { title: "Clean the range hood filter", area: "indoors", months: 3 },
  { title: "Vacuum the fridge coils", area: "indoors", months: 12 },
  { title: "Clean the gutters", area: "outdoors", months: 6, season: 10 },
  { title: "Shut off outdoor faucets", area: "outdoors", months: 12, season: 10 },
  { title: "Service the lawn mower", area: "outdoors", months: 12, season: 3 },
  { title: "Seal the deck", area: "outdoors", months: 24, season: 5 },
  { title: "Renew car registration", area: "car", months: 12 },
  { title: "Oil change", area: "car", months: 6 },
  { title: "Rotate the tires", area: "car", months: 6 },
  { title: "Swap to winter tires", area: "car", months: 12, season: 11 },
  { title: "Flu shots", area: "health", months: 12, season: 10 },
  { title: "Dentist checkups", area: "health", months: 6 },
  { title: "Yearly physicals", area: "health", months: 12 },
  { title: "Eye exams", area: "health", months: 12 },
  { title: "File taxes", area: "paperwork", months: 12, season: 4 },
  { title: "Renew home insurance", area: "paperwork", months: 12 },
  { title: "Check credit reports", area: "paperwork", months: 12 },
  { title: "Review subscriptions", area: "paperwork", months: 6 },
];

function addDays(day: string, days: number) {
  const [y, m, d] = day.split("-").map(Number);
  return localDay(new Date(y, m - 1, d + days));
}

// A first guess at when a starter rhythm is next due, to be changed before
// saving: the start of its season if it has one (a week out if that's now),
// otherwise a few weeks from today.
export function suggestedDue(starter: Pick<Starter, "months" | "season">, today: string) {
  const [y, m] = today.split("-").map(Number);
  if (starter.season) {
    if (starter.season === m) return addDays(today, 7);
    const year = starter.season > m ? y : y + 1;
    return `${year}-${String(starter.season).padStart(2, "0")}-01`;
  }
  return addDays(today, starter.months === 1 ? 7 : 21);
}

// Starters not already in the Home (matched by name, ignoring case).
export function startersLeft(existingTitles: string[]) {
  const have = new Set(existingTitles.map((t) => t.trim().toLowerCase()));
  return starterRhythms.filter((s) => !have.has(s.title.toLowerCase()));
}

// --- Due dates (RHY-004) ----------------------------------------------------------------

export type Rhythm = {
  id: string;
  home_id: string;
  title: string;
  area: string;
  due_on: string | null;
  repeat_months: number | null;
  owner: string | null;
  notes: string | null;
  last_done_on: string | null;
  last_done_by: string | null;
};

export type DueState = "overdue" | "today" | "soon" | "later" | "none";

// "Soon" is the next two weeks.
export function rhythmState(rhythm: Pick<Rhythm, "due_on">, today: string): DueState {
  if (!rhythm.due_on) return "none";
  const days = daysToDue(rhythm.due_on, today);
  return days < 0 ? "overdue" : days === 0 ? "today" : days <= 14 ? "soon" : "later";
}

function formatDay(day: string, withYear: boolean) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(withYear ? { year: "numeric" } : {}),
  });
}

export function rhythmDueWords(rhythm: Pick<Rhythm, "due_on" | "last_done_on">, today: string) {
  if (!rhythm.due_on) return rhythm.last_done_on ? "Done" : "No date set";
  const days = daysToDue(rhythm.due_on, today);
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  if (days === -1) return "Due yesterday";
  if (days < 0) return days > -60 ? `Overdue by ${-days} days` : `Overdue since ${formatDay(rhythm.due_on, true)}`;
  if (days <= 21) return `Due in ${days} days`;
  return `Due ${formatDay(rhythm.due_on, rhythm.due_on.slice(0, 4) !== today.slice(0, 4))}`;
}

// "Last done March 2025", or "today" / "yesterday" when recent.
export function lastDoneWords(lastDoneOn: string | null, today: string) {
  if (!lastDoneOn) return "Not done here yet";
  const days = daysToDue(today, lastDoneOn);
  if (days === 0) return "Done today";
  if (days === 1) return "Done yesterday";
  if (days < 31) return `Done ${days} days ago`;
  const [y, m] = lastDoneOn.split("-").map(Number);
  return `Last done ${new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" })}`;
}

// Soonest first; undated (done one-offs) last, then by name.
export function sortRhythms<T extends Pick<Rhythm, "due_on" | "title">>(rhythms: T[]) {
  return [...rhythms].sort((a, b) => {
    if (a.due_on !== b.due_on) {
      if (!a.due_on) return 1;
      if (!b.due_on) return -1;
      return a.due_on.localeCompare(b.due_on);
    }
    return a.title.localeCompare(b.title);
  });
}

// The home screen's sections: overdue or due today, the next 30 days,
// later, and one-offs that are done.
export function groupRhythms<T extends Pick<Rhythm, "due_on" | "title">>(rhythms: T[], today: string) {
  const groups = { now: [] as T[], month: [] as T[], later: [] as T[], done: [] as T[] };
  for (const r of sortRhythms(rhythms)) {
    if (!r.due_on) groups.done.push(r);
    else if (r.due_on <= today) groups.now.push(r);
    else if (daysToDue(r.due_on, today) <= 30) groups.month.push(r);
    else groups.later.push(r);
  }
  return groups;
}

// --- The log (RHY-006) -------------------------------------------------------------------

export type RhythmEntry = {
  id: string;
  rhythm_id: string;
  done_by: string | null;
  done_on: string;
  note: string | null;
  created_at: string;
};

// A rhythm's history, newest first; only the first can be undone.
export function historyFor<T extends RhythmEntry>(log: T[], rhythmId: string) {
  return log
    .filter((e) => e.rhythm_id === rhythmId)
    .sort((a, b) => b.done_on.localeCompare(a.done_on) || b.created_at.localeCompare(a.created_at));
}

export function latestEntry<T extends RhythmEntry>(log: T[], rhythmId: string) {
  return [...log.filter((e) => e.rhythm_id === rhythmId)].sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;
}
