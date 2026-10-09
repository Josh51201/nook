import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, View } from "react-native";

import { DateField } from "../../components/date-field";
import { OptionalTime } from "../../components/getaway-bits";
import { useLeaveGuard } from "../../components/leave-guard";
import { LoadingScreen, Tap } from "../../components/motion";
import { NookScroll } from "../../components/nook-scroll";
import { Text, TextInput } from "../../components/text";
import { Button, Chip } from "../../components/ui";
import { useAuth } from "../../lib/auth-context";
import { friendlyError, tap } from "../../lib/feedback";
import { bookingInfo, bookingKinds, type BookingKind } from "../../lib/getaways";
import { useGetaway } from "../../lib/getaways-data";
import { parseDateString, toDateString } from "../../lib/profile";
import { normalizeLink } from "../../lib/subscriptions";
import { supabase } from "../../lib/supabase";
import { colors, ui } from "../../lib/theme";

// Add or change a confirmation (TRIP-004).
export default function BookingForm() {
  const router = useRouter();
  const { getawayId, id } = useLocalSearchParams<{ getawayId: string; id?: string }>();
  const { session } = useAuth();
  const { data } = useGetaway(getawayId, session?.user.id);
  const existing = data?.bookings.find((b) => b.id === id);

  const [ready, setReady] = useState(false);
  const [kind, setKind] = useState<BookingKind>("flight");
  const [title, setTitle] = useState("");
  const [code, setCode] = useState("");
  const [startsOn, setStartsOn] = useState("");
  const [startsTime, setStartsTime] = useState<string | null>(null);
  const [endsOn, setEndsOn] = useState<string | null>(null);
  const [endsTime, setEndsTime] = useState<string | null>(null);
  const [place, setPlace] = useState("");
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const { allowLeave } = useLeaveGuard({ kind, title, code, startsOn, startsTime, endsOn, endsTime, place, url, notes }, ready);

  useEffect(() => {
    if (ready || !data) return;
    if (id && !existing) return;
    if (existing) {
      setKind(existing.kind);
      setTitle(existing.title);
      setCode(existing.code ?? "");
      setStartsOn(existing.starts_on);
      setStartsTime(existing.starts_time?.slice(0, 5) ?? null);
      setEndsOn(existing.ends_on);
      setEndsTime(existing.ends_time?.slice(0, 5) ?? null);
      setPlace(existing.place ?? "");
      setUrl(existing.url ?? "");
      setNotes(existing.notes ?? "");
    } else {
      setStartsOn(data.trip.starts_on);
    }
    setReady(true);
  }, [data, existing, id, ready]);

  if (!data || !ready) return <LoadingScreen cards={2} />;

  const info = bookingInfo(kind);

  function pickKind(next: BookingKind) {
    setKind(next);
    // A stay or a car usually runs to the end of the trip.
    if ((next === "stay" || next === "car") && !endsOn) setEndsOn(data!.trip.ends_on);
  }

  async function save() {
    if (!title.trim()) return Alert.alert("What is it?", kind === "flight" ? "Like “Delta 1432 to Orlando”." : "Like “Seaside Inn”.");
    if (endsOn && endsOn < startsOn) return Alert.alert("Check the dates", `${info.end} can't be before ${info.start.toLowerCase()}.`);
    setSaving(true);
    const row = {
      kind,
      title: title.trim(),
      code: code.trim() || null,
      starts_on: startsOn,
      starts_time: startsTime,
      ends_on: endsOn,
      ends_time: endsTime,
      place: place.trim() || null,
      url: normalizeLink(url),
      notes: notes.trim() || null,
    };
    const { error } = existing
      ? await supabase.from("getaway_bookings").update(row).eq("id", existing.id)
      : await supabase.from("getaway_bookings").insert({ ...row, getaway_id: data!.trip.id });
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
          const { error } = await supabase.from("getaway_bookings").delete().eq("id", existing!.id);
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
          title: existing ? "Change confirmation" : "New confirmation",
          headerRight: () => (
            <Tap onPress={save} disabled={saving} hitSlop={10}>
              <Text style={{ color: colors.bark, fontSize: 17, fontWeight: "700" }}>Save</Text>
            </Tap>
          ),
        }}
      />

      <View style={ui.chips}>
        {bookingKinds.map((k) => (
          <Chip key={k.key} icon={k.icon} selected={kind === k.key} onPress={() => pickKind(k.key)}>
            {k.label}
          </Chip>
        ))}
      </View>

      <TextInput
        style={ui.input}
        value={title}
        onChangeText={setTitle}
        placeholder={kind === "flight" ? "e.g. Delta 1432 to Orlando" : kind === "stay" ? "e.g. Seaside Inn" : kind === "car" ? "e.g. Enterprise, minivan" : "What is it?"}
        placeholderTextColor={colors.muted}
        maxLength={80}
      />
      <TextInput
        style={ui.input}
        value={code}
        onChangeText={setCode}
        placeholder="Confirmation number"
        placeholderTextColor={colors.muted}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={40}
      />

      <Text style={ui.label}>{info.start}</Text>
      <DateField mode="date" value={parseDateString(startsOn)} onChange={(d) => setStartsOn(toDateString(d))} />
      <OptionalTime value={startsTime} onChange={setStartsTime} />

      <Text style={ui.label}>{info.end}</Text>
      {endsOn ? (
        <>
          <View style={[ui.row, { gap: 12 }]}>
            <DateField mode="date" value={parseDateString(endsOn)} onChange={(d) => setEndsOn(toDateString(d))} />
            <Tap
              onPress={() => {
                setEndsOn(null);
                setEndsTime(null);
              }}
              hitSlop={8}
            >
              <Text style={ui.error}>None</Text>
            </Tap>
          </View>
          <OptionalTime value={endsTime} onChange={setEndsTime} />
        </>
      ) : (
        <Button title={`Add ${info.end.toLowerCase()}`} icon="calendar" variant="secondary" onPress={() => setEndsOn(startsOn)} style={{ alignSelf: "flex-start" }} />
      )}

      <TextInput
        style={ui.input}
        value={place}
        onChangeText={setPlace}
        placeholder={kind === "flight" ? "Airports, e.g. MSP → MCO, Terminal 1" : "Address"}
        placeholderTextColor={colors.muted}
        maxLength={200}
      />
      <TextInput
        style={ui.input}
        value={url}
        onChangeText={setUrl}
        placeholder="Link to the booking (optional)"
        placeholderTextColor={colors.muted}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        maxLength={500}
      />
      <TextInput
        style={[ui.input, { minHeight: 80, textAlignVertical: "top" }]}
        value={notes}
        onChangeText={setNotes}
        placeholder="Notes: seats, the door code, what's included…"
        placeholderTextColor={colors.muted}
        multiline
        maxLength={500}
      />

      <Button title="Save" icon="check" onPress={save} loading={saving} style={{ marginTop: 8 }} />
      {existing ? <Button title="Remove" icon="trash" variant="danger" onPress={confirmDelete} /> : null}
    </NookScroll>
  );
}
