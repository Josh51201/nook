import type { IconName } from "../components/icon";

// Pet Care Nook (PET-001..007): pure helpers, no React or database, so
// they're unit-testable. Screens live in app/pets/, loading in lib/pets-data.ts.

export type Species = "dog" | "cat" | "bird" | "fish" | "rabbit" | "reptile" | "small" | "other";

export const speciesList: { key: Species; label: string }[] = [
  { key: "dog", label: "Dog" },
  { key: "cat", label: "Cat" },
  { key: "bird", label: "Bird" },
  { key: "fish", label: "Fish" },
  { key: "rabbit", label: "Rabbit" },
  { key: "reptile", label: "Reptile" },
  { key: "small", label: "Small pet" },
  { key: "other", label: "Other" },
];

export function speciesLabel(key: string) {
  return speciesList.find((s) => s.key === key)?.label ?? "Pet";
}

export type CareKind = "meal" | "walk" | "potty" | "litter" | "treat" | "other";

// Quick check-offs beyond meals (PET-005). Which fit which pet.
export const quickCare: {
  kind: Exclude<CareKind, "meal" | "other">;
  label: string;
  done: string;
  icon: IconName;
  species?: Species[];
}[] = [
  { kind: "walk", label: "Walk", done: "took a walk with", icon: "bike", species: ["dog"] },
  { kind: "potty", label: "Potty break", done: "took out", icon: "drop", species: ["dog"] },
  { kind: "litter", label: "Litter", done: "cleaned the litter for", icon: "leaf", species: ["cat", "rabbit", "small"] },
  { kind: "treat", label: "Treat", done: "gave a treat to", icon: "cookie" },
];

export function quickCareFor(species: string) {
  return quickCare.filter((q) => !q.species || q.species.includes(species as Species));
}

// "Sam gave breakfast", "Sam took out" — the pet's name goes after the verb.
export function careVerb(kind: string, mealLabel?: string | null) {
  if (kind === "meal") return mealLabel ? `gave ${mealLabel.toLowerCase()} to` : "fed";
  return quickCare.find((q) => q.kind === kind)?.done ?? "looked after";
}

// --- Days (the pet's own day, as the phone sees it) -------------------------------------

export function localDay(date = new Date()) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function phoneTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

// --- Meals (PET-003) ------------------------------------------------------------------

export type Meal = { id: string; label: string; remind_at: string | null; position: number };
export type CareEntry = {
  id: string;
  kind: string;
  meal_id: string | null;
  done_by: string;
  done_at: string;
  day: string;
  note: string | null;
};

// For each set meal: fed today, and by whom.
export function mealStatus(meals: Meal[], log: CareEntry[], day: string) {
  return [...meals]
    .sort((a, b) => a.position - b.position)
    .map((meal) => ({
      meal,
      fed: log.find((entry) => entry.kind === "meal" && entry.meal_id === meal.id && entry.day === day) ?? null,
    }));
}

// How many of today's meals are still to be fed.
export function mealsLeft(meals: Meal[], log: CareEntry[], day: string) {
  return mealStatus(meals, log, day).filter((m) => !m.fed).length;
}

// "7:30 AM" from a database time like "07:30:00".
export function formatTimeOfDay(time: string | null | undefined) {
  if (!time) return null;
  const [hour, minute] = time.split(":").map(Number);
  return new Date(2000, 0, 1, hour, minute).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function toTimeOfDay(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
}

export function timeOfDayToDate(time: string | null | undefined) {
  const [hour, minute] = (time ?? "09:00:00").split(":").map(Number);
  return new Date(2000, 0, 1, hour, minute);
}

// --- Vet, vaccines, meds (PET-004) ------------------------------------------------------

export type HealthKind = "vet" | "vaccine" | "medication" | "other";

export const healthKinds: { key: HealthKind; label: string; icon: IconName }[] = [
  { key: "vet", label: "Vet visit", icon: "place" },
  { key: "vaccine", label: "Vaccine", icon: "bolt" },
  { key: "medication", label: "Medication", icon: "pill" },
  { key: "other", label: "Other", icon: "star" },
];

export function healthKindInfo(key: string) {
  return healthKinds.find((k) => k.key === key) ?? healthKinds[healthKinds.length - 1];
}

export const repeatChoices: { days: number | null; label: string }[] = [
  { days: null, label: "Once" },
  { days: 1, label: "Daily" },
  { days: 7, label: "Weekly" },
  { days: 30, label: "Monthly" },
  { days: 90, label: "Every 3 months" },
  { days: 180, label: "Every 6 months" },
  { days: 365, label: "Yearly" },
];

export type HealthItem = {
  id: string;
  pet_id: string;
  kind: string;
  title: string;
  due_on: string | null;
  repeat_days: number | null;
  last_done_on: string | null;
  notes: string | null;
};

function dayNumber(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  return Math.round(new Date(y, m - 1, d).getTime() / 86400000);
}

// Days from `today` to the due day (negative = overdue).
export function daysToDue(dueOn: string, today: string) {
  return dayNumber(dueOn) - dayNumber(today);
}

export type DueState = "overdue" | "today" | "soon" | "later" | "none";

export function dueState(item: Pick<HealthItem, "due_on">, today: string): DueState {
  if (!item.due_on) return "none";
  const days = daysToDue(item.due_on, today);
  return days < 0 ? "overdue" : days === 0 ? "today" : days <= 14 ? "soon" : "later";
}

export function dueWords(item: Pick<HealthItem, "due_on">, today: string) {
  if (!item.due_on) return "No date set";
  const days = daysToDue(item.due_on, today);
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  if (days === -1) return "Due yesterday";
  if (days < 0) return `Overdue by ${-days} days`;
  if (days <= 60) return `Due in ${days} days`;
  const [y, m, d] = item.due_on.split("-").map(Number);
  return `Due ${new Date(y, m - 1, d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
}

// Soonest first; undated last.
export function sortHealth<T extends Pick<HealthItem, "due_on">>(items: T[]) {
  return [...items].sort((a, b) => {
    if (!a.due_on && !b.due_on) return 0;
    if (!a.due_on) return 1;
    if (!b.due_on) return -1;
    return a.due_on.localeCompare(b.due_on);
  });
}

// Items that need attention soon, for the Nook's headline.
export function healthNeedingAttention<T extends Pick<HealthItem, "due_on">>(items: T[], today: string) {
  return sortHealth(items).filter((item) => ["overdue", "today", "soon"].includes(dueState(item, today)));
}

// --- Helpers (PET-002) ----------------------------------------------------------------

// A helper has access up to and including their end day.
export function helperActive(until: string | null, today: string) {
  return !until || until >= today;
}

export function helperUntilWords(until: string | null, today: string) {
  if (!until) return "Until you remove them";
  const days = daysToDue(until, today);
  if (days < 0) return "Access ended";
  if (days === 0) return "Until the end of today";
  const [y, m, d] = until.split("-").map(Number);
  return `Until ${new Date(y, m - 1, d).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}
