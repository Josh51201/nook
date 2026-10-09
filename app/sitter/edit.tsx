import { Stack, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, View } from "react-native";

import { Icon } from "../../components/icon";
import { LoadingScreen, Tap } from "../../components/motion";
import { NookScroll } from "../../components/nook-scroll";
import { Text, TextInput } from "../../components/text";
import { Button, SectionHeader } from "../../components/ui";
import { useAuth } from "../../lib/auth-context";
import { friendlyError, tap } from "../../lib/feedback";
import { cleanContacts, sections, type SectionKey, type SitterContact } from "../../lib/sitter";
import { saveSheet, useSitter } from "../../lib/sitter-data";
import { colors, ui } from "../../lib/theme";

const longText: Record<Exclude<SectionKey, "contacts" | "doctor" | "address">, { max: number; placeholder: string }> = {
  bedtime: { max: 600, placeholder: "8pm: bath, two stories, nightlight on. Lily sleeps with Bun-Bun." },
  food: { max: 600, placeholder: "Pasta in the fridge. One snack after school. No juice after 6." },
  rules: { max: 1000, placeholder: "One hour of screens. Stay in the yard. No friends over." },
  notes: { max: 1000, placeholder: "Wi-Fi: … First-aid kit under the bathroom sink. Spare key with the Garcias." },
};

// The parts of the sheet you type (SIT-004). Shared by the whole Home.
export default function SitterSheetForm() {
  const router = useRouter();
  const { session } = useAuth();
  const { data } = useSitter(session?.user.id);

  const [ready, setReady] = useState(false);
  const [contacts, setContacts] = useState<SitterContact[]>([]);
  const [address, setAddress] = useState("");
  const [doctorName, setDoctorName] = useState("");
  const [doctorPhone, setDoctorPhone] = useState("");
  const [text, setText] = useState<Record<keyof typeof longText, string>>({ bedtime: "", food: "", rules: "", notes: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (ready || !data) return;
    const s = data.sheet;
    setContacts(s?.contacts.length ? s.contacts : [{ name: "", phone: "" }]);
    setAddress(s?.address ?? "");
    setDoctorName(s?.doctor_name ?? "");
    setDoctorPhone(s?.doctor_phone ?? "");
    setText({ bedtime: s?.bedtime ?? "", food: s?.food ?? "", rules: s?.rules ?? "", notes: s?.notes ?? "" });
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
        bedtime: blank(text.bedtime),
        food: blank(text.food),
        rules: blank(text.rules),
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

  const info = (key: SectionKey) => sections.find((s) => s.key === key)!;
  const header = (key: SectionKey) => (
    <>
      <SectionHeader title={info(key).label} icon={info(key).icon} />
      <Text style={ui.muted}>{info(key).hint}</Text>
    </>
  );

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

      <Text style={ui.muted}>Everyone in your Home can change this. Each link you make can leave parts out.</Text>

      {header("contacts")}
      {contacts.map((c, i) => (
        <View key={i} style={[ui.card, { gap: 8 }]}>
          <View style={[ui.row, { gap: 8 }]}>
            <TextInput
              style={[ui.input, { flex: 1 }]}
              value={c.name}
              onChangeText={(v) => setContact(i, "name", v)}
              placeholder="Name"
              placeholderTextColor={colors.muted}
              maxLength={60}
            />
            <Tap onPress={() => setContacts((all) => all.filter((_, j) => j !== i))} hitSlop={8} accessibilityLabel="Remove this number">
              <Icon name="close" size={18} color={colors.muted} />
            </Tap>
          </View>
          <TextInput
            style={ui.input}
            value={c.phone}
            onChangeText={(v) => setContact(i, "phone", v)}
            placeholder="Phone"
            placeholderTextColor={colors.muted}
            keyboardType="phone-pad"
            maxLength={30}
          />
          <TextInput
            style={ui.input}
            value={c.note ?? ""}
            onChangeText={(v) => setContact(i, "note", v)}
            placeholder="Who they are, e.g. Mom, next-door neighbor"
            placeholderTextColor={colors.muted}
            maxLength={60}
          />
        </View>
      ))}
      {contacts.length < 12 ? (
        <Button title="Add a number" icon="add" variant="secondary" onPress={() => setContacts((all) => [...all, { name: "", phone: "" }])} />
      ) : null}

      {header("address")}
      <TextInput
        style={ui.input}
        value={address}
        onChangeText={setAddress}
        placeholder="12 Oak Lane, Springfield"
        placeholderTextColor={colors.muted}
        maxLength={200}
      />

      {header("doctor")}
      <TextInput
        style={ui.input}
        value={doctorName}
        onChangeText={setDoctorName}
        placeholder="Dr. Patel, Springfield Pediatrics"
        placeholderTextColor={colors.muted}
        maxLength={80}
      />
      <TextInput
        style={ui.input}
        value={doctorPhone}
        onChangeText={setDoctorPhone}
        placeholder="Phone"
        placeholderTextColor={colors.muted}
        keyboardType="phone-pad"
        maxLength={30}
      />

      {(Object.keys(longText) as (keyof typeof longText)[]).map((key) => (
        <View key={key} style={{ gap: 8 }}>
          {header(key)}
          <TextInput
            style={[ui.input, { minHeight: 90, textAlignVertical: "top" }]}
            value={text[key]}
            onChangeText={(v) => setText((t) => ({ ...t, [key]: v }))}
            placeholder={longText[key].placeholder}
            placeholderTextColor={colors.muted}
            multiline
            maxLength={longText[key].max}
          />
        </View>
      ))}

      <Button title="Save" icon="check" onPress={save} loading={saving} style={{ marginTop: 8 }} />
    </NookScroll>
  );
}
