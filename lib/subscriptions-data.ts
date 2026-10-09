import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";

import { guarded } from "./feedback";
import { displayName } from "./gift-nook";
import { localDay } from "./pets";
import { current, monthlyCents, sortByRenewal, totals, type PriceEntry, type Status, type Subscription } from "./subscriptions";
import { supabase } from "./supabase";

// Loads your Home's subscriptions (SUB-001..012) with everything their
// screens need. Row level security means only your Home's come back, and
// nobody else's "Just me" ones.

export type SubscriptionsData = {
  homeId: string;
  subs: Subscription[];
  // Every price each one has had (SUB-008), newest first.
  prices: PriceEntry[];
  // Who lives in your Home, for picking who pays (SUB-005).
  members: { id: string; name: string }[];
  // Names for everyone mentioned, including people who've moved out.
  names: Map<string, string>;
  today: string;
};

export async function loadSubscriptions(userId: string): Promise<SubscriptionsData> {
  const { data: homeId, error: homeError } = await supabase.rpc("my_home");
  if (homeError) throw homeError;

  const [subsResult, pricesResult, membersResult] = await Promise.all([
    supabase.from("subscriptions").select("*").eq("home_id", homeId).order("renews_on"),
    supabase
      .from("subscription_prices")
      .select("id, subscription_id, price_cents, cycle, changed_on, changed_by, created_at")
      .order("created_at", { ascending: false })
      .limit(2000),
    supabase.from("home_members").select("profile_id").eq("home_id", homeId),
  ]);
  if (subsResult.error) throw subsResult.error;
  if (pricesResult.error) throw pricesResult.error;

  const subs = (subsResult.data ?? []) as Subscription[];
  const prices = (pricesResult.data ?? []) as PriceEntry[];
  const memberIds = ((membersResult.data ?? []) as { profile_id: string }[]).map((m) => m.profile_id);

  const ids = new Set<string>([userId, ...memberIds]);
  for (const s of subs) {
    if (s.payer) ids.add(s.payer);
    if (s.created_by) ids.add(s.created_by);
  }
  for (const p of prices) if (p.changed_by) ids.add(p.changed_by);
  const { data: profiles } = await supabase.from("profiles").select("id, display_name").in("id", [...ids]);
  const names = new Map(
    ((profiles ?? []) as { id: string; display_name: string | null }[]).map((p) => [p.id, displayName(p)])
  );
  const members = memberIds
    .map((id) => ({ id, name: names.get(id) ?? "Someone" }))
    .sort((a, b) => (a.id === userId ? -1 : b.id === userId ? 1 : a.name.localeCompare(b.name)));

  return { homeId, subs, prices, members, names, today: localDay() };
}

// Your Home's subscriptions for a screen, fresh each time it comes into view.
export function useSubscriptions(userId: string | undefined) {
  const [data, setData] = useState<SubscriptionsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const reload = useCallback(
    () =>
      userId
        ? guarded(
            async () => {
              setData(await loadSubscriptions(userId));
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
export function personName(data: Pick<SubscriptionsData, "names">, id: string | null, userId: string | undefined) {
  if (!id) return "Someone";
  return id === userId ? "You" : data.names.get(id) ?? "Someone";
}

// Yours: you pay for it, or it's "Just me".
export function isMine(sub: Pick<Subscription, "payer" | "private">, userId: string | undefined) {
  return sub.private || (!!userId && sub.payer === userId);
}

// --- Changes -------------------------------------------------------------------------------

// Pause or cancel (SUB-010). It stays in the Nook, counting what it saves.
export async function stopSubscription(id: string, status: Exclude<Status, "active">, onDay = localDay()) {
  const { error } = await supabase.from("subscriptions").update({ status, stopped_on: onDay }).eq("id", id);
  return { error };
}

// Start it again, with its next charge on `renewsOn`.
export async function resumeSubscription(id: string, renewsOn: string) {
  const { error } = await supabase
    .from("subscriptions")
    .update({ status: "active", stopped_on: null, renews_on: renewsOn, on_trial: false })
    .eq("id", id);
  return { error };
}

// --- What the Hearth shows (SUB-006) -------------------------------------------------------

export type SubscriptionsSummary = {
  count: number;
  monthly: number;
  yearly: number;
  trials: number;
  // Active ones, soonest renewal first, each with what it costs a month.
  next: { id: string; name: string; renews_on: string; on_trial: boolean; price_cents: number; monthly: number; mine: boolean }[];
  today: string;
};

export function useSubscriptionsSummary(userId: string | undefined, refreshKey: number) {
  const [summary, setSummary] = useState<SubscriptionsSummary | null>(null);

  useEffect(() => {
    if (!userId) return;
    let live = true;
    loadSubscriptions(userId)
      .then((data) => {
        if (!live) return;
        const active = data.subs.filter((s) => s.status === "active");
        const sum = totals(active, data.today);
        setSummary({
          count: active.length,
          monthly: sum.monthly,
          yearly: sum.yearly,
          trials: sum.trials,
          next: sortByRenewal(active, data.today).map((s) => {
            const now = current(s, data.today);
            return {
              id: s.id,
              name: s.name,
              renews_on: now.renews_on,
              on_trial: now.on_trial,
              price_cents: s.price_cents,
              monthly: monthlyCents(s),
              mine: isMine(s, userId),
            };
          }),
          today: data.today,
        });
      })
      .catch(() => live && setSummary(null));
    return () => {
      live = false;
    };
  }, [userId, refreshKey]);

  return summary;
}
