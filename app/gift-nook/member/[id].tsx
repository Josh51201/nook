import { Redirect, Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { GiftCard } from "../../../components/gift-card";
import { useAuth } from "../../../lib/auth-context";
import { displayName, GIFT_SELECT, type Gift, type Tuck } from "../../../lib/gift-nook";
import { supabase } from "../../../lib/supabase";
import { colors, ui } from "../../../lib/theme";

type FamilyGift = Gift & { claims: Tuck[] };

// Someone else's Wishbook, seen by family (GIFT-005/006/008/009/013). This is
// the only screen that reads claims ("Tucks"). It redirects away if you open
// your own — and RLS returns no claims to the owner regardless (GIFT-007).
export default function MemberWishbook() {
  const { id: profileId } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const userId = session?.user.id;

  const [name, setName] = useState("");
  const [gifts, setGifts] = useState<FamilyGift[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyGiftId, setBusyGiftId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [profileResult, wishbookResult] = await Promise.all([
      supabase.from("profiles").select("id, display_name").eq("id", profileId).single(),
      supabase.from("wishbooks").select("id").eq("owner_id", profileId).single(),
    ]);
    setName(displayName(profileResult.data));
    if (wishbookResult.error || !wishbookResult.data) {
      setError("You can only see Wishbooks of people who share a Burrow with you.");
      setIsLoading(false);
      return;
    }
    const { data, error: giftsError } = await supabase
      .from("gifts")
      .select(`${GIFT_SELECT}, claims(id, claimed_by, released_at)`)
      .eq("wishbook_id", wishbookResult.data.id)
      .order("created_at", { ascending: false });
    if (giftsError) setError(giftsError.message);
    else setGifts((data ?? []) as unknown as FamilyGift[]);
    setIsLoading(false);
  }, [profileId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (profileId === userId) {
    return <Redirect href="/gift-nook/wishbook" />;
  }

  async function tuck(gift: FamilyGift) {
    setBusyGiftId(gift.id);
    const { error: tuckError } = await supabase
      .from("claims")
      .insert({ gift_id: gift.id, claimed_by: userId });
    setBusyGiftId(null);
    if (tuckError) Alert.alert("Couldn't tuck it away", tuckError.message);
    load();
  }

  async function release(tuckId: string) {
    setBusyGiftId(tuckId);
    const { error: releaseError } = await supabase.rpc("release_tuck", { claim_id: tuckId });
    setBusyGiftId(null);
    if (releaseError) Alert.alert("Couldn't release it", releaseError.message);
    load();
  }

  function confirmRelease(tuckId: string) {
    Alert.alert("Release this gift?", "Someone else will be able to tuck it away instead.", [
      { text: "Keep it", style: "cancel" },
      { text: "Release", style: "destructive", onPress: () => release(tuckId) },
    ]);
  }

  function tuckFooter(gift: FamilyGift) {
    const active = gift.claims.filter((c) => !c.released_at);
    const mine = active.find((c) => c.claimed_by === userId);
    const othersCount = active.length - (mine ? 1 : 0);
    const isBusy = busyGiftId === gift.id || busyGiftId === mine?.id;

    // Who tucked it is hidden for now — Q-005/Q-016 are still open.
    const othersNote =
      othersCount > 0
        ? `${othersCount} other${othersCount === 1 ? " is" : "s are"} giving this too`
        : null;

    if (mine) {
      return (
        <View style={{ marginTop: 8, gap: 4 }}>
          <Text style={{ color: colors.bark, fontWeight: "600" }}>✓ You tucked this away</Text>
          {othersNote ? <Text style={ui.muted}>{othersNote}</Text> : null}
          <Text style={ui.link} onPress={() => !isBusy && confirmRelease(mine.id)}>
            Release it
          </Text>
        </View>
      );
    }

    if (!gift.is_repeatable && active.length > 0) {
      return (
        <Text style={[ui.muted, { marginTop: 8 }]}>🤫 Already tucked away by someone</Text>
      );
    }

    return (
      <View style={{ marginTop: 8, gap: 6 }}>
        {othersNote ? <Text style={ui.muted}>{othersNote}</Text> : null}
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

  if (isLoading) {
    return (
      <View style={ui.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={ui.screen}
      refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
    >
      <Stack.Screen options={{ title: `${name}'s Wishbook` }} />
      {error ? <Text style={ui.error}>{error}</Text> : null}
      <Text style={ui.muted}>
        🤫 {name} can't see anything you tuck away — it stays a surprise.
      </Text>
      {gifts.length === 0 && !error ? (
        <Text style={ui.muted}>{name} hasn't added any gifts yet.</Text>
      ) : (
        gifts.map((gift) => <GiftCard key={gift.id} gift={gift} footer={tuckFooter(gift)} />)
      )}
    </ScrollView>
  );
}
