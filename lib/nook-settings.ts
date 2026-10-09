import { useCallback, useEffect, useMemo, useReducer } from "react";

import { useAuth } from "./auth-context";
import { supabase } from "./supabase";

// Settings for the Hearth or one Nook, saved to the account
// (public.nook_settings) so they follow you across devices. Saved values
// are merged over `defaults`, so adding a new setting needs no migration.
//
// All screens share one in-memory copy per (user, nook), so a change made
// on one screen (e.g. adding a Nook from the Market) shows up immediately on
// another (the Hearth) without reloading.

type Saved = Record<string, unknown>;

const cache = new Map<string, Saved>();
const loadErrors = new Map<string, string>();
const loading = new Set<string>();
const listeners = new Map<string, Set<() => void>>();

function notify(key: string) {
  listeners.get(key)?.forEach((listener) => listener());
}

function load(key: string, userId: string, nook: string) {
  if (loading.has(key)) return;
  loading.add(key);
  loadErrors.delete(key);
  supabase
    .from("nook_settings")
    .select("settings")
    .eq("profile_id", userId)
    .eq("nook", nook)
    .maybeSingle()
    .then(({ data, error }) => {
      loading.delete(key);
      // On error, cache nothing: saving defaults over real settings after a
      // network blip would wipe someone's Hearth.
      if (error) loadErrors.set(key, error.message);
      else cache.set(key, (data?.settings as Saved) ?? {});
      notify(key);
    });
}

export function useNookSettings<T extends Saved>(nook: string, defaults: T) {
  const { session } = useAuth();
  const userId = session?.user.id;
  const key = userId ? `${userId}:${nook}` : null;
  const [, rerender] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    if (!key || !userId) return;
    const set = listeners.get(key) ?? new Set();
    listeners.set(key, set);
    set.add(rerender);
    if (!cache.has(key)) load(key, userId, nook);
    return () => {
      set.delete(rerender);
    };
  }, [key, userId, nook]);

  const saved = key ? cache.get(key) : undefined;
  const error = key ? loadErrors.get(key) ?? null : null;
  // `defaults` is a literal at each call site; recompute only when saved changes.
  const settings = useMemo(() => ({ ...defaults, ...saved }) as T, [saved]);

  const update = useCallback(
    async (changes: Partial<T>) => {
      if (!key || !userId || !cache.has(key)) return;
      const next = { ...cache.get(key), ...changes };
      cache.set(key, next);
      notify(key);
      const { error: saveError } = await supabase.from("nook_settings").upsert(
        { profile_id: userId, nook, settings: next, updated_at: new Date().toISOString() },
        { onConflict: "profile_id,nook" }
      );
      if (saveError) throw saveError;
    },
    [key, userId, nook]
  );

  const reload = useCallback(() => {
    if (key && userId) load(key, userId, nook);
  }, [key, userId, nook]);

  return { settings, update, reload, isLoading: !saved && !error, error };
}

// Gift Nook settings and their defaults. Provisional list pending Q-019.
// The notify* keys are also read by the database (public.wants_notification)
// — rename them in both places or not at all.
export const giftNookSettingDefaults = {
  hideTakenGifts: false,
  notifyGatheringSoon: true, // GIFT-029
  notifyGatheringNew: true, // someone plans a Gathering in your Burrow
  notifyNewGifts: true,
  notifyTuckChanged: true,
  notifyMemberJoined: true,
};

// Pet Care settings. The notify* keys are also read by the database
// (public.wants_pet_notice) — rename them in both places or not at all.
export const petSettingDefaults = {
  notifyMissed: true, // PET-007: a meal not fed by its time
  notifyDue: true, // PET-007: vet, vaccine and refill dates coming up
  notifyFed: false, // PET-007: someone fed a pet (off unless turned on)
};

// Rhythms settings. The notify* keys are also read by the database
// (public.wants_rhythm_notice) — rename them in both places or not at all.
export const rhythmSettingDefaults = {
  notifyHeadsUp: true, // RHY-007: a week before it's due
  notifyDueDay: true, // RHY-007: on the day
  notifyOverdue: true, // RHY-007: once it's overdue
  notifyDone: false, // RHY-007: someone did one (off unless turned on)
};

// Letterbox settings. notifyBirthdays is also read by the database
// (public.wants_letterbox_reminder) — rename it in both places or not at all.
export const letterboxSettingDefaults = {
  notifyBirthdays: true, // LET-010
};

// Potluck settings. The notify* keys are also read by the database
// (public.wants_potluck_reminder, public.wants_potluck_notice): rename them in
// both places or not at all. The chatty ones are off until you turn them on.
export const potluckSettingDefaults = {
  notifyReminder: true, // POT-007: the day before, for what you're bringing
  notifyNew: true, // a Potluck is planned in your Burrow
  notifyChanged: true, // its time, place or name changes (if you're going or bringing)
  notifyRsvps: false, // hosts: someone RSVPs
  notifyDishes: false, // hosts: someone picks a dish
};
