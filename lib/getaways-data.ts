import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";

import { guarded } from "./feedback";
import { displayName, PROFILE_FIELDS, type Profile } from "./gift-nook";
import {
  leftToPack,
  nextGetaway,
  type Booking,
  type Cost,
  type Getaway,
  type Item,
  type PackList,
  type Plan,
  type Transfer,
  type Traveler,
} from "./getaways";
import { localDay, phoneTimeZone } from "./pets";
import { supabase } from "./supabase";

// Loads Getaways (TRIP-001..014). Row level security means only the ones
// you're going on come back.

const ITEM_FIELDS = "id, getaway_id, kind, text, for_person, due_on, done_at, done_by, created_at";

async function profilesFor(ids: Iterable<string>) {
  const list = [...new Set(ids)];
  if (!list.length) return new Map<string, Profile>();
  const { data } = await supabase.from("profiles").select(PROFILE_FIELDS).in("id", list);
  return new Map(((data ?? []) as Profile[]).map((p) => [p.id, p]));
}

// --- Your Getaways ---------------------------------------------------------------------------

export type GetawaysData = {
  trips: Getaway[];
  travelers: Traveler[];
  // Just enough of every list to show progress.
  items: Pick<Item, "id" | "getaway_id" | "kind" | "for_person" | "done_at" | "due_on">[];
  profiles: Map<string, Profile>;
  today: string;
};

export async function loadGetaways(): Promise<GetawaysData> {
  const { data: tripRows, error } = await supabase.from("getaways").select("*").order("starts_on");
  if (error) throw error;
  const trips = (tripRows ?? []) as Getaway[];
  const ids = trips.map((t) => t.id);
  const [peopleResult, itemsResult] = ids.length
    ? await Promise.all([
        supabase.from("getaway_people").select("getaway_id, profile_id, added_by").in("getaway_id", ids),
        supabase.from("getaway_items").select("id, getaway_id, kind, for_person, done_at, due_on").in("getaway_id", ids).limit(5000),
      ])
    : [{ data: [] }, { data: [] }];
  const travelers = (peopleResult.data ?? []) as Traveler[];
  const profiles = await profilesFor(travelers.map((t) => t.profile_id));
  return { trips, travelers, items: (itemsResult.data ?? []) as GetawaysData["items"], profiles, today: localDay() };
}

function useLoader<T>(load: () => Promise<T>, deps: unknown[], enabled: boolean) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const reload = useCallback(
    () =>
      enabled
        ? guarded(
            async () => {
              setData(await load());
              setError(null);
            },
            setError,
            () => setIsLoading(false)
          )
        : Promise.resolve(),
    deps
  );

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  return { data, error, isLoading, reload };
}

export function useGetaways(userId: string | undefined) {
  return useLoader(loadGetaways, [userId], !!userId);
}

// --- One Getaway -------------------------------------------------------------------------------

export type GetawayData = {
  trip: Getaway;
  // Everyone going, you first.
  people: Profile[];
  items: Item[];
  bookings: Booking[];
  plans: Plan[];
  costs: Cost[];
  // Kids going, and the grown-up going who covers their share of costs.
  coveredBy: Map<string, string>;
  // Names for anyone mentioned, including people who've left the trip.
  profiles: Map<string, Profile>;
  today: string;
};

