import { Stack, useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { HeaderWithHelp } from "../../components/help-button";
import { Icon, IconBadge, type IconName } from "../../components/icon";
import { Sparkline } from "../../components/log-chart";
import { Appear, LoadingScreen, Tap } from "../../components/motion";
import { NookHero } from "../../components/nook-hero";
import { NookScroll } from "../../components/nook-scroll";
import { Text } from "../../components/text";
import { Button, Chip, EmptyState, SectionHeader } from "../../components/ui";
import { useAuth } from "../../lib/auth-context";
import { tap } from "../../lib/feedback";
import { agoWords, formatEntry, inRange, starters, yesNoDays, type LittleLog } from "../../lib/little-log";
import { useLittleLogs, whoName } from "../../lib/little-log-data";
import { findNook } from "../../lib/nooks";
import { localDay } from "../../lib/pets";
import { colors, ui } from "../../lib/theme";

const nook = findNook("little-log")!;

// Little Log home (LOG-001..006): each log with its latest entry and a tiny
// trend, a + to log it in two taps, and the shared logs of people you live
// with. New here: pick a starter.
export default function LittleLogHome() {
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user.id;
  const { data, error, isLoading, reload } = useLittleLogs(userId);

  if (isLoading && !data) return <LoadingScreen cards={3} />;
  if (!data) {
    return (
      <NookScroll onRefresh={reload}>
        <EmptyState icon="chart" title="Couldn't open Little Log" body={error ?? "Check your connection and try again."} />
      </NookScroll>
    );
  }

  const mine = data.logs.filter((log) => log.owner_id === userId);
  const theirs = data.logs.filter((log) => log.owner_id !== userId);
  const today = localDay();
  const loggedToday = data.logs.filter((log) => (data.entries.get(log.id) ?? []).some((e) => localDay(new Date(e.logged_at)) === today));

  function addTo(log: LittleLog) {
    tap();
    router.push({ pathname: "/little-log/entry", params: { log: log.id } });
  }

  function row(log: LittleLog, index: number) {
    const entries = data!.entries.get(log.id) ?? [];
    const latest = entries[0];
    const recent = inRange(entries, "month");
    const owner = log.owner_id !== userId ? whoName(data!, log.owner_id, userId) : null;
    const sub = latest
      ? `${log.kind === "text" ? "Wrote" : formatEntry(log, latest)} · ${agoWords(latest.logged_at, today)}`
      : "Nothing logged yet";
    return (
      <Appear key={log.id} index={index}>
        <Tap
          onPress={() => router.push(`/little-log/${log.id}`)}
          style={[ui.card, styles.row]}
          accessibilityRole="button"
          accessibilityLabel={`${log.name}. ${sub}`}
        >
          <IconBadge name={log.icon as IconName} size={42} color="#ffffff" background={log.color} />
          <View style={{ flex: 1, gap: 2 }}>
            <View style={[ui.row, { gap: 6 }]}>
              <Text style={[ui.cardTitle, { flexShrink: 1 }]} numberOfLines={1}>
                {log.name}
              </Text>
              {log.shared ? <Icon name="group" size={13} color={colors.muted} /> : null}
            </View>
            <Text style={[ui.muted, { fontSize: 13 }]} numberOfLines={1}>
              {owner ? `${owner}'s · ` : ""}
              {sub}
            </Text>
          </View>
          {log.kind === "yesno" ? (
            <WeekDots log={log} entries={entries} />
          ) : log.kind !== "text" ? (
            <Sparkline entries={recent} color={log.color} width={64} height={30} ring={colors.surface} />
          ) : null}
          <Tap
            onPress={() => addTo(log)}
            hitSlop={8}
            pressedScale={0.85}
            style={[styles.add, { backgroundColor: log.color }]}
            accessibilityRole="button"
            accessibilityLabel={`Log ${log.name}`}
          >
            <Icon name="add" size={18} color="#ffffff" />
          </Tap>
        </Tap>
      </Appear>
    );
  }

  return (
    <NookScroll onRefresh={reload}>
      <Stack.Screen
        options={{
          headerRight: () => <HeaderWithHelp />,
        }}
      />

      <NookHero
        icon="chart"
        accent={nook.iconColor}
        tint={nook.color}
        headline={
          !data.logs.length
            ? "Keep track of anything"
            : loggedToday.length
              ? `${loggedToday.length} of ${data.logs.length} logged today`
              : "Nothing logged yet today"
        }
        facts={
          data.logs.length
            ? [
                { icon: "chart", text: `${data.logs.length} log${data.logs.length === 1 ? "" : "s"}` },
                ...(theirs.length ? [{ icon: "group" as const, text: `${theirs.length} shared with you` }] : []),
              ]
            : [{ icon: "sparkles", text: "Weight, blood pressure, mood, mileage…" }]
        }
      />

      {!data.logs.length ? (
        <>
          <EmptyState
            icon="chart"
            title="What would you like to keep track of?"
            body="Pick one to start, or make your own. Each one gets a chart, its history, and a reminder if you want one. They're just yours unless you share one with your Home."
          />
          <View style={ui.chips}>
            {starters.map((s) => (
              <Chip key={s.name} icon={s.icon as IconName} onPress={() => router.push({ pathname: "/little-log/form", params: { starter: s.name } })}>
                {s.name}
              </Chip>
            ))}
          </View>
          <Button title="Make your own" icon="add" variant="secondary" onPress={() => router.push("/little-log/form")} />
        </>
      ) : (
        <>
          {mine.length ? (
            <View style={{ gap: 10 }}>
              {theirs.length ? <SectionHeader title="Your logs" icon="person" /> : null}
              {mine.map((log, i) => row(log, i))}
            </View>
          ) : null}
          {theirs.length ? (
            <View style={{ gap: 10 }}>
              <SectionHeader title="Shared with you" icon="group" />
              {theirs.map((log, i) => row(log, i + mine.length))}
            </View>
          ) : null}
          <Button title="New log" icon="add" onPress={() => router.push("/little-log/form")} />
        </>
      )}
    </NookScroll>
  );
}

// The last 7 days of a yes/no log, as little dots.
function WeekDots({ log, entries }: { log: LittleLog; entries: Parameters<typeof yesNoDays>[0] }) {
  return (
    <View style={{ flexDirection: "row", gap: 3 }} accessibilityElementsHidden>
      {yesNoDays(entries, 7).map((d) => (
        <View
          key={d.day}
          style={{
            width: 7,
            height: 7,
            borderRadius: 2,
            backgroundColor: d.state === "yes" ? log.color : d.state === "no" ? colors.barkSoft : "transparent",
            borderWidth: d.state === null ? 1 : 0,
            borderColor: colors.border,
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  add: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
});
