import * as Clipboard from "expo-clipboard";
import * as Print from "expo-print";
import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import Animated, { FadeIn, LinearTransition } from "react-native-reanimated";

import { Icon } from "../../components/icon";
import { Appear, LoadingScreen, Tap } from "../../components/motion";
import { NookScroll } from "../../components/nook-scroll";
import { Text } from "../../components/text";
import { Banner, Button, Chip, EmptyState, SectionHeader } from "../../components/ui";
import { friendlyError, tap } from "../../lib/feedback";
import { addressListText, cardSeason, labelSheetHtml, seasonStatus, type Label } from "../../lib/letterbox";
import { householdAddress, labelFor, type Household } from "../../lib/letterbox-data";
import { findNook } from "../../lib/nooks";
import { supabase } from "../../lib/supabase";
import { colors, shadow, ui } from "../../lib/theme";
import { useLetterbox } from "../../lib/use-letterbox";

const nook = findNook("letterbox")!;

// Card season (LET-005, LET-008, LET-009): this year's holiday card list —
// tick each one off as it goes in the mail, see who sent you one, and print
// labels or copy the addresses for the ones still to go.
export default function CardSeason() {
  const router = useRouter();
  const { data, isLoading, reload } = useLetterbox();
  const current = cardSeason();
  const [season, setSeason] = useState(current);
  const [busy, setBusy] = useState<string | null>(null);

  if (isLoading && !data) return <LoadingScreen cards={4} />;
  if (!data) return <EmptyState icon="mail" title="Couldn't open your Letterbox" />;

  const status = seasonStatus(data.households, data.cards, season);
  const seasons = [...new Set([current, current - 1, ...data.cards.filter((c) => c.occasion === "holiday").map((c) => c.season)])]
    .sort((a, b) => b - a)
    .slice(0, 4);
  const done = status.sent.length;
  const fraction = status.total ? done / status.total : 0;
  const labels = status.toSend.map((h) => labelFor(h, data)).filter(Boolean) as Label[];
  const noAddress = status.toSend.filter((h) => !householdAddress(h, data));

  async function markSent(household: Household) {
    if (busy) return;
    setBusy(household.id);
    tap("success");
    const { error } = await supabase.from("letterbox_cards").insert({
      letterbox_id: data!.boxId,
      household_id: household.id,
      direction: "sent",
      occasion: "holiday",
      season,
    });
    if (error) Alert.alert("Couldn't check them off", friendlyError(error));
    await reload();
    setBusy(null);
  }

  async function unmarkSent(household: Household) {
    if (busy) return;
    setBusy(household.id);
    tap();
    const card = data!.cards.find(
      (c) => c.household_id === household.id && c.direction === "sent" && c.occasion === "holiday" && c.season === season
    );
    if (card) {
      const { error } = await supabase.from("letterbox_cards").delete().eq("id", card.id);
      if (error) Alert.alert("Couldn't change that", friendlyError(error));
    }
    await reload();
    setBusy(null);
  }

  async function addToList(household: Household) {
    tap();
    const { error } = await supabase.from("letterbox_households").update({ on_holiday_list: true }).eq("id", household.id);
    if (error) Alert.alert("Couldn't add them", friendlyError(error));
    reload();
  }

  async function printLabels() {
    if (!labels.length) return Alert.alert("No addresses to print", "Everyone still to send is missing an address.");
    try {
      await Print.printAsync({ html: labelSheetHtml(labels) });
    } catch (error) {
      Alert.alert("Couldn't print", (error as Error).message);
    }
  }

  async function copyAddresses() {
    if (!labels.length) return;
    await Clipboard.setStringAsync(addressListText(labels));
    tap("success");
    Alert.alert(`${labels.length} address${labels.length === 1 ? "" : "es"} copied`, "Paste them anywhere, like a printing site or a note.");
  }

  const row = (household: Household, sent: boolean) => {
    const address = householdAddress(household, data);
    const gotOne = status.gotFrom.some((h) => h.id === household.id);
    return (
      <Animated.View key={household.id} entering={FadeIn.duration(200)} layout={LinearTransition.springify().damping(20)}>
        <View style={[ui.card, styles.row]}>
          <Tap
            onPress={() => (sent ? unmarkSent(household) : markSent(household))}
            disabled={busy === household.id}
            hitSlop={8}
            pressedScale={0.85}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: sent }}
            accessibilityLabel={`${household.name}: ${sent ? "sent" : "not sent yet"}`}
          >
            <View style={[styles.check, { borderColor: nook.iconColor }, sent && { backgroundColor: nook.iconColor }]}>
              {sent ? <Icon name="check" size={15} color="#ffffff" /> : null}
            </View>
          </Tap>
          <Tap style={{ flex: 1, gap: 2 }} onPress={() => router.push(`/letterbox/household/${household.id}`)}>
            <Text style={[ui.cardTitle, sent && styles.done]}>{household.name}</Text>
            <Text style={[ui.muted, { fontSize: 13 }, !address && { color: colors.error }]} numberOfLines={1}>
              {address ? [address.line1, address.city].filter(Boolean).join(" · ") : "No address yet"}
            </Text>
          </Tap>
          {gotOne ? <Icon name="arrowDown" size={16} color={nook.iconColor} /> : null}
        </View>
      </Animated.View>
    );
  };

  return (
    <NookScroll onRefresh={reload}>
      <Stack.Screen options={{ title: `Card season ${season}` }} />

      {seasons.length > 1 ? (
        <View style={ui.chips}>
          {seasons.map((year) => (
            <Chip key={year} selected={season === year} onPress={() => setSeason(year)}>
              {year === current ? `This year (${year})` : String(year)}
            </Chip>
          ))}
        </View>
      ) : null}

      <Appear>
        <View style={[styles.hero, { boxShadow: shadow.boxShadow }, { backgroundColor: colors.dark ? `${nook.iconColor}26` : nook.color }]}>
          <View style={styles.watermark} pointerEvents="none">
            <Icon name="christmas" size={150} color={nook.iconColor} />
          </View>
          <Text style={[styles.big, { color: colors.text }]}>
            {status.total ? (status.toSend.length ? status.toSend.length : "All sent!") : "0"}
          </Text>
          <Text style={[styles.lead, { color: colors.text }]}>
            {status.total
              ? status.toSend.length
                ? `card${status.toSend.length === 1 ? "" : "s"} still to send`
                : `Every card on your list is in the mail`
              : "Nobody on your holiday list yet"}
          </Text>
          {status.total ? (
            <>
              <View style={styles.track}>
                <Animated.View
                  layout={LinearTransition.duration(300)}
                  style={[styles.fill, { width: `${Math.round(fraction * 100)}%`, backgroundColor: nook.iconColor }]}
                />
              </View>
              <Text style={[ui.muted, { color: colors.text }]}>
                {done} of {status.total} sent{status.gotFrom.length ? ` · ${status.gotFrom.length} came in` : ""}
              </Text>
            </>
          ) : null}
        </View>
      </Appear>

      {status.total === 0 ? (
        <EmptyState
          icon="christmas"
          title="Start your holiday list"
          body="Everyone you add to your Letterbox goes on the list unless you turn it off for them."
        />
      ) : null}

      {status.toSend.length ? (
        <>
          <View style={[ui.row, { gap: 10 }]}>
            <Button title="Print labels" icon="mail" style={{ flex: 1 }} onPress={printLabels} />
            <Button title="Copy addresses" icon="copy" variant="secondary" style={{ flex: 1 }} onPress={copyAddresses} />
          </View>
          <Text style={[ui.muted, { fontSize: 13, textAlign: "center" }]}>
            Labels fit standard 30-per-sheet address labels (like Avery 5160).
            {noAddress.length ? ` ${noAddress.length} without an address ${noAddress.length === 1 ? "is" : "are"} left out.` : ""}
          </Text>
          <SectionHeader title="Still to send" icon="mail" />
          {status.toSend.map((h) => row(h, false))}
        </>
      ) : null}

      {status.sent.length ? (
        <>
          <SectionHeader title="In the mail" icon="check" />
          {status.sent.map((h) => row(h, true))}
        </>
      ) : null}

      {status.worthAdding.map((household) => (
        <Banner
          key={household.id}
          icon="arrowDown"
          tone="sky"
          title={`${household.name} sent you one`}
          body="They're not on your holiday list. Tap to add them."
          onPress={() => addToList(household)}
        />
      ))}

      <SectionHeader title="Cards you got" icon="arrowDown" />
      {status.gotFrom.length ? (
        <Text style={ui.muted}>{status.gotFrom.map((h) => h.name).join(", ")}</Text>
      ) : (
        <Text style={ui.muted}>None logged yet for {season}.</Text>
      )}
      <Button
        title="Log a card you got"
        icon="arrowDown"
        variant="secondary"
        onPress={() => router.push({ pathname: "/letterbox/card-form", params: { direction: "received", occasion: "holiday" } })}
      />
    </NookScroll>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: 28, padding: 20, gap: 8, overflow: "hidden" },
  watermark: { position: "absolute", right: -30, bottom: -36, opacity: 0.1, transform: [{ rotate: "-12deg" }] },
  big: { fontSize: 56, fontWeight: "800", letterSpacing: -1.5, lineHeight: 62 },
  lead: { fontSize: 17, fontWeight: "600" },
  track: { height: 10, borderRadius: 5, backgroundColor: "rgba(255,255,255,0.6)", overflow: "hidden", marginTop: 6 },
  fill: { height: 10, borderRadius: 5 },
  row: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 12 },
  check: { width: 28, height: 28, borderRadius: 10, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  done: { textDecorationLine: "line-through", opacity: 0.55 },
});
