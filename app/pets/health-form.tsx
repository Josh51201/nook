import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, View } from "react-native";

import { DateField } from "../../components/date-field";
import { LoadingScreen, Tap } from "../../components/motion";
import { NookScroll } from "../../components/nook-scroll";
import { Text, TextInput } from "../../components/text";
import { Button, Chip } from "../../components/ui";
import { useAuth } from "../../lib/auth-context";
import { friendlyError, tap } from "../../lib/feedback";
import { healthKinds, repeatChoices, type HealthKind } from "../../lib/pets";
import { usePets } from "../../lib/pets-data";
import { parseDateString, toDateString } from "../../lib/profile";
import { supabase } from "../../lib/supabase";
import { colors, ui } from "../../lib/theme";

// A vet visit, vaccine or medication for a pet (PET-004): what it is, when
// it's due, and how often it comes round. Marked done from the pet's page.
export default function HealthForm() {
  const router = useRouter();
  const { petId, id } = useLocalSearchParams<{ petId: string; id?: string }>();
  const { session } = useAuth();
  const { data } = usePets(session?.user.id);
  const pet = data?.pets.find((p) => p.id === petId);
  const existing = pet?.pet_health.find((h) => h.id === id);

  const [ready, setReady] = useState(false);
  const [kind, setKind] = useState<HealthKind>("vet");
  const [title, setTitle] = useState("");
  const [dueOn, setDueOn] = useState<string | null>(null);
  const [repeat, setRepeat] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (ready || !data) return;
    if (id && !existing) return;
    if (existing) {
      setKind(existing.kind as HealthKind);
      setTitle(existing.title);
      setDueOn(existing.due_on);
      setRepeat(existing.repeat_days);
      setNotes(existing.notes ?? "");
    } else {
      setDueOn(toDateString(new Date()));
    }
    setReady(true);
  }, [data, existing, id, ready]);

  if (!data || !ready) return <LoadingScreen cards={2} />;

  const suggestions: Record<HealthKind, string[]> = {
    vet: ["Annual checkup", "Dental cleaning", "Follow-up"],
    vaccine: ["Rabies", "Distemper / parvo", "Bordetella"],
    medication: ["Heartworm prevention", "Flea & tick", "Daily pill"],
    other: ["Grooming", "Nail trim"],
  };

  async function save() {
    if (!title.trim()) return Alert.alert("What is it?", "Like “Rabies booster”.");
    setSaving(true);
    const row = { kind, title: title.trim(), due_on: dueOn, repeat_days: repeat, notes: notes.trim() || null };
    const { error } = existing
      ? await supabase.from("pet_health").update(row).eq("id", existing.id)
      : await supabase.from("pet_health").insert({ ...row, pet_id: petId });
    if (error) {
      setSaving(false);
      return Alert.alert("Couldn't save", friendlyError(error));
    }
    tap("success");
    router.back();
  }

  function confirmDelete() {
    Alert.alert("Remove this?", undefined, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase.from("pet_health").delete().eq("id", existing!.id);
          if (error) return Alert.alert("Couldn't remove it", friendlyError(error));
          router.back();
        },
      },
    ]);
  }

  return (
    <NookScroll>
      <Stack.Screen
        options={{
          title: existing ? "Change" : `For ${pet?.name ?? "your pet"}`,
          headerRight: () => (
            <Tap onPress={save} disabled={saving} hitSlop={10}>
              <Text style={{ color: colors.bark, fontSize: 17, fontWeight: "700" }}>Save</Text>
            </Tap>
          ),
        }}
      />

      <View style={ui.chips}>
        {healthKinds.map((k) => (
          <Chip key={k.key} icon={k.icon} selected={kind === k.key} onPress={() => setKind(k.key)}>
            {k.label}
          </Chip>
        ))}
      </View>

      <TextInput
        style={ui.input}
        value={title}
        onChangeText={setTitle}
        placeholder="What is it? e.g. Rabies booster"
        placeholderTextColor={colors.muted}
      />
      {!title ? (
        <View style={ui.chips}>
          {suggestions[kind].map((s) => (
            <Chip key={s} onPress={() => setTitle(s)}>
              {s}
            </Chip>
          ))}
        </View>
      ) : null}

      <Text style={ui.label}>Due</Text>
      {dueOn ? (
        <View style={[ui.row, { gap: 10 }]}>
          <View style={{ flex: 1 }}>
            <DateField mode="date" value={parseDateString(dueOn)} onChange={(d) => setDueOn(toDateString(d))} />
          </View>
          <Tap onPress={() => setDueOn(null)} hitSlop={8}>
            <Text style={ui.error}>No date</Text>
          </Tap>
        </View>
      ) : (
        <Button title="Set a due date" variant="secondary" icon="calendar" onPress={() => setDueOn(toDateString(new Date()))} />
      )}

      <Text style={ui.label}>Comes round</Text>
      <View style={ui.chips}>
        {repeatChoices.map((c) => (
          <Chip key={c.label} selected={repeat === c.days} onPress={() => setRepeat(c.days)}>
            {c.label}
          </Chip>
        ))}
      </View>
      <Text style={ui.muted}>
        When you mark it done, the next date is set for you. You get a heads-up a week before things that come round monthly or less often.
      </Text>

      <TextInput
        style={[ui.input, { minHeight: 80, textAlignVertical: "top" }]}
        value={notes}
        onChangeText={setNotes}
        placeholder="Notes: dose, which vet, anything to remember…"
        placeholderTextColor={colors.muted}
        multiline
      />

      <Button title="Save" icon="check" onPress={save} loading={saving} style={{ marginTop: 8 }} />
      {existing ? <Button title="Remove" icon="trash" variant="danger" onPress={confirmDelete} /> : null}
    </NookScroll>
  );
}
