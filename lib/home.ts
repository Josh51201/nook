import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";

import { guarded } from "./feedback";
import { PROFILE_FIELDS, type Profile } from "./gift-nook";
import { supabase } from "./supabase";

// Your Home (HOME-001..005): the people you live with, shared by every Nook
// that keeps things for a household. Each person is in exactly one Home;
// Nooks keep their things against the Home's id (see my_home() in
// supabase/migrations/20261008170000_homes.sql).

// HOME-006: a Home holds at most this many people. Also enforced in the
// database (enforce_home_size) — change it in both places or not at all.
export const MAX_HOME_MEMBERS = 6;

export type HomeMember = { profile_id: string; profiles: Profile | null };

export type HomeInvite = { id: string; home_id: string; invited: string; invited_by: string | null };

export type HomeData = {
  homeId: string;
  members: HomeMember[];
  // Invites you've sent, and invites waiting for you.
  sent: HomeInvite[];
  incoming: HomeInvite[];
  // Everyone you share a Burrow with (who you could invite), plus the names
  // of anyone involved in an invite.
  people: Map<string, Profile>;
  // Who's already in each Home you've been invited to.
  inviterHomes: Map<string, string[]>;
};

export async function loadHome(userId: string): Promise<HomeData> {
  const { data: homeId, error } = await supabase.rpc("my_home");
  if (error) throw error;

  const [membersResult, invitesResult, matesResult] = await Promise.all([
    supabase.from("home_members").select(`profile_id, profiles(${PROFILE_FIELDS})`).eq("home_id", homeId),
    supabase.from("home_invites").select("id, home_id, invited, invited_by"),
    supabase.from("burrow_members").select(`profiles(${PROFILE_FIELDS})`),
  ]);

  const people = new Map<string, Profile>();
  for (const row of (matesResult.data ?? []) as unknown as { profiles: Profile | null }[]) {
    if (row.profiles && row.profiles.id !== userId && !row.profiles.is_managed) people.set(row.profiles.id, row.profiles);
  }
  const members = (membersResult.data ?? []) as unknown as HomeMember[];
  const invites = (invitesResult.data ?? []) as HomeInvite[];
  const incoming = invites.filter((i) => i.invited === userId);
  const sent = invites.filter((i) => i.home_id === homeId);

  // Who lives in the Homes you're invited to.
  const inviterHomes = new Map<string, string[]>();
  if (incoming.length) {
    const { data } = await supabase
      .from("home_members")
      .select(`home_id, profiles(${PROFILE_FIELDS})`)
      .in("home_id", incoming.map((i) => i.home_id));
    for (const row of (data ?? []) as unknown as { home_id: string; profiles: Profile | null }[]) {
      if (!row.profiles) continue;
      people.set(row.profiles.id, row.profiles);
      inviterHomes.set(row.home_id, [...(inviterHomes.get(row.home_id) ?? []), row.profiles.display_name?.trim() || "Someone"]);
    }
  }
  return { homeId, members, sent, incoming, people, inviterHomes };
}

// Your Home for a screen, fresh each time it comes into view.
export function useHome(userId: string | undefined) {
  const [data, setData] = useState<HomeData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const reload = useCallback(
    () =>
      userId
        ? guarded(
            async () => {
              setData(await loadHome(userId));
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
