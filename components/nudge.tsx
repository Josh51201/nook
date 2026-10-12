import { useState } from "react";
import { Alert, View } from "react-native";

import { friendlyError, tap } from "../lib/feedback";
import { nudgeOutcome, type NudgeKind } from "../lib/nudges";
import { supabase } from "../lib/supabase";
import { colors, ui } from "../lib/theme";
import { Icon } from "./icon";
import { Tap } from "./motion";
import { Text } from "./text";
import { Button } from "./ui";

// Nudges (CORE-101): the buttons that send one, and what they remember. A
// screen calls useNudges() once and gives each button its own key, so each
// flips to "Nudged" on its own after it's tapped.

export function useNudges() {
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);

  async function nudge(
    key: string,
    kind: NudgeKind,
    target: string,
    options: { person?: string; aboutGathering?: string | null; many?: boolean } = {}
  ) {
    if (busy || sent.has(key)) return;
    setBusy(key);
    const { data, error } = await supabase.rpc("send_nudge", {
      nudge_kind: kind,
      target,
      person: options.person ?? null,
      about_gathering: options.aboutGathering ?? null,
    });
    setBusy(null);
    if (error) return Alert.alert("Couldn't send that nudge", friendlyError(error));
    const outcome = nudgeOutcome(Number(data ?? 0), options.many);
    if (outcome) Alert.alert(outcome.title, outcome.body);
    else tap("success");
    setSent((before) => new Set(before).add(key));
  }

  return {
    nudge,
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
