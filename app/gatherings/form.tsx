import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Switch, View } from "react-native";

import { DateField } from "../../components/date-field";
import { GuestPicker } from "../../components/guest-picker";
import { IconBadge, type IconName } from "../../components/icon";
import { useLeaveGuard } from "../../components/leave-guard";
import { LoadingScreen } from "../../components/motion";
import { NookScroll } from "../../components/nook-scroll";
import { Text, TextInput } from "../../components/text";
import { Button, Chip, SectionHeader } from "../../components/ui";
import { useAuth } from "../../lib/auth-context";
import { friendlyError, tap } from "../../lib/feedback";
import { defaultTitle, invitedIds, whenFields } from "../../lib/gatherings";
import { loadPickerBurrows, planGathering, updateGathering, type PickerBurrow } from "../../lib/gatherings-data";
import { countdown, displayName, gatheringKindInfo, gatheringKinds, type GatheringKind } from "../../lib/gift-nook";
import type { Profile } from "../../lib/gift-nook";
import { supabase } from "../../lib/supabase";
import { colors, ui } from "../../lib/theme";

// Plan or change a Gathering (GATH-002..007): what kind, when and where, who's
// invited (whole Burrows and/or people picked one by one, GATH-003), whether
// it has gift lists (the Gift Nook) and a Potluck (GATH-004), who it's for,
// and who co-hosts.
//   ?gatheringId=…  change one (hosts only — the database checks)
//   ?burrowId=…     start with that Burrow invited
//   ?gifts=1        start with gift lists on (from the Gift Nook)
//   ?food=1         start with a Potluck on (from the Potluck Nook); after
//                   planning, opens the Potluck to list what's needed
export default function GatheringForm() {
  const router = useRouter();
  const params = useLocalSearchParams<{ gatheringId?: string; burrowId?: string; gifts?: string; food?: string }>();
  const editing = Boolean(params.gatheringId);
  const { session } = useAuth();
  const userId = session?.user.id ?? "";

  const startKind: GatheringKind = params.food ? "dinner" : params.gifts ? "christmas" : "party";
  const [burrows, setBurrows] = useState<PickerBurrow[]>([]);
  const [kind, setKind] = useState<GatheringKind>(startKind);
  const [title, setTitle] = useState("");
  const [day, setDay] = useState(() => defaultDay(startKind));
  const [time, setTime] = useState<Date | null>(() => (params.food ? defaultTime() : null));
  const [place, setPlace] = useState("");
  const [notes, setNotes] = useState("");
  const [gifts, setGifts] = useState(Boolean(params.gifts) || gatheringKindInfo(startKind).gifts);
  const [food, setFood] = useState(Boolean(params.food) || gatheringKindInfo(startKind).food);
  // Set once someone flips gifts/food themselves, so picking a kind stops changing them.
  const [extrasTouched, setExtrasTouched] = useState(Boolean(params.gifts || params.food));
  const [hasPotluck, setHasPotluck] = useState(false);
  const [burrowIds, setBurrowIds] = useState<Set<string>>(new Set(params.burrowId ? [params.burrowId] : []));
  const [personIds, setPersonIds] = useState<Set<string>>(new Set());
  const [honorees, setHonorees] = useState<Set<string>>(new Set());
  const [cohosts, setCohosts] = useState<Set<string>>(new Set());
  // Hosts are always on the guest list, even if no Burrow or pick covers them.
  const [originalHosts, setOriginalHosts] = useState<string[]>([]);
  // Burrows and people another host invited that you can't see.
  const [hiddenBurrows, setHiddenBurrows] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { allowLeave } = useLeaveGuard(
    { kind, title, day, time, place, notes, gifts, food, burrowIds: [...burrowIds], personIds: [...personIds], honorees: [...honorees], cohosts: [...cohosts] },
    !isLoading
  );

  useEffect(() => {
    (async () => {
      try {
        const mine = await loadPickerBurrows();
        setBurrows(mine);
        if (params.gatheringId) {
          const id = params.gatheringId;
          const [row, invitedBurrows, guests, honoreeRows, hostRows, potlucks] = await Promise.all([
            supabase.from("gatherings").select("title, kind, ends_at, starts_at, place, notes, gifts").eq("id", id).single(),
            supabase.from("gathering_burrows").select("burrow_id").eq("gathering_id", id),
            supabase.from("gathering_guests").select("profile_id").eq("gathering_id", id),
            supabase.from("gathering_honorees").select("profile_id").eq("gathering_id", id),
            supabase.from("gathering_hosts").select("profile_id").eq("gathering_id", id),
            supabase.from("potlucks").select("id").eq("gathering_id", id).limit(1),
          ]);
          if (row.data) {
            setTitle(row.data.title);
            setKind(row.data.kind as GatheringKind);
            const at = new Date(row.data.starts_at ?? row.data.ends_at);
            setDay(at);
            setTime(row.data.starts_at ? at : null);
            setPlace(row.data.place ?? "");
            setNotes(row.data.notes ?? "");
            setGifts(Boolean(params.gifts) || row.data.gifts);
          }
          const invited = (invitedBurrows.data ?? []).map((b) => b.burrow_id as string);
          setBurrowIds(new Set(invited));
          setHiddenBurrows(invited.filter((b) => !mine.some((m) => m.id === b)).length);
          setPersonIds(new Set((guests.data ?? []).map((g) => g.profile_id as string)));
          setHonorees(new Set((honoreeRows.data ?? []).map((h) => h.profile_id as string)));
          const hostIds = (hostRows.data ?? []).map((h) => h.profile_id as string);
          setCohosts(new Set(hostIds));
          setOriginalHosts(hostIds);
          setHasPotluck(Boolean(potlucks.data?.length));
          setFood(Boolean(potlucks.data?.length));
          setExtrasTouched(true);
        } else if (!params.burrowId && mine.length === 1) {
          setBurrowIds(new Set([mine[0].id]));
        }
      } catch (error) {
        Alert.alert("Couldn't open that", friendlyError(error as { message?: string }));
      } finally {
        setIsLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isLoading) return <LoadingScreen cards={3} />;

  const kindInfo = gatheringKindInfo(kind);
  // Everyone you can see who's invited, for "who's it for" and co-hosts.
  const people = new Map<string, Profile>();
  for (const burrow of burrows) for (const member of burrow.members) people.set(member.id, member);
  const invited = invitedIds(burrowIds, personIds, (id) => burrows.find((b) => b.id === id)?.members.map((m) => m.id) ?? []);
  invited.add(userId);
  for (const host of originalHosts) invited.add(host);
  const invitedPeople = [...invited]
    .map((id) => people.get(id))
    .filter((p): p is Profile => Boolean(p))
    .sort((a, b) => displayName(a).localeCompare(displayName(b)));
  const nameOf = (p: Profile) => (p.id === userId ? "You" : displayName(p));

  function pickKind(next: GatheringKind) {
    tap();
    setKind(next);
    if (editing) return;
    setDay(defaultDay(next));
    if (!extrasTouched) {
      setGifts(gatheringKindInfo(next).gifts);
      setFood(gatheringKindInfo(next).food);
    }
  }

  function toggle(set: Set<string>, id: string, save: (next: Set<string>) => void) {
    tap();
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    save(next);
  }

  async function save() {
    if (!burrowIds.size && !personIds.size) {
      return Alert.alert("Who's invited?", "Pick a Burrow, or at least one person.");
    }
    const honoreeNames = invitedPeople.filter((p) => honorees.has(p.id)).map((p) => displayName(p));
    const when = whenFields(day, time);
    // Honorees and co-hosts who are no longer invited drop off.
    const keep = (set: Set<string>) => [...set].filter((id) => invited.has(id) || !people.has(id));
    const input = {
      title: title.trim() || defaultTitle(kindInfo.label, honoreeNames),
      kind,
      ...when,
      place,
      notes,
      gifts,
      burrowIds: [...burrowIds],
      guestIds: [...personIds],
      honoreeIds: gifts ? keep(honorees) : [],
      cohostIds: editing ? keep(cohosts) : keep(cohosts).filter((id) => id !== userId),
    };
    setSaving(true);
    try {
      if (params.gatheringId) {
        await updateGathering(params.gatheringId, input);
        let potluckId: string | null = null;
        if (food && !hasPotluck) {
          const { data, error } = await supabase.rpc("add_potluck", { target_gathering: params.gatheringId });
          if (error) throw error;
          potluckId = data as string;
        }
        tap("success");
        allowLeave();
        if (potluckId) router.replace({ pathname: "/potluck/form", params: { potluckId } });
        else router.back();
      } else {
        const id = await planGathering(input, food);
        tap("success");
        allowLeave();
        if (food && params.food) {
          const { data } = await supabase.from("potlucks").select("id").eq("gathering_id", id).limit(1);
          const potluckId = data?.[0]?.id as string | undefined;
          if (potluckId) return router.replace({ pathname: "/potluck/form", params: { potluckId } });
        }
        router.replace(`/gatherings/${id}`);
      }
    } catch (error) {
      Alert.alert("Couldn't save it", friendlyError(error as { message?: string }));
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete() {
    Alert.alert(`Delete ${title || "this Gathering"}?`, "Everyone's answers go with it, and its Potluck if it has one. Wishbooks and tucks aren't affected.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase.from("gatherings").delete().eq("id", params.gatheringId!);
          if (error) return Alert.alert("Couldn't delete it", friendlyError(error));
          allowLeave();
          router.dismissTo("/gatherings");
        },
      },
    ]);
  }

  return (
    <NookScroll>
      <Stack.Screen options={{ title: editing ? "Change Gathering" : "Plan a Gathering" }} />

      <Text style={ui.label}>What kind?</Text>
      <View style={ui.chips}>
        {gatheringKinds.map((k) => (
          <Chip key={k.key} icon={k.icon} selected={k.key === kind} onPress={() => pickKind(k.key)}>
            {k.label}
          </Chip>
        ))}
      </View>

      <Text style={ui.label}>Name</Text>
      <TextInput
        style={ui.input}
        value={title}
        onChangeText={setTitle}
        placeholder={`e.g. ${kind === "game_night" ? "Game night at Sam's" : kind === "dinner" ? "Sunday dinner" : kindInfo.label}`}
        placeholderTextColor={colors.muted}
        maxLength={120}
      />
      <Text style={ui.muted}>Leave it blank and we'll name it for you.</Text>

      <Text style={ui.label}>When</Text>
      <View style={[ui.row, { gap: 10, flexWrap: "wrap" }]}>
        <DateField mode="date" value={day} onChange={setDay} />
        {time ? <DateField mode="time" value={time} onChange={setTime} /> : null}
        <Text style={ui.muted}>{countdown(whenFields(day, null).ends_at)}</Text>
      </View>
      <View style={[ui.row, { justifyContent: "space-between" }]}>
        <Text style={{ color: colors.text, fontSize: 15 }}>Set a time</Text>
        <Switch
          value={Boolean(time)}
          onValueChange={(on) => {
            tap();
            setTime(on ? defaultTime() : null);
          }}
          trackColor={{ true: colors.bark }}
        />
      </View>

      <Text style={ui.label}>Where (optional)</Text>
      <TextInput
        style={ui.input}
        value={place}
        onChangeText={setPlace}
        placeholder="e.g. Grandma's house"
        placeholderTextColor={colors.muted}
        maxLength={120}
      />

      <Text style={ui.label}>Notes (optional)</Text>
      <TextInput
        style={[ui.input, { minHeight: 70, textAlignVertical: "top" }]}
        value={notes}
        onChangeText={setNotes}
        placeholder="Bring a chair, the game starts at 7…"
        placeholderTextColor={colors.muted}
        multiline
        maxLength={500}
      />

      <SectionHeader title="Who's invited" icon="invite" />
      <GuestPicker
        burrows={burrows}
        burrowIds={burrowIds}
        personIds={personIds}
        meId={userId}
        onChange={(nextBurrows, nextPeople) => {
          setBurrowIds(nextBurrows);
          setPersonIds(nextPeople);
        }}
      />
      {hiddenBurrows ? (
        <Text style={ui.muted}>
          Also invited: {hiddenBurrows} Burrow{hiddenBurrows === 1 ? "" : "s"} you're not in (another host added {hiddenBurrows === 1 ? "it" : "them"}).
        </Text>
      ) : null}

      <SectionHeader title="What's part of it" icon="sparkles" />
      <Extra
        icon="gift"
        color="#a5532f"
        background="#f6d9c4"
        title="Gift lists"
        body="Shows in the Gift Nook with Wishbooks, so people can tuck gifts without doubling up."
        value={gifts}
        onChange={(on) => {
          tap();
          setExtrasTouched(true);
          setGifts(on);
        }}
      />
      <Extra
        icon="potluck"
        color="#4f6b45"
        background="#dfe8d6"
        title="Potluck"
        body={hasPotluck ? "It has one. To stop it, open the Potluck and delete it there." : "Who's bringing what to eat, with allergy warnings."}
        value={food}
        disabled={hasPotluck}
        onChange={(on) => {
          tap();
          setExtrasTouched(true);
          setFood(on);
        }}
      />

      {gifts ? (
        <>
          <Text style={ui.label}>Who's it for? (optional)</Text>
          <Text style={ui.muted}>Their Wishbooks are the ones it shows. Leave it blank for everyone, like Christmas.</Text>
          <View style={ui.chips}>
            {invitedPeople.map((person) => (
              <Chip key={person.id} selected={honorees.has(person.id)} onPress={() => toggle(honorees, person.id, setHonorees)}>
                {nameOf(person)}
              </Chip>
            ))}
          </View>
        </>
      ) : null}

      {invitedPeople.some((p) => p.id !== userId && !p.is_managed) ? (
        <>
          <Text style={ui.label}>Co-hosts (optional)</Text>
          <Text style={ui.muted}>Hosts can change the Gathering and its Potluck. {editing ? "" : "You're a host already."}</Text>
          <View style={ui.chips}>
            {invitedPeople
              .filter((p) => !p.is_managed && (editing || p.id !== userId))
              .map((person) => (
                <Chip key={person.id} icon={cohosts.has(person.id) ? "check" : "person"} selected={cohosts.has(person.id)} onPress={() => toggle(cohosts, person.id, setCohosts)}>
                  {nameOf(person)}
                </Chip>
              ))}
          </View>
        </>
      ) : null}

      <Button
        title={editing ? "Save" : "Plan it"}
        icon={editing ? "check" : "celebration"}
        onPress={save}
        loading={saving}
        style={{ marginTop: 8 }}
      />
      {editing ? <Button title="Delete this Gathering" icon="trash" variant="danger" onPress={confirmDelete} /> : null}
    </NookScroll>
  );
}

function Extra({
  icon,
  color,
  background,
  title,
  body,
  value,
  disabled,
  onChange,
}: {
  icon: IconName;
  color: string;
  background: string;
  title: string;
  body: string;
  value: boolean;
  disabled?: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <View style={[ui.card, ui.row, { gap: 12 }]}>
      <IconBadge name={icon} size={40} color={color} background={background} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={ui.cardTitle}>{title}</Text>
        <Text style={ui.muted}>{body}</Text>
      </View>
      <Switch value={value} disabled={disabled} onValueChange={onChange} trackColor={{ true: colors.bark }} />
    </View>
  );
}

// Christmas starts on the next Christmas Day; anything else a couple of weeks out.
function defaultDay(kind: GatheringKind) {
  const now = new Date();
  if (kind === "christmas") {
    const thisYear = new Date(now.getFullYear(), 11, 25);
    return now > new Date(now.getFullYear(), 11, 25, 23, 59) ? new Date(now.getFullYear() + 1, 11, 25) : thisYear;
  }
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 14);
}

// 5pm: a reasonable start for most get-togethers.
function defaultTime() {
  const date = new Date();
  date.setHours(17, 0, 0, 0);
  return date;
}
