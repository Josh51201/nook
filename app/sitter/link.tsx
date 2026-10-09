import * as Clipboard from "expo-clipboard";
import { Stack, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Share, View } from "react-native";

import { DateField } from "../../components/date-field";
import { LoadingScreen, Tap } from "../../components/motion";
import { NookScroll } from "../../components/nook-scroll";
import { Text, TextInput } from "../../components/text";
import { Button, Chip, SectionHeader } from "../../components/ui";
import { useAuth } from "../../lib/auth-context";
import { friendlyError, tap } from "../../lib/feedback";
import { phoneTimeZone } from "../../lib/pets";
import { parseDateString, toDateString } from "../../lib/profile";
import { linkUrl, sectionFilled, sections, shareMessage, stayProblem, type SectionKey, type SitterLink } from "../../lib/sitter";
import { useSitter } from "../../lib/sitter-data";
import { supabase } from "../../lib/supabase";
import { colors, ui } from "../../lib/theme";

// Make a link for one stay (SIT-003, SIT-006, SIT-008): who it's for, which
// days, which parts of the sheet, and which kids and pets (none unless ticked).
export default function NewSitterLink() {
  const router = useRouter();
  const { session } = useAuth();
  const { data } = useSitter(session?.user.id);

  const [ready, setReady] = useState(false);
  const [label, setLabel] = useState("");
  const [startsOn, setStartsOn] = useState(toDateString(new Date()));
  const [endsOn, setEndsOn] = useState(toDateString(new Date(Date.now() + 864e5)));
  const [picked, setPicked] = useState<SectionKey[]>([]);
  const [kidIds, setKidIds] = useState<string[]>([]);
  const [petIds, setPetIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (ready || !data) return;
    // Everything you've filled in, to start; kids and pets stay off.
    setPicked(sections.filter((s) => sectionFilled(data.sheet, s.key)).map((s) => s.key));
    setReady(true);
  }, [data, ready]);

  if (!data || !ready) return <LoadingScreen cards={2} />;

  const toggle = <T,>(list: T[], item: T) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);
  const filled = sections.filter((s) => sectionFilled(data.sheet, s.key));

  async function save() {
    if (!label.trim()) return Alert.alert("Who's it for?", "Like “Grandma, Thanksgiving weekend”.");
    const problem = stayProblem(startsOn, endsOn, data!.today);
    if (problem) return Alert.alert("Check the dates", problem);
    if (!picked.length && !kidIds.length && !petIds.length) return Alert.alert("Nothing to show", "Pick at least one part of the sheet, a kid or a pet.");
    setSaving(true);
    const { data: link, error } = await supabase
      .from("sitter_links")
      .insert({
        home_id: data!.homeId,
        label: label.trim(),
        starts_on: startsOn,
        ends_on: endsOn,
        tz: phoneTimeZone(),
        sections: picked,
        kid_ids: kidIds,
        pet_ids: petIds,
        created_by: session!.user.id,
      })
      .select("*")
      .single();
    if (error || !link) {
      setSaving(false);
      return Alert.alert("Couldn't make the link", friendlyError(error));
    }
    tap("success");
    const made = link as SitterLink;
    const url = linkUrl(made.token);
    if (!url) {
      router.back();
      return Alert.alert("Link made", "The sitter's web page hasn't been put online yet. The link is saved here, ready to share when it is.");
    }
    Alert.alert("Link made", "Send it to them now?", [
      { text: "Share…", onPress: () => Share.share({ message: shareMessage(made, url) }).finally(() => router.back()) },
      {
        text: "Copy link",
        onPress: async () => {
          await Clipboard.setStringAsync(url);
          router.back();
        },
      },
      { text: "Later", style: "cancel", onPress: () => router.back() },
    ]);
  }

  return (
    <NookScroll>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Tap onPress={save} disabled={saving} hitSlop={10}>
              <Text style={{ color: colors.bark, fontSize: 17, fontWeight: "700" }}>Make</Text>
            </Tap>
          ),
        }}
      />

      <TextInput
        style={ui.input}
        value={label}
        onChangeText={setLabel}
        placeholder="Who's it for? e.g. Grandma, Thanksgiving weekend"
        placeholderTextColor={colors.muted}
        maxLength={60}
      />
      <Text style={ui.muted}>Only your Home sees this name. The sitter sees it as the title.</Text>

      <SectionHeader title="When" icon="calendar" />
      <Text style={ui.label}>First day</Text>
      <DateField mode="date" value={parseDateString(startsOn)} onChange={(d) => {
        const day = toDateString(d);
        setStartsOn(day);
        if (endsOn < day) setEndsOn(day);
      }} />
      <Text style={ui.label}>Last day</Text>
      <DateField mode="date" value={parseDateString(endsOn)} onChange={(d) => setEndsOn(toDateString(d))} />
      <Text style={ui.muted}>
        They can open it as soon as you send it, so they can read ahead. It stops working at the end of the last day, and you can switch it off sooner.
      </Text>

      <SectionHeader title="From the sheet" icon="doc" />
      {filled.length ? (
        <View style={ui.chips}>
          {filled.map((s) => (
            <Chip key={s.key} icon={s.icon} selected={picked.includes(s.key)} onPress={() => setPicked((p) => toggle(p, s.key))}>
              {s.label}
            </Chip>
          ))}
        </View>
      ) : (
        <Text style={ui.muted}>Nothing written on the sheet yet.</Text>
      )}

      {data.kids.length ? (
        <>
          <SectionHeader title="Kids" icon="kid" />
          <View style={ui.chips}>
            {data.kids.map((k) => (
              <Chip key={k.id} icon="kid" selected={kidIds.includes(k.id)} onPress={() => setKidIds((p) => toggle(p, k.id))}>
                {k.name.split(" ")[0]}
              </Chip>
            ))}
          </View>
          <Text style={ui.muted}>Off unless you tick them. The sitter sees only a first name, allergies and diets, from each kid's profile.</Text>
        </>
      ) : null}

      {data.pets.length ? (
        <>
          <SectionHeader title="Pets" icon="paw" />
          <View style={ui.chips}>
            {data.pets.map((p) => (
              <Chip key={p.id} icon="paw" selected={petIds.includes(p.id)} onPress={() => setPetIds((x) => toggle(x, p.id))}>
                {p.name}
              </Chip>
            ))}
          </View>
          <Text style={ui.muted}>From Pet Care: food, meals, medications, vet and notes. Off unless you tick them.</Text>
        </>
      ) : null}

      <Button title="Make the link" icon="link" onPress={save} loading={saving} style={{ marginTop: 8 }} />
    </NookScroll>
  );
}
