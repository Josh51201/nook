import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Text, TextInput, View } from "react-native";

import { Icon } from "../../components/icon";
import { LoadingScreen } from "../../components/motion";
import { NookScroll } from "../../components/nook-scroll";
import { Button, Chip, EmptyState } from "../../components/ui";
import { useAuth } from "../../lib/auth-context";
import { friendlyError, tap } from "../../lib/feedback";
import { allergens, dishWarnings, otherContents, slotRoom } from "../../lib/potluck";
import { loadPotluck, type PotluckData } from "../../lib/potluck-data";
import { supabase } from "../../lib/supabase";
import { colors, ui } from "../../lib/theme";

// Sign up to bring something, or change what you're bringing (POT-003/004).
// As you tag what's in it, any clash with someone coming shows straight
// away (POT-005).
//   ?potluckId=…&slotId=…  bring something for that spot
//   ?potluckId=…&dishId=…  edit your dish
export default function DishForm() {
  const router = useRouter();
  const params = useLocalSearchParams<{ potluckId: string; slotId?: string; dishId?: string }>();
  const { session } = useAuth();
  const userId = session?.user.id;

  const [data, setData] = useState<PotluckData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [name, setName] = useState("");
  const [slotId, setSlotId] = useState<string | null>(params.slotId ?? null);
  const [tags, setTags] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!userId) return;
    loadPotluck(params.potluckId, userId)
      .then((loaded) => {
        setData(loaded);
        const dish = loaded?.dishes.find((d) => d.id === params.dishId);
        if (dish) {
          setName(dish.name);
          setSlotId(dish.slot_id);
          setTags(dish.tags);
          setNote(dish.note ?? "");
        }
      })
      .catch((error: Error) => Alert.alert("Couldn't load the Potluck", error.message))
      .finally(() => setIsLoading(false));
  }, [params.potluckId, params.dishId, params.slotId, userId]);

  if (isLoading) return <LoadingScreen cards={2} />;
  if (!data || !userId) return <EmptyState icon="potluck" title="This Potluck isn't here" />;

  const editing = Boolean(params.dishId);
  const currentDish = data.dishes.find((d) => d.id === params.dishId);
  // Spots with room (plus the one this dish is already in).
  const openSlots = data.slots.filter(
    (slot) => !slotRoom(slot, data.dishes).full || slot.id === currentDish?.slot_id
  );
  const warnings = dishWarnings(tags, data.coming);

  function toggleTag(key: string) {
    tap();
    setTags((current) => (current.includes(key) ? current.filter((t) => t !== key) : [...current, key]));
  }

  async function save() {
    if (!name.trim()) return Alert.alert("What are you bringing?", "Give your dish a name.");
    setSaving(true);
    const fields = { name: name.trim(), slot_id: slotId, tags, note: note.trim() || null };
    const { error } = editing
      ? await supabase.from("potluck_dishes").update(fields).eq("id", params.dishId!)
      : await supabase.from("potluck_dishes").insert({ ...fields, potluck_id: params.potluckId, brought_by: userId });
    if (!error && !data!.rsvps.some((r) => r.profile_id === userId)) {
      // Bringing something means you're coming (proposed) — change it any time.
      await supabase
        .from("potluck_rsvps")
        .insert({ potluck_id: params.potluckId, profile_id: userId, status: "going" });
    }
    setSaving(false);
    if (error) return Alert.alert("Couldn't save your dish", friendlyError(error));
    tap("success");
    router.back();
  }

  function confirmRemove() {
    Alert.alert(`Not bringing ${name || "this"} any more?`, "It comes off the list for everyone.", [
      { text: "Keep it", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase.from("potluck_dishes").delete().eq("id", params.dishId!);
          if (error) Alert.alert("Couldn't remove it", friendlyError(error));
          else router.back();
        },
      },
    ]);
  }

  return (
    <NookScroll>
      <Stack.Screen options={{ title: editing ? "Your dish" : "Bring something" }} />
      <Text style={ui.muted}>For {data.potluck.title}</Text>

      <Text style={ui.label}>What are you bringing?</Text>
      <TextInput
        style={ui.input}
        value={name}
        onChangeText={setName}
        placeholder="e.g. Mashed potatoes"
        placeholderTextColor={colors.muted}
        maxLength={80}
        autoFocus={!editing}
      />

      {data.slots.length ? (
        <>
          <Text style={ui.label}>For which spot?</Text>
          <View style={ui.chips}>
            {openSlots.map((slot) => (
              <Chip
                key={slot.id}
                selected={slotId === slot.id}
                onPress={() => {
                  tap();
                  setSlotId(slot.id);
                }}
              >
                {slot.label}
              </Chip>
            ))}
            <Chip
              selected={!slotId}
              onPress={() => {
                tap();
                setSlotId(null);
              }}
            >
              Something extra
            </Chip>
          </View>
        </>
      ) : null}

      <Text style={ui.label}>What's in it?</Text>
      <Text style={ui.muted}>
        Tag anything people might need to know. Nook warns you if it clashes with someone coming.
      </Text>
      <View style={ui.chips}>
        {[...allergens, ...otherContents].map((tag) => (
          <Chip key={tag.key} selected={tags.includes(tag.key)} onPress={() => toggleTag(tag.key)}>
            {tag.label}
          </Chip>
        ))}
      </View>

      {warnings.length ? (
        <View style={{ backgroundColor: colors.rose, borderRadius: 16, padding: 14, gap: 6 }}>
          <View style={[ui.row, { gap: 8 }]}>
            <Icon name="warning" size={16} color={colors.heart} />
            <Text style={[ui.cardTitle, { color: colors.heart }]}>Heads up</Text>
          </View>
          {warnings.map((warning) => (
            <Text key={warning} style={{ color: colors.text, fontSize: 14 }}>
              {warning}.
            </Text>
          ))}
        </View>
      ) : null}

      <Text style={ui.label}>Note (optional)</Text>
      <TextInput
        style={ui.input}
        value={note}
        onChangeText={setNote}
        placeholder="e.g. Enough for 10, bringing a serving spoon"
        placeholderTextColor={colors.muted}
        maxLength={200}
      />

      <Button title={editing ? "Save" : "I'll bring it"} icon="check" onPress={save} loading={saving} />
      {editing ? <Button title="Not bringing it any more" icon="trash" variant="danger" onPress={confirmRemove} /> : null}
    </NookScroll>
  );
}
