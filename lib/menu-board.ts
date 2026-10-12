import type { IconName } from "../components/icon";
import { localDay } from "./pets";

// Menu Board Nook (MENU-001..010): the Home's menu for the week, like the
// wipe-off menu mat on the fridge. Each day has breakfast, lunch and
// dinner; a meal holds a dish or two (maybe from the Recipe Box), or says
// "Going out" or "On your own". Pure (no React/Supabase), so it's
// unit-testable; loading and saving is in menu-board-data.ts.

export type MealKey = "breakfast" | "lunch" | "dinner";
export type MenuKind = "dish" | "out" | "own";

export type MenuMeal = {
  id: string;
  home_id: string;
  day: string;
  meal: MealKey;
  kind: MenuKind;
  title: string;
  recipe_id: string | null;
  position: number;
  created_by: string | null;
  created_at: string;
};

export const mealTimes: { key: MealKey; label: string; icon: IconName }[] = [
  { key: "breakfast", label: "Breakfast", icon: "coffee" },
  { key: "lunch", label: "Lunch", icon: "food" },
  { key: "dinner", label: "Dinner", icon: "potluck" },
];

export function mealLabel(key: string) {
  return mealTimes.find((m) => m.key === key)?.label ?? key;
}

// A few dishes in one meal is plenty (tacos, rice, beans…).
export const MAX_DISHES = 6;

// --- Days and weeks ---------------------------------------------------------------
// Days are "YYYY-MM-DD" in the phone's time zone; noon keeps daylight
// saving from nudging a day over.

const noon = (day: string) => new Date(`${day}T12:00:00`);

export function addDays(day: string, days: number) {
  const date = noon(day);
  date.setDate(date.getDate() + days);
  return localDay(date);
}

// The first day of the week `day` is in. `startsOn` is 0 for Sunday, 1 for
// Monday (MENU-001's setting).
export function weekStart(day: string, startsOn: 0 | 1) {
  const back = (noon(day).getDay() - startsOn + 7) % 7;
  return addDays(day, -back);
}

export function weekDays(start: string) {
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

// "Today", "Tomorrow", else "Wednesday".
export function dayWords(day: string, today = localDay()) {
  if (day === today) return "Today";
  if (day === addDays(today, 1)) return "Tomorrow";
  if (day === addDays(today, -1)) return "Yesterday";
  return noon(day).toLocaleDateString(undefined, { weekday: "long" });
}

// "Dec 8"
export function shortDate(day: string) {
  return noon(day).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// "This week", "Next week", "Last week", else "Dec 7 – Dec 13".
export function weekWords(start: string, today: string, startsOn: 0 | 1) {
  const current = weekStart(today, startsOn);
  if (start === current) return "This week";
  if (start === addDays(current, 7)) return "Next week";
  if (start === addDays(current, -7)) return "Last week";
  return `${shortDate(start)} – ${shortDate(addDays(start, 6))}`;
}

// --- Meals -------------------------------------------------------------------------

// What's planned for one meal, in order.
export function slot<T extends Pick<MenuMeal, "day" | "meal" | "position" | "created_at">>(rows: T[], day: string, meal: MealKey): T[] {
  return rows
    .filter((r) => r.day === day && r.meal === meal)
    .sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at));
}

// How a meal reads on the board: "Tacos, Rice", "Going out · Pizza Hut",
// "On your own", or "" with nothing planned. Going out or On your own wins
// over dishes (the screens never leave both, but just in case).
export function slotWords(rows: Pick<MenuMeal, "kind" | "title">[]) {
  const out = rows.find((r) => r.kind === "out");
  if (out) return out.title.trim() ? `Going out · ${out.title.trim()}` : "Going out";
  if (rows.some((r) => r.kind === "own")) return "On your own";
  return rows
    .filter((r) => r.kind === "dish")
    .map((r) => r.title.trim())
    .join(", ");
}

export function slotKind(rows: Pick<MenuMeal, "kind">[]): MenuKind | null {
  if (rows.some((r) => r.kind === "out")) return "out";
  if (rows.some((r) => r.kind === "own")) return "own";
  return rows.length ? "dish" : null;
}

// How many of the week's shown meals have something planned.
export function plannedCount(rows: Pick<MenuMeal, "day" | "meal">[], days: string[], shown: MealKey[]) {
  const filled = new Set(rows.map((r) => `${r.day}|${r.meal}`));
  let count = 0;
  for (const day of days) for (const meal of shown) if (filled.has(`${day}|${meal}`)) count++;
  return count;
}

// "Copy last week" (MENU-006): last week's meals moved on 7 days, but only
// into meals this week that are still empty, so nothing planned is lost.
export function copyPlan<T extends Pick<MenuMeal, "day" | "meal" | "kind" | "title" | "recipe_id" | "position">>(
  lastWeek: T[],
  thisWeek: Pick<MenuMeal, "day" | "meal">[]
) {
  const filled = new Set(thisWeek.map((r) => `${r.day}|${r.meal}`));
  return lastWeek
    .map((r) => ({ day: addDays(r.day, 7), meal: r.meal, kind: r.kind, title: r.title, recipe_id: r.recipe_id, position: r.position }))
    .filter((r) => !filled.has(`${r.day}|${r.meal}`));
}

// Every recipe on the menu, once each, in the order they come up
// ("Shop for this week", MENU-005).
export function recipesOnMenu(rows: Pick<MenuMeal, "day" | "meal" | "kind" | "recipe_id" | "position" | "created_at">[]) {
  const order: Record<MealKey, number> = { breakfast: 0, lunch: 1, dinner: 2 };
  const sorted = [...rows].sort(
    (a, b) => a.day.localeCompare(b.day) || order[a.meal] - order[b.meal] || a.position - b.position || a.created_at.localeCompare(b.created_at)
  );
  const ids: string[] = [];
  for (const r of sorted) if (r.kind === "dish" && r.recipe_id && !ids.includes(r.recipe_id)) ids.push(r.recipe_id);
  return ids;
}

// Dishes typed without a recipe, once each (they can still go on the
// grocery list as a reminder).
export function dishesWithoutRecipe(rows: Pick<MenuMeal, "kind" | "title" | "recipe_id">[]) {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const r of rows) {
    const name = r.title.trim();
    if (r.kind !== "dish" || r.recipe_id || !name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    names.push(name);
  }
  return names;
}

// The meal coming up next today: dinner after lunchtime, and so on. Used by
// the hero and the Hearth tile ("Tonight: Tacos").
export function nextMeal(shown: MealKey[], hour: number): MealKey | null {
  if (!shown.length) return null;
  const want: MealKey = hour < 10 ? "breakfast" : hour < 14 ? "lunch" : "dinner";
  const order: MealKey[] = ["breakfast", "lunch", "dinner"];
  return order.slice(order.indexOf(want)).find((m) => shown.includes(m)) ?? null;
}

export function mealHeadline(meal: MealKey, words: string) {
  const when = meal === "dinner" ? "Tonight" : meal === "lunch" ? "Lunch" : "Breakfast";
  return words ? `${when}: ${words}` : `Nothing planned for ${meal === "dinner" ? "tonight" : meal}`;
}
