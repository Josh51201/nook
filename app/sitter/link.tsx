import * as Clipboard from "expo-clipboard";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Share, View } from "react-native";

import { DateField } from "../../components/date-field";
import { LoadingScreen, Tap } from "../../components/motion";
import { NookScroll } from "../../components/nook-scroll";
import { Text, TextInput } from "../../components/text";
import { Button, Chip, EmptyState, SectionHeader } from "../../components/ui";
import { useAuth } from "../../lib/auth-context";
import { friendlyError, tap } from "../../lib/feedback";
import { phoneTimeZone } from "../../lib/pets";
import { parseDateString, toDateString } from "../../lib/profile";
import {
  applyPreset,
  linkUrl,
  pastSitters,
  presets,
  reusePicks,
  sectionFilled,
  sections,
  shareMessage,
  stayProblem,
  type PresetKey,
  type SectionKey,
  type SitterLink,
} from "../../lib/sitter";
import { useSitter } from "../../lib/sitter-data";
import { supabase } from "../../lib/supabase";
import { colors, ui } from "../../lib/theme";

// Make a link for one stay (SIT-003, SIT-006, SIT-008): who it's for, which
// days, which parts of the sheet, and which kids and pets (none unless ticked).
// Quick starts (SIT-012) fill in the picks for a kind of sitter, or copy a
// past link's. Codes are only ever ticked by hand (SIT-013).
export default function NewSitterLink() {
  const router = useRouter();
  const { session } = useAuth();
  const { data } = useSitter(session?.user.id);
  // A Getaway opens this with its dates and name filled in (TRIP-012).
  const params = useLocalSearchParams<{ startsOn?: string; endsOn?: string; label?: string }>();

  const [ready, setReady] = useState(false);
  const [label, setLabel] = useState(params.label ? params.label.slice(0, 60) : "");
  const [startsOn, setStartsOn] = useState(params.startsOn ?? toDateString(new Date()));
  const [endsOn, setEndsOn] = useState(params.endsOn ?? toDateString(new Date(Date.now() + 864e5)));
  const [picked, setPicked] = useState<SectionKey[]>([]);
  const [kidIds, setKidIds] = useState<string[]>([]);
  const [petIds, setPetIds] = useState<string[]>([]);
  const [showSick, setShowSick] = useState(false);
  const [quick, setQuick] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (ready || !data) return;
    if (!sections.some((s) => sectionFilled(data.sheet, s.key)) && !data.kids.length && !data.pets.length) return;
    // Everything you've filled in except codes, to start; kids and pets stay off.
    setPicked(sections.filter((s) => s.key !== "codes" && sectionFilled(data.sheet, s.key)).map((s) => s.key));
    setReady(true);
  }, [data, ready]);

  if (!data) return <LoadingScreen cards={2} />;

  // A link shows parts of the sheet. With nothing written (and no kids or
  // pets to show), say so and point to the sheet instead of an empty form.
  if (!sections.some((s) => sectionFilled(data.sheet, s.key)) && !data.kids.length && !data.pets.length) {
    return (
      <NookScroll>
        <EmptyState
          icon="sitter"
          title="Write your sheet first"
          body="A link shows parts of your Sitter Sheet, and yours is empty so far. Fill in what a sitter needs (emergency numbers, your address, bedtime, the Wi-Fi), then come back here to make the link."
        />
        <Button title="Fill in the sheet" icon="edit" onPress={() => router.push("/sitter/edit")} />
        <Text style={ui.muted}>You only write it once. Each link after that just picks the days and which parts to show.</Text>
      </NookScroll>
    );
  }
  if (!ready) return <LoadingScreen cards={2} />;

  const toggle = <T,>(list: T[], item: T) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);
  const filled = sections.filter((s) => sectionFilled(data.sheet, s.key));
  const unwritten = sections.filter((s) => !sectionFilled(data.sheet, s.key));
  const allKids = data.kids.map((k) => k.id);
  const allPets = data.pets.map((p) => p.id);
  const past = pastSitters(data.links);

  function pickPreset(key: PresetKey) {
    tap();
    const picks = applyPreset(key, data!.sheet, allKids, allPets);
    setPicked(picks.sections);
    setKidIds(picks.kidIds);
    setPetIds(picks.petIds);
    setQuick(key);
  }

  function pickLast(link: SitterLink) {
    tap();
    const picks = reusePicks(link, allKids, allPets);
    setPicked(picks.sections.filter((s) => sectionFilled(data!.sheet, s)));
    setKidIds(picks.kidIds);
    setPetIds(picks.petIds);
    setShowSick(!!link.show_sick);
    setLabel(link.label);
    setQuick(link.id);
  }

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
        show_sick: showSick && kidIds.length > 0,
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

      <SectionHeader title="Quick start" icon="sparkles" />
      <View style={ui.chips}>
        {presets.map((p) => (
          <Chip key={p.key} icon={p.icon} selected={quick === p.key} onPress={() => pickPreset(p.key)}>
            {p.label}
          </Chip>
        ))}
      </View>
      {past.length ? (
        <>
          <Text style={ui.label}>Same as last time</Text>
          <View style={ui.chips}>
            {past.map((l) => (
              <Chip key={l.id} icon="undo" selected={quick === l.id} onPress={() => pickLast(l)}>
                {l.label}
              </Chip>
            ))}
          </View>
        </>
      ) : null}
      <Text style={ui.muted}>Fills in the picks below. You can still change any of them.</Text>

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
      {unwritten.length ? (
        <Text style={ui.muted}>
          Not on your sheet yet, so they can't go on a link: {unwritten.map((s) => s.label).join(", ")}.{" "}
          <Text style={ui.link} onPress={() => router.push("/sitter/edit")}>
            Add to the sheet
          </Text>
        </Text>
      ) : null}
      {picked.includes("codes") ? (
        <Text style={[ui.muted, { color: colors.error }]}>
          Door and alarm codes are on this link. Anyone with the link can see them until it ends, so only send it to someone you'd give a key to.
        </Text>
      ) : sectionFilled(data.sheet, "codes") ? (
        <Text style={ui.muted}>Door and alarm codes stay off unless you tick them.</Text>
      ) : null}

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
          {kidIds.length ? (
            <>
              <Chip icon="sick" selected={showSick} onPress={() => setShowSick(!showSick)}>
                Sick day: medicine and next dose
              </Chip>
              <Text style={ui.muted}>
                While a kid you ticked is sick (Sick Day Nook), the sitter sees what it is, the latest temperature, and each medicine with when
                the next dose is OK. They can't log anything; they text you. Off unless you tick it.
              </Text>
            </>
          ) : null}
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
