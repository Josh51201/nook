import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";

import { guarded } from "./feedback";
import { addDays, copyPlan, slot, type MealKey, type MenuKind, type MenuMeal } from "./menu-board";
import { localDay } from "./pets";
import { supabase } from "./supabase";

// Loads and saves the Menu Board (MENU-001..010). The menu belongs to the
// Home (MENU-002): row level security shows only your Home's meals.

const FIELDS = "id, home_id, day, meal, kind, title, recipe_id, position, created_by, created_at";

export type MenuWeek = { homeId: string; meals: MenuMeal[] };

async function myHome() {
  const { data, error } = await supabase.rpc("my_home");
  if (error) throw error;
  return data as string;
}

export async function loadMenu(from: string, days = 7): Promise<MenuWeek> {
  const homeId = await myHome();
  const { data, error } = await supabase
    .from("menu_meals")
    .select(FIELDS)
    .eq("home_id", homeId)
    .gte("day", from)
    .lte("day", addDays(from, days - 1))
    .order("day")
    .order("position")
    .order("created_at");
  if (error) throw error;
  return { homeId, meals: (data ?? []) as MenuMeal[] };
}

// A week of the menu for a screen: fresh when it comes into view, and live
// while it's open, so a meal planned on another phone shows up.
export function useMenu(userId: string | undefined, start: string) {
  const [data, setData] = useState<MenuWeek | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const startRef = useRef(start);
  startRef.current = start;

  const reload = useCallback(
    () =>
      userId
        ? guarded(
            async () => {
              const week = await loadMenu(start);
              if (startRef.current === start) setData(week);
              setError(null);
            },
            setError,
            () => setIsLoading(false)
          )
        : Promise.resolve(),
    [userId, start]
  );

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  const homeId = data?.homeId;
  useEffect(() => {
    if (!homeId) return;
    const channel = supabase
      .channel(`menu-${homeId}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "menu_meals", filter: `home_id=eq.${homeId}` }, () => void reload())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [homeId, reload]);

  return { data, error, isLoading, reload };
}

// For the Hearth (MENU-008): today and tomorrow, reloaded when the Hearth
// refreshes.
export function useMenuSummary(userId: string | undefined, refreshKey: number, days = 2) {
  const [data, setData] = useState<MenuWeek | null>(null);
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    loadMenu(localDay(), days)
      .then((next) => {
        if (!cancelled) setData(next);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [userId, refreshKey, days]);
  return data;
}

export type NewMeal = { day: string; meal: MealKey; kind: MenuKind; title: string; recipe_id?: string | null };

// Plan a meal (MENU-003, MENU-004). "Going out" and "On your own" replace
// whatever was planned; a dish replaces either of those, and otherwise
// goes after the dishes already there.
export async function planMeal(homeId: string, current: MenuMeal[], next: NewMeal) {
  const here = slot(current, next.day, next.meal);
  const replace = next.kind !== "dish" ? here : here.filter((r) => r.kind !== "dish");
  if (replace.length) {
    const { error } = await supabase.from("menu_meals").delete().in("id", replace.map((r) => r.id));
    if (error) return { error: error.message };
  }
  const position = next.kind === "dish" ? Math.max(-1, ...here.filter((r) => r.kind === "dish").map((r) => r.position)) + 1 : 0;
  const { error } = await supabase.from("menu_meals").insert({
    home_id: homeId,
    day: next.day,
    meal: next.meal,
    kind: next.kind,
    title: next.title.trim().slice(0, 80),
    recipe_id: next.kind === "dish" ? next.recipe_id ?? null : null,
    position,
  });
  return { error: error?.message ?? null };
}

export async function removeMeals(ids: string[]) {
  if (!ids.length) return { error: null };
  const { error } = await supabase.from("menu_meals").delete().in("id", ids);
  return { error: error?.message ?? null };
}

export async function renameMeal(id: string, title: string) {
  const { error } = await supabase.from("menu_meals").update({ title: title.trim().slice(0, 80) }).eq("id", id);
  return { error: error?.message ?? null };
}

// "Copy last week" (MENU-006): fills only meals still empty this week. A
// recipe nobody can open any more is copied as just its name.
export async function copyLastWeek(homeId: string, start: string, thisWeek: MenuMeal[]) {
  const { meals: last } = await loadMenu(addDays(start, -7));
  const rows = copyPlan(last, thisWeek);
  if (!rows.length) return { copied: 0, error: null };
  const { error } = await supabase.from("menu_meals").insert(rows.map((r) => ({ ...r, home_id: homeId })));
  if (error && /recipe/i.test(error.message)) {
    const { error: again } = await supabase.from("menu_meals").insert(rows.map((r) => ({ ...r, recipe_id: null, home_id: homeId })));
    return { copied: again ? 0 : rows.length, error: again?.message ?? null };
  }
  return { copied: error ? 0 : rows.length, error: error?.message ?? null };
}

// "Wipe the week" (MENU-006), like wiping the mat.
export async function wipeWeek(homeId: string, start: string) {
  const { error } = await supabase
    .from("menu_meals")
    .delete()
    .eq("home_id", homeId)
    .gte("day", start)
    .lte("day", addDays(start, 6));
  return { error: error?.message ?? null };
}
