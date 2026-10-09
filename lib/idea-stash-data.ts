import { displayName, PROFILE_FIELDS, type Profile } from "./gift-nook";
import { IDEA_SELECT, type Idea } from "./idea-stash";
import { supabase } from "./supabase";

// Loads your Idea Stash (GIFT-036) and the people you can write notes about:
// everyone you share a Burrow with, and kids you manage. Row level security
// only ever returns your own notes.

export type StashData = { ideas: Idea[]; people: Map<string, Profile> };

export async function loadStash(userId: string): Promise<StashData> {
  const [ideasResult, matesResult, kidsResult] = await Promise.all([
    supabase.from("idea_stash").select(IDEA_SELECT).order("created_at", { ascending: false }),
    supabase.from("burrow_members").select(`profiles(${PROFILE_FIELDS})`),
    supabase.from("profile_managers").select(`profiles!profile_managers_profile_id_fkey(${PROFILE_FIELDS})`).eq("manager_id", userId),
  ]);
  if (ideasResult.error) throw ideasResult.error;

  const people = new Map<string, Profile>();
  const add = (row: unknown) => {
    const profile = (row as { profiles: Profile | null }).profiles;
    if (profile && profile.id !== userId) people.set(profile.id, profile);
  };
  for (const row of matesResult.data ?? []) add(row);
  for (const row of kidsResult.data ?? []) add(row);

  const ideas = (ideasResult.data ?? []) as Idea[];
  // A note about someone you no longer share a Burrow with is still yours.
  const missing = [...new Set(ideas.map((i) => i.about_id))].filter((id) => !people.has(id));
  if (missing.length) {
    const { data } = await supabase.from("profiles").select(PROFILE_FIELDS).in("id", missing);
    for (const profile of (data ?? []) as Profile[]) people.set(profile.id, profile);
  }
  return { ideas, people };
}

export function personName(people: Map<string, Profile>, id: string) {
  return displayName(people.get(id));
}
