import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Linking, StyleSheet, View } from "react-native";

import { Avatar } from "../../components/avatar";
import { Icon, IconBadge } from "../../components/icon";
import { Appear, LoadingScreen, Tap } from "../../components/motion";
import { NookScroll } from "../../components/nook-scroll";
import { PetAvatar } from "../../components/pet-avatar";
import { Text } from "../../components/text";
import { Button, EmptyState, SectionHeader } from "../../components/ui";
import { useAuth } from "../../lib/auth-context";
import { friendlyError, tap } from "../../lib/feedback";
import { formatBirthday } from "../../lib/profile";
import { findNook } from "../../lib/nooks";
import {
  careVerb,
  dueState,
  dueWords,
  formatTimeOfDay,
  healthKindInfo,
  helperUntilWords,
  mealStatus,
  quickCareFor,
  sortHealth,
  speciesLabel,
} from "../../lib/pets";
import { feedMeal, logCare, petPhotoUrls, undoCare, usePets, whenWords, whoName } from "../../lib/pets-data";
import { supabase } from "../../lib/supabase";
import { colors, ui } from "../../lib/theme";

const nook = findNook("pets")!;

function ageOf(birthday: string | null) {
  if (!birthday) return null;
  const [y, m, d] = birthday.split("-").map(Number);
  const now = new Date();
  let months = (now.getFullYear() - y) * 12 + (now.getMonth() + 1 - m) - (now.getDate() < d ? 1 : 0);
  if (months < 0) return null;
  if (months < 24) return `${months} month${months === 1 ? "" : "s"} old`;
  months = Math.floor(months / 12);
  return `${months} years old`;
}

