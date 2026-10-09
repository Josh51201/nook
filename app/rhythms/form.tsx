import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useLeaveGuard } from "../../components/leave-guard";
import { useEffect, useState } from "react";
import { Alert, View } from "react-native";

import { DateField } from "../../components/date-field";
import { LoadingScreen, Tap } from "../../components/motion";
import { NookScroll } from "../../components/nook-scroll";
import { Text, TextInput } from "../../components/text";
import { Button, Chip } from "../../components/ui";
import { useAuth } from "../../lib/auth-context";
import { friendlyError, tap } from "../../lib/feedback";
import { phoneTimeZone } from "../../lib/pets";
import { parseDateString, toDateString } from "../../lib/profile";
import { areas, repeatChoices, type Area } from "../../lib/rhythms";
import { useRhythms } from "../../lib/rhythms-data";
import { supabase } from "../../lib/supabase";
import { colors, ui } from "../../lib/theme";

// Add or change a rhythm (RHY-004, RHY-005): what it is, when it's next due,
// how often it comes round, and whose it is.
export default function RhythmForm() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { session } = useAuth();
  const userId = session?.user.id;
  const { data } = useRhythms(userId);
  const existing = data?.rhythms.find((r) => r.id === id);

  const [ready, setReady] = useState(false);
  const [title, setTitle] = useState("");
  const [area, setArea] = useState<Area>("indoors");
  const [dueOn, setDueOn] = useState<string | null>(null);
  const [repeat, setRepeat] = useState<number | null>(12);
  const [owner, setOwner] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  // Leaving with unsaved changes asks first (CORE-075).
  const { allowLeave } = useLeaveGuard({ title, area, dueOn, repeat, owner, notes }, ready);

  useEffect(() => {
    if (ready || !data) return;
    if (id && !existing) return;
    if (existing) {
      setTitle(existing.title);
      setArea(existing.area as Area);
      setDueOn(existing.due_on);
      setRepeat(existing.repeat_months);
      setOwner(existing.owner);
      setNotes(existing.notes ?? "");
    } else {
      setDueOn(toDateString(new Date()));
    }
    setReady(true);
  }, [data, existing, id, ready]);

  if (!data || !ready) return <LoadingScreen cards={2} />;

  async function save() {
    if (!title.trim()) return Alert.alert("What needs doing?", "Like “Change the furnace filter”.");
    setSaving(true);
    const row = { title: title.trim(), area, due_on: dueOn, repeat_months: repeat, owner, notes: notes.trim() || null, tz: phoneTimeZone() };
    const { error } = existing
      ? await supabase.from("rhythms").update(row).eq("id", existing.id)
      : await supabase.from("rhythms").insert({ ...row, home_id: data!.homeId });
    if (error) {
      setSaving(false);
      return Alert.alert("Couldn't save", friendlyError(error));
    }
    tap("success");
    allowLeave();
    router.back();
  }

  function confirmDelete() {
    Alert.alert(`Remove “${existing!.title}”?`, "Its history goes too, for everyone in your Home.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase.from("rhythms").delete().eq("id", existing!.id);
          if (error) return Alert.alert("Couldn't remove it", friendlyError(error));
          allowLeave();
          router.dismissTo("/rhythms");
        },
      },
    ]);
  }

  return (
    <NookScroll>
      <Stack.Screen
        options={{
          title: existing ? "Change rhythm" : "New rhythm",
          headerRight: () => (
            <Tap onPress={save} disabled={saving} hitSlop={10}>
              <Text style={{ color: colors.bark, fontSize: 17, fontWeight: "700" }}>Save</Text>
            </Tap>
          ),
        }}
      />

      <TextInput
        style={ui.input}
        value={title}
        onChangeText={setTitle}
        placeholder="What needs doing? e.g. Clean the gutters"
        placeholderTextColor={colors.muted}
        maxLength={80}
      />

      <Text style={ui.label}>Kind</Text>
      <View style={ui.chips}>
        {areas.map((a) => (
          <Chip key={a.key} icon={a.icon} selected={area === a.key} onPress={() => setArea(a.key)}>
            {a.label}
          </Chip>
        ))}
      </View>

      <Text style={ui.label}>Next due</Text>
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
          <Chip key={c.label} selected={repeat === c.months} onPress={() => setRepeat(c.months)}>
            {c.label}
          </Chip>
        ))}
      </View>
      <Text style={ui.muted}>When it's marked done, the next date is set from that day.</Text>

      {data.members.length > 1 ? (
        <>
          <Text style={ui.label}>Whose is it?</Text>
          <View style={ui.chips}>
            <Chip icon="group" selected={owner === null} onPress={() => setOwner(null)}>
              Anyone
            </Chip>
            {data.members.map((m) => (
              <Chip key={m.id} icon="person" selected={owner === m.id} onPress={() => setOwner(m.id)}>
                {m.id === userId ? "Me" : m.name}
              </Chip>
            ))}
          </View>
          <Text style={ui.muted}>
            Reminders go to whoever it belongs to, or to everyone if it's anyone's. Anyone can still mark it done.
          </Text>
        </>
      ) : null}

      <TextInput
        style={[ui.input, { minHeight: 80, textAlignVertical: "top" }]}
        value={notes}
        onChangeText={setNotes}
        placeholder="Notes: filter size, who to call, where the key is…"
        placeholderTextColor={colors.muted}
        multiline
        maxLength={300}
      />

      <Button title="Save" icon="check" onPress={save} loading={saving} style={{ marginTop: 8 }} />
      {existing ? <Button title="Remove" icon="trash" variant="danger" onPress={confirmDelete} /> : null}
    </NookScroll>
  );
}
