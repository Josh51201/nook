import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, View } from "react-native";

import { DateField } from "../../components/date-field";
import { useLeaveGuard } from "../../components/leave-guard";
import { LoadingScreen, Tap } from "../../components/motion";
import { NookScroll } from "../../components/nook-scroll";
import { Text, TextInput } from "../../components/text";
import { Button, Chip, EmptyState } from "../../components/ui";
import { useAuth } from "../../lib/auth-context";
import { friendlyError, tap } from "../../lib/feedback";
import { localDay, phoneTimeZone } from "../../lib/pets";
import { parseDateString, toDateString } from "../../lib/profile";
import { illnessPicks, missedChoices, type MissedFrom } from "../../lib/sickday";
import { useSickDay } from "../../lib/sickday-data";
import { supabase } from "../../lib/supabase";
import { colors, ui } from "../../lib/theme";

// Someone's sick (SICK-001), or change a sick spell: who, what it is, when it
// started, what they're missing, and notes.
export default function StartSpell() {
  const router = useRouter();
  const { id, patient: patientParam } = useLocalSearchParams<{ id?: string; patient?: string }>();
  const { session } = useAuth();
  const userId = session?.user.id;
  const { data } = useSickDay(userId);
  const existing = data?.spells.find((s) => s.id === id);

  const [ready, setReady] = useState(false);
  const [patient, setPatient] = useState<string | null>(patientParam ?? null);
  const [title, setTitle] = useState("");
  const [startedOn, setStartedOn] = useState(localDay());
  const [missedFrom, setMissedFrom] = useState<MissedFrom | null>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const { allowLeave } = useLeaveGuard({ patient, title, startedOn, missedFrom, notes }, ready);

  useEffect(() => {
    if (ready || !data) return;
    if (id && !existing) return;
    if (existing) {
      setPatient(existing.patient_id);
      setTitle(existing.title ?? "");
      setStartedOn(existing.started_on);
      setMissedFrom(existing.missed_from);
      setNotes(existing.notes ?? "");
    }
    setReady(true);
  }, [data, existing, id, ready]);

  if (!data || !ready) return <LoadingScreen cards={2} />;

  const sickNow = new Set(data.spells.filter((s) => !s.ended_on && s.home_id === data.homeId).map((s) => s.patient_id));
  const person = data.homePeople.find((p) => p.id === patient);

  function pickPerson(pid: string) {
    tap();
    setPatient(pid);
    // Kids miss school, grown-ups miss work.
    if (!existing && !missedFrom) {
      const p = data!.homePeople.find((x) => x.id === pid);
      setMissedFrom(p?.isKid ? "school" : null);
    }
  }

  async function save() {
    if (!patient) return Alert.alert("Who's sick?", "Pick someone from your Home.");
    if (startedOn > localDay()) return Alert.alert("Not yet", "It can't start in the future.");
    setSaving(true);
    const row = {
      title: title.trim() || null,
      started_on: startedOn,
      missed_from: missedFrom,
      notes: notes.trim() || null,
      tz: phoneTimeZone(),
    };
    if (existing) {
      const { error } = await supabase
        .from("sick_spells")
        .update({ ...row, missed_days: existing.missed_days.filter((d) => d >= startedOn) })
        .eq("id", existing.id);
      if (error) {
        setSaving(false);
        return Alert.alert("Couldn't save", friendlyError(error));
      }
      tap("success");
      allowLeave();
      return router.back();
    }
    const { data: made, error } = await supabase
      .from("sick_spells")
      .insert({ ...row, home_id: data!.homeId, patient_id: patient })
      .select("id")
      .single();
    if (error) {
      setSaving(false);
      const already = /duplicate key|sick_spells_one_open/i.test(error.message);
      return Alert.alert(
        already ? `${person?.name.split(" ")[0] ?? "They"} is already sick` : "Couldn't save",
        already ? "Open them from the Sick Day page, or mark them better first." : friendlyError(error)
      );
    }
    tap("success");
    allowLeave();
    router.replace(`/sickday/${made.id}`);
  }

  function confirmDelete() {
    Alert.alert("Delete this sick spell?", "Every temperature, symptom and dose logged in it goes too. Marking them better keeps it in Past sick days instead.", [
      { text: "Keep it", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase.from("sick_spells").delete().eq("id", existing!.id);
          if (error) return Alert.alert("Couldn't delete it", friendlyError(error));
          allowLeave();
          router.dismissTo("/sickday");
        },
      },
    ]);
  }

  return (
    <NookScroll>
      <Stack.Screen
        options={{
          title: existing ? "Change" : "Someone's sick",
          headerRight: () => (
            <Tap onPress={save} disabled={saving} hitSlop={10}>
              <Text style={{ color: colors.bark, fontSize: 17, fontWeight: "700" }}>Save</Text>
            </Tap>
          ),
        }}
      />

      {!existing ? (
        <>
          <Text style={ui.label}>Who's sick?</Text>
          {data.homePeople.length ? (
            <View style={ui.chips}>
              {data.homePeople.map((p) => (
                <Chip key={p.id} icon={p.isKid ? "kid" : "person"} selected={patient === p.id} onPress={() => pickPerson(p.id)}>
                  {p.id === userId ? "Me" : p.name.split(" ")[0]}
                  {sickNow.has(p.id) ? " (sick)" : ""}
                </Chip>
              ))}
            </View>
          ) : (
            <EmptyState icon="kid" title="Nobody here yet" />
          )}
          <Text style={ui.muted}>
            Your Home and the kids you look after. A kid shows here once they have a profile: in the Gift Nook, tap “Make a Wishbook for a kid”.
          </Text>
        </>
      ) : (
        <Text style={ui.cardTitle}>{person?.name ?? "Someone"}</Text>
      )}

      <Text style={ui.label}>What is it? (if you know)</Text>
      <TextInput
        style={ui.input}
        value={title}
        onChangeText={setTitle}
        placeholder="e.g. Flu, Strep throat"
        placeholderTextColor={colors.muted}
        maxLength={60}
      />
      <View style={ui.chips}>
        {illnessPicks.map((pick) => (
          <Chip key={pick} selected={title === pick} onPress={() => setTitle(title === pick ? "" : pick)}>
            {pick}
          </Chip>
        ))}
      </View>

      <Text style={ui.label}>It started</Text>
      <DateField mode="date" value={parseDateString(startedOn)} onChange={(d) => setStartedOn(toDateString(d))} maximumDate={new Date()} />

      <Text style={ui.label}>Missing</Text>
      <View style={ui.chips}>
        <Chip selected={!missedFrom} onPress={() => setMissedFrom(null)}>
          Nothing
        </Chip>
        {missedChoices.map((m) => (
          <Chip key={m.key} icon={m.icon} selected={missedFrom === m.key} onPress={() => setMissedFrom(m.key)}>
            {m.label}
          </Chip>
        ))}
      </View>
      <Text style={ui.muted}>You'll tick which days on their page, and can make a note for {missedFrom === "work" ? "work" : "school"} from them.</Text>

      <Text style={ui.label}>Notes</Text>
      <TextInput
        style={[ui.input, { minHeight: 80, textAlignVertical: "top" }]}
        value={notes}
        onChangeText={setNotes}
        placeholder="Anything to remember, e.g. what the doctor said"
        placeholderTextColor={colors.muted}
        maxLength={600}
        multiline
      />

      <Button title={existing ? "Save" : "Start"} icon="check" onPress={save} loading={saving} />
      {existing ? <Button title="Delete this sick spell" icon="trash" variant="danger" onPress={confirmDelete} /> : null}
    </NookScroll>
  );
}
