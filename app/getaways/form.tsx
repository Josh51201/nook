import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, View } from "react-native";

import { DateField } from "../../components/date-field";
import { PeopleChips } from "../../components/getaway-bits";
import { useLeaveGuard } from "../../components/leave-guard";
import { LoadingScreen, Tap } from "../../components/motion";
import { NookScroll } from "../../components/nook-scroll";
import { Text, TextInput } from "../../components/text";
import { Button, Chip } from "../../components/ui";
import { useAuth } from "../../lib/auth-context";
import { friendlyError, tap } from "../../lib/feedback";
import { addDays, kinds, type Kind } from "../../lib/getaways";
import { createGetaway, useCompanions, useGetaway } from "../../lib/getaways-data";
import { localDay, phoneTimeZone } from "../../lib/pets";
import { parseDateString, toDateString } from "../../lib/profile";
import { supabase } from "../../lib/supabase";
import { colors, ui } from "../../lib/theme";

// Plan a Getaway or change one (TRIP-001, TRIP-002): what it is, where,
// when, and (when it's new) who's going.
export default function GetawayForm() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { session } = useAuth();
  const userId = session?.user.id;
  const { data: existing, isLoading } = useGetaway(id, userId);
  const companions = useCompanions(id ? undefined : userId);

  const [ready, setReady] = useState(false);
  const [title, setTitle] = useState("");
  const [place, setPlace] = useState("");
  const [kind, setKind] = useState<Kind>("other");
  const [startsOn, setStartsOn] = useState(addDays(localDay(), 14));
  const [endsOn, setEndsOn] = useState(addDays(localDay(), 17));
  const [notes, setNotes] = useState("");
  const [people, setPeople] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const { allowLeave } = useLeaveGuard({ title, place, kind, startsOn, endsOn, notes, people }, ready);

  useEffect(() => {
    if (ready) return;
    if (id) {
      if (isLoading || !existing) return;
      const t = existing.trip;
      setTitle(t.title);
      setPlace(t.place ?? "");
      setKind(t.kind as Kind);
      setStartsOn(t.starts_on);
      setEndsOn(t.ends_on);
      setNotes(t.notes ?? "");
    } else {
      // The people you live with are usually coming; anyone can be unticked.
      if (!companions) return;
      setPeople(companions.filter((c) => c.where === "home").map((c) => c.id));
    }
    setReady(true);
  }, [ready, id, isLoading, existing, companions]);

  if (!ready) return <LoadingScreen cards={2} />;

  function pickStart(day: string) {
    // Keep the same length when the start moves.
    const length = Math.max(0, Math.round((parseDateString(endsOn).getTime() - parseDateString(startsOn).getTime()) / 864e5));
    setStartsOn(day);
    setEndsOn(addDays(day, length));
  }

  async function save() {
    if (!title.trim()) return Alert.alert("What's the Getaway?", "Like “Beach week” or “Thanksgiving at Grandma's”.");
    if (endsOn < startsOn) return Alert.alert("Check the dates", "It can't end before it starts.");
    setSaving(true);
    const fields = { title: title.trim(), place: place.trim() || null, kind, starts_on: startsOn, ends_on: endsOn, notes: notes.trim() || null };
    if (id) {
      const { error } = await supabase.from("getaways").update({ ...fields, tz: phoneTimeZone() }).eq("id", id);
      if (error) {
        setSaving(false);
        return Alert.alert("Couldn't save", friendlyError(error));
      }
      tap("success");
      allowLeave();
      return router.back();
    }
    const { id: newId, error } = await createGetaway({ ...fields, people });
    if (error || !newId) {
      setSaving(false);
      return Alert.alert("Couldn't save", error ? friendlyError(error) : "Try again.");
    }
    tap("success");
    allowLeave();
    router.replace(`/getaways/${newId}`);
  }

  function confirmDelete() {
    Alert.alert(`Remove “${existing!.trip.title}”?`, "Its lists, confirmations, plans and costs go too, for everyone going.", [
      { text: "Keep it", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase.from("getaways").delete().eq("id", id!);
          if (error) return Alert.alert("Couldn't remove it", friendlyError(error));
          allowLeave();
          router.dismissTo("/getaways");
        },
      },
    ]);
  }

  const toggle = (pid: string) => setPeople((list) => (list.includes(pid) ? list.filter((x) => x !== pid) : [...list, pid]));
  const groups = companions
    ? [
        { title: "People you live with", list: companions.filter((c) => c.where === "home") },
        { title: "Your kids", list: companions.filter((c) => c.where === "kid") },
        { title: "Family in your Burrows", list: companions.filter((c) => c.where === "burrow") },
      ].filter((g) => g.list.length)
    : [];

  return (
    <NookScroll>
      <Stack.Screen
        options={{
          title: id ? "Change Getaway" : "New Getaway",
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
        placeholder="What's the Getaway? e.g. Beach week"
        placeholderTextColor={colors.muted}
        maxLength={60}
      />
      <TextInput
        style={ui.input}
        value={place}
        onChangeText={setPlace}
        placeholder="Where? e.g. Gulf Shores"
        placeholderTextColor={colors.muted}
        maxLength={80}
      />

      <Text style={ui.label}>Kind</Text>
      <View style={ui.chips}>
        {kinds.map((k) => (
          <Chip key={k.key} icon={k.icon} selected={kind === k.key} onPress={() => setKind(k.key)}>
            {k.label}
          </Chip>
        ))}
      </View>

      <View style={[ui.row, { gap: 16, flexWrap: "wrap" }]}>
        <View style={{ gap: 6 }}>
          <Text style={ui.label}>Leaving</Text>
          <DateField mode="date" value={parseDateString(startsOn)} onChange={(d) => pickStart(toDateString(d))} />
        </View>
        <View style={{ gap: 6 }}>
          <Text style={ui.label}>Coming home</Text>
          <DateField mode="date" value={parseDateString(endsOn)} onChange={(d) => setEndsOn(toDateString(d))} />
        </View>
      </View>

      {id ? null : (
        <>
          <Text style={ui.label}>Who's going</Text>
          <Text style={ui.muted}>You're going. Everyone you pick can see the Getaway and add to it; nobody else can.</Text>
          {groups.length ? (
            groups.map((g) => (
              <View key={g.title} style={{ gap: 6 }}>
                <Text style={[ui.muted, { fontSize: 13, fontWeight: "600" }]}>{g.title}</Text>
                <PeopleChips people={g.list} selected={people} onToggle={toggle} />
              </View>
            ))
          ) : (
            <Text style={ui.muted}>Join a Burrow or share a Home to bring family along. You can add people later too.</Text>
          )}
        </>
      )}

      <TextInput
        style={[ui.input, { minHeight: 80, textAlignVertical: "top" }]}
        value={notes}
        onChangeText={setNotes}
        placeholder="Notes: the house's address, the Wi-Fi, who's bringing the cooler…"
        placeholderTextColor={colors.muted}
        multiline
        maxLength={500}
      />

      <Button title="Save" icon="check" onPress={save} loading={saving} style={{ marginTop: 8 }} />
      {id && existing?.trip.created_by === userId ? <Button title="Remove this Getaway" icon="trash" variant="danger" onPress={confirmDelete} /> : null}
    </NookScroll>
  );
}
