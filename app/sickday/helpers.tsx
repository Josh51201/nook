import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, View } from "react-native";

import { Avatar } from "../../components/avatar";
import { DateField } from "../../components/date-field";
import { Icon } from "../../components/icon";
import { Appear, LoadingScreen, Tap } from "../../components/motion";
import { NookScroll } from "../../components/nook-scroll";
import { Text } from "../../components/text";
import { Button, Chip, EmptyState } from "../../components/ui";
import { useAuth } from "../../lib/auth-context";
import { friendlyError, tap } from "../../lib/feedback";
import { displayName, PROFILE_FIELDS, type Profile } from "../../lib/gift-nook";
import { localDay } from "../../lib/pets";
import { toDateString } from "../../lib/profile";
import { firstName, useSickDay } from "../../lib/sickday-data";
import { supabase } from "../../lib/supabase";
import { colors, ui } from "../../lib/theme";

type Length = "better" | "today" | "tomorrow" | "pick";

// Add a helper to one sick spell (SICK-002): a grandparent or sitter you
// share a Burrow with who doesn't live with you. They see this person's sick
// day and can log temperatures, symptoms and doses, but not change anything
// else; access ends on their day, or the day after they're better.
export default function SickHelpers() {
  const router = useRouter();
  const { spell: spellId } = useLocalSearchParams<{ spell: string }>();
  const { session } = useAuth();
  const userId = session?.user.id;
  const { data } = useSickDay(userId);
  const spell = data?.spells.find((s) => s.id === spellId);
  const [people, setPeople] = useState<Profile[] | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [length, setLength] = useState<Length>("better");
  const [until, setUntil] = useState(new Date(Date.now() + 2 * 864e5));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!userId) return;
    supabase
      .from("burrow_members")
      .select(`profiles(${PROFILE_FIELDS})`)
      .then(({ data: mates }) => {
        const byId = new Map<string, Profile>();
        for (const row of (mates ?? []) as unknown as { profiles: Profile | null }[]) {
          if (row.profiles && row.profiles.id !== userId && !row.profiles.is_managed) byId.set(row.profiles.id, row.profiles);
        }
        setPeople([...byId.values()].sort((a, b) => displayName(a).localeCompare(displayName(b))));
      });
  }, [userId]);

  if (!data || !people) return <LoadingScreen cards={3} />;
  if (!spell) return <EmptyState icon="sick" title="That isn't here" />;

  const name = firstName(data, spell.patient_id);
  const homeIds = new Set(data.homePeople.map((p) => p.id));
  const already = new Set(data.helpers.filter((h) => h.spell_id === spell.id).map((h) => h.profile_id));
  const choices = people.filter((p) => !homeIds.has(p.id) && !already.has(p.id));

  function endDay(): string | null {
    const d = new Date();
    if (length === "better") return null;
    if (length === "today") return localDay(d);
    if (length === "tomorrow") return localDay(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1));
    return toDateString(until);
  }

  async function add() {
    if (!picked) return Alert.alert("Pick someone", `Choose who'll help with ${name}.`);
    setSaving(true);
    const { error } = await supabase.from("sick_helpers").insert({ spell_id: spell!.id, profile_id: picked, until: endDay() });
    if (error) {
      setSaving(false);
      return Alert.alert("Couldn't add them", friendlyError(error));
    }
    tap("success");
    router.back();
  }

  return (
    <NookScroll>
      <Stack.Screen options={{ title: `Help with ${name}` }} />
      <Text style={ui.muted}>
        A helper sees how {name} is doing and every dose so far, and can log temperatures, symptoms and doses (the same double-dose check
        applies). They get a notice, and can't change anything else.
      </Text>

      {choices.length === 0 ? (
        <EmptyState
          icon="burrow"
          title="No one to add yet"
          body="Helpers come from your Burrows. Invite a grandparent or sitter to a Burrow first, then add them here."
        />
      ) : (
        choices.map((person, i) => {
          const on = picked === person.id;
          return (
            <Appear key={person.id} index={i}>
              <Tap
                onPress={() => setPicked(on ? null : person.id)}
                style={[ui.card, ui.row, { gap: 12 }, on && { borderColor: colors.bark, borderWidth: 2 }]}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
              >
                <Avatar name={displayName(person)} icon={person.avatar_icon} color={person.avatar_color} photo={person.avatar_path} size={40} />
                <Text style={[ui.cardTitle, { flex: 1 }]}>{displayName(person)}</Text>
                {on ? <Icon name="check" size={20} color={colors.bark} /> : null}
              </Tap>
            </Appear>
          );
        })
      )}

      {choices.length ? (
        <>
          <Text style={ui.label}>For how long</Text>
          <View style={ui.chips}>
            {(
              [
                ["better", `Until ${name}'s better`],
                ["today", "Just today"],
                ["tomorrow", "Through tomorrow"],
                ["pick", "Until a date"],
              ] as [Length, string][]
            ).map(([key, label]) => (
              <Chip key={key} selected={length === key} onPress={() => setLength(key)}>
                {label}
              </Chip>
            ))}
          </View>
          {length === "pick" ? <DateField mode="date" value={until} onChange={setUntil} /> : null}
          <Button title="Add helper" icon="check" onPress={add} loading={saving} disabled={!picked} />
        </>
      ) : null}
    </NookScroll>
  );
}
