import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";

import { guarded } from "./feedback";
import { displayName } from "./gift-nook";
import type { Note } from "./notes";
import { supabase } from "./supabase";
import { useHearthData } from "./hearth-data";

// Loads the Notes Nook (NOTE-001..010): your notes and the shared ones of
// people you live with (row level security decides which).

export type NotesData = {
  notes: Note[];
  // Names for owners and editors of shared notes.
  names: Map<string, string>;
};

export async function loadNotes(): Promise<NotesData> {
  const { data, error } = await supabase.from("notes").select("*").order("updated_at", { ascending: false });
  if (error) throw error;
  const notes = (data ?? []) as Note[];
  const ids = new Set<string>();
  for (const n of notes) {
    if (n.shared) ids.add(n.owner_id);
    if (n.edited_by) ids.add(n.edited_by);
  }
  const names = new Map<string, string>();
  if (ids.size) {
    const { data: people } = await supabase.from("profiles").select("id, display_name").in("id", [...ids]);
    for (const p of (people ?? []) as { id: string; display_name: string | null }[]) names.set(p.id, displayName(p));
  }
  return { notes, names };
}

// Notes for a screen, fresh each time it comes into view.
export function useNotes(userId: string | undefined) {
  const [data, setData] = useState<NotesData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const reload = useCallback(
    () =>
      userId
        ? guarded(
            async () => {
              setData(await loadNotes());
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

// For the Hearth (NOTE-007): the same, reloaded when the Hearth refreshes.
export function useNotesSummary(userId: string | undefined, refreshKey: number) {
  // Remembered between Hearth pages, so a page you've seen shows at once (CORE-104).
  return useHearthData(userId ? `notes:${userId}` : null, refreshKey, () => loadNotes());
}

export function personName(names: Map<string, string>, id: string | null, userId: string | undefined) {
  if (!id) return "Someone";
  return id === userId ? "You" : names.get(id) ?? "Someone";
}

// Save new words (NOTE-002, NOTE-009). Only if nobody else changed it since
// `since` (the updated_at we last saw); otherwise hands back their version
// so the screen can ask which to keep.
export async function saveNoteBody(id: string, body: string, since: string) {
  const { data, error } = await supabase
    .from("notes")
    .update({ body })
    .eq("id", id)
    .eq("updated_at", since)
    .select("*");
  if (error) return { error: error.message };
  if (data?.length) return { note: data[0] as Note };
  const { data: theirs } = await supabase.from("notes").select("*").eq("id", id).maybeSingle();
  return { conflict: (theirs as Note | null) ?? null };
}

// Keep my words anyway, over whatever's there now.
export async function overwriteNoteBody(id: string, body: string) {
  const { data, error } = await supabase.from("notes").update({ body }).eq("id", id).select("*").single();
  if (error) return { error: error.message };
  return { note: data as Note };
}

export async function createNote(body: string, folder: string | null) {
  const { data, error } = await supabase.from("notes").insert({ body, folder }).select("*").single();
  if (error) return { error: error.message };
  return { note: data as Note };
}
