import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Platform, Text, TextInput, TouchableOpacity, View } from "react-native";

import { NookScroll } from "../../components/nook-scroll";
import { useAuth } from "../../lib/auth-context";
import { friendlyError, tap } from "../../lib/feedback";
import {
  countdown,
  displayName,
  gatheringKinds,
  type BurrowMember,
  type GatheringKind,
} from "../../lib/gift-nook";
import { supabase } from "../../lib/supabase";
import { colors, ui } from "../../lib/theme";

// Plan or edit a Gathering in a Burrow (GIFT-010/014/015). Honorees are
// optional: none means it's for everyone (e.g. Christmas); one or two people
// covers a birthday or anniversary. How honorees affect which Wishbooks show
// is Q-003.
//   ?burrowId=...     plan a new one
//   ?gatheringId=...  edit an existing one
export default function GatheringForm() {
  const router = useRouter();
  const params = useLocalSearchParams<{ burrowId?: string; gatheringId?: string }>();
  const { gatheringId } = params;
  const { session } = useAuth();
  const userId = session?.user.id;

  const [burrowId, setBurrowId] = useState(params.burrowId ?? null);
  const [members, setMembers] = useState<BurrowMember[]>([]);
  const [kind, setKind] = useState<GatheringKind>("christmas");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(defaultDate("christmas"));
  const [showIosPicker, setShowIosPicker] = useState(false);
  const [honorees, setHonorees] = useState<Set<string>>(new Set());
  const [originalHonorees, setOriginalHonorees] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(Boolean(gatheringId));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Editing: load what's there.
  useEffect(() => {
    if (!gatheringId) return;
    (async () => {
      const [gatheringResult, honoreesResult] = await Promise.all([
        supabase.from("gatherings").select("burrow_id, title, kind, ends_at").eq("id", gatheringId).single(),
        supabase.from("gathering_honorees").select("profile_id").eq("gathering_id", gatheringId),
      ]);
      const row = gatheringResult.data;
      if (row) {
        setBurrowId(row.burrow_id);
        setTitle(row.title);
        setKind(row.kind as GatheringKind);
        setDate(new Date(row.ends_at));
      }
      const ids = new Set((honoreesResult.data ?? []).map((h) => h.profile_id));
      setHonorees(ids);
      setOriginalHonorees(new Set(ids));
      setIsLoading(false);
    })();
  }, [gatheringId]);

  useEffect(() => {
    if (!burrowId) return;
    supabase
      .from("burrow_members")
      .select("profile_id, role, profiles(id, display_name)")
      .eq("burrow_id", burrowId)
      .then(({ data }) => setMembers((data ?? []) as unknown as BurrowMember[]));
  }, [burrowId]);

  function pickKind(next: GatheringKind) {
    setKind(next);
    if (!gatheringId) setDate(defaultDate(next));
  }

  function toggleHonoree(profileId: string) {
    setHonorees((prev) => {
      const next = new Set(prev);
      if (next.has(profileId)) next.delete(profileId);
      else next.add(profileId);
      return next;
    });
  }

  function openDatePicker() {
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: date,
        mode: "date",
        onChange: (_event, picked) => picked && setDate(picked),
      });
    } else {
      setShowIosPicker((shown) => !shown);
    }
  }

  async function save() {
    if (!burrowId) return;
    // The Gathering "ends" at the end of the chosen day, local time.
    const endsAt = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59);
    const kindLabel = gatheringKinds.find((k) => k.key === kind)!.label;
    const honoreeNames = members
      .filter((m) => honorees.has(m.profile_id))
      .map((m) => displayName(m.profiles));
    const finalTitle =
      title.trim() ||
      (honoreeNames.length ? `${honoreeNames.join(" & ")}'s ${kindLabel}` : kindLabel);

    setIsSaving(true);
    setError(null);

    let id = gatheringId;
    if (gatheringId) {
      const { error: updateError } = await supabase
        .from("gatherings")
        .update({ title: finalTitle, kind, ends_at: endsAt.toISOString() })
        .eq("id", gatheringId);
      if (updateError) return fail(updateError);
    } else {
      const { data: created, error: insertError } = await supabase
        .from("gatherings")
        .insert({ burrow_id: burrowId, title: finalTitle, kind, ends_at: endsAt.toISOString() })
        .select("id")
        .single();
      if (insertError || !created) return fail(insertError);
      id = created.id;
    }

    const added = [...honorees].filter((p) => !originalHonorees.has(p));
    const removed = [...originalHonorees].filter((p) => !honorees.has(p));
    if (added.length) {
      const { error: addError } = await supabase
        .from("gathering_honorees")
        .insert(added.map((profileId) => ({ gathering_id: id, profile_id: profileId })));
      if (addError) return fail(addError);
    }
    if (removed.length) {
      const { error: removeError } = await supabase
        .from("gathering_honorees")
        .delete()
        .eq("gathering_id", id!)
        .in("profile_id", removed);
      if (removeError) return fail(removeError);
    }

    setIsSaving(false);
    tap("success");
    if (gatheringId) router.back();
    else router.replace(`/gift-nook/gathering/${id}`);
  }

  function fail(failure: { message: string; code?: string } | null) {
    setIsSaving(false);
    setError(friendlyError(failure) ?? "Couldn't save that Gathering.");
  }

  if (isLoading) {
    return (
      <View style={ui.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <NookScroll>
      <Stack.Screen options={{ title: gatheringId ? "Edit Gathering" : "New Gathering" }} />

      <Text style={ui.label}>What kind?</Text>
      <View style={ui.chips}>
        {gatheringKinds.map((k) => {
          const selected = k.key === kind;
          return (
            <TouchableOpacity
              key={k.key}
              style={[ui.chip, selected && ui.chipSelected]}
              onPress={() => pickKind(k.key)}
            >
              <Text style={[ui.chipText, selected && ui.chipTextSelected]}>
                {k.emoji} {k.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={ui.label}>Who's it for? (optional)</Text>
      <Text style={ui.muted}>Leave blank for everyone — like Christmas.</Text>
      <View style={ui.chips}>
        {members.map((member) => {
          const selected = honorees.has(member.profile_id);
          return (
            <TouchableOpacity
              key={member.profile_id}
              style={[ui.chip, selected && ui.chipSelected]}
              onPress={() => toggleHonoree(member.profile_id)}
            >
              <Text style={[ui.chipText, selected && ui.chipTextSelected]}>
                {displayName(member.profiles)}
                {member.profile_id === userId ? " (you)" : ""}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={ui.label}>Date</Text>
      <TouchableOpacity
        style={[ui.input, ui.row, { justifyContent: "space-between" }]}
        onPress={openDatePicker}
        accessibilityLabel="Pick the date"
      >
        <Text style={{ fontSize: 16, color: colors.text }}>
          📅{" "}
          {date.toLocaleDateString(undefined, { weekday: "short", month: "long", day: "numeric", year: "numeric" })}
        </Text>
        <Text style={ui.muted}>{countdown(date.toISOString())}</Text>
      </TouchableOpacity>
      {Platform.OS === "ios" && showIosPicker ? (
        <DateTimePicker
          value={date}
          mode="date"
          display="inline"
          accentColor={colors.bark}
          onChange={(_event, picked) => picked && setDate(picked)}
        />
      ) : null}
      <Text style={ui.muted}>After this day it moves to Archived.</Text>

      <Text style={ui.label}>Name (optional)</Text>
      <TextInput
        style={ui.input}
        value={title}
        onChangeText={setTitle}
        placeholder="We'll name it for you if you skip this"
      />

      {error ? <Text style={ui.error}>{error}</Text> : null}

      <TouchableOpacity style={ui.button} onPress={save} disabled={isSaving}>
        {isSaving ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={ui.buttonText}>{gatheringId ? "Save changes" : "Plan Gathering"}</Text>
        )}
      </TouchableOpacity>
    </NookScroll>
  );
}

// Christmas defaults to the next Christmas Day; anything else to a month out.
function defaultDate(kind: GatheringKind) {
  const now = new Date();
  if (kind === "christmas") {
    const thisYear = new Date(now.getFullYear(), 11, 25);
    return now > new Date(now.getFullYear(), 11, 25, 23, 59) ? new Date(now.getFullYear() + 1, 11, 25) : thisYear;
  }
  return new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
}
