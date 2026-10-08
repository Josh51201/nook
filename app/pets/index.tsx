import { Stack, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";

import { Icon } from "../../components/icon";
import { LoadingScreen, Tap } from "../../components/motion";
import { NookHero } from "../../components/nook-hero";
import { NookScroll } from "../../components/nook-scroll";
import { PetAvatar } from "../../components/pet-avatar";
import { Text } from "../../components/text";
import { Button, EmptyState, HeaderIcon, SectionHeader } from "../../components/ui";
import { useAuth } from "../../lib/auth-context";
import { friendlyError, tap } from "../../lib/feedback";
import { findNook } from "../../lib/nooks";
import { healthNeedingAttention, mealStatus, mealsLeft, speciesLabel } from "../../lib/pets";
import { feedMeal, petPhotoUrls, undoCare, usePets, whenWords, whoName, type Pet, type PetsData } from "../../lib/pets-data";
import { colors, ui } from "../../lib/theme";

const nook = findNook("pets")!;

// Pet Care home (PET-001): every pet you look after, with today's meals one
// tap away so nobody feeds twice (PET-003).
export default function PetsHome() {
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user.id;
  const { data, error, isLoading, reload } = usePets(userId);
  const [photos, setPhotos] = useState<Map<string, string>>(new Map());
  const [busy, setBusy] = useState<string | null>(null);

  const photoKey = data?.pets.map((p) => p.photo_path).filter(Boolean).join(",") ?? "";
  useEffect(() => {
    const paths = (data?.pets ?? []).map((p) => p.photo_path).filter(Boolean) as string[];
    if (paths.length) petPhotoUrls(paths).then(setPhotos);
  }, [photoKey]);

  if (isLoading && !data) return <LoadingScreen cards={3} />;
  if (!data) {
    return (
      <NookScroll onRefresh={reload}>
        <EmptyState icon="paw" title="Couldn't open Pet Care" body={error ?? "Check your connection and try again."} />
      </NookScroll>
    );
  }

  const mine = data.pets.filter((p) => p.canEdit);
  const helping = data.pets.filter((p) => !p.canEdit);
  const hungry = data.pets
    .map((pet) => ({ pet, left: mealStatus(pet.pet_meals, data.log.filter((l) => l.pet_id === pet.id), data.today).filter((m) => !m.fed) }))
    .filter((x) => x.left.length);
  const dueSoon = data.pets.flatMap((pet) =>
    healthNeedingAttention(pet.pet_health, data.today).map((item) => ({ pet, item }))
  );

  const headline = !data.pets.length
    ? "Add your first pet"
    : hungry.length
      ? `${hungry[0].pet.name} still needs ${hungry[0].left[0].meal.label.toLowerCase()}`
      : data.pets.some((p) => p.pet_meals.length)
        ? "Everyone's fed for now"
        : "Set meals to track feeding";

  async function feed(pet: Pet, mealId: string) {
    if (busy) return;
    setBusy(mealId);
    tap("success");
    const { error: feedError, alreadyFed } = await feedMeal(pet.id, mealId);
    if (feedError) {
      Alert.alert(alreadyFed ? "Already fed!" : "Couldn't check that off", alreadyFed ? "Someone just did it. Refreshing…" : friendlyError(feedError));
    }
    await reload();
    setBusy(null);
  }

  async function unfeed(entryId: string) {
    setBusy(entryId);
    tap();
    const { error: undoError } = await undoCare(entryId);
    if (undoError) Alert.alert("Couldn't undo that", friendlyError(undoError));
    await reload();
    setBusy(null);
  }

  function petCard(pet: Pet, data: PetsData) {
    const log = data.log.filter((l) => l.pet_id === pet.id);
    const status = mealStatus(pet.pet_meals, log, data.today);
    const left = mealsLeft(pet.pet_meals, log, data.today);
    const due = healthNeedingAttention(pet.pet_health, data.today);
    return (
      <View key={pet.id} style={[ui.card, { gap: 12 }]}>
        <Tap onPress={() => router.push(`/pets/${pet.id}`)} style={[ui.row, { gap: 12 }]} accessibilityRole="button">
          <PetAvatar uri={pet.photo_path ? photos.get(pet.photo_path) : null} size={52} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[ui.cardTitle, { fontSize: 18 }]}>{pet.name}</Text>
            <Text style={ui.muted} numberOfLines={1}>
              {[pet.breed || speciesLabel(pet.species), pet.canEdit ? null : "You're helping"].filter(Boolean).join(" · ")}
            </Text>
          </View>
          {due.length ? (
            <View style={[styles.flag, { backgroundColor: due[0].due_on! < data.today ? colors.error : nook.iconColor }]}>
              <Icon name="pill" size={12} color="#ffffff" />
              <Text style={styles.flagText}>{due.length}</Text>
            </View>
          ) : null}
          <Icon name="chevron" size={14} color={colors.muted} />
        </Tap>

        {status.length ? (
          <View style={styles.meals}>
            {status.map(({ meal, fed }) => (
              <Tap
                key={meal.id}
                disabled={busy === meal.id || busy === fed?.id}
                onPress={() => {
                  if (!fed) return feed(pet, meal.id);
                  if (fed.done_by === userId) {
                    Alert.alert(`Undo ${meal.label.toLowerCase()}?`, `${pet.name} will show as not fed yet.`, [
                      { text: "Keep", style: "cancel" },
                      { text: "Undo", style: "destructive", onPress: () => unfeed(fed.id) },
                    ]);
                  } else {
                    Alert.alert(`${pet.name} was fed`, `${whoName(data, fed.done_by, userId)} did ${meal.label.toLowerCase()} at ${whenWords(fed.done_at)}.`);
                  }
                }}
                style={[
                  styles.meal,
                  fed ? { backgroundColor: nook.iconColor, borderColor: nook.iconColor } : { borderColor: nook.iconColor },
                ]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: Boolean(fed) }}
                accessibilityLabel={`${pet.name} ${meal.label}`}
              >
                <Icon name={fed ? "check" : "paw"} size={14} color={fed ? "#ffffff" : nook.iconColor} />
                <View>
                  <Text style={[styles.mealLabel, { color: fed ? "#ffffff" : colors.text }]}>{meal.label}</Text>
                  {fed ? (
                    <Text style={[styles.mealSub, { color: "rgba(255,255,255,0.85)" }]} numberOfLines={1}>
                      {whoName(data, fed.done_by, userId)} · {whenWords(fed.done_at)}
                    </Text>
                  ) : null}
                </View>
              </Tap>
            ))}
          </View>
        ) : (
          <Text style={ui.muted}>
            {pet.canEdit ? "No meals set yet. Open to add Breakfast, Dinner and more." : "No meals set for this pet."}
          </Text>
        )}
        {left === 0 && status.length ? <Text style={[ui.muted, { fontSize: 13 }]}>All fed for today.</Text> : null}
      </View>
    );
  }

  return (
    <NookScroll onRefresh={reload}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <HeaderIcon icon="settings" label="Pet Care Nook settings" onPress={() => router.push("/pets/settings")} />
          ),
        }}
      />

      <NookHero
        icon="paw"
        accent={nook.iconColor}
        tint={nook.color}
        headline={headline}
        facts={[
          { icon: "paw", text: `${data.pets.length} pet${data.pets.length === 1 ? "" : "s"}` },
          ...(dueSoon.length
            ? [{ icon: "pill" as const, text: `${dueSoon[0].pet.name}: ${dueSoon[0].item.title}${dueSoon.length > 1 ? ` +${dueSoon.length - 1} more` : ""}` }]
            : []),
        ]}
      />

      {mine.length === 0 && helping.length === 0 ? (
        <EmptyState
          icon="paw"
          title="No pets yet"
          body="Add the pets in your Home. Everyone you live with can check off meals, so nobody feeds twice."
        />
      ) : null}
      {mine.map((pet) => petCard(pet, data))}

      {helping.length ? (
        <>
          <SectionHeader title="Pets you're helping with" icon="group" />
          {helping.map((pet) => petCard(pet, data))}
        </>
      ) : null}

      <Button title="Add a pet" icon="add" onPress={() => router.push("/pets/form")} />
    </NookScroll>
  );
}

const styles = StyleSheet.create({
  flag: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  flagText: { color: "#ffffff", fontSize: 12, fontWeight: "800" },
  meals: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  meal: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 2,
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    minWidth: 120,
  },
  mealLabel: { fontSize: 14, fontWeight: "700" },
  mealSub: { fontSize: 11 },
});
