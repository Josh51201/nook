import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Switch, View } from "react-native";
import Animated, { FadeIn, LinearTransition } from "react-native-reanimated";

import { Avatar } from "../../components/avatar";
import { DateField } from "../../components/date-field";
import { Icon } from "../../components/icon";
import { LoadingScreen, Tap } from "../../components/motion";
import { NookScroll } from "../../components/nook-scroll";
import { Text, TextInput } from "../../components/text";
import { Button, Chip, SectionHeader } from "../../components/ui";
import { useAuth } from "../../lib/auth-context";
import { friendlyError, tap } from "../../lib/feedback";
import { displayName } from "../../lib/gift-nook";
import { addressLines, cleanAddress, emptyAddress, hasAddress, householdNameFor, type Address } from "../../lib/letterbox";
import { parseDateString, toDateString } from "../../lib/profile";
import { supabase } from "../../lib/supabase";
import { colors, ui } from "../../lib/theme";
import { useLetterbox } from "../../lib/use-letterbox";

type DraftPerson = { key: string; id?: string; name: string; birthday: string | null; profile_id: string | null };
type Mate = { id: string; display_name: string | null; avatar_icon: string | null; avatar_color: string | null; birthday: string | null };

let keySeed = 0;
const newKey = () => `p${++keySeed}`;

