import type { RealtimeChannel } from "@supabase/supabase-js";
import { useEffect, useReducer, useState } from "react";

import { cleanDoodle, fridgesWithNews, NOTE_SELECT, placeKey, type FridgeNote, type FridgePlace, type Stroke } from "./fridge";
import { supabase } from "./supabase";

// Loading, sticking up and taking down Fridge door notes (CORE-086), with
// live updates. Every widget and screen showing the same fridge shares one
// copy and one live connection, so a new note shows everywhere at once.

type Entry = { notes: FridgeNote[]; loaded: boolean; error: string | null };

const entries = new Map<string, Entry>();
const listeners = new Map<string, Set<() => void>>();
const loading = new Map<string, Promise<void>>();
const channels = new Map<string, { channel: RealtimeChannel; users: number }>();
// Told whenever any fridge changes, so the page tabs' news catches up.
const newsListeners = new Set<() => void>();

function notify(key: string) {
  listeners.get(key)?.forEach((listener) => listener());
  newsListeners.forEach((listener) => listener());
}

function load(place: FridgePlace) {
  const key = placeKey(place);
  const running = loading.get(key);
  if (running) return running;
  const job = (async () => {
    const { data, error } = await supabase
      .from("fridge_notes")
      .select(NOTE_SELECT)
      .eq(place.kind === "home" ? "home_id" : "burrow_id", place.id)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });
    const before = entries.get(key);
    entries.set(
      key,
      error
        ? { notes: before?.notes ?? [], loaded: true, error: error.message }
        : {
            notes: ((data ?? []) as unknown as FridgeNote[]).map((note) => ({ ...note, doodle: note.doodle ? cleanDoodle(note.doodle) : null })),
            loaded: true,
            error: null,
          }
    );
    loading.delete(key);
    notify(key);
  })();
  loading.set(key, job);
  return job;
}

// One live connection per fridge, shared by everyone watching it.
function watch(place: FridgePlace) {
  const key = placeKey(place);
  const open = channels.get(key);
  if (open) {
    open.users += 1;
  } else {
    const channel = supabase
      .channel(`fridge-${place.kind}-${place.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "fridge_notes", filter: `${place.kind === "home" ? "home_id" : "burrow_id"}=eq.${place.id}` },
        () => void load(place)
      )
      .subscribe();
    channels.set(key, { channel, users: 1 });
  }
  return () => {
    const entry = channels.get(key);
    if (!entry) return;
    entry.users -= 1;
    if (entry.users <= 0) {
      void supabase.removeChannel(entry.channel);
      channels.delete(key);
    }
  };
}

// The notes up on one fridge right now, newest first. `refreshKey` changing
// fetches them again (e.g. coming back to the Hearth).
export function useFridgeNotes(place: FridgePlace | null, refreshKey: unknown = 0) {
  const key = place ? placeKey(place) : null;
  const [, rerender] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    if (!place || !key) return;
    const set = listeners.get(key) ?? new Set();
    listeners.set(key, set);
    set.add(rerender);
    const stop = watch(place);
    return () => {
      set.delete(rerender);
      stop();
    };
    // `key` stands for `place`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (place) void load(place);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, refreshKey]);

  const entry = key ? entries.get(key) : undefined;
  return {
    notes: entry?.notes ?? [],
    loaded: Boolean(entry?.loaded),
    error: entry?.error ?? null,
    reload: () => (place ? load(place) : Promise.resolve()),
  };
}

export type NewNote = { kind: "note"; body: string } | { kind: "doodle"; doodle: Stroke[]; body?: string };

export async function stickUpNote(place: FridgePlace, note: NewNote & { paper: string; lastsDays: number }) {
  const { error } = await supabase.from("fridge_notes").insert({
    [place.kind === "home" ? "home_id" : "burrow_id"]: place.id,
    kind: note.kind,
    body: note.body?.trim() || null,
    doodle: note.kind === "doodle" ? note.doodle : null,
    paper: note.paper,
    lasts_days: note.lastsDays,
  });
  if (error) throw error;
  await load(place);
}

export async function takeDownNote(place: FridgePlace, noteId: string) {
  const key = placeKey(place);
  const entry = entries.get(key);
  if (entry) {
    entries.set(key, { ...entry, notes: entry.notes.filter((n) => n.id !== noteId) });
    notify(key);
  }
  const { error, count } = await supabase.from("fridge_notes").delete({ count: "exact" }).eq("id", noteId);
  if (error || !count) {
    await load(place);
    if (error) throw error;
    throw new Error("Only whoever stuck it up can take it down.");
  }
}

// --- News: which fridges have something you haven't seen ------------------------------

// Fridges (as placeKey()s) with a note you haven't seen yet. Listens live
// to your Home's fridge, so the Home page's tab lights up while you're on
// another page.
export function useFridgeNews(homeId: string | null, refreshKey: unknown = 0) {
  const [news, setNews] = useState<Set<string>>(() => new Set());
  const [version, bump] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    newsListeners.add(bump);
    return () => {
      newsListeners.delete(bump);
    };
  }, []);

  useEffect(() => {
    if (!homeId) return;
    return watch({ kind: "home", id: homeId });
  }, [homeId]);

  useEffect(() => {
    let cancelled = false;
    // Give a note's notices a moment to be written before asking.
    const timer = setTimeout(() => {
      supabase
        .from("notifications")
        .select("data")
        .eq("nook", "fridge")
        .is("read_at", null)
        .limit(100)
        .then(({ data }) => {
          if (!cancelled) setNews(fridgesWithNews((data ?? []) as { data: Record<string, string> }[]));
        });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [homeId, refreshKey, version]);

  return news;
}

// You've seen these fridges: their notices are marked read (which clears
// the dot on the page tab and in the inbox).
export async function markFridgesSeen(places: FridgePlace[]) {
  if (!places.length) return;
  const now = new Date().toISOString();
  const results = await Promise.all(
    places.map((place) =>
      supabase
        .from("notifications")
        .update({ read_at: now }, { count: "exact" })
        .eq("nook", "fridge")
        .is("read_at", null)
        .eq(place.kind === "home" ? "data->>home_id" : "data->>burrow_id", place.id)
    )
  );
  if (results.some((r) => r.count)) newsListeners.forEach((listener) => listener());
}
