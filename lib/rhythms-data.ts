import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";

import { guarded } from "./feedback";
import { displayName } from "./gift-nook";
import { localDay, phoneTimeZone } from "./pets";
import { groupRhythms, type Rhythm, type RhythmEntry, type Starter } from "./rhythms";
import { supabase } from "./supabase";
import { useHearthData } from "./hearth-data";

// Loads your Home's rhythms (RHY-001..008) with everything their screens
// need. Row level security means only your Home's come back.

export type RhythmsData = {
  homeId: string;
  rhythms: Rhythm[];
  // Every "done" kept (RHY-006), newest first.
  log: RhythmEntry[];
  // Who lives in your Home, for picking an owner (RHY-005).
  members: { id: string; name: string }[];
  // Names for everyone in the log, including people who've moved out.
  names: Map<string, string>;
  today: string;
};

export async function loadRhythms(userId: string): Promise<RhythmsData> {
  const { data: homeId, error: homeError } = await supabase.rpc("my_home");
  if (homeError) throw homeError;

  const [rhythmsResult, logResult, membersResult] = await Promise.all([
    supabase.from("rhythms").select("*").eq("home_id", homeId).order("due_on", { nullsFirst: false }),
    supabase
      .from("rhythm_log")
      .select("id, rhythm_id, done_by, done_on, note, created_at")
      .order("done_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1000),
    supabase.from("home_members").select("profile_id").eq("home_id", homeId),
  ]);
  if (rhythmsResult.error) throw rhythmsResult.error;
  if (logResult.error) throw logResult.error;

  const rhythms = (rhythmsResult.data ?? []) as Rhythm[];
  const log = (logResult.data ?? []) as RhythmEntry[];
  const memberIds = ((membersResult.data ?? []) as { profile_id: string }[]).map((m) => m.profile_id);

  const ids = new Set<string>([userId, ...memberIds]);
  for (const entry of log) if (entry.done_by) ids.add(entry.done_by);
  for (const r of rhythms) {
    if (r.owner) ids.add(r.owner);
    if (r.last_done_by) ids.add(r.last_done_by);
  }
  const { data: profiles } = await supabase.from("profiles").select("id, display_name").in("id", [...ids]);
  const names = new Map(
    ((profiles ?? []) as { id: string; display_name: string | null }[]).map((p) => [p.id, displayName(p)])
  );
  const members = memberIds
    .map((id) => ({ id, name: names.get(id) ?? "Someone" }))
    .sort((a, b) => (a.id === userId ? -1 : b.id === userId ? 1 : a.name.localeCompare(b.name)));

  return { homeId, rhythms, log, members, names, today: localDay() };
}

// Your Home's rhythms for a screen, fresh each time it comes into view.
export function useRhythms(userId: string | undefined) {
  const [data, setData] = useState<RhythmsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const reload = useCallback(
    () =>
      userId
        ? guarded(
            async () => {
              setData(await loadRhythms(userId));
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
export function personName(data: Pick<RhythmsData, "names">, id: string | null, userId: string | undefined) {
  if (!id) return "Someone";
  return id === userId ? "You" : data.names.get(id) ?? "Someone";
}

// --- Changes -------------------------------------------------------------------------------

// Mark one done (RHY-004). If someone else already did it that day, the
// database says so.
export async function completeRhythm(rhythmId: string, onDay = localDay(), note?: string) {
  const { error } = await supabase.rpc("complete_rhythm", {
    target_rhythm: rhythmId,
    on_day: onDay,
    note: note?.trim() || null,
  });
  return { error, alreadyDone: error?.code === "23505" };
}

export async function undoRhythm(entryId: string) {
  const { error } = await supabase.rpc("undo_rhythm", { target_entry: entryId });
  return { error };
}

// Add the picked starters in one go (RHY-003).
export async function addStarters(homeId: string, picks: (Starter & { due_on: string })[]) {
  const tz = phoneTimeZone();
  const { error } = await supabase.from("rhythms").insert(
    picks.map((p) => ({ home_id: homeId, title: p.title, area: p.area, repeat_months: p.months, due_on: p.due_on, tz }))
  );
  return { error };
}

// --- What the Hearth shows (RHY-008) -------------------------------------------------------

export type RhythmsSummary = {
  total: number;
  // Overdue or due today, soonest first.
  now: { id: string; title: string; overdue: boolean; mine: boolean }[];
  // The next 30 days.
  soon: { id: string; title: string; due_on: string; mine: boolean }[];
  today: string;
};

export function useRhythmsSummary(userId: string | undefined, refreshKey: number) {
  // Remembered between Hearth pages, so a page you've seen shows at once (CORE-104).
  return useHearthData(userId ? `rhythms:${userId}` : null, refreshKey, () =>
    loadRhythms(userId!).then((data) => {
      const groups = groupRhythms(data.rhythms, data.today);
      return {
        total: data.rhythms.length,
        now: groups.now.map((r) => ({ id: r.id, title: r.title, overdue: r.due_on! < data.today, mine: r.owner === userId })),
        soon: groups.month.map((r) => ({ id: r.id, title: r.title, due_on: r.due_on!, mine: r.owner === userId })),
        today: data.today,
      };
    }));
}
