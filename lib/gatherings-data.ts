import { useEffect, useState } from "react";

import { PROFILE_FIELDS, type Profile } from "./gift-nook";
import type { GatheringRow, Guest } from "./gatherings";
import type { RsvpStatus } from "./potluck";
import { supabase } from "./supabase";

// Loading and saving Gatherings (GATH-001..). Row level security decides
// what comes back: a Gathering you aren't invited to simply isn't found.

export const GATHERING_FIELDS = "id, title, kind, ends_at, starts_at, place, notes, gifts, burrow_id, created_by";

// A Gathering in the list, with what it has and your own answer.
export type GatheringListItem = GatheringRow & {
  potlucks: { id: string }[];
  gathering_rsvps: { profile_id: string; status: RsvpStatus }[];
  gathering_burrows: { burrow_id: string }[];
};

// Everything you're invited to, from a month ago on. `burrowId` keeps only
// the ones that Burrow is invited to (from a Burrow's page).
export async function loadGatherings(burrowId?: string) {
  let query = supabase
    .from("gatherings")
    .select(`${GATHERING_FIELDS}, potlucks(id), gathering_rsvps(profile_id, status), gathering_burrows${burrowId ? "!inner" : ""}(burrow_id)`)
    .gt("ends_at", new Date(Date.now() - 30 * 864e5).toISOString())
    .order("ends_at");
  if (burrowId) query = query.eq("gathering_burrows.burrow_id", burrowId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as GatheringListItem[];
}

export type GatheringData = {
  gathering: GatheringRow;
  guests: Guest[];
  burrows: { id: string; name: string }[];
  honorees: string[];
  potluckId: string | null;
  canHost: boolean;
  // Kids you look after who are invited (you answer for them).
  myKids: string[];
};

export async function loadGathering(id: string, userId: string): Promise<GatheringData | null> {
  const { data: gathering, error } = await supabase.from("gatherings").select(GATHERING_FIELDS).eq("id", id).maybeSingle();
  if (error) throw error;
  if (!gathering) return null;

  const [guestsResult, burrowsResult, honoreesResult, potluckResult, hostResult, kidsResult] = await Promise.all([
    supabase.rpc("gathering_guest_list", { target_gathering: id }),
    supabase.from("gathering_burrows").select("burrow_id, burrows(name)").eq("gathering_id", id),
    supabase.from("gathering_honorees").select("profile_id").eq("gathering_id", id),
    supabase.from("potlucks").select("id").eq("gathering_id", id).order("created_at").limit(1),
    supabase.rpc("can_host_gathering", { target_gathering: id }),
    supabase.from("profile_managers").select("profile_id").eq("manager_id", userId),
  ]);
  const firstError = guestsResult.error ?? burrowsResult.error ?? honoreesResult.error ?? potluckResult.error;
  if (firstError) throw firstError;

  const guests = (guestsResult.data ?? []) as Guest[];
  const managed = new Set((kidsResult.data ?? []).map((k) => k.profile_id as string));
  return {
    gathering: gathering as GatheringRow,
    guests,
    burrows: (burrowsResult.data ?? []).map((row) => ({
      id: row.burrow_id as string,
      name: (row.burrows as unknown as { name: string } | null)?.name ?? "A Burrow",
    })),
    honorees: (honoreesResult.data ?? []).map((row) => row.profile_id as string),
    potluckId: (potluckResult.data?.[0]?.id as string | undefined) ?? null,
    canHost: Boolean(hostResult.data),
    myKids: guests.filter((g) => managed.has(g.profile_id)).map((g) => g.profile_id),
  };
}

// What the form sends (GATH-002..007).
export type GatheringInput = {
  title: string;
  kind: string;
  ends_at: string;
  starts_at: string | null;
  place: string;
  notes: string;
  gifts: boolean;
  burrowIds: string[];
  guestIds: string[];
  honoreeIds: string[];
  cohostIds: string[];
};

function args(input: GatheringInput) {
  return {
    gathering_title: input.title,
    gathering_kind: input.kind,
    gathering_ends_at: input.ends_at,
    gathering_starts_at: input.starts_at,
    gathering_place: input.place,
    gathering_notes: input.notes,
    with_gifts: input.gifts,
    burrow_ids: input.burrowIds,
    guest_ids: input.guestIds,
    honoree_ids: input.honoreeIds,
    cohost_ids: input.cohostIds,
  };
}

export async function planGathering(input: GatheringInput, withFood: boolean) {
  const { data, error } = await supabase.rpc("plan_gathering", { ...args(input), with_food: withFood });
  if (error) throw error;
  return data as string;
}

export async function updateGathering(id: string, input: GatheringInput) {
  const { error } = await supabase.rpc("update_gathering", { target_gathering: id, ...args(input) });
  if (error) throw error;
}

// Add a Potluck to a Gathering (hosts). Returns the Potluck's id.
export async function addPotluck(gatheringId: string) {
  const { data, error } = await supabase.rpc("add_potluck", { target_gathering: gatheringId });
  if (error) throw error;
  return data as string;
}

export async function setRsvp(gatheringId: string, profileId: string, status: RsvpStatus, extraGuests: number) {
  return supabase.from("gathering_rsvps").upsert({
    gathering_id: gatheringId,
    profile_id: profileId,
    status,
    extra_guests: extraGuests,
    updated_at: new Date().toISOString(),
  });
}

// Your Burrows and who's in each, for the guest picker.
export type PickerBurrow = { id: string; name: string; members: Profile[] };

export async function loadPickerBurrows(): Promise<PickerBurrow[]> {
  const { data, error } = await supabase
    .from("burrows")
    .select(`id, name, burrow_members(profiles(${PROFILE_FIELDS}))`)
    .order("name");
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    members: ((row.burrow_members ?? []) as unknown as { profiles: Profile | null }[])
      .map((m) => m.profiles)
      .filter((p): p is Profile => Boolean(p)),
  }));
}

// For the Hearth tile: the next few Gatherings.
export function useUpcomingGatherings(enabled: boolean, refreshKey: number) {
  const [rows, setRows] = useState<GatheringListItem[] | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    loadGatherings()
      .then((all) => live && setRows(all.filter((g) => new Date(g.ends_at).getTime() >= Date.now())))
      .catch(() => live && setRows([]));
    return () => {
      live = false;
    };
  }, [enabled, refreshKey]);
  return rows;
}
