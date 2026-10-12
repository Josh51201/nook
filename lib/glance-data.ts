import { nextBirthdays, type BirthdayPerson, type NextBirthday } from "./birthdays";
import { gatheringKindInfo } from "./gift-nook";
import { kindInfo, type Getaway } from "./getaways";
import { useHearthData } from "./hearth-data";
import { addDays, slot, slotWords } from "./menu-board";
import { loadMenu } from "./menu-board-data";
import { loadNewWishes, type NewWish } from "./new-wishes";
import { localDay } from "./pets";
import { hasRealName } from "./profile";
import { current } from "./subscriptions";
import { supabase } from "./supabase";
import { tripDayWords, type WeekEntry } from "./this-week";

// What Phase 2's Hearth widgets load (CORE-105..108): This week, Birthdays
// coming up, a Getaway, and New in Wishbooks. Each is remembered between
// Hearth pages like every other widget's data (CORE-104). A Nook someone
// doesn't use (no Home yet, no trips) just adds nothing.

// --- This week (CORE-105) -------------------------------------------------------------

const quietly = async (load: () => PromiseLike<WeekEntry[]>): Promise<WeekEntry[]> => {
  try {
    return await load();
  } catch {
    return [];
  }
};

const timeWords = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

export async function loadWeek(userId: string, today: string, days: number): Promise<WeekEntry[]> {
  const last = addDays(today, days - 1);
  const parts = await Promise.all([
    quietly(async () => {
      const { data } = await supabase
        .from("gatherings")
        .select("id, title, kind, starts_at, ends_at")
        .gt("ends_at", new Date().toISOString())
        .order("ends_at")
        .limit(40);
      return ((data ?? []) as { id: string; title: string; kind: string; starts_at: string | null; ends_at: string }[]).map((g) => ({
        day: localDay(new Date(g.starts_at ?? g.ends_at)),
        source: "gatherings" as const,
        title: g.title,
        detail: g.starts_at ? timeWords(g.starts_at) : null,
        icon: gatheringKindInfo(g.kind).icon,
        route: `/gatherings/${g.id}`,
      }));
    }),
    quietly(async () => {
      const birthdays = await loadBirthdayPeople(userId);
      return nextBirthdays(birthdays, new Date(), days).map((b) => ({
        day: b.day,
        source: "birthdays" as const,
        title: `${b.name}'s birthday`,
        detail: b.turning ? `Turns ${b.turning}` : null,
        icon: "birthday" as const,
        route: `/gift-nook/member/${b.profileId}`,
      }));
    }),
    quietly(async () => {
      const { data } = await supabase
        .from("getaways")
        .select("id, title, kind, starts_on, ends_on")
        .gte("ends_on", today)
        .lte("starts_on", last)
        .order("starts_on")
        .limit(10);
      return ((data ?? []) as Pick<Getaway, "id" | "title" | "kind" | "starts_on" | "ends_on">[]).map((g) => {
        const on = g.starts_on <= today;
        return {
          day: on ? today : g.starts_on,
          source: "trips" as const,
          title: g.title,
          detail: on ? tripDayWords(g.starts_on, g.ends_on, today) : "Trip starts",
          icon: kindInfo(g.kind).icon,
          route: `/getaways/${g.id}`,
        };
      });
    }),
    quietly(async () => {
      const { data } = await supabase.from("rhythms").select("id, title, due_on").not("due_on", "is", null).lte("due_on", last).limit(60);
      return ((data ?? []) as { id: string; title: string; due_on: string }[]).map((r) => ({
        day: r.due_on,
        source: "chores" as const,
        title: r.title,
        detail: r.due_on < today ? "Overdue" : null,
        icon: "rhythm" as const,
        route: `/rhythms/${r.id}`,
        overdue: r.due_on < today,
      }));
    }),
    quietly(async () => {
      const { data } = await supabase
        .from("pet_health")
        .select("id, pet_id, title, due_on, pets(name)")
        .not("due_on", "is", null)
        .lte("due_on", last)
        .limit(60);
      return ((data ?? []) as unknown as { pet_id: string; title: string; due_on: string; pets: { name: string } | null }[]).map((h) => ({
        day: h.due_on,
        source: "pets" as const,
        title: h.pets?.name ? `${h.pets.name}: ${h.title}` : h.title,
        detail: h.due_on < today ? "Overdue" : null,
        icon: "paw" as const,
        route: `/pets/${h.pet_id}`,
        overdue: h.due_on < today,
      }));
    }),
    quietly(async () => {
      const { data } = await supabase
        .from("subscriptions")
        .select("id, name, renews_on, on_trial, cycle")
        .eq("status", "active")
        .limit(100);
      return ((data ?? []) as { id: string; name: string; renews_on: string; on_trial: boolean; cycle: string }[])
        .map((s) => ({ ...s, ...current(s, today) }))
        .filter((s) => s.renews_on <= last)
        .map((s) => ({
          day: s.renews_on,
          source: "renewals" as const,
          title: s.name,
          detail: s.on_trial ? "Free trial ends" : "Renews",
          icon: s.on_trial ? ("warning" as const) : ("card" as const),
          route: `/subscriptions/${s.id}`,
        }));
    }),
    quietly(async () => {
      const menu = await loadMenu(today, days);
      return Array.from({ length: days }, (_, i) => addDays(today, i)).flatMap((day) => {
        const text = slotWords(slot(menu.meals, day, "dinner"));
        return text ? [{ day, source: "meals" as const, title: text, detail: "Dinner", icon: "potluck" as const, route: "/menu-board" }] : [];
      });
    }),
  ]);
  return parts.flat();
}

