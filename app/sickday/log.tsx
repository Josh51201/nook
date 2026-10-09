import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Alert, View } from "react-native";

import { DateField } from "../../components/date-field";
import { useLeaveGuard } from "../../components/leave-guard";
import { LoadingScreen, Tap } from "../../components/motion";
import { NookScroll } from "../../components/nook-scroll";
import { Text, TextInput } from "../../components/text";
import { Button, Chip, EmptyState } from "../../components/ui";
import { useAuth } from "../../lib/auth-context";
import { friendlyError, tap } from "../../lib/feedback";
import { sickdaySettingDefaults, useNookSettings } from "../../lib/nook-settings";
import {
  cleanSymptom,
  formatTemp,
  isFever,
  parseTemp,
  symptomPicks,
  tempWhereChoices,
  urgentSymptoms,
  type TempWhere,
} from "../../lib/sickday";
import { firstName, useSickDay } from "../../lib/sickday-data";
import { supabase } from "../../lib/supabase";
import { colors, ui } from "../../lib/theme";

type Mode = "temp" | "symptoms" | "note";

// Log a temperature, symptoms or a note (SICK-003). Opens on the part you
// tapped; anything else can be added in the same go.
export default function LogEntryScreen() {
  const router = useRouter();
  const { spell: spellId, mode: modeParam } = useLocalSearchParams<{ spell: string; mode?: Mode }>();
  const mode: Mode = modeParam === "symptoms" || modeParam === "note" ? modeParam : "temp";
  const { session } = useAuth();
  const { data } = useSickDay(session?.user.id);
  const { settings } = useNookSettings("sickday", sickdaySettingDefaults);
  const spell = data?.spells.find((s) => s.id === spellId);

  const [temp, setTemp] = useState("");
  const [where, setWhere] = useState<TempWhere | null>(null);
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [typed, setTyped] = useState("");
  const [note, setNote] = useState("");
  const [at, setAt] = useState(new Date());
  const [changeTime, setChangeTime] = useState(false);
  const [saving, setSaving] = useState(false);
  const { allowLeave } = useLeaveGuard({ temp, where, symptoms, typed, note });

  if (!data) return <LoadingScreen cards={2} />;
  if (!spell) return <EmptyState icon="sick" title="That isn't here" />;

  const unit = settings.tempUnit;
  const parsed = parseTemp(temp, unit);
  const name = firstName(data, spell.patient_id);

  function toggle(s: string) {
    tap();
    setSymptoms((list) => (list.includes(s) ? list.filter((x) => x !== s) : [...list, s]));
  }

  function addTyped() {
    const s = cleanSymptom(typed);
    if (s && !symptoms.includes(s)) setSymptoms((list) => [...list, s]);
    setTyped("");
  }

  async function save() {
    const extra = cleanSymptom(typed);
    const all = extra && !symptoms.includes(extra) ? [...symptoms, extra] : symptoms;
    if (temp.trim() && parsed == null) {
      return Alert.alert("Check the temperature", unit === "f" ? "Like 101.3 (°F)." : "Like 38.5 (°C).");
    }
    if (parsed == null && !all.length && !note.trim()) {
      return Alert.alert("Nothing to log", "Add a temperature, a symptom or a note.");
    }
    if (changeTime && at.getTime() > Date.now() + 5 * 60_000) return Alert.alert("Not yet", "That time hasn't come yet.");
    setSaving(true);
    const { error } = await supabase.from("sick_log").insert({
      spell_id: spell!.id,
      logged_at: (changeTime ? at : new Date()).toISOString(),
      temp_c: parsed,
      temp_where: parsed != null ? where : null,
      symptoms: all,
      note: note.trim() || null,
    });
    if (error) {
      setSaving(false);
      return Alert.alert("Couldn't save", friendlyError(error));
    }
    tap("success");
    allowLeave();
    router.back();
  }

  const tempBlock = (
    <>
      <Text style={ui.label}>Temperature (°{unit.toUpperCase()})</Text>
      <TextInput
        style={[ui.input, { fontSize: 28, fontWeight: "700" }]}
        value={temp}
        onChangeText={setTemp}
        placeholder={unit === "f" ? "101.3" : "38.5"}
        placeholderTextColor={colors.muted}
        keyboardType="decimal-pad"
        autoFocus={mode === "temp"}
        maxLength={6}
      />
      {parsed != null ? (
        <Text style={[ui.muted, isFever(parsed) && { color: colors.error, fontWeight: "700" }]}>
          {isFever(parsed) ? "That's a fever" : "No fever"} · {formatTemp(parsed, unit === "f" ? "c" : "f")}
        </Text>
      ) : null}
      <View style={ui.chips}>
        {tempWhereChoices.map((w) => (
          <Chip key={w.key} selected={where === w.key} onPress={() => setWhere(where === w.key ? null : w.key)}>
            {w.label}
          </Chip>
        ))}
      </View>
    </>
  );

  const symptomBlock = (
    <>
      <Text style={ui.label}>Symptoms</Text>
      <View style={ui.chips}>
        {[...symptomPicks, ...symptoms.filter((s) => !symptomPicks.includes(s))].map((s) => (
          <Chip key={s} selected={symptoms.includes(s)} icon={urgentSymptoms.has(s) ? "warning" : undefined} onPress={() => toggle(s)}>
            {s}
          </Chip>
        ))}
      </View>
      <TextInput
        style={ui.input}
        value={typed}
        onChangeText={setTyped}
        onSubmitEditing={addTyped}
        placeholder="Something else"
        placeholderTextColor={colors.muted}
        maxLength={40}
        returnKeyType="done"
      />
      {symptoms.some((s) => urgentSymptoms.has(s)) ? (
        <Text style={[ui.muted, { color: colors.error }]}>If {name} is having trouble breathing now, call the doctor or emergency services.</Text>
      ) : null}
    </>
  );

  const noteBlock = (
    <>
      <Text style={ui.label}>Note</Text>
      <TextInput
        style={[ui.input, { minHeight: 80, textAlignVertical: "top" }]}
        value={note}
        onChangeText={setNote}
        placeholder="e.g. Ate a little toast, slept 2 hours"
        placeholderTextColor={colors.muted}
        maxLength={300}
        multiline
        autoFocus={mode === "note"}
      />
    </>
  );

  const order = mode === "temp" ? [tempBlock, symptomBlock, noteBlock] : mode === "symptoms" ? [symptomBlock, tempBlock, noteBlock] : [noteBlock, tempBlock, symptomBlock];

  return (
    <NookScroll>
      <Stack.Screen
        options={{
          title: mode === "temp" ? `${name}'s temperature` : mode === "symptoms" ? `How's ${name}?` : `A note about ${name}`,
          headerRight: () => (
            <Tap onPress={save} disabled={saving} hitSlop={10}>
              <Text style={{ color: colors.bark, fontSize: 17, fontWeight: "700" }}>Save</Text>
            </Tap>
          ),
        }}
      />
      {order.map((block, i) => (
        <View key={i} style={{ gap: 10 }}>
          {block}
        </View>
      ))}

      <Text style={ui.label}>When</Text>
      {changeTime ? (
        <DateField mode="datetime" value={at} onChange={setAt} maximumDate={new Date()} />
      ) : (
        <View style={ui.chips}>
          <Chip selected onPress={() => {}}>
            Just now
          </Chip>
          <Chip icon="clock" onPress={() => setChangeTime(true)}>
            Earlier
          </Chip>
        </View>
      )}

      <Button title="Save" icon="check" onPress={save} loading={saving} />
    </NookScroll>
  );
}
