import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import { Alert, StyleSheet, View } from "react-native";

import { Icon, IconBadge } from "../../components/icon";
import { Appear, LoadingScreen, Tap } from "../../components/motion";
import { NookHero } from "../../components/nook-hero";
import { NookScroll } from "../../components/nook-scroll";
import { Text } from "../../components/text";
import { Button, Chip, EmptyState, HeaderIcon, SectionHeader } from "../../components/ui";
import { HeaderWithHelp } from "../../components/help-button";
import { useAuth } from "../../lib/auth-context";
import { friendlyError, tap } from "../../lib/feedback";
import { findNook } from "../../lib/nooks";
import { areaInfo, groupRhythms, rhythmDueWords, rhythmState, startersLeft, type Rhythm } from "../../lib/rhythms";
import { completeRhythm, personName, useRhythms } from "../../lib/rhythms-data";
import { colors, ui } from "../../lib/theme";

const nook = findNook("rhythms")!;

// Rhythms home (RHY-001): what needs doing now, what's coming this month,
// and everything later, each one tap from done.
export default function RhythmsHome() {
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user.id;
  const { data, error, isLoading, reload } = useRhythms(userId);
  const [busy, setBusy] = useState<string | null>(null);
  const [mineOnly, setMineOnly] = useState(false);

  if (isLoading && !data) return <LoadingScreen cards={3} />;
  if (!data) {
    return (
      <NookScroll onRefresh={reload}>
        <EmptyState icon="rhythm" title="Couldn't open Rhythms" body={error ?? "Check your connection and try again."} />
      </NookScroll>
    );
  }

  const shared = data.members.length > 1;
  const shown = mineOnly ? data.rhythms.filter((r) => r.owner === userId) : data.rhythms;
  const groups = groupRhythms(shown, data.today);
  const all = groupRhythms(data.rhythms, data.today);
  const overdue = all.now.filter((r) => r.due_on! < data.today).length;
  const next = all.now[0] ?? all.month[0] ?? all.later[0];
  const moreStarters = startersLeft(data.rhythms.map((r) => r.title)).length;

  const headline = !data.rhythms.length
    ? "Set up your Home's rhythms"
    : overdue
      ? `${overdue} thing${overdue === 1 ? "" : "s"} overdue`
      : all.now.length
        ? `${all.now[0].title} is due today`
        : next
          ? `Next: ${next.title}`
          : "All caught up";

  async function done(rhythm: Rhythm) {
    if (busy) return;
    setBusy(rhythm.id);
    tap("success");
    const { error: doneError, alreadyDone } = await completeRhythm(rhythm.id);
    if (doneError) {
      Alert.alert(alreadyDone ? "Already done today" : "Couldn't mark that done", alreadyDone ? "Someone just did it. Refreshing…" : friendlyError(doneError));
    }
    await reload();
    setBusy(null);
  }

  function row(rhythm: Rhythm, index: number) {
    const state = rhythmState(rhythm, data!.today);
    const hot = state === "overdue" || state === "today";
    const area = areaInfo(rhythm.area);
    const owner = rhythm.owner ? personName(data!, rhythm.owner, userId) : null;
    return (
      <Appear key={rhythm.id} index={index}>
        <View style={[ui.card, styles.row]}>
          <Tap
            onPress={() => router.push(`/rhythms/${rhythm.id}`)}
            style={[ui.row, { gap: 12, flex: 1 }]}
            accessibilityRole="button"
            accessibilityLabel={`${rhythm.title}, ${rhythmDueWords(rhythm, data!.today)}`}
          >
            <IconBadge name={area.icon} size={40} color={hot ? "#ffffff" : nook.iconColor} background={hot ? colors.error : nook.color} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={ui.cardTitle} numberOfLines={2}>
                {rhythm.title}
              </Text>
              <Text style={[ui.muted, { fontSize: 13 }, hot && { color: colors.error, fontWeight: "600" }]} numberOfLines={1}>
                {[rhythmDueWords(rhythm, data!.today), owner].filter(Boolean).join(" · ")}
              </Text>
            </View>
          </Tap>
          {rhythm.due_on ? (
            <Button
              title="Done"
              variant={hot ? "primary" : "secondary"}
              disabled={busy === rhythm.id}
              onPress={() => done(rhythm)}
              style={{ paddingHorizontal: 12, paddingVertical: 8 }}
            />
          ) : (
            <Icon name="check" size={20} color={nook.iconColor} />
          )}
        </View>
      </Appear>
    );
  }

  const sections: { key: keyof typeof groups; title: string; icon: "warning" | "calendar" | "rhythm" | "check" }[] = [
    { key: "now", title: "Needs doing", icon: "warning" },
    { key: "month", title: "This month", icon: "calendar" },
    { key: "later", title: "Later", icon: "rhythm" },
    { key: "done", title: "Done for good", icon: "check" },
  ];

  return (
    <NookScroll onRefresh={reload}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <HeaderWithHelp>
              <HeaderIcon icon="settings" label="Rhythms Nook settings" onPress={() => router.push("/rhythms/settings")} />
            </HeaderWithHelp>
          ),
        }}
      />

      <NookHero
        icon="rhythm"
        accent={nook.iconColor}
        tint={nook.color}
        headline={headline}
        facts={[
          { icon: "rhythm", text: `${data.rhythms.length} rhythm${data.rhythms.length === 1 ? "" : "s"}` },
          ...(all.month.length ? [{ icon: "calendar" as const, text: `${all.month.length} coming up this month` }] : []),
          ...(shared ? [{ icon: "group" as const, text: "Shared with your Home" }] : []),
        ]}
      />

      {!data.rhythms.length ? (
        <>
          <EmptyState
            icon="rhythm"
            title="Nothing here yet"
            body="Pick the chores your Home does every season or year — furnace filters, smoke detectors, flu shots — and Rhythms will remind you when each comes round."
          />
          <Button title="Pick from the starter list" icon="todo" onPress={() => router.push("/rhythms/starter")} />
          <Button title="Add your own" icon="add" variant="secondary" onPress={() => router.push("/rhythms/form")} />
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
            <Text style={ui.muted}>Nothing is yours yet. Open a rhythm and pick who looks after it.</Text>
          ) : null}

          {sections.map((section) =>
            groups[section.key].length ? (
              <View key={section.key} style={{ gap: 10 }}>
                <SectionHeader title={section.title} icon={section.icon} />
                {groups[section.key].map((r, i) => row(r, i))}
              </View>
            ) : null
          )}

          <Button title="Add a rhythm" icon="add" onPress={() => router.push("/rhythms/form")} />
          {moreStarters ? (
            <Button title="More from the starter list" icon="todo" variant="secondary" onPress={() => router.push("/rhythms/starter")} />
          ) : null}
        </>
      )}
    </NookScroll>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
});
