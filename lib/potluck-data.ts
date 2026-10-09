import { whenWords, type Guest } from "./gatherings";
import { displayName, type Profile } from "./gift-nook";
import { isComing, type Person, type Rsvp, type Slot } from "./potluck";
import { supabase } from "./supabase";

// Loads one Potluck with everything its screens need: spots, dishes, and
// from its Gathering (GATH-004) the guest list, hosts and RSVPs, with the
// allergies/diets of the guests (PROF-004) you can see. Row level security
// decides what comes back — a Potluck for a Gathering you're not invited to
// simply isn't found.

export type PotluckRow = {
  id: string;
  gathering_id: string;
  title: string;
  starts_at: string;
  place: string | null;
  notes: string | null;
  created_by: string | null;
  gatherings: { title: string; starts_at: string | null; ends_at: string } | null;
};

export type Dish = {
  id: string;
  slot_id: string | null;
  brought_by: string;
  name: string;
  tags: string[];
  note: string | null;
  // The Recipe Box recipe it's made from (REC-009).
  recipe_id: string | null;
};

export type PotluckData = {
  potluck: PotluckRow;
  hosts: string[];
  slots: Slot[];
  dishes: Dish[];
  rsvps: Rsvp[];
  // Everyone invited, with their allergies and diets.
  people: Map<string, Person & { profile: Profile | null }>;
  // Kids the viewer manages who are invited (they RSVP for them).
  myKids: string[];
  isHost: boolean;
  // Recipes behind dishes that the viewer is allowed to open (REC-009).
  openRecipes: Set<string>;
  // People coming (Going or Maybe), for warnings.
  coming: (Person & { profile: Profile | null })[];
};

export async function loadPotluck(id: string, userId: string): Promise<PotluckData | null> {
  const { data: potluck, error } = await supabase
    .from("potlucks")
    .select("id, gathering_id, title, starts_at, place, notes, created_by, gatherings(title, starts_at, ends_at)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!potluck) return null;

  const [guestsResult, slotsResult, dishesResult, kidsResult, hostResult] = await Promise.all([
    supabase.rpc("gathering_guest_list", { target_gathering: potluck.gathering_id }),
    supabase.from("potluck_slots").select("id, label, wanted").eq("potluck_id", id).order("position"),
    supabase
      .from("potluck_dishes")
      .select("id, slot_id, brought_by, name, tags, note, recipe_id")
      .eq("potluck_id", id)
      .order("created_at"),
    supabase.from("profile_managers").select("profile_id").eq("manager_id", userId),
    supabase.rpc("can_host_gathering", { target_gathering: potluck.gathering_id }),
  ]);
  const firstError = guestsResult.error ?? slotsResult.error ?? dishesResult.error;
  if (firstError) throw firstError;

  const guests = (guestsResult.data ?? []) as Guest[];
  const guestIds = guests.map((g) => g.profile_id);
  const { data: needsRows } = guestIds.length
    ? await supabase.from("dietary_needs").select("profile_id, allergies, diets").in("profile_id", guestIds)
    : { data: [] };
  const needs = new Map((needsRows ?? []).map((row) => [row.profile_id as string, row]));

  const people = new Map<string, Person & { profile: Profile | null }>();
  for (const guest of guests) {
    const row = needs.get(guest.profile_id);
    const profile: Profile = {
      id: guest.profile_id,
      display_name: guest.display_name,
      is_managed: guest.is_managed,
      avatar_icon: guest.avatar_icon,
      avatar_color: guest.avatar_color,
      avatar_path: guest.avatar_path,
    };
    people.set(guest.profile_id, {
      id: guest.profile_id,
      name: displayName(profile),
      profile,
      allergies: (row?.allergies as string[] | undefined) ?? [],
      diets: (row?.diets as string[] | undefined) ?? [],
    });
  }

  // Row level security returns only the recipes this viewer may see, so a
  // "Just me" recipe never gets a link.
  const dishes = (dishesResult.data ?? []) as Dish[];
  const recipeIds = [...new Set(dishes.map((d) => d.recipe_id).filter(Boolean) as string[])];
  const { data: recipeRows } = recipeIds.length
    ? await supabase.from("recipes").select("id").in("id", recipeIds)
    : { data: [] };

  const rsvps: Rsvp[] = guests
    .filter((g) => g.status)
    .map((g) => ({ profile_id: g.profile_id, status: g.status!, extra_guests: g.extra_guests }));
  const managed = new Set((kidsResult.data ?? []).map((k) => k.profile_id as string));

  return {
    potluck: potluck as unknown as PotluckRow,
    hosts: guests.filter((g) => g.is_host).map((g) => g.profile_id),
    slots: (slotsResult.data ?? []) as Slot[],
    dishes,
    openRecipes: new Set((recipeRows ?? []).map((r) => r.id as string)),
    rsvps,
    people,
    myKids: guestIds.filter((pid) => managed.has(pid)),
    isHost: Boolean(hostResult.data),
    coming: rsvps
      .filter((rsvp) => isComing(rsvp.status))
      .map((rsvp) => people.get(rsvp.profile_id))
      .filter((person): person is Person & { profile: Profile | null } => Boolean(person)),
  };
}

// When a Potluck is: its Gathering's day, and time if one was set.
export function potluckWhen(potluck: Pick<PotluckRow, "starts_at" | "gatherings">) {
  return potluck.gatherings ? whenWords(potluck.gatherings) : formatWhen(potluck.starts_at);
}

// "Sat, Dec 20 · 5:00 PM"
export function formatWhen(iso: string) {
  const date = new Date(iso);
  const day = date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  const time = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${day} · ${time}`;
}
