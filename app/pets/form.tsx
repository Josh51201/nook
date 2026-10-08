import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, StyleSheet, Switch, View } from "react-native";
import Animated, { FadeIn, LinearTransition } from "react-native-reanimated";

import { DateField } from "../../components/date-field";
import { Icon } from "../../components/icon";
import { LoadingScreen, Tap } from "../../components/motion";
import { NookScroll } from "../../components/nook-scroll";
import { Text, TextInput } from "../../components/text";
import { Button, Chip, EmptyState, SectionHeader } from "../../components/ui";
import { useAuth } from "../../lib/auth-context";
import { friendlyError, tap } from "../../lib/feedback";
import { phoneTimeZone, speciesList, timeOfDayToDate, toTimeOfDay, type Species } from "../../lib/pets";
import { petPhotoUrls, removePetPhoto, uploadPetPhoto, usePets } from "../../lib/pets-data";
import { parseDateString, toDateString } from "../../lib/profile";
import { supabase } from "../../lib/supabase";
import { colors, ui } from "../../lib/theme";

type DraftMeal = { key: string; id?: string; label: string; remind: boolean; at: string };
let seed = 0;
const newKey = () => `m${++seed}`;

const starterMeals = (species: Species): DraftMeal[] =>
  species === "fish" || species === "reptile"
    ? [{ key: newKey(), label: "Feeding", remind: false, at: "18:00:00" }]
    : [
        { key: newKey(), label: "Breakfast", remind: false, at: "09:00:00" },
        { key: newKey(), label: "Dinner", remind: false, at: "19:00:00" },
      ];

