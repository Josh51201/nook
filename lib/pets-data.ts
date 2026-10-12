import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";

import { useAuth } from "./auth-context";
import { guarded } from "./feedback";
import { displayName } from "./gift-nook";
import { hungryMeal } from "./hearth-pet";
import { healthNeedingAttention, localDay, mealStatus, toTimeOfDay, type CareEntry, type HealthItem, type Meal } from "./pets";
import { supabase } from "./supabase";
import { useHearthData } from "./hearth-data";

// Loads the pets you look after (PET-001..007) with everything their screens
// need. Row level security decides what comes back: your Home's pets, plus
// any you're a helper for while your access lasts.

export type Helper = { pet_id: string; profile_id: string; until: string | null; added_at: string };

export type Pet = {
  id: string;
  home_id: string;
  name: string;
  species: string;
  breed: string | null;
  birthday: string | null;
  photo_path: string | null;
  microchip: string | null;
  vet_name: string | null;
  vet_phone: string | null;
  food: string | null;
  notes: string | null;
  tz: string;
  pet_meals: Meal[];
  pet_health: HealthItem[];
  pet_helpers: Helper[];
  // True for your Home's pets, false for pets you only help with.
  canEdit: boolean;
};

export type PetsData = {
  homeId: string | null;
  pets: Pet[];
  // Recent care across all your pets, newest first.
  log: (CareEntry & { pet_id: string })[];
  // Profile names for everyone in the log and helper lists.
  names: Map<string, string>;
  today: string;
};

export async function loadPets(userId: string): Promise<PetsData> {
  const { data: homeId } = await supabase.rpc("my_home");
  const since = new Date(Date.now() - 14 * 864e5).toISOString();

  const [petsResult, logResult] = await Promise.all([
    supabase.from("pets").select("*, pet_meals(*), pet_health(*), pet_helpers(*)").order("name"),
    supabase
      .from("pet_care_log")
      .select("id, pet_id, kind, meal_id, done_by, done_at, day, note")
      .gte("done_at", since)
      .order("done_at", { ascending: false })
      .limit(600),
  ]);
  if (petsResult.error) throw petsResult.error;
  if (logResult.error) throw logResult.error;

  const pets = ((petsResult.data ?? []) as Omit<Pet, "canEdit">[]).map((pet) => ({
    ...pet,
    canEdit: pet.home_id === homeId,
    pet_meals: [...pet.pet_meals].sort((a, b) => a.position - b.position),
  }));
  const log = (logResult.data ?? []) as PetsData["log"];

  const ids = new Set<string>([userId]);
  for (const entry of log) ids.add(entry.done_by);
  for (const pet of pets) for (const helper of pet.pet_helpers) ids.add(helper.profile_id);
  const { data: profiles } = await supabase.from("profiles").select("id, display_name").in("id", [...ids]);
  const names = new Map(
    ((profiles ?? []) as { id: string; display_name: string | null }[]).map((p) => [p.id, displayName(p)])
  );

  return { homeId: homeId ?? null, pets, log, names, today: localDay() };
}

