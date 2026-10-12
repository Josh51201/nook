import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";

import { DateField } from "../../components/date-field";
import { useLeaveGuard } from "../../components/leave-guard";
import { LoadingScreen, Tap } from "../../components/motion";
import { NookScroll } from "../../components/nook-scroll";
import { Text, TextInput } from "../../components/text";
import { Button, EmptyState } from "../../components/ui";
import { useAuth } from "../../lib/auth-context";
import { friendlyError, tap } from "../../lib/feedback";
import { formatEntry, formatNumber, parseNumber, scaleWords } from "../../lib/little-log";
import { useLittleLogs } from "../../lib/little-log-data";
import { supabase } from "../../lib/supabase";
import { colors, themed, ui } from "../../lib/theme";

// Log it (LOG-003), or change an entry: what goes in depends on the log —
// a number, two numbers, 1 to 5, yes or no, or a few words — plus when
// (now, unless you change it) and an optional note.
export default function LogEntryScreen() {
  const router = useRouter();
  const { log: logId, entry: entryId } = useLocalSearchParams<{ log: string; entry?: string }>();
  const { session } = useAuth();
  const userId = session?.user.id;
  const { data } = useLittleLogs(userId);
  const log = data?.logs.find((l) => l.id === logId);
  const existing = entryId ? data?.entries.get(logId)?.find((e) => e.id === entryId) : undefined;
  const last = data?.entries.get(logId)?.[0];

  const [ready, setReady] = useState(false);
  const [value, setValue] = useState("");
  const [value2, setValue2] = useState("");
  const [choice, setChoice] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [when, setWhen] = useState(new Date());
  const [saving, setSaving] = useState(false);
  const { allowLeave } = useLeaveGuard({ value, value2, choice, note, when: when.getTime() }, ready);

  useEffect(() => {
    if (ready || !data) return;
    if (entryId && !existing) return;
    if (existing) {
      setValue(existing.value !== null && log?.kind !== "scale" && log?.kind !== "yesno" ? String(existing.value) : "");
      setValue2(existing.value2 !== null ? String(existing.value2) : "");
      setChoice(log?.kind === "scale" || log?.kind === "yesno" ? existing.value : null);
      setNote(existing.note ?? "");
      setWhen(new Date(existing.logged_at));
    }
    setReady(true);
  }, [data, existing, entryId, log, ready]);

  if (!data || !ready) return <LoadingScreen cards={1} />;
  if (!log) return <EmptyState icon="chart" title="This log isn't here" body="It may have been removed." />;
  const theLog = log;

  async function save() {
    let row: { value: number | null; value2: number | null; note: string | null };
    const words = note.trim() || null;
    if (theLog.kind === "number" || theLog.kind === "pair") {
      const a = parseNumber(value);
      if (a === null) return Alert.alert("What's the number?", theLog.unit ? `Just the number, in ${theLog.unit}.` : "Just the number, like 182.4.");
      const b = theLog.kind === "pair" ? parseNumber(value2) : null;
      if (theLog.kind === "pair" && b === null) return Alert.alert("Both numbers", `Fill in ${theLog.labels?.[1]?.toLowerCase() ?? "the second one"} too.`);
      row = { value: a, value2: b, note: words };
    } else if (theLog.kind === "scale" || theLog.kind === "yesno") {
      if (choice === null) return Alert.alert(theLog.kind === "scale" ? "Pick 1 to 5" : "Yes or no?");
      row = { value: choice, value2: null, note: words };
    } else {
      if (!words) return Alert.alert("Write something", "A line or two is plenty.");
      row = { value: null, value2: null, note: words };
    }
    if (when.getTime() > Date.now() + 5 * 60_000) return Alert.alert("That's in the future", "Pick a time that's already happened.");

    setSaving(true);
    const full = { ...row, logged_at: when.toISOString() };
    const { error } = existing
      ? await supabase.from("little_log_entries").update(full).eq("id", existing.id)
      : await supabase.from("little_log_entries").insert({ ...full, log_id: theLog.id });
    if (error) {
      setSaving(false);
      return Alert.alert("Couldn't save", friendlyError(error));
    }
    tap("success");
    allowLeave();
    router.back();
  }

  function confirmDelete() {
    Alert.alert("Remove this entry?", formatEntry(theLog, existing!), [
      { text: "Keep it", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase.from("little_log_entries").delete().eq("id", existing!.id);
          if (error) return Alert.alert("Couldn't remove it", friendlyError(error));
          allowLeave();
          router.back();
        },
      },
    ]);
  }

  function pick(n: number) {
    tap();
    setChoice(n);
  }

  // Last time's value as the hint, so you can see where you are.
  const hint = (v: number | null | undefined, fallback: string) => (v !== null && v !== undefined ? formatNumber(v) : fallback);

  return (
    <NookScroll>
      <Stack.Screen
        options={{
          title: existing ? `Change ${theLog.name}` : theLog.name,
          headerRight: () => (
            <Tap onPress={save} disabled={saving} hitSlop={10}>
              <Text style={{ color: colors.bark, fontSize: 17, fontWeight: "700" }}>Save</Text>
            </Tap>
          ),
        }}
      />

      {theLog.kind === "number" ? (
        <View style={[ui.row, { gap: 10 }]}>
          <TextInput
            style={[ui.input, styles.bigInput, { flex: 1 }]}
            value={value}
            onChangeText={setValue}
            placeholder={hint(last?.value, "0")}
            placeholderTextColor={colors.muted}
            keyboardType="decimal-pad"
            autoFocus={!existing}
            maxLength={12}
            accessibilityLabel={theLog.name}
          />
          {theLog.unit ? <Text style={styles.unit}>{theLog.unit}</Text> : null}
        </View>
      ) : null}

      {theLog.kind === "pair" ? (
        <>
          <View style={[ui.row, { gap: 8 }]}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={ui.label}>{theLog.labels?.[0] ?? "First"}</Text>
              <TextInput
                style={[ui.input, styles.bigInput]}
                value={value}
                onChangeText={setValue}
                placeholder={hint(last?.value, "120")}
                placeholderTextColor={colors.muted}
                keyboardType="decimal-pad"
                autoFocus={!existing}
                maxLength={10}
                accessibilityLabel={theLog.labels?.[0] ?? "First"}
              />
            </View>
            <Text style={[styles.unit, { marginTop: 22 }]}>/</Text>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={ui.label}>{theLog.labels?.[1] ?? "Second"}</Text>
              <TextInput
                style={[ui.input, styles.bigInput]}
                value={value2}
                onChangeText={setValue2}
                placeholder={hint(last?.value2, "80")}
                placeholderTextColor={colors.muted}
                keyboardType="decimal-pad"
                maxLength={10}
                accessibilityLabel={theLog.labels?.[1] ?? "Second"}
              />
            </View>
          </View>
          {theLog.unit ? <Text style={ui.muted}>In {theLog.unit}.</Text> : null}
        </>
      ) : null}

      {theLog.kind === "scale" ? (
        <View style={{ gap: 8 }}>
          {[5, 4, 3, 2, 1].map((n) => (
            <Tap
              key={n}
              onPress={() => pick(n)}
              style={[ui.card, styles.choice, choice === n && { backgroundColor: theLog.color, borderColor: theLog.color }]}
              accessibilityRole="radio"
              accessibilityState={{ selected: choice === n }}
            >
              <Text style={[styles.choiceNumber, choice === n && { color: "#ffffff" }]}>{n}</Text>
              <Text style={[ui.cardTitle, choice === n && { color: "#ffffff" }]}>{scaleWords[n - 1]}</Text>
            </Tap>
          ))}
        </View>
      ) : null}

      {theLog.kind === "yesno" ? (
        <View style={[ui.row, { gap: 10 }]}>
          {[
            { n: 1, label: "Yes" },
            { n: 0, label: "No" },
          ].map(({ n, label }) => (
            <Tap
              key={label}
              onPress={() => pick(n)}
              style={[ui.card, styles.yesNo, choice === n && { backgroundColor: n ? theLog.color : colors.bark, borderColor: n ? theLog.color : colors.bark }]}
              accessibilityRole="radio"
              accessibilityState={{ selected: choice === n }}
            >
              <Text style={[styles.choiceNumber, choice === n && { color: "#ffffff" }]}>{label}</Text>
            </Tap>
          ))}
        </View>
      ) : null}

      {theLog.kind === "text" ? (
        <TextInput
          style={[ui.input, { minHeight: 140, textAlignVertical: "top" }]}
          value={note}
          onChangeText={setNote}
          placeholder="What happened?"
          placeholderTextColor={colors.muted}
          multiline
          autoFocus={!existing}
          maxLength={500}
        />
      ) : (
        <TextInput
          style={[ui.input, { minHeight: 70, textAlignVertical: "top" }]}
          value={note}
          onChangeText={setNote}
          placeholder="A note (optional), e.g. after a run"
          placeholderTextColor={colors.muted}
          multiline
          maxLength={500}
        />
      )}

      <Text style={ui.label}>When</Text>
      <DateField mode="datetime" value={when} onChange={setWhen} maximumDate={new Date(Date.now() + 5 * 60_000)} />

      <Button title={existing ? "Save" : "Log it"} icon="check" onPress={save} loading={saving} style={{ marginTop: 8 }} />
      {existing ? <Button title="Remove this entry" icon="trash" variant="danger" onPress={confirmDelete} /> : null}
    </NookScroll>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    bigInput: { fontSize: 28, fontWeight: "700", paddingVertical: 14, textAlign: "center" },
    unit: { fontSize: 20, fontWeight: "600", color: colors.muted },
    choice: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 12 },
    choiceNumber: { fontSize: 22, fontWeight: "800", color: colors.text, minWidth: 22, textAlign: "center" },
    yesNo: { flex: 1, alignItems: "center", paddingVertical: 22 },
  })
);
