import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Switch, Text, TouchableOpacity, View } from "react-native";

import { NookScroll } from "../../components/nook-scroll";
import { friendlyError, tap } from "../../lib/feedback";
import { GIFT_SELECT, isGiftShown, loadGiftPicks, type Gift } from "../../lib/gift-nook";
import { supabase } from "../../lib/supabase";
import { colors, ui } from "../../lib/theme";

// GIFT-026: after a Gathering ends, the honoree (or a kid's manager) checks
// off what they received. Lists every gift that was shown for the Gathering
// — never just the tucked ones — so nothing is revealed (GIFT-007).
//   ?gatheringId=...&profileId=...  (profileId: you, or a kid you manage)
export default function ReceivedScreen() {
  const router = useRouter();
  const { gatheringId, profileId } = useLocalSearchParams<{ gatheringId: string; profileId: string }>();

  const [title, setTitle] = useState("");
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const [gatheringResult, wishbookResult] = await Promise.all([
        supabase.from("gatherings").select("title").eq("id", gatheringId).single(),
        supabase.from("wishbooks").select("id").eq("owner_id", profileId).single(),
      ]);
      setTitle(gatheringResult.data?.title ?? "");
      const wishbookId = wishbookResult.data?.id;
      if (wishbookId) {
        const [giftsResult, picks] = await Promise.all([
          supabase
            .from("gifts")
            .select(GIFT_SELECT)
            .eq("wishbook_id", wishbookId)
            .is("received_at", null)
            .is("removed_at", null)
            .order("created_at", { ascending: false }),
          loadGiftPicks(gatheringId, wishbookId),
        ]);
        const all = (giftsResult.data ?? []) as unknown as Gift[];
        setGifts(all.filter((gift) => isGiftShown(gift.id, picks)));
      }
      setIsLoading(false);
    })();
  }, [gatheringId, profileId]);

  function toggle(giftId: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(giftId)) next.delete(giftId);
      else next.add(giftId);
      return next;
    });
  }

  async function submit() {
    setIsSaving(true);
    const { error } = await supabase.rpc("mark_received", {
      target_gathering: gatheringId,
      for_profile: profileId,
      received_gift_ids: [...checked],
    });
    setIsSaving(false);
    if (error) Alert.alert("Couldn't save", friendlyError(error));
    else {
      tap("success");
      router.back();
    }
  }

  if (isLoading) {
    return (
      <View style={ui.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <NookScroll>
      <Stack.Screen options={{ title: "What did you get?" }} />
      <Text style={ui.muted}>
        {title} is over! Check off anything you received. One-and-done gifts come off the list;
        "many can give" gifts stay. Nobody's told who gave what.
      </Text>

      {gifts.map((gift) => (
        <View key={gift.id} style={[ui.card, ui.row]}>
          <View style={{ flex: 1 }}>
            <Text style={ui.cardTitle}>{gift.title}</Text>
            <Text style={ui.muted}>{gift.is_repeatable ? "Many can give — stays on your list" : "One-and-done"}</Text>
          </View>
          <Switch
            value={checked.has(gift.id)}
            onValueChange={() => toggle(gift.id)}
            trackColor={{ true: colors.bark }}
          />
        </View>
      ))}

      <TouchableOpacity style={ui.button} onPress={submit} disabled={isSaving}>
        {isSaving ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={ui.buttonText}>
            {checked.size ? `Mark ${checked.size} received` : "I didn't get any of these"}
          </Text>
        )}
      </TouchableOpacity>
    </NookScroll>
  );
}