export async function loadGetaway(id: string, userId: string): Promise<GetawayData | null> {
  const [tripResult, peopleResult, itemsResult, bookingsResult, plansResult, costsResult] = await Promise.all([
    supabase.from("getaways").select("*").eq("id", id).maybeSingle(),
    supabase.from("getaway_people").select("profile_id, added_at").eq("getaway_id", id).order("added_at"),
    supabase.from("getaway_items").select(ITEM_FIELDS).eq("getaway_id", id).order("created_at").limit(2000),
    supabase.from("getaway_bookings").select("*").eq("getaway_id", id).order("starts_on").order("starts_time", { nullsFirst: true }),
    supabase.from("getaway_plans").select("*").eq("getaway_id", id).order("on_day").order("at_time", { nullsFirst: true }),
    supabase.from("getaway_costs").select("*").eq("getaway_id", id).order("spent_on", { ascending: false }).order("created_at", { ascending: false }),
  ]);
  if (tripResult.error) throw tripResult.error;
  if (!tripResult.data) return null;

  const items = (itemsResult.data ?? []) as Item[];
  const costs = (costsResult.data ?? []) as Cost[];
  const peopleIds = ((peopleResult.data ?? []) as { profile_id: string }[]).map((p) => p.profile_id);
  const mentioned = new Set<string>(peopleIds);
  for (const c of costs) {
    mentioned.add(c.paid_by);
    c.split_among.forEach((p) => mentioned.add(p));
  }
  for (const i of items) if (i.done_by) mentioned.add(i.done_by);
  const profiles = await profilesFor(mentioned);
  const people = peopleIds
    .map((pid) => profiles.get(pid) ?? { id: pid, display_name: null })
    .sort((a, b) => (a.id === userId ? -1 : b.id === userId ? 1 : 0));

  // A kid's share goes to one of their managers who's going (you, if you are).
  const coveredBy = new Map<string, string>();
  const kids = people.filter((p) => p.is_managed).map((p) => p.id);
  if (kids.length) {
    const { data: managers } = await supabase.from("profile_managers").select("profile_id, manager_id").in("profile_id", kids);
    const going = new Set(peopleIds);
    for (const m of ((managers ?? []) as { profile_id: string; manager_id: string }[]).sort((a, b) =>
      a.manager_id === userId ? -1 : b.manager_id === userId ? 1 : 0
    )) {
      if (going.has(m.manager_id) && !coveredBy.has(m.profile_id)) coveredBy.set(m.profile_id, m.manager_id);
    }
  }

  return {
    trip: tripResult.data as Getaway,
    people,
    items,
    bookings: (bookingsResult.data ?? []) as Booking[],
    plans: (plansResult.data ?? []) as Plan[],
    costs,
    coveredBy,
    profiles,
    today: localDay(),
  };
}

export function useGetaway(id: string | undefined, userId: string | undefined) {
  return useLoader(() => loadGetaway(id!, userId!), [id, userId], !!id && !!userId);
}

// "You" for yourself, otherwise their name.
export function nameOf(profiles: Map<string, Profile>, id: string | null | undefined, userId: string | undefined) {
  if (!id) return "Someone";
  if (id === userId) return "You";
  const p = profiles.get(id);
  return p ? displayName(p) : "Someone";
}

// --- Who you can bring (TRIP-002) ----------------------------------------------------------------

export type Companion = Profile & { where: "home" | "kid" | "burrow" };

// The people you live with, kids you manage, and family in your Burrows.
export async function loadCompanions(userId: string): Promise<Companion[]> {
  const { data: homeId } = await supabase.rpc("my_home");
  const [homeResult, burrowResult, kidsResult] = await Promise.all([
    supabase.from("home_members").select(`profiles(${PROFILE_FIELDS})`).eq("home_id", homeId),
    supabase.from("burrow_members").select(`profiles(${PROFILE_FIELDS})`),
    supabase.from("profile_managers").select("profile_id").eq("manager_id", userId),
  ]);
  const out = new Map<string, Companion>();
  const kidIds = ((kidsResult.data ?? []) as { profile_id: string }[]).map((k) => k.profile_id);
  for (const [id, p] of await profilesFor(kidIds)) out.set(id, { ...p, where: "kid" });
  for (const row of (homeResult.data ?? []) as unknown as { profiles: Profile | null }[]) {
    if (row.profiles) out.set(row.profiles.id, { ...row.profiles, where: "home" });
  }
  for (const row of (burrowResult.data ?? []) as unknown as { profiles: Profile | null }[]) {
    if (row.profiles && !out.has(row.profiles.id)) out.set(row.profiles.id, { ...row.profiles, where: "burrow" });
  }
  out.delete(userId);
  const order = { home: 0, kid: 1, burrow: 2 };
  return [...out.values()].sort((a, b) => order[a.where] - order[b.where] || displayName(a).localeCompare(displayName(b)));
}

export function useCompanions(userId: string | undefined) {
  const [companions, setCompanions] = useState<Companion[] | null>(null);
  useEffect(() => {
    if (!userId) return;
    let live = true;
    loadCompanions(userId)
      .then((list) => live && setCompanions(list))
      .catch(() => live && setCompanions([]));
    return () => {
      live = false;
    };
  }, [userId]);
  return companions;
}

// --- Changes ---------------------------------------------------------------------------------------

