import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Alert, StyleSheet, View } from "react-native";

import { Avatar } from "../../components/avatar";
import { DateField } from "../../components/date-field";
import { Icon, IconBadge } from "../../components/icon";
import { Appear, LoadingScreen, Tap } from "../../components/motion";
import { NookScroll } from "../../components/nook-scroll";
import { NudgeButton, useNudges } from "../../components/nudge";
import { Text, TextInput } from "../../components/text";
import { Button, EmptyState, SectionHeader } from "../../components/ui";
import { useAuth } from "../../lib/auth-context";
import { friendlyError, tap } from "../../lib/feedback";
import { findNook } from "../../lib/nooks";
import { localDay } from "../../lib/pets";
import { parseDateString, toDateString } from "../../lib/profile";
import { areaInfo, historyFor, lastDoneWords, latestEntry, repeatWords, rhythmDueWords, rhythmState } from "../../lib/rhythms";
import { completeRhythm, personName, undoRhythm, useRhythms } from "../../lib/rhythms-data";
import { colors, ui } from "../../lib/theme";

const nook = findNook("rhythms")!;

function dayWords(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

// One rhythm (RHY-004..006): when it's due, whose it is, mark it done (today
// or another day, with a note), and the log of who did it before.
export default function RhythmPage() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const userId = session?.user.id;
  const { data, isLoading, reload } = useRhythms(userId);
  const [busy, setBusy] = useState(false);
  const [logging, setLogging] = useState(false);
  const [onDay, setOnDay] = useState(localDay());
  const [note, setNote] = useState("");
  const [showAll, setShowAll] = useState(false);
  const nudges = useNudges();

  const rhythm = data?.rhythms.find((r) => r.id === id);

  if (isLoading && !data) return <LoadingScreen cards={3} />;
  if (!data || !rhythm) {
    return <EmptyState icon="rhythm" title="That rhythm isn't here" body="Someone in your Home may have removed it." />;
  }

  const area = areaInfo(rhythm.area);
  const state = rhythmState(rhythm, data.today);
  const hot = state === "overdue" || state === "today";
  const history = historyFor(data.log, rhythm.id);
  const latest = latestEntry(data.log, rhythm.id);
  const shown = showAll ? history : history.slice(0, 6);
  const owner = rhythm.owner ? personName(data, rhythm.owner, userId) : null;

  async function markDone(day: string, withNote: string) {
    if (busy) return;
    setBusy(true);
    tap("success");
    const { error, alreadyDone } = await completeRhythm(rhythm!.id, day, withNote);
    if (error) {
      Alert.alert(
        alreadyDone ? "Already done that day" : "Couldn't mark that done",
        alreadyDone ? "Someone already logged it for that day." : friendlyError(error)
      );
    } else {
      setLogging(false);
      setNote("");
      setOnDay(localDay());
    }
    await reload();
    setBusy(false);
  }

  function confirmUndo(entryId: string) {
    Alert.alert("Undo this?", "The due date goes back to what it was.", [
      { text: "Keep", style: "cancel" },
      {
        text: "Undo",
        style: "destructive",
        onPress: async () => {
          setBusy(true);
          tap();
          const { error } = await undoRhythm(entryId);
          if (error) Alert.alert("Couldn't undo that", friendlyError(error));
          await reload();
          setBusy(false);
        },
      },
    ]);
  }

  return (
    <View style={{ flex: 1 }}>
      <NookScroll onRefresh={reload}>
        <Stack.Screen
          options={{
            title: area.label,
            headerRight: () => (
              <Tap
                onPress={() => router.push({ pathname: "/rhythms/form", params: { id: rhythm.id } })}
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
            <IconBadge name={area.icon} size={56} color={hot ? "#ffffff" : nook.iconColor} background={hot ? colors.error : colors.surface} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[styles.title, { color: colors.text }]}>{rhythm.title}</Text>
              <Text style={[ui.muted, { color: hot ? colors.error : colors.text, fontWeight: hot ? "700" : "500" }]}>
                {rhythmDueWords(rhythm, data.today)}
              </Text>
            </View>
          </View>
        </Appear>

        <View style={[ui.card, { gap: 12 }]}>
          <View style={[ui.row, { gap: 10 }]}>
            <Icon name="rhythm" size={18} color={nook.iconColor} />
            <Text style={[ui.muted, { flex: 1, color: colors.text }]}>
              Comes round {repeatWords(rhythm.repeat_months)}
              {rhythm.due_on ? ` · next ${dayWords(rhythm.due_on)}` : ""}
            </Text>
          </View>
          <View style={[ui.row, { gap: 10 }]}>
            <Icon name="person" size={18} color={nook.iconColor} />
            <Text style={[ui.muted, { flex: 1, color: colors.text }]}>
              {owner ? (owner === "You" ? "Yours to do" : `${owner}'s to do`) : "Anyone in the Home can do it"}
            </Text>
          </View>
          <View style={[ui.row, { gap: 10 }]}>
            <Icon name="clock" size={18} color={nook.iconColor} />
            <Text style={[ui.muted, { flex: 1, color: colors.text }]}>
              {lastDoneWords(rhythm.last_done_on, data.today)}
              {rhythm.last_done_by ? ` by ${personName(data, rhythm.last_done_by, userId).replace(/^You$/, "you")}` : ""}
            </Text>
          </View>
          {rhythm.notes ? <Text style={[ui.muted, { color: colors.text }]}>{rhythm.notes}</Text> : null}
        </View>

        {/* CORE-101: it's someone else's job, so you can remind them. */}
        {owner && rhythm.owner !== userId ? (
          <NudgeButton
            title={`Remind ${owner}`}
            sent={nudges.isSent("rhythm")}
            busy={nudges.isBusy("rhythm")}
            onPress={() => nudges.nudge("rhythm", "rhythm", rhythm.id, { who: owner })}
          />
        ) : null}

        {logging ? (
          <View style={[ui.card, { gap: 10 }]}>
            <Text style={ui.label}>When was it done?</Text>
            <DateField mode="date" value={parseDateString(onDay)} maximumDate={new Date()} onChange={(d) => setOnDay(toDateString(d))} />
            <TextInput
              style={ui.input}
              value={note}
              onChangeText={setNote}
              placeholder="A note, if you like: “used 16x25 filter”"
              placeholderTextColor={colors.muted}
              maxLength={200}
            />
            <Button title="Mark done" icon="check" onPress={() => markDone(onDay, note)} loading={busy} />
            <Tap onPress={() => setLogging(false)} hitSlop={8} style={{ alignSelf: "center" }}>
              <Text style={ui.link}>Cancel</Text>
            </Tap>
          </View>
        ) : (
          <>
            <Button
              title={rhythm.due_on ? "Done today" : "Did it again today"}
              icon="check"
              onPress={() => markDone(localDay(), "")}
              loading={busy}
            />
            <Tap onPress={() => setLogging(true)} hitSlop={8} style={{ alignSelf: "center" }}>
              <Text style={ui.link}>Done on another day, or add a note</Text>
            </Tap>
          </>
        )}

        <SectionHeader title="Who did it" icon="clock" />
        {history.length === 0 ? (
          <Text style={ui.muted}>Nothing logged yet. Each time it's done, it shows up here with who did it.</Text>
        ) : (
          <View style={[ui.card, { gap: 12 }]}>
            {shown.map((entry) => {
              const who = personName(data, entry.done_by, userId);
              return (
                <View key={entry.id} style={[ui.row, { gap: 10, alignItems: "flex-start" }]}>
                  <Avatar name={entry.done_by ? data.names.get(entry.done_by) : null} size={30} />
                  <View style={{ flex: 1 }}>
                    <Text style={[ui.muted, { color: colors.text, fontSize: 14 }]}>
                      {who} · {dayWords(entry.done_on)}
                    </Text>
                    {entry.note ? <Text style={[ui.muted, { fontSize: 13 }]}>{entry.note}</Text> : null}
                  </View>
                  {latest?.id === entry.id ? (
                    <Tap onPress={() => confirmUndo(entry.id)} disabled={busy} hitSlop={8}>
                      <Text style={ui.error}>Undo</Text>
                    </Tap>
                  ) : null}
                </View>
              );
            })}
            {history.length > 6 ? (
              <Tap onPress={() => setShowAll((v) => !v)} hitSlop={8}>
                <Text style={ui.link}>{showAll ? "Show less" : `Show all ${history.length}`}</Text>
              </Tap>
            ) : null}
          </View>
        )}
      </NookScroll>
      {nudges.sheet}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: "row", alignItems: "center", gap: 16, padding: 18, borderRadius: 24 },
  title: { fontSize: 24, fontWeight: "800", letterSpacing: -0.5 },
});