// Add or change a household (LET-003/004): its name, who lives there (with
// birthdays, or linked to family on Nook), and where to mail them — a
// family member's own profile address, or one typed in.
export default function HouseholdForm() {
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user.id;
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { data, isLoading } = useLetterbox();
  const existing = id ? data?.households.find((h) => h.id === id) : undefined;

  const [ready, setReady] = useState(false);
  const [name, setName] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [people, setPeople] = useState<DraftPerson[]>([]);
  const [addressFrom, setAddressFrom] = useState<string | null>(null);
  const [address, setAddress] = useState<Address>(emptyAddress());
  const [onList, setOnList] = useState(true);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [mates, setMates] = useState<Mate[]>([]);
  const [shared, setShared] = useState<Map<string, Address>>(new Map());

  // Fill the form once the Letterbox has loaded.
  useEffect(() => {
    if (ready || !data || (id && !existing)) return;
    if (existing) {
      setName(existing.name);
      setNameTouched(true);
      setPeople(
        existing.letterbox_people.map((p) => ({ key: newKey(), id: p.id, name: p.name, birthday: p.birthday, profile_id: p.profile_id }))
      );
      setAddressFrom(existing.address_from);
      setAddress({
        line1: existing.line1 ?? "",
        line2: existing.line2 ?? "",
        city: existing.city ?? "",
        region: existing.region ?? "",
        postal_code: existing.postal_code ?? "",
        country: existing.country ?? "",
      });
      setOnList(existing.on_holiday_list);
      setNotes(existing.notes ?? "");
    } else {
      setPeople([{ key: newKey(), name: "", birthday: null, profile_id: null }]);
    }
    setReady(true);
  }, [data, existing, id, ready]);

  // Family from your Burrows you can link, and whose addresses you can see.
  useEffect(() => {
    if (!userId) return;
    supabase
      .from("burrow_members")
      .select("profiles(id, display_name, avatar_icon, avatar_color, birthday)")
      .then(async ({ data: rows }) => {
        const byId = new Map<string, Mate>();
        for (const row of (rows ?? []) as unknown as { profiles: Mate | null }[]) {
          if (row.profiles && row.profiles.id !== userId) byId.set(row.profiles.id, row.profiles);
        }
        const list = [...byId.values()].sort((a, b) => displayName(a).localeCompare(displayName(b)));
        setMates(list);
        if (list.length) {
          const { data: addresses } = await supabase
            .from("profile_addresses")
            .select("profile_id, line1, line2, city, region, postal_code, country")
            .in("profile_id", list.map((m) => m.id));
          setShared(new Map(((addresses ?? []) as (Address & { profile_id: string })[]).map((a) => [a.profile_id, a])));
        }
      });
  }, [userId]);

  if (isLoading || !ready || !data) return <LoadingScreen cards={2} />;

  const linkedIds = new Set(people.map((p) => p.profile_id).filter(Boolean));
  const suggested = householdNameFor(people.map((p) => p.name));
  const shownName = nameTouched ? name : suggested;
  // Linked people who share an address with you can be this household's address.
  const addressChoices = people.filter((p) => p.profile_id && shared.has(p.profile_id));
  const usingProfile = addressFrom !== null && (shared.has(addressFrom) || !hasAddress(address));

  function setPerson(key: string, changes: Partial<DraftPerson>) {
    setPeople((list) => list.map((p) => (p.key === key ? { ...p, ...changes } : p)));
  }

  function link(mate: Mate) {
    tap();
    const blank = people.find((p) => !p.name.trim() && !p.profile_id);
    const person = { name: displayName(mate), birthday: null, profile_id: mate.id };
    if (blank) setPerson(blank.key, person);
    else setPeople((list) => [...list, { key: newKey(), ...person }]);
    if (!addressFrom && !hasAddress(address) && shared.has(mate.id)) setAddressFrom(mate.id);
  }

  function removePerson(person: DraftPerson) {
    setPeople((list) => list.filter((p) => p.key !== person.key));
    if (person.profile_id && person.profile_id === addressFrom) setAddressFrom(null);
  }

  async function save() {
    const finalName = shownName.trim();
    if (!finalName) return Alert.alert("Give them a name", "Like “The Johnson Family” or “Grandma Rose”.");
    const kept = people.filter((p) => p.name.trim());
    setSaving(true);
    try {
      const typed = cleanAddress(address);
      const row = {
        letterbox_id: data!.boxId,
        name: finalName,
        address_from: usingProfile ? addressFrom : null,
        ...(usingProfile ? cleanAddress(emptyAddress()) : typed),
        on_holiday_list: onList,
        notes: notes.trim() || null,
      };
      let householdId = id;
      if (existing) {
        const { error } = await supabase.from("letterbox_households").update(row).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { data: created, error } = await supabase.from("letterbox_households").insert(row).select("id").single();
        if (error) throw error;
        householdId = created.id;
      }

      const removed = (existing?.letterbox_people ?? []).filter((p) => !kept.some((k) => k.id === p.id)).map((p) => p.id);
      if (removed.length) await supabase.from("letterbox_people").delete().in("id", removed);
      for (const [position, person] of kept.entries()) {
        const fields = {
          name: person.name.trim(),
          birthday: person.profile_id ? null : person.birthday,
          profile_id: person.profile_id,
          position,
        };
        const { error } = person.id
          ? await supabase.from("letterbox_people").update(fields).eq("id", person.id)
          : await supabase
              .from("letterbox_people")
              .insert({ ...fields, household_id: householdId, letterbox_id: data!.boxId });
        if (error) throw error;
      }
      tap("success");
      if (existing) router.back();
      else router.replace(`/letterbox/household/${householdId}`);
    } catch (error) {
      setSaving(false);
      Alert.alert("Couldn't save", friendlyError(error as { message?: string }));
    }
  }

  function confirmDelete() {
    Alert.alert(`Remove ${existing!.name}?`, "Their cards and history go too.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase.from("letterbox_households").delete().eq("id", existing!.id);
          if (error) return Alert.alert("Couldn't remove them", friendlyError(error));
          router.dismissTo("/letterbox");
        },
      },
    ]);
  }

  const field = (key: keyof Address, placeholder: string, extra?: object) => (
    <TextInput
      style={[ui.input, { flex: 1 }]}
      value={address[key] ?? ""}
      onChangeText={(value) => setAddress((a) => ({ ...a, [key]: value }))}
      placeholder={placeholder}
      placeholderTextColor={colors.muted}
      {...extra}
    />
  );

  return (
    <NookScroll>
      <Stack.Screen
        options={{
          title: existing ? "Edit household" : "New household",
          headerRight: () => (
            <Tap onPress={save} disabled={saving} hitSlop={10}>
              <Text style={{ color: colors.bark, fontSize: 17, fontWeight: "700" }}>Save</Text>
            </Tap>
          ),
        }}
      />

      <SectionHeader title="Who lives here" icon="group" />
      {people.map((person) => {
        const mate = person.profile_id ? mates.find((m) => m.id === person.profile_id) : null;
        return (
          <Animated.View
            key={person.key}
            entering={FadeIn.duration(200)}
            layout={LinearTransition.duration(200)}
            style={[ui.card, { gap: 10 }]}
          >
            <View style={[ui.row, { gap: 10 }]}>
              {person.profile_id ? (
                <Avatar name={person.name} icon={mate?.avatar_icon} color={mate?.avatar_color} size={36} />
              ) : null}
              <TextInput
                style={[ui.input, { flex: 1 }]}
                value={person.name}
                onChangeText={(value) => setPerson(person.key, { name: value })}
                placeholder="Name, e.g. Mia Johnson"
                placeholderTextColor={colors.muted}
                editable={!person.profile_id}
              />
              <Tap onPress={() => removePerson(person)} hitSlop={8} pressedScale={0.85} accessibilityLabel="Remove this person">
                <Icon name="trash" size={20} color={colors.error} />
              </Tap>
            </View>
            {person.profile_id ? (
              <Text style={ui.muted}>
                On Nook — their name{mate?.birthday ? " and birthday" : ""} come from their profile.
              </Text>
            ) : person.birthday ? (
              <View style={[ui.row, { gap: 10 }]}>
                <Icon name="birthday" size={18} />
                <View style={{ flex: 1 }}>
                  <DateField
                    mode="date"
                    value={parseDateString(person.birthday)}
                    maximumDate={new Date()}
                    onChange={(date) => setPerson(person.key, { birthday: toDateString(date) })}
                  />
                </View>
                <Tap onPress={() => setPerson(person.key, { birthday: null })} hitSlop={8}>
                  <Text style={ui.error}>Remove</Text>
                </Tap>
              </View>
            ) : (
              <Tap onPress={() => setPerson(person.key, { birthday: toDateString(new Date(1990, 0, 1)) })} style={[ui.row, { gap: 6 }]}>
                <Icon name="birthday" size={16} />
                <Text style={ui.link}>Add their birthday</Text>
              </Tap>
            )}
          </Animated.View>
        );
      })}
      <Button
        title="Add another person"
        icon="add"
        variant="secondary"
        onPress={() => setPeople((list) => [...list, { key: newKey(), name: "", birthday: null, profile_id: null }])}
      />
      {mates.filter((m) => !linkedIds.has(m.id)).length ? (
        <>
          <Text style={ui.label}>Or pick family on Nook</Text>
          <View style={ui.chips}>
            {mates
              .filter((m) => !linkedIds.has(m.id))
              .map((mate) => (
                <Chip key={mate.id} icon="person" onPress={() => link(mate)}>
                  {displayName(mate)}
                </Chip>
              ))}
          </View>
        </>
      ) : null}

      <SectionHeader title="Name on the envelope" icon="mail" />
      <TextInput
        style={ui.input}
        value={shownName}
        onChangeText={(value) => {
          setNameTouched(true);
          setName(value);
        }}
        placeholder="e.g. The Johnson Family"
        placeholderTextColor={colors.muted}
      />

      <SectionHeader title="Address" icon="place" />
      {addressChoices.length ? (
        <View style={ui.chips}>
          {addressChoices.map((person) => (
            <Chip
              key={person.key}
              icon="sparkles"
              selected={usingProfile && addressFrom === person.profile_id}
              onPress={() => setAddressFrom(person.profile_id)}
            >
              {person.name.split(" ")[0]}'s address
            </Chip>
          ))}
          <Chip icon="edit" selected={!usingProfile} onPress={() => setAddressFrom(null)}>
            Type one in
          </Chip>
        </View>
      ) : null}
      {usingProfile && addressFrom && shared.has(addressFrom) ? (
        <Animated.View entering={FadeIn.duration(200)} style={[ui.card, { gap: 2 }]}>
          {addressLines(shared.get(addressFrom)).map((line) => (
            <Text key={line} style={ui.cardTitle}>
              {line}
            </Text>
          ))}
          <Text style={[ui.muted, { marginTop: 6 }]}>From their profile, so it stays up to date when they move.</Text>
        </Animated.View>
      ) : (
        <Animated.View entering={FadeIn.duration(200)} style={{ gap: 10 }}>
          {field("line1", "Street address", { textContentType: "streetAddressLine1", autoComplete: "street-address" })}
          {field("line2", "Apartment, unit (optional)", { textContentType: "streetAddressLine2" })}
          <View style={[ui.row, { gap: 10 }]}>
            {field("city", "City", { textContentType: "addressCity" })}
          </View>
          <View style={[ui.row, { gap: 10 }]}>
            {field("region", "State", { textContentType: "addressState" })}
            {field("postal_code", "ZIP", { textContentType: "postalCode", keyboardType: "numbers-and-punctuation" })}
          </View>
          {field("country", "Country (if not the US)", { textContentType: "countryName" })}
        </Animated.View>
      )}

      <View style={[ui.card, ui.row, { gap: 12 }]}>
        <Icon name="christmas" size={22} />
        <Text style={[ui.cardTitle, { flex: 1 }]}>On the holiday card list</Text>
        <Switch value={onList} onValueChange={setOnList} trackColor={{ true: colors.bark }} />
      </View>

      <Text style={ui.label}>Notes (optional)</Text>
      <TextInput
        style={[ui.input, { minHeight: 80, textAlignVertical: "top" }]}
        value={notes}
        onChangeText={setNotes}
        placeholder="Kids' names, how you know them, anything to remember…"
        placeholderTextColor={colors.muted}
        multiline
      />

      <Button title="Save" icon="check" onPress={save} loading={saving} style={{ marginTop: 8 }} />
      {existing ? <Button title="Remove household" icon="trash" variant="danger" onPress={confirmDelete} /> : null}
    </NookScroll>
  );
}
