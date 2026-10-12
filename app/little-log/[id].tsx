import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { HeaderWithHelp } from "../../components/help-button";
import { Icon, IconBadge, type IconName } from "../../components/icon";
import { LogChart, YesNoGrid } from "../../components/log-chart";
import { LoadingScreen, Tap } from "../../components/motion";
import { NookScroll } from "../../components/nook-scroll";
import { Text } from "../../components/text";
import { Button, Chip, EmptyState, HeaderIcon, SectionHeader } from "../../components/ui";
import { useAuth } from "../../lib/auth-context";
import {
  agoWords,
  changeWords,
  dayWords,
  formatEntry,
  formatNumber,
  groupByDay,
  inRange,
  kindInfo,
  logStats,
  ranges,
  remindWords,
  scaleWord,
  timeWords,
  yesNoDays,
  yesStreak,
  type LogEntry,
  type RangeKey,
} from "../../lib/little-log";
import { useLittleLogs, whoName } from "../../lib/little-log-data";
import { colors, themed, ui } from "../../lib/theme";

// One log (LOG-004, LOG-005): the latest entry big, a chart over a range
// you pick (a day grid for yes/no), a few numbers, and the history, newest
// first. Tap an entry to change it.
export default function LogPage() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const userId = session?.user.id;
  const { data, isLoading, reload } = useLittleLogs(userId);
  const [range, setRange] = useState<RangeKey>("month");
  const [chartWidth, setChartWidth] = useState(0);
  const [showAll, setShowAll] = useState(false);

  if (isLoading && !data) return <LoadingScreen cards={3} />;
  const log = data?.logs.find((l) => l.id === id);
  if (!data || !log) {
    return (
      <NookScroll onRefresh={reload}>
        <EmptyState icon="chart" title="This log isn't here" body="It may have been removed, or it's no longer shared with you." />
      </NookScroll>
    );
  }

  const owner = log.owner_id === userId;
  const entries = data.entries.get(log.id) ?? [];
  const latest = entries[0];
  const shown = inRange(entries, range);
  const stats = logStats(shown);
  const unit = log.unit ? ` ${log.unit}` : "";
  const groups = groupByDay(entries);
  const visibleGroups = showAll ? groups : groups.slice(0, 14);

  const days = range === "week" ? 7 : range === "month" ? 35 : 91;
  const grid = log.kind === "yesno" ? yesNoDays(entries, days, data.today) : [];
  const yesCount = grid.filter((d) => d.state === "yes").length;

  const statTiles: { label: string; value: string }[] =
    log.kind === "number" && stats.count
      ? [
          { label: "Average", value: `${formatNumber(stats.average!)}${unit}` },
          { label: "Lowest", value: formatNumber(stats.low!) },
          { label: "Highest", value: formatNumber(stats.high!) },
          ...(stats.change !== null ? [{ label: "Change", value: changeWords(stats.change) }] : []),
        ]
      : log.kind === "pair" && stats.count
        ? [
            { label: `Average ${log.labels?.[0]?.toLowerCase() ?? ""}`.trim(), value: formatNumber(stats.average!) },
            { label: `Average ${log.labels?.[1]?.toLowerCase() ?? ""}`.trim(), value: formatNumber(stats.average2!) },
            { label: "Entries", value: String(stats.count) },
          ]
        : log.kind === "scale" && stats.count
          ? [
              { label: "Average", value: `${formatNumber(stats.average!)} · ${scaleWord(stats.average!)}` },
              { label: "Best", value: String(stats.high) },
              { label: "Worst", value: String(stats.low) },
            ]
          : log.kind === "yesno"
            ? [
                { label: `Yes, last ${days} days`, value: `${yesCount} of ${days}` },
                { label: "Streak", value: `${yesStreak(grid)} day${yesStreak(grid) === 1 ? "" : "s"}` },
              ]
            : [];

  const canChange = (entry: LogEntry) => owner || entry.written_by === userId;

  return (
    <NookScroll onRefresh={reload}>
      <Stack.Screen
        options={{
          title: log.name,
          headerRight: () => (
            <HeaderWithHelp>
              {owner ? <HeaderIcon icon="edit" label={`Change ${log.name}`} onPress={() => router.push({ pathname: "/little-log/form", params: { id: log.id } })} /> : null}
            </HeaderWithHelp>
          ),
        }}
      />

      <View style={[ui.card, styles.hero]}>
        <IconBadge name={log.icon as IconName} size={52} color="#ffffff" background={log.color} />
        <View style={{ flex: 1, gap: 2 }}>
          {latest ? (
            <>
              <Text style={styles.big} numberOfLines={log.kind === "text" ? 3 : 1} adjustsFontSizeToFit={log.kind !== "text"}>
                {formatEntry(log, latest)}
              </Text>
              <Text style={ui.muted}>
                {log.kind === "pair" && log.labels ? `${log.labels[0]} / ${log.labels[1]} · ` : ""}
                {agoWords(latest.logged_at, data.today)}, {timeWords(latest.logged_at)}
              </Text>
            </>
          ) : (
            <Text style={ui.muted}>Nothing logged yet. Tap “Log it” to add the first one.</Text>
          )}
        </View>
      </View>

      <Button
        title="Log it"
        icon="add"
        onPress={() => router.push({ pathname: "/little-log/entry", params: { log: log.id } })}
      />

      <View style={[ui.row, { gap: 14, flexWrap: "wrap" }]}>
        <View style={[ui.row, { gap: 5 }]}>
          <Icon name={log.shared ? "group" : "lock"} size={13} color={colors.muted} />
          <Text style={[ui.muted, { fontSize: 13 }]}>
            {log.shared ? (owner ? "Shared with your Home" : `${whoName(data, log.owner_id, userId)}'s, shared with your Home`) : "Just you"}
          </Text>
        </View>
        {owner && log.remind_at ? (
          <View style={[ui.row, { gap: 5 }]}>
            <Icon name="bell" size={13} color={colors.muted} />
            <Text style={[ui.muted, { fontSize: 13 }]}>Reminds you at {remindWords(log.remind_at)}</Text>
          </View>
        ) : null}
      </View>

      {entries.length && log.kind !== "text" ? (
        <>
          <View style={ui.chips}>
            {ranges
              .filter((r) => log.kind !== "yesno" || r.days !== null && r.days <= 91)
              .map((r) => (
                <Chip key={r.key} selected={range === r.key} onPress={() => setRange(r.key)}>
                  {r.label}
                </Chip>
              ))}
          </View>

          <View style={ui.card} onLayout={(e) => setChartWidth(e.nativeEvent.layout.width - 32)}>
            {chartWidth > 0 ? (
              log.kind === "yesno" ? (
                <YesNoGrid entries={entries} color={log.color} days={days} width={chartWidth} today={data.today} />
              ) : shown.length ? (
                <LogChart log={log} entries={shown} width={chartWidth} />
              ) : (
                <Text style={ui.muted}>Nothing logged in this time. Try a longer one.</Text>
              )
            ) : null}
            {log.kind !== "yesno" && shown.length > 1 ? (
              <Text style={[ui.muted, { fontSize: 12, marginTop: 6 }]}>Touch and slide along the chart to read any entry.</Text>
            ) : null}
          </View>

          {statTiles.length ? (
            <View style={styles.tiles}>
              {statTiles.map((t) => (
                <View key={t.label} style={[ui.card, styles.tile]}>
                  <Text style={[ui.muted, { fontSize: 12 }]} numberOfLines={1}>
                    {t.label}
                  </Text>
                  <Text style={styles.tileValue} numberOfLines={1} adjustsFontSizeToFit>
                    {t.value}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </>
      ) : null}

      {groups.length ? (
        <View style={{ gap: 10 }}>
          <SectionHeader title="History" icon="calendar" right={<Text style={[ui.muted, { fontSize: 13 }]}>{entries.length} in all</Text>} />
          {visibleGroups.map((group) => (
            <View key={group.day} style={{ gap: 6 }}>
              <Text style={[ui.label, { marginBottom: 0 }]}>{dayWords(group.day, data.today)}</Text>
              <View style={[ui.card, { paddingVertical: 4, gap: 0 }]}>
                {group.entries.map((entry, i) => (
                  <Tap
                    key={entry.id}
                    disabled={!canChange(entry)}
                    onPress={() => router.push({ pathname: "/little-log/entry", params: { log: log.id, entry: entry.id } })}
                    style={[styles.entry, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}
                    accessibilityRole={canChange(entry) ? "button" : undefined}
                  >
                    <Text style={[ui.muted, styles.time]}>{timeWords(entry.logged_at)}</Text>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={[ui.cardTitle, { fontWeight: log.kind === "text" ? "400" : "600" }]}>{formatEntry(log, entry)}</Text>
                      {log.kind !== "text" && entry.note ? <Text style={[ui.muted, { fontSize: 13 }]}>{entry.note}</Text> : null}
                      {log.shared && entry.written_by && entry.written_by !== userId ? (
                        <Text style={[ui.muted, { fontSize: 12 }]}>by {whoName(data, entry.written_by, userId)}</Text>
                      ) : null}
                    </View>
                    {canChange(entry) ? <Icon name="chevron" size={12} color={colors.muted} /> : null}
                  </Tap>
                ))}
              </View>
            </View>
          ))}
          {groups.length > visibleGroups.length ? (
            <Button title={`Show all ${groups.length} days`} variant="secondary" onPress={() => setShowAll(true)} />
          ) : null}
        </View>
      ) : null}

      <Text style={[ui.muted, { fontSize: 12 }]}>{kindInfo(log.kind).label} · {kindInfo(log.kind).hint}</Text>
    </NookScroll>
  );
}

// Themed, so the colors follow light and dark.
const styles = themed(() =>
  StyleSheet.create({
    hero: { flexDirection: "row", alignItems: "center", gap: 14 },
    big: { fontSize: 30, fontWeight: "800", letterSpacing: -0.6, color: colors.text },
    tiles: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    tile: { flexGrow: 1, flexBasis: "45%", paddingVertical: 12, gap: 2 },
    tileValue: { fontSize: 20, fontWeight: "700", color: colors.text },
    entry: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
    time: { width: 64, fontSize: 13 },
  })
);
