import { useState } from "react";
import { Alert, View } from "react-native";

import { friendlyError, tap } from "../lib/feedback";
import { nudgeOutcome, type NudgeKind } from "../lib/nudges";
import { supabase } from "../lib/supabase";
import { colors, ui } from "../lib/theme";
import { Icon } from "./icon";
import { BottomSheet } from "./bottom-sheet";
import { Tap } from "./motion";
import { Text, TextInput } from "./text";
import { Button } from "./ui";

// Nudges (CORE-101): the buttons that send one, and what they remember. A
// screen calls useNudges() once, renders `sheet` as the last child of its
// root View, and gives each button its own key, so each flips to "Nudged"
// on its own. Tapping a button opens the sheet, where a short note can be
// added before sending.

export const NUDGE_NOTE_LENGTH = 140;

type NudgeAsk = {
  key: string;
  kind: NudgeKind;
  target: string;
  // Who it's going to, for the sheet's title: "Sam", "3 people".
  who: string;
  person?: string;
  aboutGathering?: string | null;
  many?: boolean;
  // A line under the note box, like the Wishbook's "don't give it away".
  hint?: string;
};

export function useNudges() {
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [asking, setAsking] = useState<NudgeAsk | null>(null);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");

  function nudge(key: string, kind: NudgeKind, target: string, options: Omit<NudgeAsk, "key" | "kind" | "target">) {
    if (busy || sent.has(key)) return;
    tap();
    setAsking({ key, kind, target, ...options });
    setNote("");
    setOpen(true);
  }

  async function send() {
    if (!asking || busy) return;
    const { key, kind, target, person, aboutGathering, many } = asking;
    setBusy(key);
    const { data, error } = await supabase.rpc("send_nudge", {
      nudge_kind: kind,
      target,
      person: person ?? null,
      about_gathering: aboutGathering ?? null,
      note: note.trim() || null,
    });
    setBusy(null);
    if (error) return Alert.alert("Couldn't send that nudge", friendlyError(error));
    setOpen(false);
    const outcome = nudgeOutcome(Number(data ?? 0), many);
    if (outcome) Alert.alert(outcome.title, outcome.body);
    else tap("success");
    setSent((before) => new Set(before).add(key));
  }

  const sheet = (
    <BottomSheet
      visible={open}
      onClose={() => setOpen(false)}
      header={<Text style={[ui.cardTitle, { fontSize: 18 }]}>Nudge {asking?.who}</Text>}
    >
      <View style={{ gap: 12 }}>
        <Text style={ui.muted}>
          {asking?.many ? "Each gets a reminder in their inbox." : "They'll get a reminder in their inbox."} Add a few
          words if you like.
        </Text>
        <TextInput
          style={[ui.input, { minHeight: 70, textAlignVertical: "top" }]}
          value={note}
          onChangeText={setNote}
          placeholder="A note (optional)"
          placeholderTextColor={colors.muted}
          maxLength={NUDGE_NOTE_LENGTH}
          multiline
          // Wraps like a note, but the return key sends it (a nudge note is
          // one line anyway), so there's always a way off the keyboard.
          submitBehavior="blurAndSubmit"
          returnKeyType="send"
          onSubmitEditing={send}
          accessibilityLabel="A note to go with the nudge"
        />
        <View style={[ui.row, { justifyContent: "space-between", gap: 12 }]}>
          <Text style={[ui.muted, { fontSize: 13, flex: 1 }]}>{asking?.hint ?? ""}</Text>
          {note.length > NUDGE_NOTE_LENGTH - 30 ? (
            <Text style={[ui.muted, { fontSize: 13 }]}>{NUDGE_NOTE_LENGTH - note.length} left</Text>
          ) : null}
        </View>
        <Button title="Send nudge" icon="nudge" onPress={send} loading={busy !== null} />
      </View>
    </BottomSheet>
  );

  return {
    nudge,
    sheet,
    isSent: (key: string) => sent.has(key),
    isBusy: (key: string) => busy === key,
  };
}

// A small "Nudge" pill for the end of a row.
export function NudgePill({
  sent,
  onPress,
  label,
}: {
  sent: boolean;
  onPress: () => void;
  // Read out by screen readers: "Nudge Sam to answer".
  label: string;
}) {
  return (
    <Tap
      onPress={onPress}
      disabled={sent}
      hitSlop={8}
      style={[
        ui.row,
        {
          gap: 4,
          paddingVertical: 5,
          paddingHorizontal: 10,
          borderRadius: 999,
          backgroundColor: colors.barkSoft,
          opacity: sent ? 0.7 : 1,
        },
      ]}
      accessibilityRole="button"
      accessibilityState={{ disabled: sent }}
      accessibilityLabel={sent ? "Nudged" : label}
    >
      <Icon name={sent ? "check" : "nudge"} size={13} color={colors.bark} />
      <Text style={{ fontSize: 13, fontWeight: "700", color: colors.bark }}>{sent ? "Nudged" : "Nudge"}</Text>
    </Tap>
  );
}

// A full-width button: "Nudge everyone who hasn't answered".
export function NudgeButton({
  title,
  sent,
  busy,
  onPress,
  hint,
}: {
  title: string;
  sent: boolean;
  busy: boolean;
  onPress: () => void;
  hint?: string;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Button
        title={sent ? "Nudged" : title}
        icon={sent ? "check" : "nudge"}
        variant="secondary"
        loading={busy}
        disabled={sent}
        onPress={onPress}
      />
      {hint && !sent ? <Text style={[ui.muted, { fontSize: 13 }]}>{hint}</Text> : null}
    </View>
  );
}
