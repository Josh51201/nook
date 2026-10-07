import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, Text, TouchableOpacity, View } from "react-native";

import { useAuth } from "../../lib/auth-context";
import { displayName, giftChangedSince, tuckStatusLabel, type Tuck } from "../../lib/gift-nook";
import { supabase } from "../../lib/supabase";
import { colors, ui } from "../../lib/theme";

type MyTuck = Tuck & {
  gifts: {
    id: string;
    title: string;
    created_at: string;
    updated_at: string;
    removed_at: string | null;
    wishbooks: { owner_id: string; profiles: { display_name: string | null } | null } | null;
  } | null;
};

// Your shopping list: everything you've tucked away, across every Wishbook,
// with heads-ups when a gift changed or was removed (GIFT-023/025).
export default function MyTucks() {
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user.id;

  const [tucks, setTucks] = useState<MyTuck[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from("claims")
      .select(
        "id, claimed_by, released_at, status, note, claimed_at, acknowledged_at, profiles(display_name), " +
          "gifts(id, title, created_at, updated_at, removed_at, wishbooks(owner_id, profiles(display_name)))"
      )
      .eq("claimed_by", userId)
      .is("released_at", null)
      .order("claimed_at", { ascending: false });
    setTucks(((data ?? []) as unknown as MyTuck[]).filter((t) => t.gifts));
    setIsLoading(false);
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (isLoading) {
    return (
      <View style={ui.center}>
        <ActivityIndicator />
      </View>
    );
  }

  const open = tucks.filter((t) => t.status !== "given");
  const given = tucks.filter((t) => t.status === "given");

  function row(tuck: MyTuck) {
    const gift = tuck.gifts!;
    const owner = gift.wishbooks;
    const needsAttention = gift.removed_at || (tuck.status !== "given" && giftChangedSince(gift, tuck));
    return (
      <TouchableOpacity
        key={tuck.id}
        style={[ui.card, needsAttention ? { borderWidth: 2, borderColor: colors.bark } : null]}
        onPress={() => owner && router.push(`/gift-nook/member/${owner.owner_id}`)}
      >
        <Text style={ui.cardTitle}>{gift.title}</Text>
        <Text style={ui.muted}>
          For {displayName(owner?.profiles)} · {tuckStatusLabel[tuck.status]}
        </Text>
        {tuck.note ? <Text style={{ color: colors.muted, fontStyle: "italic" }}>“{tuck.note}”</Text> : null}
        {gift.removed_at ? (
          <Text style={{ color: colors.error }}>⚠️ Removed from their list — open to release it</Text>
        ) : needsAttention ? (
          <Text style={{ color: colors.bark }}>✏️ Changed since you tucked it</Text>
        ) : null}
      </TouchableOpacity>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={ui.screen}
      refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
    >
      {open.length === 0 ? (
        <Text style={ui.muted}>
          Nothing tucked away yet. Open someone's Wishbook and tap "Tuck it away" on a gift you'll get.
        </Text>
      ) : (
        <>
          <Text style={ui.muted}>
            {open.filter((t) => t.status === "planning").length} to get ·{" "}
            {open.filter((t) => t.status === "bought").length} bought
          </Text>
          {open.map(row)}
        </>
      )}
      {given.length > 0 ? (
        <>
          <Text style={ui.sectionTitle}>Given 🎉</Text>
          {given.map(row)}
        </>
      ) : null}
    </ScrollView>
  );
}
