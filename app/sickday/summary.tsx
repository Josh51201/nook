import * as Clipboard from "expo-clipboard";
import { Stack, useLocalSearchParams } from "expo-router";
import { Alert, Share, View } from "react-native";

import { LoadingScreen } from "../../components/motion";
import { NookScroll } from "../../components/nook-scroll";
import { Text } from "../../components/text";
import { Button, EmptyState } from "../../components/ui";
import { useAuth } from "../../lib/auth-context";
import { tap } from "../../lib/feedback";
import { sickdaySettingDefaults, useNookSettings } from "../../lib/nook-settings";
import { useMyProfile } from "../../lib/profile";
import { absenceNote, doctorSummary, missedWord } from "../../lib/sickday";
import { personName, useSickDay, useSpell } from "../../lib/sickday-data";
import { ui } from "../../lib/theme";

// The doctor summary (SICK-007): everything a doctor asks, in the order they
// ask it, to read out on the phone or send. With mode=absence, a note for
// school or work instead (SICK-012).
export default function Summary() {
  const { id, mode } = useLocalSearchParams<{ id: string; mode?: "absence" }>();
  const { session } = useAuth();
  const userId = session?.user.id;
  const { data } = useSickDay(userId);
  const spell = data?.spells.find((s) => s.id === id);
  const others = data?.spells.filter((s) => spell && s.patient_id === spell.patient_id && s.home_id === spell.home_id) ?? [];
  const { data: detail } = useSpell(spell, others);
  const { settings } = useNookSettings("sickday", sickdaySettingDefaults);
  const { profile } = useMyProfile();

  if (!data || (spell && !detail)) return <LoadingScreen cards={2} />;
  if (!spell || !detail) return <EmptyState icon="sick" title="That isn't here" />;

  const patientName = data.names.get(spell.patient_id)?.name ?? "Someone";
  const absence = mode === "absence";
  const text = absence
    ? absenceNote(spell, patientName, profile?.display_name ?? null)
    : doctorSummary({
        spell,
        patientName,
        allergies: data.allergies.get(spell.patient_id) ?? [],
        log: detail.log,
        doses: detail.doses,
        unit: settings.tempUnit,
        names: (pid) => personName(data, pid, userId).replace(/^You$/, "me"),
      });

  async function copy() {
    await Clipboard.setStringAsync(text);
    tap("success");
    Alert.alert("Copied", absence ? "Paste it into an email or the school's app." : "Paste it into a message or the doctor's portal.");
  }

  return (
    <NookScroll>
      <Stack.Screen options={{ title: absence ? `Note for ${missedWord(spell.missed_from)}` : "For the doctor" }} />
      <Text style={ui.muted}>
        {absence
          ? "Ready to send. Change anything you like after pasting it."
          : "What the doctor will ask, in order. Read it out on the phone, or send it."}
      </Text>
      <View style={ui.card}>
        <Text selectable style={{ fontSize: 16, lineHeight: 23 }}>
          {text}
        </Text>
      </View>
      <Button title="Share" icon="share" onPress={() => Share.share({ message: text })} />
      <Button title="Copy" icon="copy" variant="secondary" onPress={copy} />
    </NookScroll>
  );
}
