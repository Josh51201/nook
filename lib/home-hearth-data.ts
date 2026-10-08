import type { RealtimeChannel } from "@supabase/supabase-js";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useReducer } from "react";

import { useAuth } from "./auth-context";
import type { HearthItem } from "./hearth-layout";
import { DEFAULT_HOME_PAGE_NAME, diffHomeItems } from "./home-hearth";
import { supabase } from "./supabase";

// Loading, saving and live updates for the Home page (CORE-054). Every
// screen shares one copy, like the Hearth's own settings (lib/nook-settings.ts),
// so a change shows everywhere at once. While a phone is showing the Hearth,
// changes made by others in the Home arrive within a moment or two.

type Store = {
  userId: string;
  homeId: string | null;
  // How many people live in the Home, and the first names of the others.
  memberCount: number;
  others: string[];
  items: HearthItem[];
  name: string;
  loaded: boolean;
  error: string | null;
};

let store: Store | null = null;
let lastLoad = 0;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();
// Saves still on their way, and whether news arrived meanwhile (it's fetched
// once they land, so a half-saved change never flickers back).
let saving = 0;
let stale = false;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;
let channel: RealtimeChannel | null = null;
let channelHome: string | null = null;
// Whether you're looking at the Home page right now (shared by the Hearth
// and the widget editor, so the editor finds widgets that are on it).
let onHomePage = false;

function notify() {
  listeners.forEach((listener) => listener());
}

function firstName(name: string | null | undefined) {
  return name?.trim().split(" ")[0] || "Someone";
}

async function fetchRows(homeId: string) {
  const [rows, home] = await Promise.all([
    supabase
      .from("home_hearth_items")
      .select("id, item, position")
      .eq("home_id", homeId)
      .eq("removed", false)
      .order("position")
      .order("id"),
    supabase.from("homes").select("hearth_page_name").eq("id", homeId).maybeSingle(),
  ]);
  if (rows.error) throw rows.error;
  return {
    items: (rows.data ?? []).map((row) => row.item as HearthItem),
    name: (home.data?.hearth_page_name as string | null)?.trim() || DEFAULT_HOME_PAGE_NAME,
  };
}

function load(userId: string) {
  if (loading && store?.userId === userId) return loading;
  if (store && store.userId !== userId) {
    stopListening();
    store = null;
  }
  loading = (async () => {
    try {
      const { data: homeId, error } = await supabase.rpc("my_home");
      if (error) throw error;
      const { data: members } = await supabase.from("home_members").select("profile_id, profiles(display_name)").eq("home_id", homeId);
      const people = (members ?? []) as unknown as { profile_id: string; profiles: { display_name: string | null } | null }[];
      const { items, name } = await fetchRows(homeId);
      store = {
        userId,
        homeId,
        memberCount: people.length,
        others: people.filter((p) => p.profile_id !== userId).map((p) => firstName(p.profiles?.display_name)),
        items: saving ? store?.items ?? items : items,
        name,
        loaded: true,
        error: null,
      };
      lastLoad = Date.now();
      if (people.length >= 2) listen(homeId);
      else stopListening();
    } catch (loadError) {
      // Most likely the database step for the Home page hasn't been run yet:
      // the Home page just doesn't show.
      store = { userId, homeId: null, memberCount: 0, others: [], items: [], name: DEFAULT_HOME_PAGE_NAME, loaded: true, error: (loadError as Error).message };
    } finally {
      loading = null;
      notify();
    }
  })();
  return loading;
}

async function refresh() {
  const homeId = store?.homeId;
  if (!store || !homeId) return;
  if (saving) {
    stale = true;
    return;
  }
  try {
    const fresh = await fetchRows(homeId);
    if (saving) {
      stale = true;
      return;
    }
    if (store?.homeId === homeId) {
      store = { ...store, ...fresh };
      notify();
    }
  } catch {
    // Keep what's showing; the next change or visit tries again.
  }
}

function scheduleRefresh() {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    refreshTimer = null;
    void refresh();
  }, 350);
}

function listen(homeId: string) {
  if (channelHome === homeId && channel) return;
  stopListening();
  channelHome = homeId;
  channel = supabase
    .channel(`home-hearth-${homeId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "home_hearth_items", filter: `home_id=eq.${homeId}` }, scheduleRefresh)
    .subscribe();
}

function stopListening() {
  if (channel) void supabase.removeChannel(channel);
  channel = null;
  channelHome = null;
}

// Save the Home page's things: only what changed is written.
async function saveItems(next: HearthItem[]) {
  if (!store?.homeId) return;
  const { homeId, userId } = store;
  const before = store.items;
  store = { ...store, items: next };
  notify();
  const diff = diffHomeItems(before, next);
  const now = new Date().toISOString();
  const row = (item: HearthItem) => ({ home_id: homeId, id: item.id, item, removed: false, updated_by: userId, updated_at: now });
  saving += 1;
  try {
    const writes = [];
    if (diff.added.length) {
      const base = Date.now();
      writes.push(
        supabase.from("home_hearth_items").upsert(
          diff.added.map((item, n) => ({ ...row(item), position: base + n })),
          { onConflict: "home_id,id" }
        )
      );
    }
    if (diff.changed.length) {
      writes.push(supabase.from("home_hearth_items").upsert(diff.changed.map(row), { onConflict: "home_id,id" }));
    }
    if (diff.removed.length) {
      writes.push(
        supabase
          .from("home_hearth_items")
          .update({ removed: true, updated_by: userId, updated_at: now })
          .eq("home_id", homeId)
          .in("id", diff.removed)
      );
    }
    const results = await Promise.all(writes);
    const failed = results.find((r) => r.error)?.error;
    if (failed) {
      stale = true;
      throw failed;
    }
  } finally {
    saving -= 1;
    if (!saving && stale) {
      stale = false;
      void refresh();
    }
  }
}

async function rename(name: string) {
  if (!store?.homeId) return;
  const clean = name.trim().slice(0, 20);
  store = { ...store, name: clean || DEFAULT_HOME_PAGE_NAME };
  notify();
  const { error } = await supabase.from("homes").update({ hearth_page_name: clean || null }).eq("id", store.homeId);
  if (error) throw error;
}

function setOnHomePage(on: boolean) {
  if (onHomePage === on) return;
  onHomePage = on;
  notify();
}

export function useHomeHearth() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [, rerender] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    listeners.add(rerender);
    if (userId && (!store || store.userId !== userId)) void load(userId);
    return () => {
      listeners.delete(rerender);
    };
  }, [userId]);

  // Coming back to a screen: catch up (someone may have joined the Home).
  useFocusEffect(
    useCallback(() => {
      if (userId && store?.loaded && Date.now() - lastLoad > 10_000) void load(userId);
    }, [userId])
  );

  const mine = store && store.userId === userId ? store : null;
  const available = Boolean(mine?.homeId && mine.memberCount >= 2 && !mine.error);
  return {
    available,
    loaded: Boolean(mine?.loaded),
    homeId: mine?.homeId ?? null,
    others: mine?.others ?? [],
    items: mine?.items ?? [],
    name: mine?.name ?? DEFAULT_HOME_PAGE_NAME,
    onHomePage: available && onHomePage,
    setOnHomePage,
    saveItems,
    rename,
  };
}