// Add or change a pet (PET-003, PET-006): who they are, their records, and
// the meals that get checked off each day (with an optional nudge time).
export default function PetForm() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { session } = useAuth();
  const { data, isLoading } = usePets(session?.user.id);
  const existing = id ? data?.pets.find((p) => p.id === id) : undefined;

  const [ready, setReady] = useState(false);
  const [name, setName] = useState("");
  const [species, setSpecies] = useState<Species>("dog");
  const [breed, setBreed] = useState("");
  const [birthday, setBirthday] = useState<string | null>(null);
  const [microchip, setMicrochip] = useState("");
  const [vetName, setVetName] = useState("");
  const [vetPhone, setVetPhone] = useState("");
  const [food, setFood] = useState("");
  const [notes, setNotes] = useState("");
  const [meals, setMeals] = useState<DraftMeal[]>([]);
  const [photo, setPhoto] = useState<{ uri: string; mimeType?: string | null; isNew: boolean } | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (ready || !data || (id && !existing)) return;
    if (existing) {
      setName(existing.name);
      setSpecies(existing.species as Species);
      setBreed(existing.breed ?? "");
      setBirthday(existing.birthday);
      setMicrochip(existing.microchip ?? "");
      setVetName(existing.vet_name ?? "");
      setVetPhone(existing.vet_phone ?? "");
      setFood(existing.food ?? "");
      setNotes(existing.notes ?? "");
      setMeals(
        existing.pet_meals.map((m) => ({ key: newKey(), id: m.id, label: m.label, remind: Boolean(m.remind_at), at: m.remind_at ?? "18:00:00" }))
      );
      if (existing.photo_path) {
        petPhotoUrls([existing.photo_path]).then((urls) => {
          const uri = urls.get(existing.photo_path!);
          if (uri) setPhoto({ uri, isNew: false });
        });
      }
    } else {
      setMeals(starterMeals("dog"));
    }
    setReady(true);
  }, [data, existing, id, ready]);

  if (isLoading || !ready || !data) return id && data && !existing ? <EmptyState icon="paw" title="That pet isn't here" /> : <LoadingScreen cards={2} />;

  function pickSpecies(next: Species) {
    setSpecies(next);
    // Brand-new pet with untouched starter meals: suit them to the species.
    if (!existing && meals.every((m) => !m.id && !m.remind && ["Breakfast", "Dinner", "Feeding"].includes(m.label))) {
      setMeals(starterMeals(next));
    }
  }

  async function pickPhoto(from: "camera" | "library") {
    const permission =
      from === "camera" ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      return Alert.alert("Nook can't reach your " + (from === "camera" ? "camera" : "photos"), "You can allow it in your phone's Settings.");
    }
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 0.6, allowsEditing: true, aspect: [1, 1] };
    const result = from === "camera" ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    const asset = result.canceled ? null : result.assets[0];
    if (asset) {
      setPhoto({ uri: asset.uri, mimeType: asset.mimeType, isNew: true });
      setRemovePhoto(false);
    }
  }

  function choosePhoto() {
    Alert.alert("A picture of them", undefined, [
      { text: "Take a photo", onPress: () => pickPhoto("camera") },
      { text: "Choose from library", onPress: () => pickPhoto("library") },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  async function save() {
    if (!name.trim()) return Alert.alert("What's their name?", "Every pet needs one.");
    const kept = meals.filter((m) => m.label.trim());
    setSaving(true);
    try {
      const fields = {
        name: name.trim(),
        species,
        breed: breed.trim() || null,
        birthday,
        microchip: microchip.trim() || null,
        vet_name: vetName.trim() || null,
        vet_phone: vetPhone.trim() || null,
        food: food.trim() || null,
        notes: notes.trim() || null,
        tz: phoneTimeZone(),
      };
      let petId = id;
      if (existing) {
        const { error } = await supabase.from("pets").update(fields).eq("id", existing.id);
        if (error) throw error;
      } else {
        const homeId = data!.homeId ?? (await supabase.rpc("my_home")).data;
        const { data: created, error } = await supabase.from("pets").insert({ ...fields, home_id: homeId }).select("id").single();
        if (error) throw error;
        petId = created.id;
      }

      // Photo.
      if (photo?.isNew) {
        const path = await uploadPetPhoto(petId!, photo.uri, photo.mimeType);
        const { error } = await supabase.from("pets").update({ photo_path: path }).eq("id", petId!);
        if (error) throw error;
        removePetPhoto(existing?.photo_path ?? null);
      } else if (removePhoto && existing?.photo_path) {
        await supabase.from("pets").update({ photo_path: null }).eq("id", existing.id);
        removePetPhoto(existing.photo_path);
      }

      // Meals: remove the ones taken out, update the rest, add the new.
      const removed = (existing?.pet_meals ?? []).filter((m) => !kept.some((k) => k.id === m.id)).map((m) => m.id);
      if (removed.length) {
        const { error } = await supabase.from("pet_meals").delete().in("id", removed);
        if (error) throw error;
      }
      for (const [position, meal] of kept.entries()) {
        const row = { label: meal.label.trim(), remind_at: meal.remind ? meal.at : null, position };
        const { error } = meal.id
          ? await supabase.from("pet_meals").update(row).eq("id", meal.id)
          : await supabase.from("pet_meals").insert({ ...row, pet_id: petId });
        if (error) throw error;
      }
      tap("success");
      if (existing) router.back();
      else router.replace(`/pets/${petId}`);
    } catch (error) {
      setSaving(false);
      Alert.alert("Couldn't save", friendlyError(error as { message?: string }));
    }
  }

  const input = (value: string, onChange: (v: string) => void, placeholder: string, extra?: object) => (
    <TextInput
      style={ui.input}
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={colors.muted}
      {...extra}
    />
  );

  return (
    <NookScroll>
      <Stack.Screen
        options={{
          title: existing ? `Edit ${existing.name}` : "New pet",
          headerRight: () => (
            <Tap onPress={save} disabled={saving} hitSlop={10}>
              <Text style={{ color: colors.bark, fontSize: 17, fontWeight: "700" }}>Save</Text>
            </Tap>
          ),
        }}
      />

      <Tap onPress={choosePhoto} style={styles.photoWrap} accessibilityLabel="Add a photo">
        {photo ? (
          <Image source={{ uri: photo.uri }} style={styles.photo} contentFit="cover" />
        ) : (
          <View style={[styles.photo, styles.photoEmpty]}>
            <Icon name="camera" size={28} color={colors.muted} />
          </View>
        )}
      </Tap>
      {photo ? (
        <Tap
          onPress={() => {
            setPhoto(null);
            setRemovePhoto(true);
          }}
          style={{ alignSelf: "center" }}
        >
          <Text style={ui.error}>Remove photo</Text>
        </Tap>
      ) : null}

      {input(name, setName, "Name, e.g. Biscuit")}
      <View style={ui.chips}>
        {speciesList.map((s) => (
          <Chip key={s.key} selected={species === s.key} onPress={() => pickSpecies(s.key)}>
            {s.label}
          </Chip>
        ))}
      </View>
      {input(breed, setBreed, "Breed (optional)")}
      {birthday ? (
        <View style={[ui.row, { gap: 10 }]}>
          <Icon name="birthday" size={18} />
          <View style={{ flex: 1 }}>
            <DateField mode="date" value={parseDateString(birthday)} maximumDate={new Date()} onChange={(d) => setBirthday(toDateString(d))} />
          </View>
          <Tap onPress={() => setBirthday(null)} hitSlop={8}>
            <Text style={ui.error}>Remove</Text>
          </Tap>
        </View>
      ) : (
        <Button title="Add their birthday" icon="birthday" variant="secondary" onPress={() => setBirthday(toDateString(new Date()))} />
      )}

      <SectionHeader title="Meals" icon="food" />
      <Text style={ui.muted}>
        Each one gets checked off once a day, so nobody feeds twice. Turn on a nudge and the Home hears if it hasn't been done by then.
      </Text>
      {meals.map((meal) => (
        <Animated.View key={meal.key} entering={FadeIn.duration(200)} layout={LinearTransition.duration(200)} style={[ui.card, { gap: 10 }]}>
          <View style={[ui.row, { gap: 10 }]}>
            <TextInput
              style={[ui.input, { flex: 1 }]}
              value={meal.label}
              onChangeText={(label) => setMeals((list) => list.map((m) => (m.key === meal.key ? { ...m, label } : m)))}
              placeholder="e.g. Breakfast"
              placeholderTextColor={colors.muted}
            />
            <Tap onPress={() => setMeals((list) => list.filter((m) => m.key !== meal.key))} hitSlop={8} pressedScale={0.85} accessibilityLabel="Remove this meal">
              <Icon name="trash" size={20} color={colors.error} />
            </Tap>
          </View>
          <View style={[ui.row, { gap: 10 }]}>
            <Text style={[ui.cardTitle, { flex: 1 }]}>Nudge if not fed by</Text>
            <Switch
              value={meal.remind}
              onValueChange={(remind) => setMeals((list) => list.map((m) => (m.key === meal.key ? { ...m, remind } : m)))}
              trackColor={{ true: colors.bark }}
            />
          </View>
          {meal.remind ? (
            <DateField
              mode="time"
              value={timeOfDayToDate(meal.at)}
              onChange={(d) => setMeals((list) => list.map((m) => (m.key === meal.key ? { ...m, at: toTimeOfDay(d) } : m)))}
            />
          ) : null}
        </Animated.View>
      ))}
      <Button
        title="Add a meal"
        icon="add"
        variant="secondary"
        onPress={() => setMeals((list) => [...list, { key: newKey(), label: "", remind: false, at: "18:00:00" }])}
      />

      <SectionHeader title="Records" icon="books" />
      {input(vetName, setVetName, "Vet's name")}
      {input(vetPhone, setVetPhone, "Vet's phone", { keyboardType: "phone-pad", textContentType: "telephoneNumber" })}
      {input(microchip, setMicrochip, "Microchip number")}
      {input(food, setFood, "Food, e.g. Blue Buffalo, 1 cup")}
      <TextInput
        style={[ui.input, { minHeight: 90, textAlignVertical: "top" }]}
        value={notes}
        onChangeText={setNotes}
        placeholder="Notes: allergies, quirks, where the leash is…"
        placeholderTextColor={colors.muted}
        multiline
      />

      <Button title="Save" icon="check" onPress={save} loading={saving} style={{ marginTop: 8 }} />
    </NookScroll>
  );
}

const styles = StyleSheet.create({
  photoWrap: { alignSelf: "center" },
  photo: { width: 110, height: 110, borderRadius: 40 },
  photoEmpty: { backgroundColor: colors.barkSoft, alignItems: "center", justifyContent: "center" },
});
