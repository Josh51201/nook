import { useEffect, useReducer } from "react";

import type { IconName } from "../components/icon";
import { useAuth } from "./auth-context";
import { supabase } from "./supabase";

// Your own profile (name, avatar, birthday, bio) — what family sees of you.
// One shared copy per signed-in person so the Hearth, Settings and the
// welcome screen always agree.

export type MyProfile = {
  id: string;
  display_name: string | null;
  avatar_icon: string | null;
  avatar_color: string | null;
  // A photo instead of the icon/initials (PROF-006): its storage path.
  avatar_path: string | null;
  birthday: string | null; // YYYY-MM-DD
  bio: string | null;
  onboarded_at: string | null;
};

export const PROFILE_SELECT = "id, display_name, avatar_icon, avatar_color, avatar_path, birthday, bio, onboarded_at";

// Avatar choices. `null` icon = the person's initials.
export const avatarIcons: IconName[] = [
  "paw",
  "leaf",
  "star",
  "moon",
  "sun",
  "flame",
  "coffee",
  "music",
  "sailboat",
  "cookie",
  "bike",
  "gamepad",
  "heart",
  "gift",
  "birthday",
  "christmas",
];

export const avatarColors = ["#8a5a3b", "#b0552d", "#9a7a1c", "#4f6b45", "#3b8a86", "#3f6a96", "#6a4f96", "#a3425f"];

export function initialsOf(name: string | null | undefined) {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!words.length || (name ?? "").includes("@")) return "?";
  return (words[0][0] + (words.length > 1 ? words[words.length - 1][0] : "")).toUpperCase();
}

// "Is this a real name?" New accounts have none; older ones used their email.
export function hasRealName(name: string | null | undefined) {
  const trimmed = (name ?? "").trim();
  return trimmed.length > 0 && !trimmed.includes("@");
}

// Birthdays are stored as YYYY-MM-DD with no time zone, so format them by hand.
export function toDateString(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseDateString(value: string) {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// "March 4" — family sees the day, not the year.
export function formatBirthday(value: string | null | undefined) {
  if (!value) return null;
  return parseDateString(value).toLocaleDateString(undefined, { month: "long", day: "numeric" });
}

// --- Shared store ------------------------------------------------------------

type Entry = { profile: MyProfile | null; error: string | null; loaded: boolean };
const cache = new Map<string, Entry>();
const inFlight = new Set<string>();
const listeners = new Map<string, Set<() => void>>();

function notify(userId: string) {
  listeners.get(userId)?.forEach((listener) => listener());
}

function load(userId: string) {
  if (inFlight.has(userId)) return;
  inFlight.add(userId);
  supabase
    .from("profiles")
    .select(PROFILE_SELECT)
    .eq("id", userId)
    .maybeSingle()
    .then(({ data, error }) => {
      inFlight.delete(userId);
      cache.set(userId, { profile: (data as MyProfile | null) ?? null, error: error?.message ?? null, loaded: true });
      notify(userId);
    });
}

export function useMyProfile() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [, rerender] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    if (!userId) return;
    const set = listeners.get(userId) ?? new Set();
    listeners.set(userId, set);
    set.add(rerender);
    if (!cache.has(userId)) load(userId);
    return () => {
      set.delete(rerender);
    };
  }, [userId]);

  const entry = userId ? cache.get(userId) : undefined;
  const profile = entry?.profile ?? null;

  return {
    profile,
    isLoading: Boolean(userId) && !entry?.loaded,
    error: entry?.error ?? null,
    // Not yet asked to set up a profile. If the profile can't be read at all
    // (e.g. the database update hasn't been run yet) we do NOT trap anyone on
    // the welcome screen.
    needsOnboarding: Boolean(profile) && !profile!.onboarded_at,
    reload: () => userId && load(userId),
    async save(changes: Partial<Omit<MyProfile, "id">>) {
      if (!userId) return { error: "Not signed in" };
      const { data, error } = await supabase
        .from("profiles")
        .update(changes)
        .eq("id", userId)
        .select(PROFILE_SELECT)
        .single();
      if (error) return { error: error.message };
      cache.set(userId, { profile: data as MyProfile, error: null, loaded: true });
      notify(userId);
      return { error: null };
    },
  };
}