// Your pets for a screen, fresh each time it comes into view.
export function usePets(userId: string | undefined) {
  const [data, setData] = useState<PetsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const reload = useCallback(
    () =>
      userId
        ? guarded(
            async () => {
              setData(await loadPets(userId));
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

  return { data, error, isLoading, reload };
}

// "You" for yourself, otherwise their name.
export function whoName(data: Pick<PetsData, "names">, id: string, userId: string | undefined) {
  return id === userId ? "You" : data.names.get(id) ?? "Someone";
}

// "8:05 AM" for today, "Yesterday 6:30 PM", or "Mon 6:30 PM".
export function whenWords(iso: string, now = new Date()) {
  const when = new Date(iso);
  const time = when.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(when)) / 86400000);
  if (days <= 0) return time;
  if (days === 1) return `Yesterday ${time}`;
  return `${when.toLocaleDateString(undefined, { weekday: "short" })} ${time}`;
}

// --- Photos (PET-006) ------------------------------------------------------------------

export async function uploadPetPhoto(petId: string, uri: string, mimeType?: string | null) {
  const type = mimeType && mimeType.startsWith("image/") ? mimeType : "image/jpeg";
  const extension = type === "image/png" ? "png" : type === "image/heic" ? "heic" : "jpg";
  const path = `${petId}/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
  const body = await (await fetch(uri)).arrayBuffer();
  const { error } = await supabase.storage.from("pets").upload(path, body, { contentType: type });
  if (error) throw error;
  return path;
}

export async function removePetPhoto(path: string | null) {
  if (path) await supabase.storage.from("pets").remove([path]);
}

export async function petPhotoUrls(paths: string[]) {
  const unique = [...new Set(paths.filter(Boolean))];
  if (!unique.length) return new Map<string, string>();
  const { data } = await supabase.storage.from("pets").createSignedUrls(unique, 3600);
  return new Map((data ?? []).filter((d) => d.signedUrl && d.path).map((d) => [d.path!, d.signedUrl as string]));
}

// --- Checking things off (PET-003, PET-005) -----------------------------------------------

// Feed a set meal. A meal can be fed once a day, so if someone else got
// there first the database says so and we tell them who.
export async function feedMeal(petId: string, mealId: string) {
  const { error } = await supabase
    .from("pet_care_log")
    .insert({ pet_id: petId, kind: "meal", meal_id: mealId, day: localDay() });
  return { error, alreadyFed: error?.code === "23505" };
}

export async function logCare(petId: string, kind: string, note?: string) {
  const { error } = await supabase
    .from("pet_care_log")
    .insert({ pet_id: petId, kind, day: localDay(), note: note?.trim() || null });
  return { error };
}

export async function undoCare(entryId: string) {
  const { error } = await supabase.from("pet_care_log").delete().eq("id", entryId);
  return { error };
}

// --- What the Hearth shows (PET-001) ------------------------------------------------------

export type PetsSummary = {
  pets: number;
  mealsTotal: number;
  // Meals still to feed today, in pet order.
  toFeed: { petId: string; pet: string; meal: string }[];
  // Vet visits, vaccines and meds due soon or overdue.
  due: { petId: string; pet: string; title: string; overdue: boolean }[];
};

export function usePetsSummary(userId: string | undefined, refreshKey: number) {
  // Remembered between Hearth pages, so a page you've seen shows at once (CORE-104).
  return useHearthData(userId ? `pets:${userId}` : null, refreshKey, () =>
    loadPets(userId!).then((data) => {
      const toFeed: PetsSummary["toFeed"] = [];
      const due: PetsSummary["due"] = [];
      let mealsTotal = 0;
      for (const pet of data.pets) {
        const status = mealStatus(pet.pet_meals, data.log.filter((l) => l.pet_id === pet.id), data.today);
        mealsTotal += status.length;
        for (const s of status) if (!s.fed) toFeed.push({ petId: pet.id, pet: pet.name, meal: s.meal.label });
        for (const item of healthNeedingAttention(pet.pet_health, data.today)) {
          due.push({ petId: pet.id, pet: pet.name, title: item.title, overdue: item.due_on! < data.today });
        }
      }
      return { pets: data.pets.length, mealsTotal, toFeed, due };
    }));
}

// --- The Hearth pet (CORE-048) --------------------------------------------------------------

// A pet's bed widget and the pet wandering out of it both want the same Pet
// Care pet, so one load is shared for a minute (or until the screen
// refreshes).
let shared: { userId: string; key: number; at: number; data: Promise<PetsData> } | null = null;
const photoCache = new Map<string, { url: string; at: number }>();

function loadPetsShared(userId: string, refreshKey: number) {
  if (!shared || shared.userId !== userId || shared.key !== refreshKey || Date.now() - shared.at > 60_000) {
    const data = loadPets(userId);
    shared = { userId, key: refreshKey, at: Date.now(), data };
    data.catch(() => {
      if (shared?.data === data) shared = null;
    });
  }
  return shared.data;
}

export type HearthPetInfo = {
  name: string;
  species: string;
  photoUrl: string | null;
  // A meal that's late (PET-003), or null.
  hungryFor: string | null;
};

// The Pet Care pet behind a Hearth pet, or null while loading, if it isn't
// linked, or if it's no longer yours to see.
export function useHearthPetInfo(petId: string | null, refreshKey: number) {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [info, setInfo] = useState<HearthPetInfo | null>(null);

  useEffect(() => {
    if (!userId || !petId) {
      setInfo(null);
      return;
    }
    let live = true;
    loadPetsShared(userId, refreshKey)
      .then(async (data) => {
        const pet = data.pets.find((p) => p.id === petId);
        if (!pet) return live && setInfo(null);
        let photoUrl: string | null = null;
        if (pet.photo_path) {
          const cached = photoCache.get(pet.photo_path);
          if (cached && Date.now() - cached.at < 50 * 60_000) photoUrl = cached.url;
          else {
            photoUrl = (await petPhotoUrls([pet.photo_path])).get(pet.photo_path) ?? null;
            if (photoUrl) photoCache.set(pet.photo_path, { url: photoUrl, at: Date.now() });
          }
        }
        const log = data.log.filter((entry) => entry.pet_id === pet.id);
        const hungryFor = hungryMeal(pet.pet_meals, log, localDay(), toTimeOfDay(new Date()));
        if (live) setInfo({ name: pet.name, species: pet.species, photoUrl, hungryFor });
      })
      .catch(() => live && setInfo(null));
    return () => {
      live = false;
    };
  }, [userId, petId, refreshKey]);

  return info;
}
