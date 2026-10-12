import * as Notifications from "expo-notifications";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";

import { guarded } from "./feedback";
import { displayName } from "./gift-nook";
import { guessAisle, isWaiting, itemKey, mergeAmount, mergeSource, sortLists, type Aisle, type GroceryItem, type GroceryList } from "./groceries";
import { localDay } from "./pets";
import { canRemind, configureReminders } from "./reminders";
import { supabase } from "./supabase";
import { useHearthData } from "./hearth-data";

// Loads and saves the Grocery List Nook (GROC-001..009): your lists and the
// shared ones of people you live with (row level security decides which),
// with their items.

const LIST_FIELDS = "id, owner_id, name, shared, created_at";
const ITEM_FIELDS = "id, list_id, name, amount, aisle, source, potluck_id, show_from, checked, added_by, created_at";

export type Groceries = {
  lists: GroceryList[];
  items: GroceryItem[];
  // Names of whoever owns a list shared with you.
  names: Map<string, string>;
};

export async function loadGroceries(userId: string): Promise<Groceries> {
  const { data: listRows, error } = await supabase.from("grocery_lists").select(LIST_FIELDS);
  if (error) throw error;
  const lists = sortLists((listRows ?? []) as GroceryList[], userId);
  const { data: itemRows, error: itemError } = lists.length
    ? await supabase.from("grocery_items").select(ITEM_FIELDS).in("list_id", lists.map((l) => l.id)).order("created_at").limit(3000)
    : { data: [], error: null };
  if (itemError) throw itemError;

  const owners = [...new Set(lists.filter((l) => l.owner_id !== userId).map((l) => l.owner_id))];
  const names = new Map<string, string>();
  if (owners.length) {
    const { data: people } = await supabase.from("profiles").select("id, display_name").in("id", owners);
    for (const p of (people ?? []) as { id: string; display_name: string | null }[]) names.set(p.id, displayName(p));
  }
  return { lists, items: (itemRows ?? []) as GroceryItem[], names };
}

// The first time you open the Nook (GROC-001): a "Groceries" list shared
// with your Home, unless someone you live with already shares one.
let makingFirst: Promise<boolean> | null = null;
export async function ensureFirstList(userId: string, data: Groceries) {
  if (data.lists.length) return false;
  // Two loads at once (coming into view, a live update) make one list.
  makingFirst ??= Promise.resolve(supabase.from("grocery_lists").insert({ owner_id: userId, name: "Groceries", shared: true }))
    .then(({ error }) => !error)
    .finally(() => setTimeout(() => (makingFirst = null), 3000));
  return makingFirst;
}

