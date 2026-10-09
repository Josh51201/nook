import { Redirect, Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useLeaveGuard } from "../../components/leave-guard";
import { useEffect, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { Text, TextInput } from "../../components/text";

import { Icon } from "../../components/icon";
import { LoadingScreen, Tap } from "../../components/motion";
import { NookScroll } from "../../components/nook-scroll";
import { Button, Chip, NavCard, SectionHeader } from "../../components/ui";
import { friendlyError, tap } from "../../lib/feedback";
import { addPotluck } from "../../lib/gatherings-data";
import { slotIdeas } from "../../lib/potluck";
import { supabase } from "../../lib/supabase";
import { colors, themed, ui } from "../../lib/theme";

type SlotDraft = { id?: string; key: string; label: string; wanted: number };

let draftKey = 0;
const newKey = () => `draft-${draftKey++}`;

// A Potluck is the food part of a Gathering (GATH-004): its name, day, place
// and who's invited are the Gathering's. So:
//   (no params) / ?burrowId=…  plan a new Gathering with a Potluck
//   ?gatheringId=…             add a Potluck to that Gathering (hosts)
//   ?potluckId=…               what's needed: the spots (hosts — the database checks)
export default function PotluckForm() {
  const params = useLocalSearchParams<{ burrowId?: string; gatheringId?: string; potluckId?: string }>();
  if (params.potluckId) return <SpotsForm potluckId={params.potluckId} />;
  if (params.gatheringId) return <AddToGathering gatheringId={params.gatheringId} />;
  return (
    <Redirect href={{ pathname: "/gatherings/form", params: { food: "1", ...(params.burrowId ? { burrowId: params.burrowId } : {}) } }} />
  );
}

function AddToGathering({ gatheringId }: { gatheringId: string }) {
  const router = useRouter();
  useEffect(() => {
    addPotluck(gatheringId)
      .then((potluckId) => router.replace({ pathname: "/potluck/form", params: { potluckId } }))
      .catch((error) => {
        Alert.alert("Couldn't add a Potluck", friendlyError(error as { message?: string }));
        router.back();
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <LoadingScreen cards={2} />;
}

// What's needed (POT-003): the spots people can sign up for.
function SpotsForm({ potluckId }: { potluckId: string }) {
  const router = useRouter();
  const [gatheringId, setGatheringId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [slots, setSlots] = useState<SlotDraft[]>([]);
  const [removedSlots, setRemovedSlots] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // Leaving with unsaved changes asks first (CORE-075).
  const { allowLeave } = useLeaveGuard({ slots, removedSlots }, !isLoading);

  useEffect(() => {
    (async () => {
      const [{ data: potluck }, { data: existingSlots }] = await Promise.all([
        supabase.from("potlucks").select("gathering_id, title").eq("id", potluckId).single(),
        supabase.from("potluck_slots").select("id, label, wanted").eq("potluck_id", potluckId).order("position"),
      ]);
      if (potluck) {
        setGatheringId(potluck.gathering_id);
        setTitle(potluck.title);
      }
      setSlots((existingSlots ?? []).map((slot) => ({ ...slot, key: slot.id })));
      setIsLoading(false);
    })();
  }, [potluckId]);

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
    setSaving(true);
    try {
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
      router.replace(`/potluck/${potluckId}`);
    } catch (error) {
      Alert.alert("Couldn't save the Potluck", friendlyError(error as { message?: string }));
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete() {
    Alert.alert(`Stop the Potluck for ${title || "this Gathering"}?`, "Everyone's dishes go with it. The Gathering and everyone's answers stay.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete the Potluck",
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase.from("potlucks").delete().eq("id", potluckId);
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
      <Stack.Screen options={{ title: "What's needed" }} />

      {gatheringId ? (
        <NavCard
          icon="celebration"
          iconColor="#9a5b1c"
          iconBackground="#f3e3c8"
          title={title}
          subtitle="Change the name, day, place or who's invited on the Gathering"
          onPress={() => router.push({ pathname: "/gatherings/form", params: { gatheringId } })}
        />
      ) : null}

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

      <Button title="Save" icon="check" onPress={save} loading={saving} style={{ marginTop: 8 }} />
      <Button title="Delete this Potluck" icon="trash" variant="danger" onPress={confirmDelete} />
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
