import { Stack, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, View } from "react-native";

import { DateField } from "../../components/date-field";
import { Icon } from "../../components/icon";
import { LoadingScreen, Tap } from "../../components/motion";
import { NookScroll } from "../../components/nook-scroll";
import { Text, TextInput } from "../../components/text";
import { Button, SectionHeader } from "../../components/ui";
import { useAuth } from "../../lib/auth-context";
import { friendlyError, tap } from "../../lib/feedback";
import { timeOfDayToDate, toTimeOfDay } from "../../lib/pets";
import { cleanContacts, cleanRoutine, sections, type RoutineStep, type SectionKey, type SitterContact } from "../../lib/sitter";
import { saveSheet, useSitter } from "../../lib/sitter-data";
import { colors, ui } from "../../lib/theme";

type LongKey = "bedtime" | "food" | "rules" | "places" | "codes" | "notes";

const longText: Record<LongKey, { max: number; placeholder: string; lines?: number }> = {
  bedtime: { max: 600, placeholder: "8pm: bath, two stories, nightlight on. Lily sleeps with Bun-Bun." },
  food: { max: 600, placeholder: "Pasta in the fridge. One snack after school. No juice after 6." },
  rules: { max: 1000, placeholder: "One hour of screens. Stay in the yard. No friends over." },
  places: { max: 1000, placeholder: "First-aid kit: under the bathroom sink. Breaker box: garage, left wall. Flashlight: kitchen drawer." },
  codes: { max: 300, placeholder: "Front door: 4321. Alarm: 1234, then OFF.", lines: 2 },
  notes: { max: 1000, placeholder: "Anything that doesn't fit above." },
};

// Each section's form, in the same order the sitter sees them.
const order: SectionKey[] = ["contacts", "address", "doctor", "routine", "bedtime", "food", "rules", "wifi", "places", "codes", "notes"];

