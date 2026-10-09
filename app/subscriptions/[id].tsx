import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Linking, StyleSheet, View } from "react-native";

import { Icon, IconBadge, type IconName } from "../../components/icon";
import { Appear, LoadingScreen, Tap } from "../../components/motion";
import { NookScroll } from "../../components/nook-scroll";
import { Text } from "../../components/text";
import { Button, EmptyState, SectionHeader } from "../../components/ui";
import { useAuth } from "../../lib/auth-context";
import { friendlyError, tap } from "../../lib/feedback";
import { findNook } from "../../lib/nooks";
import {
  cancelByWords,
  cardWords,
  categoryInfo,
  current,
  cycleInfo,
  formatMoney,
  isSoon,
  lastChangeWords,
  monthlyCents,
  priceHistory,
  priceWords,
  remindChoices,
  renewWords,
  resumeDate,
  savedCents,
  yearlyCents,
} from "../../lib/subscriptions";
import { personName, resumeSubscription, stopSubscription, useSubscriptions } from "../../lib/subscriptions-data";
import { colors, ui } from "../../lib/theme";

const nook = findNook("subscriptions")!;

function dayWords(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function hostOf(url: string) {
  return url.replace(/^https?:\/\//i, "").split(/[/?#]/)[0];
}

// One subscription (SUB-003..010): when it next charges and the last day to
// cancel, what it costs a month and a year, who pays and on which card, a
// button to the page where it's cancelled, pause or cancel, and every price
// it's had.
export default function SubscriptionPage() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const userId = session?.user.id;
  const { data, isLoading, reload } = useSubscriptions(userId);
  const [busy, setBusy] = useState(false);

  const sub = data?.subs.find((s) => s.id === id);

  if (isLoading && !data) return <LoadingScreen cards={3} />;
  if (!data || !sub) {
    return <EmptyState icon="card" title="That subscription isn't here" body="Someone in your Home may have removed it." />;
  }

  const today = data.today;
  const now = current(sub, today);
  const active = sub.status === "active";
  const hot = active && now.on_trial && isSoon(sub, today);
  const category = categoryInfo(sub.category);
  const history = priceHistory(data.prices, sub.id);
  const change = lastChangeWords(history);
  const card = cardWords(sub);
  const shared = data.members.length > 1;

  async function stop(status: "paused" | "cancelled") {
    setBusy(true);
    tap("success");
    const { error } = await stopSubscription(sub!.id, status);
    if (error) Alert.alert("Couldn't save that", friendlyError(error));
    await reload();
    setBusy(false);
  }

  function confirmStop() {
    Alert.alert(
      `Stop ${sub!.name}?`,
      sub!.manage_url
        ? "Cancel it with the company first (the button above), then mark it here. It stays in your Nook, counting what it saves."
        : "Cancel it with the company first, then mark it here. It stays in your Nook, counting what it saves.",
      [
        { text: "Not yet", style: "cancel" },
        { text: "Paused it", onPress: () => stop("paused") },
        { text: "Cancelled it", style: "destructive", onPress: () => stop("cancelled") },
      ]
    );
  }

  function confirmResume() {
    const next = resumeDate(sub!, today);
    Alert.alert(`Started ${sub!.name} again?`, `Its next charge will be ${dayWords(next)}. You can change that with Edit.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Started again",
        onPress: async () => {
          setBusy(true);
          tap("success");
          const { error } = await resumeSubscription(sub!.id, next);
          if (error) Alert.alert("Couldn't save that", friendlyError(error));
          await reload();
          setBusy(false);
        },
      },
    ]);
  }

  const lines: { icon: IconName; text: string; strong?: boolean }[] = active
    ? [
        {
          icon: "calendar",
          text: `${now.on_trial ? "First charge" : "Next charge"} ${dayWords(now.renews_on)} · ${formatMoney(sub.price_cents)}`,
        },
        { icon: "warning", text: cancelByWords(sub, today), strong: hot },
        {
          icon: "card",
          text:
            sub.cycle === "monthly"
              ? `${formatMoney(yearlyCents(sub))} a year`
              : `${formatMoney(monthlyCents(sub))} a month · ${formatMoney(yearlyCents(sub))} a year`,
        },
        {
          icon: "bell",
          text: sub.remind_days ? `Reminder ${remindChoices.find((c) => c.days === sub.remind_days)?.label.toLowerCase()}` : "No reminder",
        },
      ]
    : [
        { icon: "sparkles", text: `Saved ${formatMoney(savedCents(sub, today))} since then, at ${priceWords(sub)}` },
      ];
  if (sub.payer && (shared || sub.payer !== userId)) {
    const who = personName(data, sub.payer, userId);
    lines.push({ icon: "person", text: who === "You" ? "You pay for it" : `${who} pays for it` });
  }
  if (card) lines.push({ icon: "card", text: `On ${card}` });
  if (shared) {
    lines.push(
      sub.private
        ? { icon: "lock", text: "Just you can see it" }
        : { icon: "group", text: `Shared with your Home${sub.created_by && sub.created_by !== userId ? ` · added by ${personName(data, sub.created_by, userId)}` : ""}` }
    );
  }

  return (
    <NookScroll onRefresh={reload}>
      <Stack.Screen
        options={{
          title: category.label,
          headerRight: () => (
            <Tap
              onPress={() => router.push({ pathname: "/subscriptions/form", params: { id: sub.id } })}
              hitSlop={10}
              style={[ui.row, { gap: 5 }]}
            >
              <Icon name="edit" size={17} />
              <Text style={{ color: colors.bark, fontSize: 17, fontWeight: "600" }}>Edit</Text>
            </Tap>
          ),
        }}
      />

      <Appear>
        <View style={[styles.hero, { backgroundColor: colors.dark ? `${nook.iconColor}26` : nook.color }]}>
          <IconBadge name={category.icon} size={56} color={hot ? "#ffffff" : nook.iconColor} background={hot ? colors.error : colors.surface} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[styles.title, { color: colors.text }]}>{sub.name}</Text>
            <Text style={[ui.muted, { color: colors.text, fontWeight: "600" }]}>
              {priceWords(sub)}
              {now.on_trial && active ? " after the trial" : ""}
            </Text>
            <Text style={[ui.muted, { color: hot ? colors.error : colors.text, fontWeight: hot ? "700" : "500" }]}>
              {renewWords(sub, today)}
            </Text>
          </View>
        </View>
      </Appear>

      <View style={[ui.card, { gap: 12 }]}>
        {lines.map((line, i) => (
          <View key={i} style={[ui.row, { gap: 10 }]}>
            <Icon name={line.icon} size={18} color={line.strong ? colors.error : nook.iconColor} />
            <Text style={[ui.muted, { flex: 1, color: line.strong ? colors.error : colors.text, fontWeight: line.strong ? "700" : "400" }]}>
              {line.text}
            </Text>
          </View>
        ))}
        {sub.notes ? <Text style={[ui.muted, { color: colors.text }]}>{sub.notes}</Text> : null}
      </View>

      {sub.manage_url ? (
        <Button
          title={active ? `Manage or cancel · ${hostOf(sub.manage_url)}` : `Open ${hostOf(sub.manage_url)}`}
          icon="link"
          variant="secondary"
          onPress={() => Linking.openURL(sub.manage_url!).catch(() => Alert.alert("Couldn't open that link", "Check it with Edit."))}
        />
      ) : active ? (
        <Tap onPress={() => router.push({ pathname: "/subscriptions/form", params: { id: sub.id } })} hitSlop={8} style={{ alignSelf: "center" }}>
          <Text style={ui.link}>Add the link where you manage or cancel it</Text>
        </Tap>
      ) : null}

      {active ? (
        <Button title="I paused or cancelled it" icon="pause" variant="secondary" onPress={confirmStop} loading={busy} />
      ) : (
        <Button title="I started it again" icon="play" onPress={confirmResume} loading={busy} />
      )}

      <SectionHeader title="Price history" icon="clock" />
      {change ? <Text style={[ui.muted, { color: colors.text }]}>{change}.</Text> : null}
      {history.length <= 1 ? (
        <Text style={ui.muted}>When the price changes, change it with Edit and the old one is kept here.</Text>
      ) : (
        <View style={[ui.card, { gap: 10 }]}>
          {history.map((entry, i) => (
            <View key={entry.id} style={[ui.row, { gap: 10 }]}>
              <Icon name={i === 0 ? "check" : "clock"} size={15} color={nook.iconColor} />
              <Text style={[ui.muted, { flex: 1, color: colors.text, fontSize: 14 }]}>
                {formatMoney(entry.price_cents)} {cycleInfo(entry.cycle).per}
              </Text>
              <Text style={[ui.muted, { fontSize: 13 }]}>
                {i === 0 ? "since " : ""}
                {dayWords(entry.changed_on)}
                {entry.changed_by && shared ? ` · ${personName(data, entry.changed_by, userId)}` : ""}
              </Text>
            </View>
          ))}
        </View>
      )}
    </NookScroll>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: "row", alignItems: "center", gap: 16, padding: 18, borderRadius: 24 },
  title: { fontSize: 24, fontWeight: "800", letterSpacing: -0.5 },
});
