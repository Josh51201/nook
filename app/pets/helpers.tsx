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
import { usePets } from "../../lib/pets-data";
import { localDay } from "../../lib/pets";
import { toDateString } from "../../lib/profile";
import { supabase } from "../../lib/supabase";
import { colors, ui } from "../../lib/theme";

type Length = "open" | "week" | "twoWeeks" | "month" | "pick";

// Give a pet sitter or grandparent access to one pet (PET-002): anyone you
// share a Burrow with who isn't already in your Home. They can see the pet
// and check things off, but not change its profile, meals or records.
export default function Helpers() {
  const router = useRouter();
  const { petId } = useLocalSearchParams<{ petId: string }>();
  const { session } = useAuth();
  const userId = session?.user.id;
  const { data } = usePets(userId);
  const pet = data?.pets.find((p) => p.id === petId);
  const [people, setPeople] = useState<Profile[] | null>(null);
  const [homeIds, setHomeIds] = useState<Set<string>>(new Set());
  const [picked, setPicked] = useState<string | null>(null);
  const [length, setLength] = useState<Length>("week");
  const [until, setUntil] = useState(new Date(Date.now() + 14 * 864e5));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!userId) return;
    Promise.all([
      supabase.from("burrow_members").select(`profiles(${PROFILE_FIELDS})`),
      supabase.from("home_members").select("profile_id").eq("home_id", pet?.home_id ?? ""),
    ]).then(([mates, home]) => {
      const byId = new Map<string, Profile>();
      for (const row of (mates.data ?? []) as unknown as { profiles: Profile | null }[]) {
        if (row.profiles && row.profiles.id !== userId && !row.profiles.is_managed) byId.set(row.profiles.id, row.profiles);
      }
      setPeople([...byId.values()].sort((a, b) => displayName(a).localeCompare(displayName(b))));
      setHomeIds(new Set((home.data ?? []).map((m) => m.profile_id)));
    });
  }, [userId, pet?.home_id]);

  if (!data || !people) return <LoadingScreen cards={3} />;
  if (!pet) return <EmptyState icon="paw" title="That pet isn't here" />;

  const already = new Set(pet.pet_helpers.map((h) => h.profile_id));
  const choices = people.filter((p) => !homeIds.has(p.id) && !already.has(p.id));

  function endDay(): string | null {
    const from = new Date();
    if (length === "open") return null;
    if (length === "pick") return toDateString(until);
    const days = length === "week" ? 7 : length === "twoWeeks" ? 14 : 30;
    return localDay(new Date(from.getFullYear(), from.getMonth(), from.getDate() + days));
  }

  async function add() {
    if (!picked) return Alert.alert("Pick someone", "Choose who'll help with " + pet!.name + ".");
    setSaving(true);
    const { error } = await supabase.from("pet_helpers").insert({ pet_id: pet!.id, profile_id: picked, until: endDay() });
    if (error) {
      setSaving(false);
      return Alert.alert("Couldn't add them", friendlyError(error));
    }
    tap("success");
    router.back();
  }

  return (
    <NookScroll>
      <Stack.Screen options={{ title: `Help with ${pet.name}` }} />
      <Text style={ui.muted}>
        A helper sees {pet.name} and can check off meals, walks and meds. They can't change {pet.name}'s profile, meals or records.
      </Text>

      {choices.length === 0 ? (
        <EmptyState
          icon="burrow"
          title="No one to add yet"
          body="Helpers come from your Burrows. Invite a sitter or grandparent to a Burrow first, then add them here."
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
                <Avatar name={displayName(person)} icon={person.avatar_icon} color={person.avatar_color} size={40} />
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
                ["week", "1 week"],
                ["twoWeeks", "2 weeks"],
                ["month", "1 month"],
                ["pick", "Until a date"],
                ["open", "Until I remove them"],
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
