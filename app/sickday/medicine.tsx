import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, View } from "react-native";

import { useLeaveGuard } from "../../components/leave-guard";
import { LoadingScreen, Tap } from "../../components/motion";
import { NookScroll } from "../../components/nook-scroll";
import { Text, TextInput } from "../../components/text";
import { Button, Chip } from "../../components/ui";
import { useAuth } from "../../lib/auth-context";
import { friendlyError, tap } from "../../lib/feedback";
import { gapChoices, ingredientLabel, ingredientPicks, normalizeIngredient, perDayChoices } from "../../lib/sickday";
import { useSickDay } from "../../lib/sickday-data";
import { supabase } from "../../lib/supabase";
import { colors, ui } from "../../lib/theme";

// Add or change a medicine in the cabinet (SICK-005): its name, what's in it,
// the dose and hours between doses you were told, the most a day, and whether
// it's one person's own.
export default function MedicineForm() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { session } = useAuth();
  const userId = session?.user.id;
  const { data } = useSickDay(userId);
  const existing = data?.medicines.find((m) => m.id === id);

  const [ready, setReady] = useState(false);
  const [name, setName] = useState("");
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [typedIngredient, setTypedIngredient] = useState("");
  const [amount, setAmount] = useState("");
  const [every, setEvery] = useState("");
  const [perDay, setPerDay] = useState("");
  const [forProfile, setForProfile] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const { allowLeave } = useLeaveGuard({ name, ingredients, amount, every, perDay, forProfile, notes }, ready);

  useEffect(() => {
    if (ready || !data) return;
    if (id && !existing) return;
    if (existing) {
      setName(existing.name);
      setIngredients(existing.ingredients);
      setAmount(existing.amount ?? "");
      setEvery(existing.every_hours ? String(existing.every_hours) : "");
      setPerDay(existing.max_per_day ? String(existing.max_per_day) : "");
      setForProfile(existing.for_profile);
      setNotes(existing.notes ?? "");
    }
    setReady(true);
  }, [data, existing, id, ready]);

  if (!data || !ready) return <LoadingScreen cards={2} />;

  function toggleIngredient(key: string) {
    tap();
    setIngredients((list) => (list.includes(key) ? list.filter((i) => i !== key) : [...list, key].slice(0, 6)));
  }

  function addTyped() {
    const key = normalizeIngredient(typedIngredient);
    if (key.length >= 2 && !ingredients.includes(key)) setIngredients((list) => [...list, key].slice(0, 6));
    setTypedIngredient("");
  }

  async function save() {
    if (!name.trim()) return Alert.alert("What is it?", "Like “Children's Tylenol”.");
    const hours = every.trim() ? Number(every.replace(",", ".")) : null;
    if (hours != null && (!Number.isFinite(hours) || hours < 0.5 || hours > 72)) {
      return Alert.alert("Hours between doses", "A number of hours from 0.5 to 72, like 4 or 6.");
    }
    const most = perDay.trim() ? Number(perDay) : null;
    if (most != null && (!Number.isInteger(most) || most < 1 || most > 24)) return Alert.alert("Most a day", "A whole number from 1 to 24.");
    const typed = normalizeIngredient(typedIngredient);
    const all = typed.length >= 2 && !ingredients.includes(typed) ? [...ingredients, typed].slice(0, 6) : ingredients;

    setSaving(true);
    const row = {
      name: name.trim(),
      ingredients: all,
      amount: amount.trim() || null,
      every_hours: hours == null ? null : Math.round(hours * 10) / 10,
      max_per_day: most,
      for_profile: forProfile,
      notes: notes.trim() || null,
    };
    const { error } = existing
      ? await supabase.from("sick_medicines").update(row).eq("id", existing.id)
      : await supabase.from("sick_medicines").insert({ ...row, home_id: data!.homeId });
    if (error) {
      setSaving(false);
      return Alert.alert("Couldn't save", friendlyError(error));
    }
    tap("success");
    allowLeave();
    router.back();
  }

  function confirmDelete() {
    Alert.alert(`Remove ${existing!.name}?`, "Doses already given stay in each sick day's history.", [
      { text: "Keep it", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase.from("sick_medicines").delete().eq("id", existing!.id);
          if (error) return Alert.alert("Couldn't remove it", friendlyError(error));
          allowLeave();
          router.back();
        },
      },
    ]);
  }

  return (
    <NookScroll>
      <Stack.Screen
        options={{
          title: existing ? "Change medicine" : "New medicine",
          headerRight: () => (
            <Tap onPress={save} disabled={saving} hitSlop={10}>
              <Text style={{ color: colors.bark, fontSize: 17, fontWeight: "700" }}>Save</Text>
            </Tap>
          ),
        }}
      />

      <TextInput
        style={ui.input}
        value={name}
        onChangeText={setName}
        placeholder="What is it? e.g. Children's Tylenol"
        placeholderTextColor={colors.muted}
        maxLength={60}
      />

      <Text style={ui.label}>What's in it</Text>
      <View style={ui.chips}>
        {[...ingredientPicks.map((i) => i.key), ...ingredients.filter((k) => !ingredientPicks.some((i) => i.key === k))].map((key) => (
          <Chip key={key} selected={ingredients.includes(key)} onPress={() => toggleIngredient(key)}>
            {ingredientLabel(key)}
          </Chip>
        ))}
      </View>
      <TextInput
        style={ui.input}
        value={typedIngredient}
        onChangeText={setTypedIngredient}
        onSubmitEditing={addTyped}
        placeholder="Something else in it"
        placeholderTextColor={colors.muted}
        maxLength={40}
        returnKeyType="done"
      />
      <Text style={ui.muted}>
        On the label under “Active ingredients”. Medicines sharing one count together, so you can't double up by giving two different ones.
        {ingredients.length ? "" : " (Tylenol, NyQuil and many cold medicines are all acetaminophen.)"}
      </Text>

      <Text style={ui.label}>Dose</Text>
      <TextInput
        style={ui.input}
        value={amount}
        onChangeText={setAmount}
        placeholder="e.g. 5 mL, 1 tablet"
        placeholderTextColor={colors.muted}
        maxLength={40}
      />

      <Text style={ui.label}>Hours between doses</Text>
      <View style={ui.chips}>
        {gapChoices.map((h) => (
          <Chip key={h} selected={every === String(h)} onPress={() => setEvery(every === String(h) ? "" : String(h))}>
            {`Every ${h} h`}
          </Chip>
        ))}
      </View>
      <TextInput
        style={ui.input}
        value={every}
        onChangeText={setEvery}
        placeholder="Or type it, e.g. 4"
        placeholderTextColor={colors.muted}
        keyboardType="decimal-pad"
        maxLength={4}
      />

      <Text style={ui.label}>The most in 24 hours</Text>
      <View style={ui.chips}>
        <Chip selected={!perDay} onPress={() => setPerDay("")}>
          Not set
        </Chip>
        {perDayChoices.map((n) => (
          <Chip key={n} selected={perDay === String(n)} onPress={() => setPerDay(String(n))}>
            {`${n} a day`}
          </Chip>
        ))}
      </View>

      <Text style={ui.label}>Whose</Text>
      <View style={ui.chips}>
        <Chip selected={!forProfile} onPress={() => setForProfile(null)}>
          Anyone's
        </Chip>
        {data.homePeople.map((p) => (
          <Chip key={p.id} icon={p.isKid ? "kid" : "person"} selected={forProfile === p.id} onPress={() => setForProfile(p.id)}>
            {p.id === userId ? "Mine" : p.name.split(" ")[0]}
          </Chip>
        ))}
      </View>
      <Text style={ui.muted}>
        Pick someone when it's their own dose (a kid's weight-based dose, or a prescription). It's then only offered for them.
      </Text>

      <Text style={ui.label}>Notes</Text>
      <TextInput
        style={[ui.input, { minHeight: 70, textAlignVertical: "top" }]}
        value={notes}
        onChangeText={setNotes}
        placeholder="e.g. With food. Finish the whole bottle."
        placeholderTextColor={colors.muted}
        maxLength={300}
        multiline
      />

      <Text style={[ui.muted, { fontSize: 12 }]}>
        Copy these from the label or what the doctor said. Nook never works out a dose; it only counts.
      </Text>
      <Button title="Save" icon="check" onPress={save} loading={saving} />
      {existing ? <Button title="Remove from the cabinet" icon="trash" variant="danger" onPress={confirmDelete} /> : null}
    </NookScroll>
  );
}