export function useWeekEntries(userId: string | undefined, refreshKey: number, days: number) {
  // The day is in the key, so it's fresh after midnight.
  const today = localDay();
  return useHearthData(userId ? `week:${userId}:${today}:${days}` : null, refreshKey, () =>
    loadWeek(userId!, today, days).then((entries) => ({ entries, today }))
  );
}

// --- Birthdays coming up (CORE-106) ---------------------------------------------------

// Everyone in your Burrows who's shared a birthday, but you.
async function loadBirthdayPeople(userId: string): Promise<BirthdayPerson[]> {
  const { data, error } = await supabase.from("burrow_members").select("burrow_id, profile_id, profiles(display_name, birthday)");
  if (error) throw error;
  return ((data ?? []) as unknown as { burrow_id: string; profile_id: string; profiles: { display_name: string | null; birthday: string | null } | null }[])
    .filter((m) => m.profile_id !== userId && m.profiles?.birthday && hasRealName(m.profiles.display_name))
    .map((m) => ({ burrowId: m.burrow_id, profileId: m.profile_id, name: m.profiles!.display_name!.trim(), birthday: m.profiles!.birthday! }));
}

// Each birthday, and its Birthday Gathering if one's been planned (GIFT-035).
export type BirthdayGlance = NextBirthday & { gatheringId: string | null };

export async function loadUpcomingBirthdays(userId: string, burrowId: string | null): Promise<BirthdayGlance[]> {
  const people = (await loadBirthdayPeople(userId)).filter((p) => !burrowId || p.burrowId === burrowId);
  const next = nextBirthdays(people, new Date(), 366);
  if (!next.length) return [];
  const { data } = await supabase
    .from("birthday_gatherings")
    .select("profile_id, year, gathering_id")
    .in("profile_id", next.map((b) => b.profileId))
    .in("year", [...new Set(next.map((b) => b.year))]);
  const planned = new Map(((data ?? []) as { profile_id: string; year: number; gathering_id: string | null }[]).map((r) => [`${r.profile_id}:${r.year}`, r.gathering_id]));
  return next.map((b) => ({ ...b, gatheringId: planned.get(`${b.profileId}:${b.year}`) ?? null }));
}