// One pet (PET-003..006): today's meals, quick check-offs, vet visits and
// meds, records, and who helps. Your Home's pets can be changed by anyone in
// it; a helper can check things off and mark meds given (PET-002).
export default function PetPage() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const userId = session?.user.id;
  const { data, isLoading, reload } = usePets(userId);
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const pet = data?.pets.find((p) => p.id === id);
  useEffect(() => {
    if (pet?.photo_path) petPhotoUrls([pet.photo_path]).then((urls) => setPhoto(urls.get(pet.photo_path!) ?? null));
    else setPhoto(null);
  }, [pet?.photo_path]);

  if (isLoading && !data) return <LoadingScreen cards={3} />;
  if (!data || !pet) {
    return <EmptyState icon="paw" title="That pet isn't here" body="They may have been removed, or your access as a helper may have ended." />;
  }

  const log = data.log.filter((l) => l.pet_id === pet.id);
  const meals = mealStatus(pet.pet_meals, log, data.today);
  const health = sortHealth(pet.pet_health);
  const quick = quickCareFor(pet.species);
  const recent = log.slice(0, 8);
  const mealLabel = (mealId: string | null) => pet!.pet_meals.find((m) => m.id === mealId)?.label ?? null;
  const age = ageOf(pet.birthday);

  async function run(key: string, work: () => Promise<{ error: { message?: string; code?: string } | null; alreadyFed?: boolean }>, success = true) {
    if (busy) return;
    setBusy(key);
    if (success) tap("success");
    const { error, alreadyFed } = await work();
    if (error) Alert.alert(alreadyFed ? "Already fed!" : "Couldn't do that", alreadyFed ? "Someone just did it. Refreshing…" : friendlyError(error));
    await reload();
    setBusy(null);
  }

  async function markDone(itemId: string) {
    await run(
      itemId,
      async () => {
        const today = data!.today;
        const { error } = await supabase.rpc("complete_pet_health", { target_item: itemId, on_day: today });
        return { error };
      }
    );
  }

  function confirmRemoveHealth(itemId: string, title: string) {
    Alert.alert(`Remove “${title}”?`, undefined, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => run(itemId, async () => ({ error: (await supabase.from("pet_health").delete().eq("id", itemId)).error }), false),
      },
    ]);
  }

  function confirmDeletePet() {
    Alert.alert(`Remove ${pet!.name}?`, "Their meals, records and care history are deleted for everyone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase.from("pets").delete().eq("id", pet!.id);
          if (error) return Alert.alert("Couldn't remove them", friendlyError(error));
          router.dismissTo("/pets");
        },
      },
    ]);
  }

  async function removeHelper(profileId: string, name: string) {
    Alert.alert(profileId === userId ? "Stop helping?" : `Remove ${name}?`, profileId === userId ? `You won't see ${pet!.name} any more.` : `${name} won't see ${pet!.name} any more.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: profileId === userId ? "Stop helping" : "Remove",
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase.from("pet_helpers").delete().eq("pet_id", pet!.id).eq("profile_id", profileId);
          if (error) return Alert.alert("Couldn't do that", friendlyError(error));
          if (profileId === userId) router.dismissTo("/pets");
          else reload();
        },
      },
    ]);
  }

  const records = [
    pet.birthday ? { icon: "birthday" as const, label: "Birthday", value: formatBirthday(pet.birthday) } : null,
    pet.microchip ? { icon: "key" as const, label: "Microchip", value: pet.microchip } : null,
    pet.food ? { icon: "food" as const, label: "Food", value: pet.food } : null,
  ].filter(Boolean) as { icon: "birthday" | "key" | "food"; label: string; value: string }[];

  return (
    <NookScroll onRefresh={reload}>
      <Stack.Screen
        options={{
          title: pet.name,
          headerRight: () =>
            pet.canEdit ? (
              <Tap
                onPress={() => router.push({ pathname: "/pets/form", params: { id: pet.id } })}
                hitSlop={10}
                style={[ui.row, { gap: 5 }]}
              >
                <Icon name="edit" size={17} />
                <Text style={{ color: colors.bark, fontSize: 17, fontWeight: "600" }}>Edit</Text>
              </Tap>
            ) : undefined,
        }}
      />

      <Appear>
        <View style={[styles.hero, { backgroundColor: colors.dark ? `${nook.iconColor}26` : nook.color }]}>
          <PetAvatar uri={photo} size={72} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
              {pet.name}
            </Text>
            <Text style={[ui.muted, { color: colors.text }]} numberOfLines={2}>
              {[pet.breed || speciesLabel(pet.species), age].filter(Boolean).join(" · ")}
            </Text>
          </View>
        </View>
      </Appear>

      <SectionHeader title="Today" icon="check" />
      {meals.length === 0 ? (
        <Text style={ui.muted}>
          {pet.canEdit ? "No meals set yet. Edit to add Breakfast, Dinner and more — each can nudge the Home if it's missed." : "No meals set for this pet."}
        </Text>
      ) : (
        meals.map(({ meal, fed }, i) => (
          <Appear key={meal.id} index={i}>
            <Tap
              disabled={busy === meal.id || busy === fed?.id}
              onPress={() => {
                if (!fed) return run(meal.id, () => feedMeal(pet.id, meal.id));
                if (fed.done_by === userId || pet.canEdit) {
                  Alert.alert(`Undo ${meal.label.toLowerCase()}?`, `${pet.name} will show as not fed yet.`, [
                    { text: "Keep", style: "cancel" },
                    { text: "Undo", style: "destructive", onPress: () => run(fed.id, () => undoCare(fed.id), false) },
                  ]);
                }
              }}
              style={[ui.card, styles.mealRow]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: Boolean(fed) }}
            >
              <View style={[styles.check, { borderColor: nook.iconColor }, fed && { backgroundColor: nook.iconColor }]}>
                {fed ? <Icon name="check" size={16} color="#ffffff" /> : null}
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[ui.cardTitle, fed && { opacity: 0.6 }]}>{meal.label}</Text>
                <Text style={[ui.muted, { fontSize: 13 }]}>
                  {fed
                    ? `${whoName(data, fed.done_by, userId)} fed ${pet.name} at ${whenWords(fed.done_at)}`
                    : meal.remind_at
                      ? `Nudge if not fed by ${formatTimeOfDay(meal.remind_at)}`
                      : "Not fed yet"}
                </Text>
              </View>
            </Tap>
          </Appear>
        ))
      )}

      {quick.length ? (
        <View style={styles.quick}>
          {quick.map((q) => (
            <Button
              key={q.kind}
              title={q.label}
              icon={q.icon}
              variant="secondary"
              style={{ flexGrow: 1, minWidth: 120 }}
              disabled={busy === q.kind}
              onPress={() => run(q.kind, () => logCare(pet.id, q.kind))}
            />
          ))}
        </View>
      ) : null}

      {recent.length ? (
        <>
          <SectionHeader title="Lately" icon="clock" />
          <View style={[ui.card, { gap: 10 }]}>
            {recent.map((entry) => (
              <View key={entry.id} style={[ui.row, { gap: 10 }]}>
                <Icon name={entry.kind === "meal" ? "food" : entry.kind === "walk" ? "bike" : entry.kind === "treat" ? "cookie" : entry.kind === "litter" ? "leaf" : "drop"} size={15} color={nook.iconColor} />
                <Text style={[ui.muted, { flex: 1, color: colors.text, fontSize: 14 }]} numberOfLines={1}>
                  {whoName(data, entry.done_by, userId)} {careVerb(entry.kind, mealLabel(entry.meal_id))} {pet.name}
                </Text>
                <Text style={[ui.muted, { fontSize: 12 }]}>{whenWords(entry.done_at)}</Text>
              </View>
            ))}
          </View>
        </>
      ) : null}

      <SectionHeader title="Vet, vaccines & meds" icon="pill" />
      {health.length === 0 ? (
        <Text style={ui.muted}>Nothing scheduled. Add a vet visit, vaccine or medication and it'll be here with its due date.</Text>
      ) : (
        health.map((item) => {
          const state = dueState(item, data.today);
          const kind = healthKindInfo(item.kind);
          const hot = state === "overdue" || state === "today";
          return (
            <View key={item.id} style={[ui.card, styles.healthRow]}>
              <IconBadge name={kind.icon} size={40} color={hot ? "#ffffff" : nook.iconColor} background={hot ? colors.error : nook.color} />
              <Tap
                style={{ flex: 1, gap: 2 }}
                disabled={!pet.canEdit}
                onPress={() => router.push({ pathname: "/pets/health-form", params: { petId: pet.id, id: item.id } })}
                onLongPress={pet.canEdit ? () => confirmRemoveHealth(item.id, item.title) : undefined}
              >
                <Text style={ui.cardTitle}>{item.title}</Text>
                <Text style={[ui.muted, { fontSize: 13 }, hot && { color: colors.error, fontWeight: "600" }]}>
                  {dueWords(item, data.today)}
                  {item.repeat_days ? ` · repeats` : ""}
                </Text>
              </Tap>
              <Button
                title="Done"
                variant="secondary"
                disabled={busy === item.id}
                onPress={() => markDone(item.id)}
                style={{ paddingHorizontal: 12, paddingVertical: 8 }}
              />
            </View>
          );
        })
      )}
      {pet.canEdit ? (
        <Button
          title="Add a vet visit, vaccine or med"
          icon="add"
          variant="secondary"
          onPress={() => router.push({ pathname: "/pets/health-form", params: { petId: pet.id } })}
        />
      ) : null}

      {records.length || pet.vet_name || pet.notes ? (
        <>
          <SectionHeader title="Records" icon="books" />
          <View style={[ui.card, { gap: 12 }]}>
            {pet.vet_name ? (
              <View style={[ui.row, { gap: 10 }]}>
                <Icon name="place" size={18} color={nook.iconColor} />
                <View style={{ flex: 1 }}>
                  <Text style={[ui.muted, { fontSize: 12 }]}>Vet</Text>
                  <Text style={ui.cardTitle}>{pet.vet_name}</Text>
                </View>
                {pet.vet_phone ? (
                  <Tap onPress={() => Linking.openURL(`tel:${pet.vet_phone!.replace(/[^\d+]/g, "")}`)} hitSlop={8} style={[ui.row, { gap: 5 }]}>
                    <Icon name="phone" size={16} />
                    <Text style={ui.link}>{pet.vet_phone}</Text>
                  </Tap>
                ) : null}
              </View>
            ) : null}
            {records.map((r) => (
              <View key={r.label} style={[ui.row, { gap: 10 }]}>
                <Icon name={r.icon} size={18} color={nook.iconColor} />
                <View style={{ flex: 1 }}>
                  <Text style={[ui.muted, { fontSize: 12 }]}>{r.label}</Text>
                  <Text style={ui.cardTitle} selectable>
                    {r.value}
                  </Text>
                </View>
              </View>
            ))}
            {pet.notes ? <Text style={[ui.muted, { color: colors.text }]}>{pet.notes}</Text> : null}
          </View>
        </>
      ) : null}

      <SectionHeader title="Helpers" icon="group" />
      {pet.pet_helpers.length === 0 ? (
        <Text style={ui.muted}>
          {pet.canEdit
            ? "Going away? Give a pet sitter or grandparent from your Burrows access to just this pet, for as long as you like."
            : "Nobody else is helping."}
        </Text>
      ) : (
        pet.pet_helpers.map((helper) => {
          const name = whoName(data, helper.profile_id, userId);
          return (
            <View key={helper.profile_id} style={[ui.card, ui.row, { gap: 12 }]}>
              <Avatar name={name} size={36} />
              <View style={{ flex: 1 }}>
                <Text style={ui.cardTitle}>{name}</Text>
                <Text style={[ui.muted, { fontSize: 13 }]}>{helperUntilWords(helper.until, data.today)}</Text>
              </View>
              {pet.canEdit || helper.profile_id === userId ? (
                <Tap onPress={() => removeHelper(helper.profile_id, name)} hitSlop={8}>
                  <Text style={ui.error}>{helper.profile_id === userId ? "Stop" : "Remove"}</Text>
                </Tap>
              ) : null}
            </View>
          );
        })
      )}
      {pet.canEdit ? (
        <Button
          title="Add a helper"
          icon="invite"
          variant="secondary"
          onPress={() => router.push({ pathname: "/pets/helpers", params: { petId: pet.id } })}
        />
      ) : null}

      {pet.canEdit ? <Button title={`Remove ${pet.name}`} icon="trash" variant="danger" onPress={confirmDeletePet} /> : null}
    </NookScroll>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: "row", alignItems: "center", gap: 16, padding: 18, borderRadius: 24 },
  name: { fontSize: 26, fontWeight: "800", letterSpacing: -0.5 },
  mealRow: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14 },
  check: { width: 30, height: 30, borderRadius: 10, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  quick: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  healthRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
});
