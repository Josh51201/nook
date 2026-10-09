import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";

import { guarded } from "./feedback";
import { displayName, PROFILE_FIELDS, type Profile } from "./gift-nook";
import { localDay } from "./pets";
import type { Person } from "./potluck";
import { RECIPE_FIELDS, recipeOfTheDay, type Recipe } from "./recipes";
import { supabase } from "./supabase";

// Loads recipes for the Recipe Box Nook (REC-001..012). Row level security
// decides what comes back: your own, plus family's from your Burrows that
// aren't "Just me" (REC-002/012).

export type FamilyRecipe = Recipe & { ownerName: string };

export type RecipeBox = {
  mine: Recipe[];
  family: FamilyRecipe[];
};

export async function loadRecipeBox(userId: string): Promise<RecipeBox> {
  const { data, error } = await supabase
    .from("recipes")
    .select(`${RECIPE_FIELDS}, profiles(display_name)`)
    .order("title")
    .limit(2000);
  if (error) throw error;
  const rows = (data ?? []) as unknown as (Recipe & { profiles: { display_name: string | null } | null })[];
  return {
    mine: rows.filter((r) => r.owner_id === userId),
    family: rows
      .filter((r) => r.owner_id !== userId)
      .map(({ profiles, ...r }) => ({ ...r, ownerName: displayName(profiles) })),
  };
}

export function useRecipeBox(userId: string | undefined) {
  const [box, setBox] = useState<RecipeBox | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const reload = useCallback(
    () =>
      userId
        ? guarded(
            async () => {
              setBox(await loadRecipeBox(userId));
              setError(null);
            },
            setError,
            () => setIsLoading(false)
          )
        : Promise.resolve(),
    [userId]
  );

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  return { box, error, isLoading, reload };
}

export async function loadRecipe(id: string) {
  const { data, error } = await supabase
    .from("recipes")
    .select(`${RECIPE_FIELDS}, profiles(display_name)`)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { profiles, ...recipe } = data as unknown as Recipe & { profiles: { display_name: string | null } | null };
  return { ...recipe, ownerName: displayName(profiles) } as FamilyRecipe;
}

// Everyone in your Burrows (and you), with their allergies and diets, for
// warnings (REC-010). Only family RLS already lets you see.
export async function loadFamilyNeeds(userId: string): Promise<Person[]> {
  const { data: members, error } = await supabase.from("burrow_members").select(`profile_id, profiles(${PROFILE_FIELDS})`);
  if (error) throw error;
  const profiles = new Map<string, Profile | null>();
  for (const m of (members ?? []) as unknown as { profile_id: string; profiles: Profile | null }[]) {
    profiles.set(m.profile_id, m.profiles);
  }
  if (!profiles.has(userId)) profiles.set(userId, null);
  const ids = [...profiles.keys()];
  const { data: needs } = await supabase.from("dietary_needs").select("profile_id, allergies, diets").in("profile_id", ids);
  return ((needs ?? []) as { profile_id: string; allergies: string[]; diets: string[] }[])
    .filter((row) => row.allergies.length || row.diets.length)
    .map((row) => ({
      id: row.profile_id,
      name: row.profile_id === userId ? "You" : displayName(profiles.get(row.profile_id) ?? null),
      allergies: row.allergies,
      diets: row.diets,
    }));
}

// --- Changes -------------------------------------------------------------------------

export type RecipeFields = Pick<
  Recipe,
  | "title"
  | "servings"
  | "prep_minutes"
  | "cook_minutes"
  | "ingredients"
  | "steps"
  | "notes"
  | "source_url"
  | "image_url"
  | "tags"
  | "shelves"
  | "private"
>;

export async function saveRecipe(fields: RecipeFields, id?: string) {
  const { data, error } = id
    ? await supabase.from("recipes").update(fields).eq("id", id).select("id").single()
    : await supabase.from("recipes").insert(fields).select("id").single();
  return { id: (data?.id as string | undefined) ?? id, error };
}

export async function deleteRecipe(id: string) {
  const { error } = await supabase.from("recipes").delete().eq("id", id);
  return { error };
}

// A copy of family's recipe in your own box (REC-002), yours to change.
// Nobody is told.
export async function saveCopy(recipe: FamilyRecipe) {
  const { data, error } = await supabase
    .from("recipes")
    .insert({
      title: recipe.title,
      servings: recipe.servings,
      prep_minutes: recipe.prep_minutes,
      cook_minutes: recipe.cook_minutes,
      ingredients: recipe.ingredients,
      steps: recipe.steps,
      notes: recipe.notes,
      source_url: recipe.source_url,
      image_url: recipe.image_url,
      tags: recipe.tags,
      shelves: recipe.shelves,
      from_name: recipe.from_name ?? recipe.ownerName,
      from_recipe_id: recipe.id,
    })
    .select("id")
    .single();
  return { id: data?.id as string | undefined, error };
}

export async function markMade(recipe: Pick<Recipe, "id" | "made_count">) {
  const { error } = await supabase
    .from("recipes")
    .update({ made_count: recipe.made_count + 1, last_made_at: new Date().toISOString() })
    .eq("id", recipe.id);
  return { error };
}

// --- What the Hearth shows (REC-011) ----------------------------------------------

export type RecipesSummary = {
  count: number;
  today: Pick<Recipe, "id" | "title" | "shelves" | "prep_minutes" | "cook_minutes" | "image_url" | "source_url"> | null;
  lastMade: Pick<Recipe, "id" | "title" | "last_made_at"> | null;
};

export async function loadRecipesSummary(userId: string, shelf: string | null): Promise<RecipesSummary> {
  const { data, error } = await supabase
    .from("recipes")
    .select("id, title, shelves, prep_minutes, cook_minutes, image_url, source_url, last_made_at")
    .eq("owner_id", userId)
    .limit(2000);
  if (error) throw error;
  const rows = (data ?? []) as Pick<Recipe, "id" | "title" | "shelves" | "prep_minutes" | "cook_minutes" | "image_url" | "source_url" | "last_made_at">[];
  const pool = shelf ? rows.filter((r) => r.shelves.includes(shelf)) : rows;
  const lastMade = rows
    .filter((r) => r.last_made_at)
    .sort((a, b) => b.last_made_at!.localeCompare(a.last_made_at!))[0] ?? null;
  return { count: rows.length, today: recipeOfTheDay(pool, localDay()), lastMade };
}

export function useRecipesSummary(userId: string | undefined, refreshKey: number, shelf: string | null = null) {
  const [summary, setSummary] = useState<RecipesSummary | null>(null);

  useEffect(() => {
    if (!userId) return;
    let live = true;
    loadRecipesSummary(userId, shelf)
      .then((s) => live && setSummary(s))
      .catch(() => live && setSummary(null));
    return () => {
      live = false;
    };
  }, [userId, refreshKey, shelf]);

  return summary;
}