// The parts of the sheet you type (SIT-004, SIT-010, SIT-013). Shared by the whole Home.
export default function SitterSheetForm() {
  const router = useRouter();
  const { session } = useAuth();
  const { data } = useSitter(session?.user.id);

  const [ready, setReady] = useState(false);
  const [contacts, setContacts] = useState<SitterContact[]>([]);
  const [routine, setRoutine] = useState<RoutineStep[]>([]);
  const [address, setAddress] = useState("");
  const [doctorName, setDoctorName] = useState("");
  const [doctorPhone, setDoctorPhone] = useState("");
  const [wifiName, setWifiName] = useState("");
  const [wifiPassword, setWifiPassword] = useState("");
  const [text, setText] = useState<Record<LongKey, string>>({ bedtime: "", food: "", rules: "", places: "", codes: "", notes: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (ready || !data) return;
    const s = data.sheet;
    setContacts(s?.contacts.length ? s.contacts : [{ name: "", phone: "" }]);
    setRoutine(s?.routine ?? []);
    setAddress(s?.address ?? "");
    setDoctorName(s?.doctor_name ?? "");
    setDoctorPhone(s?.doctor_phone ?? "");
    setWifiName(s?.wifi_name ?? "");
    setWifiPassword(s?.wifi_password ?? "");
    setText({
      bedtime: s?.bedtime ?? "",
      food: s?.food ?? "",
      rules: s?.rules ?? "",
      places: s?.places ?? "",
      codes: s?.codes ?? "",
      notes: s?.notes ?? "",
    });
    setReady(true);
  }, [data, ready]);

  if (!data || !ready) return <LoadingScreen cards={3} />;

  const half = contacts.filter((c) => Boolean(c.name.trim()) !== Boolean(c.phone.trim()));

  async function save() {
    if (half.length) return Alert.alert("A number is missing something", "Each emergency number needs a name and a phone number.");
    setSaving(true);
    const blank = (v: string) => v.trim() || null;
    const { error } = await saveSheet(
      data!.homeId,
      {
        contacts: cleanContacts(contacts),
        address: blank(address),
        doctor_name: blank(doctorName),
        doctor_phone: blank(doctorPhone),
        routine: cleanRoutine(routine),
        bedtime: blank(text.bedtime),
        food: blank(text.food),
        rules: blank(text.rules),
        wifi_name: blank(wifiName),
        wifi_password: blank(wifiPassword),
        places: blank(text.places),
        codes: blank(text.codes),
        notes: blank(text.notes),
      },
      Boolean(data!.sheet)
    );
    if (error) {
      setSaving(false);
      return Alert.alert("Couldn't save", friendlyError(error));
    }
    tap("success");
    router.back();
  }

  function setContact(index: number, field: keyof SitterContact, value: string) {
    setContacts((all) => all.map((c, i) => (i === index ? { ...c, [field]: value } : c)));
  }

  function setStep(index: number, step: Partial<RoutineStep>) {
    setRoutine((all) => all.map((s, i) => (i === index ? { ...s, ...step } : s)));
  }

  function addStep() {
    // Start an hour after the last step, so the list stays in order.
    const last = routine[routine.length - 1]?.time;
    const hour = last ? Math.min(23, Number(last.slice(0, 2)) + 1) : 15;
    setRoutine((all) => [...all, { time: `${String(hour).padStart(2, "0")}:00`, what: "" }]);
  }

  const info = (key: SectionKey) => sections.find((s) => s.key === key)!;
  const header = (key: SectionKey) => (
    <>
      <SectionHeader title={info(key).label} icon={info(key).icon} />
      <Text style={ui.muted}>{info(key).hint}</Text>
    </>
  );
  const input = (value: string, set: (v: string) => void, placeholder: string, max: number, phone = false) => (
    <TextInput
      style={ui.input}
      value={value}
      onChangeText={set}
      placeholder={placeholder}
      placeholderTextColor={colors.muted}
      keyboardType={phone ? "phone-pad" : "default"}
      maxLength={max}
    />
  );

  function part(key: SectionKey) {
    switch (key) {
      case "contacts":
        return (
          <>
            {header(key)}
            {contacts.map((c, i) => (
              <View key={i} style={[ui.card, { gap: 8 }]}>
                <View style={[ui.row, { gap: 8 }]}>
                  <View style={{ flex: 1 }}>{input(c.name, (v) => setContact(i, "name", v), "Name", 60)}</View>
                  <Tap onPress={() => setContacts((all) => all.filter((_, j) => j !== i))} hitSlop={8} accessibilityLabel="Remove this number">
                    <Icon name="close" size={18} color={colors.muted} />
                  </Tap>
                </View>
                {input(c.phone, (v) => setContact(i, "phone", v), "Phone", 30, true)}
                {input(c.note ?? "", (v) => setContact(i, "note", v), "Who they are, e.g. Mom, next-door neighbor", 60)}
              </View>
            ))}
            {contacts.length < 12 ? (
              <Button title="Add a number" icon="add" variant="secondary" onPress={() => setContacts((all) => [...all, { name: "", phone: "" }])} />
            ) : null}
          </>
        );
      case "address":
        return (
          <>
            {header(key)}
            {input(address, setAddress, "12 Oak Lane, Springfield", 200)}
          </>
        );
      case "doctor":
        return (
          <>
            {header(key)}
            {input(doctorName, setDoctorName, "Dr. Patel, Springfield Pediatrics", 80)}
            {input(doctorPhone, setDoctorPhone, "Phone", 30, true)}
          </>
        );
      case "routine":
        return (
          <>
            {header(key)}
            {routine.map((step, i) => (
              <View key={i} style={[ui.card, ui.row, { gap: 10, paddingVertical: 10 }]}>
                <View style={{ width: 110 }}>
                  <DateField mode="time" value={timeOfDayToDate(step.time)} onChange={(d) => setStep(i, { time: toTimeOfDay(d).slice(0, 5) })} />
                </View>
                <TextInput
                  style={[ui.input, { flex: 1 }]}
                  value={step.what}
                  onChangeText={(what) => setStep(i, { what })}
                  placeholder="School pickup"
                  placeholderTextColor={colors.muted}
                  maxLength={80}
                />
                <Tap onPress={() => setRoutine((all) => all.filter((_, j) => j !== i))} hitSlop={8} accessibilityLabel="Remove this step">
                  <Icon name="close" size={18} color={colors.muted} />
                </Tap>
              </View>
            ))}
            {routine.length < 20 ? <Button title="Add a step" icon="add" variant="secondary" onPress={addStep} /> : null}
            {routine.length ? <Text style={ui.muted}>Steps are put in time order when you save. The sitter's page shows what's on now and what's next.</Text> : null}
          </>
        );
      case "wifi":
        return (
          <>
            {header(key)}
            {input(wifiName, setWifiName, "Network name", 60)}
            {input(wifiPassword, setWifiPassword, "Password", 100)}
          </>
        );
      default: {
        const k = key as LongKey;
        return (
          <>
            {header(key)}
            <TextInput
              style={[ui.input, { minHeight: (longText[k].lines ?? 4) * 22, textAlignVertical: "top" }]}
              value={text[k]}
              onChangeText={(v) => setText((t) => ({ ...t, [k]: v }))}
              placeholder={longText[k].placeholder}
              placeholderTextColor={colors.muted}
              multiline
              maxLength={longText[k].max}
            />
          </>
        );
      }
    }
  }

  return (
    <NookScroll>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Tap onPress={save} disabled={saving} hitSlop={10}>
              <Text style={{ color: colors.bark, fontSize: 17, fontWeight: "700" }}>Save</Text>
            </Tap>
          ),
        }}
      />

      <Text style={ui.muted}>Everyone in your Home can change this. Fill in what's useful and skip the rest. Each link you make can leave parts out.</Text>

      {order.map((key) => (
        <View key={key} style={{ gap: 8 }}>
          {part(key)}
        </View>
      ))}

      <Button title="Save" icon="check" onPress={save} loading={saving} style={{ marginTop: 8 }} />
    </NookScroll>
  );
}
