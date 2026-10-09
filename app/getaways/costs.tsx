import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Alert, View } from "react-native";

import { Icon } from "../../components/icon";
import { Appear, LoadingScreen, Tap } from "../../components/motion";
import { NookScroll } from "../../components/nook-scroll";
import { Text } from "../../components/text";
import { Button, EmptyState, SectionHeader } from "../../components/ui";
import { useAuth } from "../../lib/auth-context";
import { friendlyError, tap } from "../../lib/feedback";
import { balances, settleUp, totalSpent, weekdayWords, type Transfer } from "../../lib/getaways";
import { nameOf, recordPayback, useGetaway } from "../../lib/getaways-data";
import { findNook } from "../../lib/nooks";
import { formatMoney } from "../../lib/subscriptions";
import { colors, ui } from "../../lib/theme";

const nook = findNook("getaways")!;

// Costs (TRIP-009): who paid for what and who it's split between, where
// everyone stands, and the fewest paybacks that settle everyone up.
export default function Costs() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const userId = session?.user.id;
  const { data, isLoading, reload } = useGetaway(id, userId);
  const [busy, setBusy] = useState<string | null>(null);

  if (isLoading && !data) return <LoadingScreen cards={3} />;
  if (!data) return <EmptyState icon="plane" title="That Getaway isn't here" body="It may have been removed." />;

  const name = (pid: string) => nameOf(data.profiles, pid, userId);
  const balance = balances(data.costs, data.coveredBy);
  const transfers = settleUp(balance);
  const spent = totalSpent(data.costs);
  const standings = [...balance].filter(([, c]) => c !== 0).sort((a, b) => b[1] - a[1]);

  function markPaid(t: Transfer) {
    const key = `${t.from}-${t.to}`;
    Alert.alert(
      "Mark this paid?",
      `${name(t.from)} paid ${name(t.to) === "You" ? "you" : name(t.to)} ${formatMoney(t.cents)}. It's added to the list as a payback.`,
      [
        { text: "Not yet", style: "cancel" },
        {
          text: "Paid",
          onPress: async () => {
            setBusy(key);
            const { error } = await recordPayback(data!.trip.id, t);
            setBusy(null);
            if (error) return Alert.alert("Couldn't save that", friendlyError(error));
            tap("success");
            reload();
          },
        },
      ]
    );
  }

  const open = (costId?: string) =>
    router.push({ pathname: "/getaways/cost-form", params: costId ? { getawayId: data.trip.id, id: costId } : { getawayId: data.trip.id } });

  return (
    <NookScroll onRefresh={reload}>
      <Stack.Screen options={{ title: `Costs · ${data.trip.title}` }} />

      {!data.costs.length ? (
        <EmptyState
          icon="money"
          title="No costs yet"
          body="Add what each person paid for (the house, gas, groceries) and who it's for, and Nook works out who owes whom."
        />
      ) : (
        <>
          <View style={[ui.card, { gap: 4, alignItems: "center", paddingVertical: 18 }]}>
            <Text style={{ fontSize: 32, fontWeight: "800", color: colors.text, letterSpacing: -1 }}>{formatMoney(spent)}</Text>
            <Text style={ui.muted}>spent on this Getaway</Text>
          </View>

          <SectionHeader title="Settle up" icon="money" />
          {transfers.length ? (
            transfers.map((t) => (
              <View key={`${t.from}-${t.to}`} style={[ui.card, ui.row, { gap: 12 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[ui.cardTitle, { fontSize: 15 }]}>
                    {name(t.from)} {name(t.from) === "You" ? "owe" : "owes"} {name(t.to) === "You" ? "you" : name(t.to)}
                  </Text>
                  <Text style={{ fontSize: 18, fontWeight: "800", color: nook.iconColor }}>{formatMoney(t.cents)}</Text>
                </View>
                <Button
                  title="Mark paid"
                  variant="secondary"
                  loading={busy === `${t.from}-${t.to}`}
                  onPress={() => markPaid(t)}
                  style={{ paddingHorizontal: 12, paddingVertical: 8 }}
                />
              </View>
            ))
          ) : (
            <Text style={ui.muted}>Everyone's all square.</Text>
          )}

          {standings.length ? (
            <View style={[ui.card, { gap: 8 }]}>
              {standings.map(([pid, cents]) => (
                <View key={pid} style={[ui.row, { gap: 10 }]}>
                  <Text style={[ui.muted, { flex: 1, color: colors.text }]}>{name(pid)}</Text>
                  <Text style={[ui.muted, { color: cents > 0 ? nook.iconColor : colors.error, fontWeight: "600" }]}>
                    {cents > 0 ? `owed ${formatMoney(cents)}` : `owes ${formatMoney(-cents)}`}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          <SectionHeader title="What's been paid" icon="clock" />
          <View style={[ui.card, { gap: 12 }]}>
            {data.costs.map((c, i) => (
              <Appear key={c.id} index={i}>
                <Tap onPress={() => open(c.id)} style={[ui.row, { gap: 10, alignItems: "flex-start" }]} accessibilityRole="button">
                  <Icon name={c.is_payback ? "check" : "money"} size={16} color={nook.iconColor} style={{ marginTop: 2 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, color: colors.text, fontWeight: "600" }}>
                      {c.is_payback ? `${name(c.paid_by)} paid back ${name(c.split_among[0]) === "You" ? "you" : name(c.split_among[0])}` : c.what}
                    </Text>
                    <Text style={[ui.muted, { fontSize: 13 }]}>
                      {c.is_payback
                        ? weekdayWords(c.spent_on)
                        : `${name(c.paid_by)} paid · ${
                            c.split_among.length === data.people.length && data.people.every((p) => c.split_among.includes(p.id))
                              ? "split between everyone"
                              : `for ${c.split_among.map(name).join(", ")}`
                          } · ${weekdayWords(c.spent_on)}`}
                    </Text>
                  </View>
                  <Text style={[ui.cardTitle, { fontSize: 15 }]}>{formatMoney(c.amount_cents)}</Text>
                </Tap>
              </Appear>
            ))}
          </View>
        </>
      )}

      <Button title="Add a cost" icon="add" onPress={() => open()} />
    </NookScroll>
  );
}
