import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Text, TouchableOpacity, View } from "react-native";

import { NookScroll } from "../../components/nook-scroll";
import { GiftCard } from "../../components/gift-card";
import { useAuth } from "../../lib/auth-context";
import { GIFT_SELECT, sortGifts, type Gift } from "../../lib/gift-nook";
import { supabase } from "../../lib/supabase";
import { ui } from "../../lib/theme";

// The owner's own Wishbook (GIFT-002, GIFT-012). GIFT-007: this screen never
// queries claims, and sorts only by Most wanted and creation date, so nothing
// here can hint at what's been tucked.
export default function MyWishbook() {
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user.id;

  const [gifts, setGifts] = useState<Gift[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    const { data: wishbook, error: wishbookError } = await supabase
      .from("wishbooks")
      .select("id")
      .eq("owner_id", userId)
      .single();
    if (wishbookError || !wishbook) {
      setError(wishbookError?.message ?? "Couldn't find your Wishbook.");
      setIsLoading(false);
      return;
    }
    const { data, error: giftsError } = await supabase
      .from("gifts")
      .select(GIFT_SELECT)
      .eq("wishbook_id", wishbook.id)
      .order("created_at", { ascending: false });
    if (giftsError) setError(giftsError.message);
    else setGifts(sortGifts((data ?? []) as unknown as Gift[]));
    setIsLoading(false);
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // GIFT-026: one-and-done gifts you checked off after a Gathering.
  const active = gifts.filter((gift) => !gift.received_at);
  const received = gifts.filter((gift) => gift.received_at);

  async function putBack(gift: Gift) {
    const { error: rpcError } = await supabase.rpc("unreceive_gift", { target_gift: gift.id });
    if (rpcError) Alert.alert("Couldn't put it back", rpcError.message);
    load();
  }

  if (isLoading) {
    return (
      <View style={ui.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <NookScroll onRefresh={load}>
      {error ? <Text style={ui.error}>{error}</Text> : null}

      <TouchableOpacity style={ui.button} onPress={() => router.push("/gift-nook/gift-form")}>
        <Text style={ui.buttonText}>+ Add a gift</Text>
      </TouchableOpacity>

      {active.length === 0 ? (
        <Text style={ui.muted}>
          Your Wishbook is empty. Add things you'd love — your family will see them in every Burrow
          you share. You'll never see who tucked what away; that stays a surprise.
        </Text>
      ) : (
        active.map((gift) => (
          <GiftCard
            key={gift.id}
            gift={gift}
            onPress={() => router.push({ pathname: "/gift-nook/gift-form", params: { giftId: gift.id } })}
          />
        ))
      )}

      {received.length > 0 ? (
        <>
          <Text style={ui.sectionTitle}>Received 🎉</Text>
          <Text style={ui.muted}>Things you checked off after a Gathering. Family doesn't see these.</Text>
          {received.map((gift) => (
            <GiftCard
              key={gift.id}
              gift={gift}
              footer={
                <Text style={[ui.link, { marginTop: 6 }]} onPress={() => putBack(gift)}>
                  Put it back on my list
                </Text>
              }
            />
          ))}
        </>
      ) : null}
    </NookScroll>
  );
}