export async function createGetaway(fields: {
  title: string;
  place: string | null;
  kind: string;
  starts_on: string;
  ends_on: string;
  notes: string | null;
  people: string[];
}) {
  const { data, error } = await supabase.rpc("create_getaway", { ...fields, tz: phoneTimeZone() });
  return { id: data as string | null, error };
}

export async function addTravelers(getawayId: string, people: string[]) {
  if (!people.length) return { error: null };
  const { error } = await supabase.from("getaway_people").insert(people.map((profile_id) => ({ getaway_id: getawayId, profile_id })));
  return { error };
}

export async function removeTraveler(getawayId: string, profileId: string) {
  const { error } = await supabase.from("getaway_people").delete().eq("getaway_id", getawayId).eq("profile_id", profileId);
  return { error };
}

export async function setDone(itemId: string, done: boolean) {
  const { error } = await supabase
    .from("getaway_items")
    .update({ done_at: done ? new Date().toISOString() : null })
    .eq("id", itemId);
  return { error };
}

export async function addItems(
  getawayId: string,
  kind: Item["kind"],
  lines: { text: string; for_person?: string | null; due_on?: string | null }[]
) {
  if (!lines.length) return { error: null };
  const { error } = await supabase.from("getaway_items").insert(
    lines.map((l) => ({ getaway_id: getawayId, kind, text: l.text, for_person: l.for_person ?? null, due_on: l.due_on ?? null }))
  );
  return { error };
}

// Settle one payback (TRIP-009): it's logged as a cost paid by whoever owed,
// split only to whoever was owed, which evens them out.
export async function recordPayback(getawayId: string, transfer: Transfer) {
  const { error } = await supabase.from("getaway_costs").insert({
    getaway_id: getawayId,
    what: "Paid back",
    amount_cents: transfer.cents,
    paid_by: transfer.from,
    split_among: [transfer.to],
    is_payback: true,
    spent_on: localDay(),
  });
  return { error };
}

// --- Saved packing lists (TRIP-008) -----------------------------------------------------------------

export async function loadPackLists(): Promise<PackList[]> {
  const { data, error } = await supabase.from("getaway_pack_lists").select("id, name, items").order("name");
  if (error) throw error;
  return (data ?? []) as PackList[];
}

export function usePackLists(enabled: boolean, refreshKey = 0) {
  const [lists, setLists] = useState<PackList[] | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    loadPackLists()
      .then((l) => live && setLists(l))
      .catch(() => live && setLists([]));
    return () => {
      live = false;
    };
  }, [enabled, refreshKey]);
  return lists;
}

export async function savePackList(name: string, items: string[]) {
  const { error } = await supabase.from("getaway_pack_lists").insert({ name: name.trim().slice(0, 40), items: items.slice(0, 150) });
  return { error };
}

export async function deletePackList(id: string) {
  const { error } = await supabase.from("getaway_pack_lists").delete().eq("id", id);
  return { error };
}

// --- What the Hearth shows (TRIP-010) -----------------------------------------------------------------

export type GetawaysSummary = {
  count: number;
  next: (Pick<Getaway, "id" | "title" | "kind" | "starts_on" | "ends_on" | "place"> & { leftToPack: number; leftToDo: number }) | null;
  upcoming: number;
  today: string;
};

export async function loadGetawaysSummary(userId: string): Promise<GetawaysSummary> {
  const data = await loadGetaways();
  const next = nextGetaway(data.trips, data.today);
  const mine = next ? data.items.filter((i) => i.getaway_id === next.id) : [];
  return {
    count: data.trips.length,
    next: next
      ? {
          id: next.id,
          title: next.title,
          kind: next.kind,
          starts_on: next.starts_on,
          ends_on: next.ends_on,
          place: next.place,
          leftToPack: leftToPack(mine, userId),
          leftToDo: mine.filter((i) => i.kind === "todo" && !i.done_at).length,
        }
      : null,
    upcoming: data.trips.filter((t) => t.ends_on >= data.today).length,
    today: data.today,
  };
}

export function useGetawaysSummary(userId: string | undefined, refreshKey: number) {
  const [summary, setSummary] = useState<GetawaysSummary | null>(null);
  useEffect(() => {
    if (!userId) return;
    let live = true;
    loadGetawaysSummary(userId)
      .then((s) => live && setSummary(s))
      .catch(() => live && setSummary(null));
    return () => {
      live = false;
    };
  }, [userId, refreshKey]);
  return summary;
}