// Everything for the Nook's screens: fresh when a screen comes into view,
// and live while it's open, so two people shopping from one shared list see
// each other's ticks (GROC-004).
export function useGroceries(userId: string | undefined, { makeFirst = false } = {}) {
  const [data, setData] = useState<Groceries | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const reload = useCallback(
    () =>
      userId
        ? guarded(
            async () => {
              let next = await loadGroceries(userId);
              if (makeFirst && (await ensureFirstList(userId, next))) next = await loadGroceries(userId);
              setData(next);
              setError(null);
            },
            setError,
            () => setIsLoading(false)
          )
        : Promise.resolve(),
    [userId, makeFirst]
  );

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`groceries-${userId}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "grocery_items" }, () => void reload())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, reload]);

  return { data, setData, error, isLoading, reload };
}

// For the Hearth (GROC-007), reloaded when the Hearth refreshes.
export function useGroceriesSummary(userId: string | undefined, refreshKey: number) {
  // Remembered between Hearth pages, so a page you've seen shows at once (CORE-104).
  return useHearthData<Groceries>(userId ? `groceries:${userId}` : null, refreshKey, () => loadGroceries(userId!));
}

// --- Items ---------------------------------------------------------------------------

export type ItemDraft = {
  name: string;
  amount?: string | null;
  aisle?: Aisle;
  source?: string | null;
  potluck_id?: string | null;
  show_from?: string | null;
};

// Put things on a list (GROC-003, GROC-005, GROC-006). Something already
// there and not yet in the cart (and waiting, or not, the same way) is added
// to instead of written twice: "2 cups" and "1 cup" make "3 cups".
export async function addItems(listId: string, drafts: ItemDraft[], onList: GroceryItem[]) {
  const today = localDay();
  const open = onList.filter((i) => i.list_id === listId && !i.checked);
  const inserts: Record<string, unknown>[] = [];
  const updates = new Map<string, { amount: string | null; source: string | null }>();
  let merged = 0;

  for (const draft of drafts) {
    const name = draft.name.trim().slice(0, 80);
    if (!name) continue;
    const waiting = !!draft.show_from && draft.show_from > today;
    const same = open.find((i) => itemKey(i.name) === itemKey(name) && isWaiting(i, today) === waiting && (!waiting || i.show_from === draft.show_from));
    if (same) {
      const before = updates.get(same.id) ?? { amount: same.amount, source: same.source };
      updates.set(same.id, { amount: mergeAmount(before.amount, draft.amount ?? null), source: mergeSource(before.source, draft.source ?? null) });
      merged++;
      continue;
    }
    const pending = inserts.find((row) => itemKey(row.name as string) === itemKey(name) && row.show_from === (waiting ? draft.show_from : null));
    if (pending) {
      pending.amount = mergeAmount(pending.amount as string | null, draft.amount ?? null);
      pending.source = mergeSource(pending.source as string | null, draft.source ?? null);
      merged++;
      continue;
    }
    inserts.push({
      list_id: listId,
      name,
      amount: draft.amount?.trim().slice(0, 60) || null,
      aisle: draft.aisle ?? guessAisle(name),
      source: draft.source?.slice(0, 80) || null,
      potluck_id: draft.potluck_id ?? null,
      show_from: waiting ? draft.show_from : null,
    });
  }

  if (inserts.length) {
    const { error } = await supabase.from("grocery_items").insert(inserts);
    if (error) return { error: error.message, added: 0, merged: 0 };
  }
  for (const [id, change] of updates) {
    const { error } = await supabase.from("grocery_items").update(change).eq("id", id);
    if (error) return { error: error.message, added: inserts.length, merged: 0 };
  }
  return { error: null, added: inserts.length, merged };
}

export async function updateItem(id: string, change: Partial<Pick<GroceryItem, "name" | "amount" | "aisle" | "checked" | "show_from" | "list_id">>) {
  const { error } = await supabase.from("grocery_items").update(change).eq("id", id);
  return { error: error?.message ?? null };
}

export async function removeItem(id: string) {
  const { error } = await supabase.from("grocery_items").delete().eq("id", id);
  return { error: error?.message ?? null };
}

// "Clear the cart" (GROC-004): take the ticked things off the list.
export async function clearCart(listId: string) {
  const { error } = await supabase.from("grocery_items").delete().eq("list_id", listId).eq("checked", true);
  return { error: error?.message ?? null };
}

// --- Lists ---------------------------------------------------------------------------

export async function createList(name: string, shared: boolean) {
  const { data, error } = await supabase.from("grocery_lists").insert({ name: name.trim(), shared }).select(LIST_FIELDS).single();
  if (error) return { error: error.message };
  return { list: data as GroceryList };
}

export async function updateList(id: string, change: Partial<Pick<GroceryList, "name" | "shared">>) {
  const { error } = await supabase.from("grocery_lists").update(change).eq("id", id);
  return { error: error?.message ?? null };
}

export async function deleteList(id: string) {
  const { error } = await supabase.from("grocery_lists").delete().eq("id", id);
  return { error: error?.message ?? null };
}

// --- Potluck shopping (GROC-006) -----------------------------------------------------

// A phone alert the morning Potluck shopping joins the list, on the phone
// that added it (local, so it works without push notifications, Q-032).
export async function schedulePotluckAlert(potluckId: string, potluckTitle: string, listName: string, day: string) {
  const at = new Date(`${day}T09:00:00`);
  if (at.getTime() <= Date.now() + 60_000) return;
  configureReminders();
  if (!(await canRemind())) return;
  const identifier = `grocery-potluck-${potluckId}`;
  await Notifications.cancelScheduledNotificationAsync(identifier).catch(() => {});
  await Notifications.scheduleNotificationAsync({
    identifier,
    content: { title: `It's ${potluckTitle} week`, body: `What you need for your dish is on ${listName} now.` },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: at,
      channelId: Platform.OS === "android" ? "reminders" : undefined,
    },
  }).catch(() => undefined);
}

// What you've put on your lists for one Potluck, for its page.
export async function potluckShopping(potluckId: string) {
  const { data } = await supabase.from("grocery_items").select("id, checked, show_from").eq("potluck_id", potluckId);
  return (data ?? []) as Pick<GroceryItem, "id" | "checked" | "show_from">[];
}
