import { displayName, PROFILE_FIELDS, type Profile } from "./gift-nook";
import { isComing, type Person, type Rsvp, type Slot } from "./potluck";
import { supabase } from "./supabase";

// Loads one Potluck with everything its screens need: spots, dishes,
// RSVPs, the Burrow's people and their allergies/diets (PROF-004), and
// what the viewer can do. Row level security decides what comes back — a
// Potluck outside your Burrows simply isn't found.

export type PotluckRow = {
  id: string;
  burrow_id: string;
  gathering_id: string | null;
  title: string;
  starts_at: string;
  place: string | null;
  notes: string | null;
  created_by: string | null;
  burrows: { name: string } | null;
  gatherings: { title: string } | null;
};

export type Dish = {
  id: string;
  slot_id: string | null;
  brought_by: string;
  name: string;
  tags: string[];
  note: string | null;
};

export type Member = { profile_id: string; role: "admin" | "member"; profiles: Profile | null };

export type PotluckData = {
  potluck: PotluckRow;
  hosts: string[];
  slots: Slot[];
  dishes: Dish[];
  rsvps: Rsvp[];
  members: Member[];
  // Everyone in the Burrow, with their allergies and diets.
  people: Map<string, Person & { profile: Profile | null }>;
  // Kids the viewer manages who are in this Burrow (they RSVP for them).
  myKids: string[];
  isHost: boolean;
  // People coming (Going or Maybe), for warnings.
  coming: (Person & { profile: Profile | null })[];
};

export async function loadPotluck(id: string, userId: string): Promise<PotluckData | null> {
  const { data: potluck, error } = await supabase
    .from("potlucks")
    .select("id, burrow_id, gathering_id, title, starts_at, place, notes, created_by, burrows(name), gatherings(title)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!potluck) return null;

  const [hostsResult, slotsResult, dishesResult, rsvpsResult, membersResult, kidsResult] = await Promise.all([
    supabase.from("potluck_hosts").select("profile_id").eq("potluck_id", id),
    supabase.from("potluck_slots").select("id, label, wanted").eq("potluck_id", id).order("position"),
    supabase
      .from("potluck_dishes")
      .select("id, slot_id, brought_by, name, tags, note")
      .eq("potluck_id", id)
      .order("created_at"),
    supabase.from("potluck_rsvps").select("profile_id, status, extra_guests").eq("potluck_id", id),
    supabase.from("burrow_members").select(`profile_id, role, profiles(${PROFILE_FIELDS})`).eq("burrow_id", potluck.burrow_id),
    supabase.from("profile_managers").select("profile_id").eq("manager_id", userId),
  ]);
  const firstError =
    hostsResult.error ?? slotsResult.error ?? dishesResult.error ?? rsvpsResult.error ?? membersResult.error;
  if (firstError) throw firstError;

  const members = (membersResult.data ?? []) as unknown as Member[];
  const memberIds = members.map((m) => m.profile_id);
  const { data: needsRows } = memberIds.length
    ? await supabase.from("dietary_needs").select("profile_id, allergies, diets").in("profile_id", memberIds)
    : { data: [] };
  const needs = new Map((needsRows ?? []).map((row) => [row.profile_id as string, row]));

  const people = new Map<string, Person & { profile: Profile | null }>();
  for (const member of members) {
    const row = needs.get(member.profile_id);
    people.set(member.profile_id, {
      id: member.profile_id,
      name: displayName(member.profiles),
      profile: member.profiles,
      allergies: (row?.allergies as string[] | undefined) ?? [],
      diets: (row?.diets as string[] | undefined) ?? [],
    });
  }

  const hosts = (hostsResult.data ?? []).map((h) => h.profile_id as string);
  const rsvps = (rsvpsResult.data ?? []) as Rsvp[];
  const managed = new Set((kidsResult.data ?? []).map((k) => k.profile_id as string));
  const isAdmin = members.some((m) => m.profile_id === userId && m.role === "admin");

  return {
    potluck: potluck as unknown as PotluckRow,
    hosts,
    slots: (slotsResult.data ?? []) as Slot[],
    dishes: (dishesResult.data ?? []) as Dish[],
    rsvps,
    members,
    people,
    myKids: memberIds.filter((pid) => managed.has(pid)),
    isHost: hosts.includes(userId) || isAdmin,
    coming: rsvps
      .filter((rsvp) => isComing(rsvp.status))
      .map((rsvp) => people.get(rsvp.profile_id))
      .filter((person): person is Person & { profile: Profile | null } => Boolean(person)),
  };
}

// "Sat, Dec 20 · 5:00 PM"
export function formatWhen(iso: string) {
  const date = new Date(iso);
  const day = date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  const time = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${day} · ${time}`;
}
