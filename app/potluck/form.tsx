import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useLeaveGuard } from "../../components/leave-guard";
import { useEffect, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { Text, TextInput } from "../../components/text";

import { DateField } from "../../components/date-field";
import { Icon } from "../../components/icon";
import { LoadingScreen, Tap } from "../../components/motion";
import { NookScroll } from "../../components/nook-scroll";
import { Button, Chip, SectionHeader } from "../../components/ui";
import { useAuth } from "../../lib/auth-context";
import { friendlyError, tap } from "../../lib/feedback";
import { formatDate } from "../../lib/gift-nook";
import { slotIdeas } from "../../lib/potluck";
import { supabase } from "../../lib/supabase";
import { colors, themed, ui } from "../../lib/theme";

type SlotDraft = { id?: string; key: string; label: string; wanted: number };
type GatheringOption = { id: string; title: string; ends_at: string };

let draftKey = 0;
const newKey = () => `draft-${draftKey++}`;

// A week from now at 5pm: a reasonable starting point.
function defaultStart() {
  const date = new Date(Date.now() + 7 * 864e5);
  date.setHours(17, 0, 0, 0);
  return date;
}

// Plan or edit a Potluck (POT-002/003/008).
//   ?burrowId=…     start in that Burrow
//   ?gatheringId=…  plan one for that Gathering (from the Gift Nook)
//   ?potluckId=…    edit (hosts and co-hosts only — the database checks)
export default function PotluckForm() {
  const router = useRouter();
  const params = useLocalSearchParams<{ burrowId?: string; gatheringId?: string; potluckId?: string }>();
  const editing = Boolean(params.potluckId);
  const { session } = useAuth();
  const userId = session?.user.id;

  const [burrows, setBurrows] = useState<{ id: string; name: string }[]>([]);
  const [burrowId, setBurrowId] = useState<string | null>(params.burrowId ?? null);
  const [gatherings, setGatherings] = useState<GatheringOption[]>([]);
  const [gatheringId, setGatheringId] = useState<string | null>(params.gatheringId ?? null);
  const [title, setTitle] = useState("");
  const [startsAt, setStartsAt] = useState(defaultStart);
  const [place, setPlace] = useState("");
  const [notes, setNotes] = useState("");
  const [slots, setSlots] = useState<SlotDraft[]>([]);
  const [removedSlots, setRemovedSlots] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // Leaving with unsaved changes asks first (CORE-075).
  const { allowLeave } = useLeaveGuard({ burrowId, gatheringId, title, startsAt, place, notes, slots, removedSlots }, !isLoading);

  // First load: my Burrows, and whatever we're editing or planning for.
  useEffect(() => {
    (async () => {
      const { data: myBurrows } = await supabase.from("burrows").select("id, name").order("name");
      setBurrows(myBurrows ?? []);
      if (params.potluckId) {
        const [{ data: potluck }, { data: existingSlots }] = await Promise.all([
          supabase
            .from("potlucks")
            .select("burrow_id, gathering_id, title, starts_at, place, notes")
            .eq("id", params.potluckId)
            .single(),
          supabase.from("potluck_slots").select("id, label, wanted").eq("potluck_id", params.potluckId).order("position"),
        ]);
        if (potluck) {
          setBurrowId(potluck.burrow_id);
          setGatheringId(potluck.gathering_id);
          setTitle(potluck.title);
          setStartsAt(new Date(potluck.starts_at));
          setPlace(potluck.place ?? "");
          setNotes(potluck.notes ?? "");
        }
        setSlots((existingSlots ?? []).map((slot) => ({ ...slot, key: slot.id })));
      } else if (params.gatheringId) {
        const { data: gathering } = await supabase
          .from("gatherings")
          .select("burrow_id, title, ends_at")
          .eq("id", params.gatheringId)
          .single();
        if (gathering) {
          setBurrowId(gathering.burrow_id);
          pickGathering({ id: params.gatheringId, title: gathering.title, ends_at: gathering.ends_at });
        }
      } else if (!params.burrowId && myBurrows?.length === 1) {
        setBurrowId(myBurrows[0].id);
      }
      setIsLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Upcoming Gatherings in the chosen Burrow, to tie this Potluck to.
  useEffect(() => {
    if (!burrowId) return setGatherings([]);
    supabase
      .from("gatherings")
      .select("id, title, ends_at")
      .eq("burrow_id", burrowId)
      .gt("ends_at", new Date(Date.now() - 864e5).toISOString())
      .order("ends_at")
      .limit(8)
      .then(({ data }) => setGatherings(data ?? []));
  }, [burrowId]);

  function pickGathering(gathering: GatheringOption | null) {
    tap();
    setGatheringId(gathering?.id ?? null);
    if (!gathering) return;
    // Borrow its name and day (keeping the time), unless they've typed their own.
    setTitle((current) => (current.trim() && !gatherings.some((g) => g.title === current) ? current : gathering.title));
    setStartsAt((current) => {
      const day = new Date(gathering.ends_at);
      const next = new Date(current);
      next.setFullYear(day.getFullYear(), day.getMonth(), day.getDate());
      return next;
    });
  }

  function addSlot(label = "") {
    tap();
    setSlots((current) => [...current, { key: newKey(), label, wanted: 1 }]);
  }

  function changeSlot(key: string, changes: Partial<SlotDraft>) {
    setSlots((current) => current.map((slot) => (slot.key === key ? { ...slot, ...changes } : slot)));
  }

  function removeSlot(slot: SlotDraft) {
    tap();
    setSlots((current) => current.filter((s) => s.key !== slot.key));
    if (slot.id) setRemovedSlots((current) => [...current, slot.id!]);
  }

  async function save() {
    if (!burrowId) return Alert.alert("Pick a Burrow", "Everyone in it will be invited.");
    if (!title.trim()) return Alert.alert("Give it a name", "Like “Christmas dinner” or “Summer cookout”.");
    setSaving(true);
    const fields = {
      title: title.trim(),
      starts_at: startsAt.toISOString(),
      place: place.trim() || null,
      notes: notes.trim() || null,
      gathering_id: gatheringId,
    };
    try {
      let potluckId = params.potluckId;
      if (potluckId) {
        const { error } = await supabase.from("potlucks").update(fields).eq("id", potluckId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("potlucks")
          .insert({ ...fields, burrow_id: burrowId, created_by: userId })
          .select("id")
          .single();
        if (error) throw error;
        potluckId = data.id as string;
      }

      // Spots: drop removed ones (their dishes stay, as "also bringing"),
      // then save the rest in order.
      if (removedSlots.length) {
        const { error } = await supabase.from("potluck_slots").delete().in("id", removedSlots);
        if (error) throw error;
      }
      const kept = slots.filter((slot) => slot.label.trim());
      for (const [position, slot] of kept.entries()) {
        const row = { label: slot.label.trim(), wanted: slot.wanted, position };
        const { error } = slot.id
          ? await supabase.from("potluck_slots").update(row).eq("id", slot.id)
          : await supabase.from("potluck_slots").insert({ ...row, potluck_id: potluckId });
        if (error) throw error;
      }

      tap("success");
      allowLeave();
      if (editing) router.back();
      else router.replace(`/potluck/${potluckId}`);
    } catch (error) {
      Alert.alert("Couldn't save the Potluck", friendlyError(error as { message?: string }));
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete() {
    Alert.alert(`Delete ${title || "this Potluck"}?`, "Everyone's dishes and RSVPs go with it.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase.from("potlucks").delete().eq("id", params.potluckId!);
          if (error) Alert.alert("Couldn't delete it", friendlyError(error));
          else {
            allowLeave();
            router.dismissTo("/potluck");
          }
        },
      },
    ]);
  }

  if (isLoading) return <LoadingScreen cards={3} />;

  return (
    <NookScroll>
      <Stack.Screen options={{ title: editing ? "Edit Potluck" : "Plan a Potluck" }} />

      {!editing ? (
        <>
          <Text style={ui.label}>Who's invited</Text>
          {burrows.length === 0 ? (
            <Text style={ui.muted}>You're not in a Burrow yet — start or join one in the Burrows tab first.</Text>
          ) : (
            <View style={ui.chips}>
              {burrows.map((burrow) => (
                <Chip
                  key={burrow.id}
                  icon="burrow"
                  selected={burrowId === burrow.id}
                  onPress={() => {
                    tap();
                    setBurrowId(burrow.id);
                    setGatheringId(null);
                  }}
                >
                  {burrow.name}
                </Chip>
              ))}
            </View>
          )}
          <Text style={ui.muted}>Everyone in the Burrow can see it, RSVP and sign up to bring something.</Text>
        </>
      ) : null}

      {burrowId ? (
        <>
          <Text style={ui.label}>For a Gathering?</Text>
          <View style={ui.chips}>
            <Chip selected={!gatheringId} onPress={() => pickGathering(null)}>
              On its own
            </Chip>
            {gatherings.map((gathering) => (
              <Chip
                key={gathering.id}
                icon="calendar"
                selected={gatheringId === gathering.id}
                onPress={() => pickGathering(gathering)}
              >
                {`${gathering.title} · ${formatDate(gathering.ends_at)}`}
              </Chip>
            ))}
          </View>
        </>
      ) : null}

      <Text style={ui.label}>Name</Text>
      <TextInput
        style={ui.input}
        value={title}
        onChangeText={setTitle}
        placeholder="e.g. Christmas dinner"
        placeholderTextColor={colors.muted}
        maxLength={80}
      />

      <Text style={ui.label}>When</Text>
      <DateField mode="datetime" value={startsAt} onChange={setStartsAt} />

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
        style={[ui.input, { minHeight: 80, textAlignVertical: "top" }]}
        value={notes}
        onChangeText={setNotes}
        placeholder="Bring a chair, we're eating at 5…"
        placeholderTextColor={colors.muted}
        multiline
        maxLength={500}
      />

      <SectionHeader title="What's needed" icon="potluck" />
      <Text style={ui.muted}>
        List what you'd like people to bring. Anyone can still add something that isn't on the list.
      </Text>
      {slots.map((slot) => (
        <View key={slot.key} style={[ui.card, ui.row, { gap: 10 }]}>
          <TextInput
            style={[ui.input, { flex: 1, paddingVertical: 10 }]}
            value={slot.label}
            onChangeText={(label) => changeSlot(slot.key, { label })}
            placeholder="e.g. Side dish"
            placeholderTextColor={colors.muted}
            maxLength={60}
          />
          <Tap
            onPress={() => changeSlot(slot.key, { wanted: Math.max(1, slot.wanted - 1) })}
            disabled={slot.wanted <= 1}
            style={styles.stepper}
            hitSlop={6}
            accessibilityLabel="Need one fewer"
          >
            <Icon name="minus" size={14} />
          </Tap>
          <Text style={[ui.cardTitle, { minWidth: 18, textAlign: "center" }]}>{slot.wanted}</Text>
          <Tap
            onPress={() => changeSlot(slot.key, { wanted: Math.min(20, slot.wanted + 1) })}
            disabled={slot.wanted >= 20}
            style={styles.stepper}
            hitSlop={6}
            accessibilityLabel="Need one more"
          >
            <Icon name="add" size={14} />
          </Tap>
          <Tap onPress={() => removeSlot(slot)} hitSlop={10} accessibilityLabel={`Remove ${slot.label || "spot"}`}>
            <Icon name="close" size={16} color={colors.muted} />
          </Tap>
        </View>
      ))}
      <View style={ui.chips}>
        {slotIdeas
          .filter((idea) => !slots.some((slot) => slot.label === idea))
          .map((idea) => (
            <Chip key={idea} icon="add" onPress={() => addSlot(idea)}>
              {idea}
            </Chip>
          ))}
        <Chip icon="edit" onPress={() => addSlot()}>
          Something else
        </Chip>
      </View>

      <Button
        title={editing ? "Save" : "Plan it"}
        icon={editing ? "check" : "potluck"}
        onPress={save}
        loading={saving}
        style={{ marginTop: 8 }}
      />
      {editing ? <Button title="Delete this Potluck" icon="trash" variant="danger" onPress={confirmDelete} /> : null}
    </NookScroll>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    stepper: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.barkSoft,
      alignItems: "center",
      justifyContent: "center",
    },
  })
);
