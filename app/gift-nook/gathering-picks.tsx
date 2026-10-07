import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, Switch, Text, TouchableOpacity, View } from "react-native";

import { useAuth } from "../../lib/auth-context";
import {
  GIFT_SELECT,
  isGiftShown,
  loadGiftPicks,
  type Gift,
  type GiftPicks,
} from "../../lib/gift-nook";
import { supabase } from "../../lib/supabase";
import { colors, ui } from "../../lib/theme";

// GIFT-017: pick which of your gifts show for one Gathering — e.g. only
// money for your birthday, everything for Christmas. Saves on every toggle.
// ?profileId=... picks for a kid you manage instead (GIFT-020).
export default function GatheringPicks() {
  const { gatheringId, profileId } = useLocalSearchParams<{ gatheringId: string; profileId?: string }>();
  const { session } = useAuth();
  const userId = session?.user.id;

  const [title, setTitle] = useState("");
  const [wishbookId, setWishbookId] = useState<string | null>(null);
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [picks, setPicks] = useState<GiftPicks>({ picks: new Map(), includeNew: true });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const [gatheringResult, wishbookResult] = await Promise.all([
        supabase.from("gatherings").select("title").eq("id", gatheringId).single(),
        supabase.from("wishbooks").select("id").eq("owner_id", profileId ?? userId).single(),
      ]);
      setTitle(gatheringResult.data?.title ?? "");
      const wishbook = wishbookResult.data;
      if (!wishbook) {
        setError("Couldn't find your Wishbook.");
        setIsLoading(false);
        return;
      }
      setWishbookId(wishbook.id);
      const [giftsResult, loadedPicks] = await Promise.all([
        supabase
          .from("gifts")
          .select(GIFT_SELECT)
          .eq("wishbook_id", wishbook.id)
          .is("received_at", null)
          .is("suggested_by", null)
          .order("created_at", { ascending: false }),
        loadGiftPicks(gatheringId, wishbook.id),
      ]);
      setGifts((giftsResult.data ?? []) as unknown as Gift[]);
      setPicks(loadedPicks);
      setIsLoading(false);
    })();
  }, [gatheringId, profileId, userId]);

  async function setGiftsIncluded(giftIds: string[], included: boolean) {
    const next = new Map(picks.picks);
    for (const id of giftIds) next.set(id, included);
    setPicks({ ...picks, picks: next });
    const { error: saveError } = await supabase.from("gathering_gifts").upsert(
      giftIds.map((giftId) => ({ gathering_id: gatheringId, gift_id: giftId, included })),
      { onConflict: "gathering_id,gift_id" }
    );
    if (saveError) setError(saveError.message);
  }

  async function setIncludeNew(includeNew: boolean) {
    setPicks((prev) => ({ ...prev, includeNew }));
    const { error: saveError } = await supabase
      .from("gathering_wishbook_settings")
      .upsert(
        { gathering_id: gatheringId, wishbook_id: wishbookId, include_new: includeNew },
        { onConflict: "gathering_id,wishbook_id" }
      );
    if (saveError) setError(saveError.message);
  }

  async function setAll(included: boolean) {
    await setIncludeNew(included);
    if (gifts.length) await setGiftsIncluded(gifts.map((g) => g.id), included);
  }

  if (isLoading) {
    return (
      <View style={ui.center}>
        <ActivityIndicator />
      </View>
    );
  }

  const shownCount = gifts.filter((g) => isGiftShown(g.id, picks)).length;

  return (
    <ScrollView contentContainerStyle={ui.screen}>
      <Stack.Screen options={{ title: "Your gifts here" }} />
      <Text style={ui.muted}>
        Choose which of your gifts family sees for {title || "this Gathering"}. Your Wishbook itself
        doesn't change.
      </Text>
      {error ? <Text style={ui.error}>{error}</Text> : null}

      <View style={ui.row}>
        <TouchableOpacity style={[ui.secondaryButton, { flex: 1 }]} onPress={() => setAll(true)}>
          <Text style={ui.secondaryButtonText}>Show all</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[ui.secondaryButton, { flex: 1 }]} onPress={() => setAll(false)}>
          <Text style={ui.secondaryButtonText}>Hide all</Text>
        </TouchableOpacity>
      </View>

      <Text style={ui.muted}>
        Showing {shownCount} of {gifts.length} gift{gifts.length === 1 ? "" : "s"}.
      </Text>

      {gifts.map((gift) => (
        <View key={gift.id} style={[ui.card, ui.row]}>
          <View style={{ flex: 1 }}>
            <Text style={ui.cardTitle}>{gift.title}</Text>
            <Text style={ui.muted}>{gift.shelves?.label ?? "Other"}</Text>
          </View>
          <Switch
            value={isGiftShown(gift.id, picks)}
            onValueChange={(value) => setGiftsIncluded([gift.id], value)}
            trackColor={{ true: colors.bark }}
          />
        </View>
      ))}

      <View style={[ui.row, { marginTop: 8 }]}>
        <View style={{ flex: 1 }}>
          <Text style={ui.cardTitle}>Include gifts I add later</Text>
          <Text style={ui.muted}>Turn off if you only want the gifts you picked above.</Text>
        </View>
        <Switch
          value={picks.includeNew}
          onValueChange={setIncludeNew}
          trackColor={{ true: colors.bark }}
        />
      </View>
    </ScrollView>
  );
}
