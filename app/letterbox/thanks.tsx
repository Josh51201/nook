import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import Animated, { FadeIn, LinearTransition } from "react-native-reanimated";

import { Icon } from "../../components/icon";
import { LoadingScreen, Tap } from "../../components/motion";
import { NookScroll } from "../../components/nook-scroll";
import { Text } from "../../components/text";
import { Button, EmptyState, NavCard, SectionHeader } from "../../components/ui";
import { useAuth } from "../../lib/auth-context";
import { friendlyError, guarded, tap } from "../../lib/feedback";
import { NO_NOTE } from "../../lib/letterbox";
import { loadReceivedGifts, type ReceivedGift, type Thanks } from "../../lib/letterbox-data";
import { findNook } from "../../lib/nooks";
import { supabase } from "../../lib/supabase";
import { colors, ui } from "../../lib/theme";
import { useLetterbox } from "../../lib/use-letterbox";

const nook = findNook("letterbox")!;

// Thank-you notes owed (LET-011). Gifts you checked off as received in the
// Gift Nook show up here so you can say who each was from — the app never
// knows that itself (GIFT-007, GIFT-026) — then tick them off as you write.
export default function ThankYous() {
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user.id;
  const { data } = useLetterbox();
  const [thanks, setThanks] = useState<Thanks[] | null>(null);
  const [gifts, setGifts] = useState<ReceivedGift[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    () =>
      guarded(
        async () => {
          const [rows, received] = await Promise.all([
            supabase.from("letterbox_thanks").select("*").order("created_at", { ascending: false }),
            userId ? loadReceivedGifts(userId) : Promise.resolve([]),
          ]);
          if (rows.error) throw rows.error;
          setThanks(rows.data as Thanks[]);
          setGifts(received);
        },
        setError,
        () => {}
      ),
    [userId]
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (!thanks) {
    return error ? <EmptyState icon="heart" title="Couldn't load your thank-yous" body={error} /> : <LoadingScreen cards={3} />;
  }

  const covered = new Set(thanks.map((t) => t.gift_id).filter(Boolean));
  const needWho = gifts.filter((g) => !covered.has(g.id));
  const owed = thanks.filter((t) => !t.thanked_at);
  const written = thanks.filter((t) => t.thanked_at).slice(0, 25);
  const toName = (t: Thanks) =>
    (t.contact_id ? data?.contacts.find((h) => h.id === t.contact_id)?.name : null) ?? t.from_name ?? "Someone";

  async function setThanked(item: Thanks, thanked: boolean) {
    tap(thanked ? "success" : "light");
    setThanks((list) => list!.map((t) => (t.id === item.id ? { ...t, thanked_at: thanked ? new Date().toISOString() : null } : t)));
    const { error: saveError } = await supabase
      .from("letterbox_thanks")
      .update({ thanked_at: thanked ? new Date().toISOString() : null })
      .eq("id", item.id);
    if (saveError) {
      Alert.alert("Couldn't save that", friendlyError(saveError));
      load();
    }
  }

  const row = (item: Thanks) => {
    const done = Boolean(item.thanked_at);
    const skipped = item.from_name === NO_NOTE;
    return (
      <Animated.View key={item.id} entering={FadeIn.duration(200)} layout={LinearTransition.springify().damping(20)}>
        <View style={[ui.card, styles.row]}>
          <Tap
            onPress={() => setThanked(item, !done)}
            hitSlop={8}
            pressedScale={0.85}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: done }}
            accessibilityLabel={`Thank-you to ${toName(item)}`}
          >
            <View style={[styles.check, { borderColor: nook.iconColor }, done && { backgroundColor: nook.iconColor }]}>
              {done ? <Icon name="check" size={15} color="#ffffff" /> : null}
            </View>
          </Tap>
          <Tap
            style={{ flex: 1, gap: 2 }}
            onPress={() => router.push({ pathname: "/letterbox/thanks-form", params: { id: item.id } })}
          >
            <Text style={[ui.cardTitle, done && styles.done]}>{skipped ? item.what : toName(item)}</Text>
            <Text style={[ui.muted, { fontSize: 13 }]} numberOfLines={1}>
              {skipped ? NO_NOTE : `For the ${item.what}`}
            </Text>
          </Tap>
        </View>
      </Animated.View>
    );
  };

  return (
    <NookScroll onRefresh={load}>
      {needWho.length ? (
        <>
          <SectionHeader title="Gifts you got" icon="gift" />
          <Text style={ui.muted}>From what you checked off in the Gift Nook. Who was each one from?</Text>
          {needWho.map((gift, i) => (
            <NavCard
              key={gift.id}
              index={i}
              icon="gift"
              iconColor={nook.iconColor}
              iconBackground={nook.color}
              title={gift.title}
              subtitle={`${gift.ownerName ? `${gift.ownerName}'s · ` : ""}got it ${new Date(gift.received_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`}
              right={<Text style={[ui.link, { fontWeight: "700" }]}>Who from?</Text>}
              onPress={() =>
                router.push({ pathname: "/letterbox/thanks-form", params: { giftId: gift.id, what: gift.title } })
              }
            />
          ))}
        </>
      ) : null}

      <SectionHeader title="Still to write" icon="edit" />
      {owed.length ? (
        owed.map(row)
      ) : (
        <Text style={[ui.muted, { textAlign: "center" }]}>
          {needWho.length ? "Say who a gift was from and it'll show up here." : "No thank-yous owed. All caught up!"}
        </Text>
      )}
      <Button title="Add a thank-you" icon="add" variant="secondary" onPress={() => router.push("/letterbox/thanks-form")} />

      {written.length ? (
        <View style={{ gap: 10, opacity: 0.8 }}>
          <SectionHeader title="Written" icon="check" />
          {written.map(row)}
        </View>
      ) : null}

      {!needWho.length && !thanks.length ? (
        <EmptyState
          icon="heart"
          title="Thank-yous live here"
          body="After a Gathering, check off what you got in the Gift Nook and those gifts show up here, ready for a note."
        />
      ) : null}
      <Text style={[ui.muted, { fontSize: 13, textAlign: "center", color: colors.muted }]}>
        Tap the circle when the note's written.
      </Text>
    </NookScroll>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 12 },
  check: { width: 28, height: 28, borderRadius: 10, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  done: { textDecorationLine: "line-through", opacity: 0.55 },
});
