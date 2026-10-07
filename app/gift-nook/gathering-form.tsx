import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from "react-native";

import { NookScroll } from "../../components/nook-scroll";
import { useAuth } from "../../lib/auth-context";
import {
  displayName,
  gatheringKinds,
  type BurrowMember,
  type GatheringKind,
} from "../../lib/gift-nook";
import { supabase } from "../../lib/supabase";
import { colors, ui } from "../../lib/theme";

// Plan a Gathering in a Burrow (GIFT-010/014/015). Honorees are optional:
// none means it's for everyone (e.g. Christmas); one or two people covers a
// birthday or anniversary. How honorees affect which Wishbooks show is Q-003.
export default function GatheringForm() {
  const router = useRouter();
  const { burrowId } = useLocalSearchParams<{ burrowId: string }>();
  const { session } = useAuth();
  const userId = session?.user.id;

  const [members, setMembers] = useState<BurrowMember[]>([]);
  const [kind, setKind] = useState<GatheringKind>("christmas");
  const [title, setTitle] = useState("");
  const [endDate, setEndDate] = useState(defaultEndDate("christmas"));
  const [honorees, setHonorees] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("burrow_members")
      .select("profile_id, role, profiles(id, display_name)")
      .eq("burrow_id", burrowId)
      .then(({ data }) => setMembers((data ?? []) as unknown as BurrowMember[]));
  }, [burrowId]);

  function pickKind(next: GatheringKind) {
    setKind(next);
    setEndDate(defaultEndDate(next));
  }

  function toggleHonoree(profileId: string) {
    setHonorees((prev) => {
      const next = new Set(prev);
      if (next.has(profileId)) next.delete(profileId);
      else next.add(profileId);
      return next;
    });
  }

  async function save() {
    const endsAt = parseDate(endDate);
    if (!endsAt) {
      setError("Enter the end date as YYYY-MM-DD, e.g. 2026-12-25.");
      return;
    }
    const kindLabel = gatheringKinds.find((k) => k.key === kind)!.label;
    const honoreeNames = members
      .filter((m) => honorees.has(m.profile_id))
      .map((m) => displayName(m.profiles));
    const finalTitle =
      title.trim() ||
      (honoreeNames.length ? `${honoreeNames.join(" & ")}'s ${kindLabel}` : kindLabel);

    setIsSaving(true);
    setError(null);
    const { data: gathering, error: insertError } = await supabase
      .from("gatherings")
      .insert({ burrow_id: burrowId, title: finalTitle, kind, ends_at: endsAt.toISOString() })
      .select("id")
      .single();
    if (insertError || !gathering) {
      setIsSaving(false);
      setError(insertError?.message ?? "Couldn't save that Gathering.");
      return;
    }
    if (honorees.size) {
      const { error: honoreeError } = await supabase.from("gathering_honorees").insert(
        [...honorees].map((profileId) => ({ gathering_id: gathering.id, profile_id: profileId }))
      );
      if (honoreeError) {
        setIsSaving(false);
        setError(honoreeError.message);
        return;
      }
    }
    setIsSaving(false);
    router.replace(`/gift-nook/gathering/${gathering.id}`);
  }

  return (
    <NookScroll>
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

      <Text style={ui.label}>Name (optional)</Text>
      <TextInput
        style={ui.input}
        value={title}
        onChangeText={setTitle}
        placeholder="We'll name it for you if you skip this"
      />

      <Text style={ui.label}>Ends on</Text>
      <TextInput
        style={ui.input}
        value={endDate}
        onChangeText={setEndDate}
        placeholder="YYYY-MM-DD"
        autoCorrect={false}
        keyboardType="numbers-and-punctuation"
      />
      <Text style={ui.muted}>After this date it moves to Archived.</Text>

      {error ? <Text style={ui.error}>{error}</Text> : null}

      <TouchableOpacity style={ui.button} onPress={save} disabled={isSaving}>
        {isSaving ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={ui.buttonText}>Plan Gathering</Text>
        )}
      </TouchableOpacity>
    </NookScroll>
  );
}

function toDateString(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Christmas defaults to the next Dec 26 (so the day itself is still
// "upcoming"); anything else to a month out.
function defaultEndDate(kind: GatheringKind) {
  const now = new Date();
  if (kind === "christmas") {
    const year = now > new Date(now.getFullYear(), 11, 26) ? now.getFullYear() + 1 : now.getFullYear();
    return toDateString(new Date(year, 11, 26));
  }
  return toDateString(new Date(now.getFullYear(), now.getMonth() + 1, now.getDate()));
}

// The end of the given local day.
function parseDate(value: string) {
  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value.trim());
  if (!match) return null;
  const [, y, m, d] = match.map(Number);
  const date = new Date(y, m - 1, d, 23, 59, 59);
  return date.getMonth() === m - 1 ? date : null;
}
