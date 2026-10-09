import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert } from "react-native";

import { DateField } from "../../components/date-field";
import { OptionalTime } from "../../components/getaway-bits";
import { useLeaveGuard } from "../../components/leave-guard";
import { LoadingScreen, Tap } from "../../components/motion";
import { NookScroll } from "../../components/nook-scroll";
import { Text, TextInput } from "../../components/text";
import { Button } from "../../components/ui";
import { useAuth } from "../../lib/auth-context";
import { friendlyError, tap } from "../../lib/feedback";
import { useGetaway } from "../../lib/getaways-data";
import { parseDateString, toDateString } from "../../lib/profile";
import { supabase } from "../../lib/supabase";
import { colors, ui } from "../../lib/theme";

// Add or change a plan on the day-by-day (TRIP-005): what, which day, an
// optional time, where.
export default function PlanForm() {
  const router = useRouter();
  const { getawayId, id, day } = useLocalSearchParams<{ getawayId: string; id?: string; day?: string }>();
  const { session } = useAuth();
  const { data } = useGetaway(getawayId, session?.user.id);
  const existing = data?.plans.find((p) => p.id === id);

  const [ready, setReady] = useState(false);
  const [title, setTitle] = useState("");
  const [onDay, setOnDay] = useState("");
  const [atTime, setAtTime] = useState<string | null>(null);
  const [place, setPlace] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const { allowLeave } = useLeaveGuard({ title, onDay, atTime, place, notes }, ready);

  useEffect(() => {
    if (ready || !data) return;
    if (id && !existing) return;
    if (existing) {
      setTitle(existing.title);
      setOnDay(existing.on_day);
      setAtTime(existing.at_time?.slice(0, 5) ?? null);
      setPlace(existing.place ?? "");
      setNotes(existing.notes ?? "");
    } else {
      setOnDay(day ?? data.trip.starts_on);
    }
    setReady(true);
  }, [data, existing, id, day, ready]);

  if (!data || !ready) return <LoadingScreen cards={2} />;

  async function save() {
    if (!title.trim()) return Alert.alert("What's the plan?", "Like “Dinner at the crab shack” or “Aquarium”.");
    setSaving(true);
    const row = { title: title.trim(), on_day: onDay, at_time: atTime, place: place.trim() || null, notes: notes.trim() || null };
    const { error } = existing
      ? await supabase.from("getaway_plans").update(row).eq("id", existing.id)
      : await supabase.from("getaway_plans").insert({ ...row, getaway_id: data!.trip.id });
    if (error) {
      setSaving(false);
      return Alert.alert("Couldn't save", friendlyError(error));
    }
    tap("success");
    allowLeave();
    router.back();
  }

  function confirmDelete() {
    Alert.alert(`Remove “${existing!.title}”?`, "For everyone going.", [
      { text: "Keep", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase.from("getaway_plans").delete().eq("id", existing!.id);
          if (error) return Alert.alert("Couldn't remove it", friendlyError(error));
          allowLeave();
          router.back();
        },
      },
    ]);
  }

  return (
    <NookScroll>
      <Stack.Screen
        options={{
          title: existing ? "Change plan" : "New plan",
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
        placeholder="What's the plan? e.g. Aquarium"
        placeholderTextColor={colors.muted}
        maxLength={80}
      />
      <Text style={ui.label}>Day</Text>
      <DateField mode="date" value={parseDateString(onDay)} onChange={(d) => setOnDay(toDateString(d))} />
      <OptionalTime value={atTime} onChange={setAtTime} />
      <TextInput
        style={ui.input}
        value={place}
        onChangeText={setPlace}
        placeholder="Where (optional)"
        placeholderTextColor={colors.muted}
        maxLength={200}
      />
      <TextInput
        style={[ui.input, { minHeight: 70, textAlignVertical: "top" }]}
        value={notes}
        onChangeText={setNotes}
        placeholder="Notes: tickets, what to bring…"
        placeholderTextColor={colors.muted}
        multiline
        maxLength={300}
      />
      <Button title="Save" icon="check" onPress={save} loading={saving} style={{ marginTop: 8 }} />
      {existing ? <Button title="Remove" icon="trash" variant="danger" onPress={confirmDelete} /> : null}
    </NookScroll>
  );
}
