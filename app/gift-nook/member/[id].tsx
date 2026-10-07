import { Redirect, Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { NookScroll } from "../../../components/nook-scroll";
import { GiftCard } from "../../../components/gift-card";
import { useAuth } from "../../../lib/auth-context";
import {
  displayName,
  GIFT_SELECT,
  giftChangedSince,
  isActiveTuck,
  isGiftShown,
  loadGiftPicks,
  sortGifts,
  TUCK_SELECT,
  tuckStatusLabel,
  type Gift,
  type Tuck,
} from "../../../lib/gift-nook";
import { friendlyError, tap } from "../../../lib/feedback";
import { giftNookSettingDefaults, useNookSettings } from "../../../lib/nook-settings";
import { supabase } from "../../../lib/supabase";
import { colors, ui } from "../../../lib/theme";

type FamilyGift = Gift & { claims: Tuck[] };

// Browse by budget (GIFT-033). Gifts without a price show under every budget.
const budgets = [
  { label: "Any price", max: null },
  { label: "Under $25", max: 25 },
  { label: "Under $50", max: 50 },
  { label: "Under $100", max: 100 },
] as const;

// Someone else's Wishbook, seen by family (GIFT-005/006/008/009/013). This is
// the only place a Wishbook is shown with its tucks. It redirects away if
// you open your own — and RLS returns no claims to an owner regardless
// (GIFT-007).
//
//   ?gatheringId=...  only the gifts the owner picked for that Gathering
//                     (GIFT-017); tucks made here are tied to it (GIFT-026).
//
// Managers of a kid's profile (GIFT-020) see this same view — including
// tucks, by Josh's choice — plus add/edit buttons. Everyone else can leave
// suggestions, hidden from the owner (GIFT-022).
export default function MemberWishbook() {
  const router = useRouter();
  const { id: profileId, gatheringId } = useLocalSearchParams<{
    id: string;
    gatheringId?: string;
  }>();
  const { session } = useAuth();
  const userId = session?.user.id;
  const { settings } = useNookSettings("gift-nook", giftNookSettingDefaults);

  const [name, setName] = useState("");
  const [isManaged, setIsManaged] = useState(false);
  const [isManager, setIsManager] = useState(false);
  const [gifts, setGifts] = useState<FamilyGift[]>([]);
  const [gatheringTitle, setGatheringTitle] = useState<string | null>(null);
  const [hiddenByPicks, setHiddenByPicks] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shelfFilter, setShelfFilter] = useState<string | null>(null);
  const [budget, setBudget] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    const [profileResult, wishbookResult, managerResult] = await Promise.all([
      supabase.from("profiles").select("id, display_name, is_managed").eq("id", profileId).single(),
      supabase.from("wishbooks").select("id").eq("owner_id", profileId).single(),
      supabase
        .from("profile_managers")
        .select("profile_id")
        .eq("profile_id", profileId)
        .eq("manager_id", userId),
    ]);
    setName(displayName(profileResult.data));
    setIsManaged(Boolean(profileResult.data?.is_managed));
    setIsManager(Boolean(managerResult.data?.length));
    if (wishbookResult.error || !wishbookResult.data) {
      setError("You can only see Wishbooks of people who share a Burrow with you.");
      setIsLoading(false);
      return;
    }
    const wishbookId = wishbookResult.data.id;
    const [giftsResult, picks, gatheringResult] = await Promise.all([
      supabase
        .from("gifts")
        .select(`${GIFT_SELECT}, claims(${TUCK_SELECT})`)
        .eq("wishbook_id", wishbookId)
        .is("received_at", null)
        .order("created_at", { ascending: false }),
      gatheringId ? loadGiftPicks(gatheringId, wishbookId) : null,
      gatheringId
        ? supabase.from("gatherings").select("title").eq("id", gatheringId).single()
        : null,
    ]);
    if (giftsResult.error) {
      setError(giftsResult.error.message);
    } else {
      const all = (giftsResult.data ?? []) as unknown as FamilyGift[];
      const shown = picks
        ? all.filter((gift) => gift.removed_at || isGiftShown(gift.id, picks))
        : all;
      setGifts(sortGifts(shown));
      setHiddenByPicks(all.length - shown.length);
    }
    setGatheringTitle(gatheringResult?.data?.title ?? null);
    setIsLoading(false);
  }, [profileId, gatheringId, userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (profileId === userId) {
    return <Redirect href="/gift-nook/wishbook" />;
  }

  async function run(
    id: string,
    action: () => PromiseLike<{ error: { message: string; code?: string } | null }>,
    successFeel?: "light" | "success"
  ) {
    setBusyId(id);
    const { error: actionError } = await action();
    setBusyId(null);
    if (actionError) Alert.alert("Couldn't do that", friendlyError(actionError));
    else if (successFeel) tap(successFeel);
    load();
  }

  const tuck = (gift: FamilyGift) =>
    run(gift.id, () =>
      supabase
        .from("claims")
        .insert({ gift_id: gift.id, claimed_by: userId, gathering_id: gatheringId ?? null }),
      "success"
    );

  const setStatus = (mine: Tuck, status: "planning" | "bought") =>
    run(mine.id, () =>
      supabase.rpc("update_tuck", { claim_id: mine.id, new_status: status, new_note: mine.note }),
      "light"
    );

  const acknowledge = (mine: Tuck) =>
    run(mine.id, () => supabase.rpc("acknowledge_tuck", { claim_id: mine.id }));

  function confirmRelease(mine: Tuck) {
    Alert.alert("Release this gift?", "Someone else will be able to tuck it away instead.", [
      { text: "Keep it", style: "cancel" },
      {
        text: "Release",
        style: "destructive",
        onPress: () => run(mine.id, () => supabase.rpc("release_tuck", { claim_id: mine.id })),
      },
    ]);
  }

  function canEdit(gift: FamilyGift) {
    return isManager || gift.suggested_by === userId;
  }

  function tuckFooter(gift: FamilyGift) {
    const active = gift.claims.filter(isActiveTuck);
    const mine = active.find((c) => c.claimed_by === userId);
    const others = active.filter((c) => c.claimed_by !== userId);
    const isBusy = busyId === gift.id || busyId === mine?.id;

    // GIFT-024: co-givers by name, with their status and notes.
    const giverList =
      others.length > 0 ? (
        <View style={styles.givers}>
          {others.map((other) => (
            <Text key={other.id} style={styles.giver}>
              <Text style={{ fontWeight: "600" }}>{displayName(other.profiles)}</Text> ·{" "}
              {tuckStatusLabel[other.status]}
              {other.note ? <Text style={styles.note}> — “{other.note}”</Text> : null}
            </Text>
          ))}
        </View>
      ) : null;

    if (gift.removed_at) {
      return mine ? (
        <View style={[styles.banner, { backgroundColor: "#fdecea" }]}>
          <Text style={styles.bannerText}>
            {name} removed this from their list. You'd tucked it ({tuckStatusLabel[mine.status].toLowerCase()}).
          </Text>
          <Text style={ui.link} onPress={() => run(mine.id, () => supabase.rpc("release_tuck", { claim_id: mine.id }))}>
            Release it
          </Text>
        </View>
      ) : null;
    }

    if (mine) {
      return (
        <View style={{ marginTop: 8, gap: 6 }}>
          {giftChangedSince(gift, mine) ? (
            <View style={[styles.banner, { backgroundColor: "#fff4d6" }]}>
              <Text style={styles.bannerText}>✏️ {name}'s list changed this gift since you tucked it.</Text>
              <Text style={ui.link} onPress={() => acknowledge(mine)}>
                Got it
              </Text>
            </View>
          ) : null}
          <Text style={{ color: colors.bark, fontWeight: "700" }}>
            ✓ You tucked this · {tuckStatusLabel[mine.status]}
          </Text>
          {mine.note ? <Text style={styles.note}>Your note: “{mine.note}”</Text> : null}
          {giverList}
          <View style={[ui.row, { flexWrap: "wrap" }]}>
            <TouchableOpacity
              style={[ui.chip, mine.status === "bought" && ui.chipSelected]}
              disabled={isBusy}
              onPress={() => setStatus(mine, mine.status === "bought" ? "planning" : "bought")}
            >
              <Text style={[ui.chipText, mine.status === "bought" && ui.chipTextSelected]}>
                {mine.status === "bought" ? "Bought ✓" : "Mark bought"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={ui.chip}
              onPress={() => router.push(`/gift-nook/tuck/${mine.id}`)}
            >
              <Text style={ui.chipText}>{mine.note ? "Edit note" : "Add note"}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={ui.chip} disabled={isBusy} onPress={() => confirmRelease(mine)}>
              <Text style={ui.chipText}>Release</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    if (!gift.is_repeatable && active.length > 0) {
      return (
        <View style={{ marginTop: 8 }}>
          <Text style={ui.muted}>🤫 Already tucked away</Text>
          {giverList}
        </View>
      );
    }

    return (
      <View style={{ marginTop: 8, gap: 6 }}>
        {others.length > 0 ? <Text style={ui.muted}>Also giving this:</Text> : null}
        {giverList}
        <TouchableOpacity style={ui.button} onPress={() => tuck(gift)} disabled={isBusy}>
          {isBusy ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={ui.buttonText}>Tuck it away (I'll get this)</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  // Gift Nook setting: hide one-and-done gifts someone else already tucked
  // away. Gifts you tucked yourself always stay, so you can manage them.
  const notTaken = settings.hideTakenGifts
    ? gifts.filter(
        (gift) =>
          gift.is_repeatable ||
          gift.claims.some((c) => isActiveTuck(c) && c.claimed_by === userId) ||
          !gift.claims.some(isActiveTuck)
      )
    : gifts;
  const hiddenTakenCount = gifts.length - notTaken.length;
  const visibleGifts = notTaken.filter(
    (gift) =>
      (!shelfFilter || gift.shelves?.key === shelfFilter) &&
      (budget == null || gift.price == null || gift.price <= budget)
  );
  const shelvesHere = [
    ...new Map(gifts.filter((g) => g.shelves).map((g) => [g.shelves!.key, g.shelves!.label])),
  ];

  if (isLoading) {
    return (
      <View style={ui.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <NookScroll onRefresh={load}>
      <Stack.Screen options={{ title: `${name}'s Wishbook` }} />
      {error ? <Text style={ui.error}>{error}</Text> : null}

      <Text style={ui.muted}>
        {isManaged && isManager
          ? `👶 You help manage ${name}'s list, so you can see what's been tucked away to coordinate.`
          : `🤫 ${name} can't see anything you tuck away or suggest — it stays a surprise.`}
      </Text>

      {gatheringTitle ? (
        <Text style={ui.muted}>
          Showing what {name} picked for {gatheringTitle}.
          {hiddenByPicks > 0 ? (
            <Text style={ui.link} onPress={() => router.push(`/gift-nook/member/${profileId}`)}>
              {" "}See full Wishbook ({hiddenByPicks} more)
            </Text>
          ) : null}
        </Text>
      ) : null}

      <View style={ui.row}>
        {isManager ? (
          <>
            <TouchableOpacity
              style={[ui.button, { flex: 1 }]}
              onPress={() =>
                router.push({ pathname: "/gift-nook/gift-form", params: { forProfileId: profileId } })
              }
            >
              <Text style={ui.buttonText}>+ Add a gift</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[ui.secondaryButton, { flex: 1 }]}
              onPress={() => router.push(`/gift-nook/managed/${profileId}`)}
            >
              <Text style={ui.secondaryButtonText}>Manage {name}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={[ui.secondaryButton, { flex: 1 }]}
            onPress={() =>
              router.push({ pathname: "/gift-nook/gift-form", params: { forProfileId: profileId } })
            }
          >
            <Text style={ui.secondaryButtonText}>💡 Suggest a gift (hidden from {name})</Text>
          </TouchableOpacity>
        )}
      </View>

      {gifts.length > 4 ? (
        <View style={{ gap: 8 }}>
          <View style={ui.chips}>
            {[[null, "All"] as const, ...shelvesHere].map(([key, label]) => {
              const selected = shelfFilter === key;
              return (
                <TouchableOpacity
                  key={key ?? "all"}
                  style={[ui.chip, selected && ui.chipSelected]}
                  onPress={() => setShelfFilter(key)}
                >
                  <Text style={[ui.chipText, selected && ui.chipTextSelected]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={ui.chips}>
            {budgets.map((option) => {
              const selected = budget === option.max;
              return (
                <TouchableOpacity
                  key={option.label}
                  style={[ui.chip, selected && ui.chipSelected]}
                  onPress={() => setBudget(option.max)}
                >
                  <Text style={[ui.chipText, selected && ui.chipTextSelected]}>{option.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ) : null}

      {gifts.length === 0 && !error ? (
        <Text style={ui.muted}>{name} hasn't added any gifts yet.</Text>
      ) : visibleGifts.length === 0 ? (
        <Text style={ui.muted}>Nothing matches those filters.</Text>
      ) : (
        visibleGifts.map((gift) => (
          <GiftCard
            key={gift.id}
            gift={gift}
            onPress={
              canEdit(gift) && !gift.removed_at
                ? () => router.push({ pathname: "/gift-nook/gift-form", params: { giftId: gift.id } })
                : undefined
            }
            footer={tuckFooter(gift)}
          />
        ))
      )}
      {hiddenTakenCount > 0 ? (
        <Text style={ui.muted}>
          {hiddenTakenCount} already-taken gift{hiddenTakenCount === 1 ? "" : "s"} hidden (change
          this in Gift Nook settings).
        </Text>
      ) : null}
    </NookScroll>
  );
}

const styles = StyleSheet.create({
  givers: { gap: 2 },
  giver: { fontSize: 14, color: colors.text },
  note: { fontSize: 14, color: colors.muted, fontStyle: "italic" },
  banner: { borderRadius: 10, padding: 10, gap: 4, marginTop: 8 },
  bannerText: { fontSize: 14, color: colors.text },
});