export function useUpcomingBirthdays(userId: string | undefined, refreshKey: number, burrowId: string | null) {
  const today = localDay();
  return useHearthData(userId ? `birthdays:${userId}:${today}:${burrowId ?? "all"}` : null, refreshKey, () => loadUpcomingBirthdays(userId!, burrowId));
}

// "Plan gifts" for a birthday: its Birthday Gathering, planned now if it
// isn't yet (the database plans up to a year ahead). Null if it can't be
// (say, it was planned and then deleted), so the caller can open their
// Wishbook instead.
export async function planBirthdayGifts(birthday: BirthdayGlance): Promise<string | null> {
  if (birthday.gatheringId) return birthday.gatheringId;
  const [y, m, d] = birthday.day.split("-").map(Number);
  for (const burrowId of birthday.burrowIds) {
    const { data, error } = await supabase.rpc("plan_birthday", {
      target_burrow: burrowId,
      target_profile: birthday.profileId,
      birthday_year: birthday.year,
      gathering_title: `${birthday.name}'s Birthday`,
      gathering_ends_at: new Date(y, m - 1, d, 23, 59, 59).toISOString(),
    });
    if (!error && data) return data as string;
  }
  // Planned already by someone else just now? Look it up.
  const { data } = await supabase
    .from("birthday_gatherings")
    .select("gathering_id")
    .eq("profile_id", birthday.profileId)
    .eq("year", birthday.year)
    .not("gathering_id", "is", null)
    .limit(1);
  return (data?.[0]?.gathering_id as string | undefined) ?? null;
}

// --- A Getaway (CORE-108) -------------------------------------------------------------

export type GetawayGlance = {
  trip: Pick<Getaway, "id" | "title" | "kind" | "place" | "starts_on" | "ends_on">;
  today: string;
  // Your packing list and the shared one (TRIP-003).
  packed: number;
  packTotal: number;
  // What's still to pack, oldest first.
  toPack: string[];
};

export async function loadGetawayGlance(userId: string, getawayId: string | null): Promise<GetawayGlance | null> {
  const today = localDay();
  let query = supabase.from("getaways").select("id, title, kind, place, starts_on, ends_on");
  query = getawayId ? query.eq("id", getawayId) : query.gte("ends_on", today);
  const { data: trips, error } = await query.order("starts_on").limit(1);
  if (error) throw error;
  const trip = trips?.[0] as GetawayGlance["trip"] | undefined;
  if (!trip) return null;
  const { data: items } = await supabase
    .from("getaway_items")
    .select("text, for_person, done_at, created_at")
    .eq("getaway_id", trip.id)
    .eq("kind", "pack")
    .order("created_at")
    .limit(500);
  const mine = ((items ?? []) as { text: string; for_person: string | null; done_at: string | null }[]).filter(
    (i) => i.for_person === null || i.for_person === userId
  );
  return {
    trip,
    today,
    packed: mine.filter((i) => i.done_at).length,
    packTotal: mine.length,
    toPack: mine.filter((i) => !i.done_at).map((i) => i.text),
  };
}

export function useGetawayGlance(userId: string | undefined, refreshKey: number, getawayId: string | null) {
  const today = localDay();
  // Wrapped, so "no trip" isn't mistaken for "still loading".
  return useHearthData(userId ? `getaway:${userId}:${today}:${getawayId ?? "next"}` : null, refreshKey, () =>
    loadGetawayGlance(userId!, getawayId).then((glance) => ({ glance }))
  );
}

// --- New in Wishbooks (CORE-107) ------------------------------------------------------

export function useNewWishes(userId: string | undefined, refreshKey: number, days: number) {
  const today = localDay();
  return useHearthData<NewWish[]>(userId ? `wishes:${userId}:${today}:${days}` : null, refreshKey, () =>
    loadNewWishes(supabase, userId!, days)
  );
}
