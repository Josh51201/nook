import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { Collapsible } from "../../components/collapsible";
import { HeaderWithHelp } from "../../components/help-button";
import { Icon, IconBadge } from "../../components/icon";
import { Appear, LoadingScreen, Tap } from "../../components/motion";
import { NookHero } from "../../components/nook-hero";
import { NookScroll } from "../../components/nook-scroll";
import { Text } from "../../components/text";
import { Button, Chip, EmptyState, HeaderIcon, SectionHeader } from "../../components/ui";
import { useAuth } from "../../lib/auth-context";
import { findNook } from "../../lib/nooks";
import {
  categoryInfo,
  categoryTotals,
  current,
  cycleInfo,
  formatMoney,
  groupSubscriptions,
  isSoon,
  renewWords,
  savedCents,
  totalSaved,
  totals,
  type Subscription,
} from "../../lib/subscriptions";
import { isMine, personName, useSubscriptions } from "../../lib/subscriptions-data";
import { colors, ui } from "../../lib/theme";

const nook = findNook("subscriptions")!;

// Subscriptions home (SUB-001, SUB-004, SUB-007, SUB-010): what it all costs
// a month, free trials about to end, what renews next, the totals by
// category, and what's been paused or cancelled.
export default function SubscriptionsHome() {
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user.id;
  const { data, error, isLoading, reload } = useSubscriptions(userId);
  const [mineOnly, setMineOnly] = useState(false);

  if (isLoading && !data) return <LoadingScreen cards={3} />;
  if (!data) {
    return (
      <NookScroll onRefresh={reload}>
        <EmptyState icon="card" title="Couldn't open Subscriptions" body={error ?? "Check your connection and try again."} />
      </NookScroll>
    );
  }

  const shared = data.members.length > 1;
  const shown = mineOnly ? data.subs.filter((s) => isMine(s, userId)) : data.subs;
  const groups = groupSubscriptions(shown, data.today);
  const sum = totals(shown, data.today);
  const byCategory = categoryTotals(shown, data.today);
  const saved = totalSaved(groups.stopped, data.today);
  const endingSoon = groups.trials.filter((s) => isSoon(s, data.today)).length;

  const headline = !data.subs.length
    ? "Everything that renews, in one place"
    : endingSoon
      ? `${endingSoon} free trial${endingSoon === 1 ? "" : "s"} ending this week`
      : `${formatMoney(sum.monthly)} a month`;

  function row(sub: Subscription, index: number) {
    const now = current(sub, data!.today);
    const stopped = sub.status !== "active";
    const hot = !stopped && now.on_trial && isSoon(sub, data!.today);
    const category = categoryInfo(sub.category);
    const payer = sub.payer && shared ? personName(data!, sub.payer, userId) : null;
    const sub2 = [
      renewWords(sub, data!.today),
      stopped ? (savedCents(sub, data!.today) ? `saved ${formatMoney(savedCents(sub, data!.today))}` : null) : payer ? `${payer} pays` : null,
    ].filter(Boolean);
    return (
      <Appear key={sub.id} index={index}>
        <Tap
          onPress={() => router.push(`/subscriptions/${sub.id}`)}
          style={[ui.card, styles.row, stopped && { opacity: 0.75 }]}
          accessibilityRole="button"
          accessibilityLabel={`${sub.name}, ${formatMoney(sub.price_cents)} ${cycleInfo(sub.cycle).per}, ${renewWords(sub, data!.today)}`}
        >
          <IconBadge name={category.icon} size={40} color={hot ? "#ffffff" : nook.iconColor} background={hot ? colors.error : nook.color} />
          <View style={{ flex: 1, gap: 2 }}>
            <View style={[ui.row, { gap: 6 }]}>
              <Text style={[ui.cardTitle, { flexShrink: 1 }]} numberOfLines={1}>
                {sub.name}
              </Text>
              {sub.private && shared ? <Icon name="lock" size={13} color={colors.muted} /> : null}
            </View>
            <Text style={[ui.muted, { fontSize: 13 }, hot && { color: colors.error, fontWeight: "600" }]} numberOfLines={1}>
              {sub2.join(" · ")}
            </Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={[ui.cardTitle, stopped && { textDecorationLine: "line-through", color: colors.muted }]}>
              {formatMoney(sub.price_cents)}
            </Text>
            <Text style={[ui.muted, { fontSize: 12 }]}>{now.on_trial && !stopped ? "after trial" : cycleInfo(sub.cycle).short}</Text>
          </View>
        </Tap>
      </Appear>
    );
  }

  const sections: { key: keyof typeof groups; title: string; icon: "warning" | "calendar" | "card" | "pause" }[] = [
    { key: "trials", title: "Free trials", icon: "warning" },
    { key: "soon", title: "Renewing this week", icon: "calendar" },
    { key: "month", title: "Later this month", icon: "calendar" },
    { key: "later", title: "Later on", icon: "card" },
    { key: "stopped", title: "Paused & cancelled", icon: "pause" },
  ];

  return (
    <NookScroll onRefresh={reload}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <HeaderWithHelp>
              <HeaderIcon icon="settings" label="Subscriptions Nook settings" onPress={() => router.push("/subscriptions/settings")} />
            </HeaderWithHelp>
          ),
        }}
      />

      <NookHero
        icon="card"
        accent={nook.iconColor}
        tint={nook.color}
        headline={headline}
        facts={
          data.subs.length
            ? [
                ...(endingSoon ? [{ icon: "card" as const, text: `${formatMoney(sum.monthly)} a month` }] : []),
                { icon: "calendar", text: `${formatMoney(sum.yearly)} a year` },
                ...(sum.trials ? [{ icon: "warning" as const, text: `${formatMoney(sum.trialsMonthly)} more a month after trials` }] : []),
                ...(saved ? [{ icon: "sparkles" as const, text: `${formatMoney(saved)} saved by cancelling` }] : []),
                ...(shared ? [{ icon: "group" as const, text: "Shared with your Home" }] : []),
              ]
            : [{ icon: "bell", text: "A reminder before each one renews" }]
        }
      />

      {!data.subs.length ? (
        <>
          <EmptyState
            icon="card"
            title="Nothing here yet"
            body="Add the things you pay for again and again — Netflix, Spotify, the gym, Amazon Prime — and see what they cost together, with a reminder before each one renews or a free trial ends."
          />
          <Button title="Add your first subscription" icon="add" onPress={() => router.push("/subscriptions/form")} />
        </>
      ) : (
        <>
          {shared ? (
            <View style={ui.chips}>
              <Chip selected={!mineOnly} onPress={() => setMineOnly(false)}>
                Everything
              </Chip>
              <Chip icon="person" selected={mineOnly} onPress={() => setMineOnly(true)}>
                Mine
              </Chip>
            </View>
          ) : null}

          {mineOnly && !shown.length ? (
            <Text style={ui.muted}>Nothing is yours yet. Open a subscription and pick who pays for it.</Text>
          ) : null}

          {byCategory.length > 1 ? (
            <Collapsible
              id="subscriptions-categories"
              title="By category"
              icon="filter"
              summary={byCategory
                .slice(0, 2)
                .map((c) => `${c.label} ${formatMoney(c.monthly)}`)
                .join(" · ")}
            >
              <View style={{ gap: 12 }}>
                {byCategory.map((c) => (
                  <View key={c.key} style={{ gap: 5 }}>
                    <View style={[ui.row, { gap: 10 }]}>
                      <Icon name={c.icon} size={16} color={nook.iconColor} />
                      <Text style={[ui.muted, { flex: 1, color: colors.text }]}>
                        {c.label} · {c.count}
                      </Text>
                      <Text style={[ui.muted, { color: colors.text, fontWeight: "600" }]}>{formatMoney(c.monthly)}/mo</Text>
                    </View>
                    <View style={[styles.bar, { backgroundColor: colors.dark ? `${nook.iconColor}33` : nook.color }]}>
                      <View
                        style={[styles.barFill, { width: `${Math.max(4, (c.monthly / Math.max(1, sum.monthly)) * 100)}%`, backgroundColor: nook.iconColor }]}
                      />
                    </View>
                  </View>
                ))}
              </View>
            </Collapsible>
          ) : null}

          {sections.map((section) =>
            groups[section.key].length ? (
              <View key={section.key} style={{ gap: 10 }}>
                <SectionHeader
                  title={section.title}
                  icon={section.icon}
                  right={
                    section.key === "stopped" && saved ? (
                      <Text style={[ui.muted, { fontSize: 13 }]}>{formatMoney(saved)} saved</Text>
                    ) : undefined
                  }
                />
                {groups[section.key].map((s, i) => row(s, i))}
              </View>
            ) : null
          )}

          <Button title="Add a subscription" icon="add" onPress={() => router.push("/subscriptions/form")} />
        </>
      )}
    </NookScroll>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  bar: { height: 6, borderRadius: 3, overflow: "hidden" },
  barFill: { height: 6, borderRadius: 3 },
});
