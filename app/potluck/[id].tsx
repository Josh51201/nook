import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { Text } from "../../components/text";

import { Avatar } from "../../components/avatar";
import { Icon } from "../../components/icon";
import { Appear, LoadingScreen, Tap } from "../../components/motion";
import { NookScroll } from "../../components/nook-scroll";
import { NudgeButton, useNudges } from "../../components/nudge";
import { RsvpCard } from "../../components/rsvp";
import { Banner, Button, EmptyState, HeaderIcon, NavCard, SectionHeader } from "../../components/ui";
import { useAuth } from "../../lib/auth-context";
import { friendlyError, guarded, tap } from "../../lib/feedback";
import { countdown } from "../../lib/gift-nook";
import {
  dietLabel,
  dishWarnings,
  headcount,
  slotRoom,
  tagLabel,
  allergens,
  type RsvpStatus,
} from "../../lib/potluck";
import { setRsvp } from "../../lib/gatherings-data";
import { isPotluckWeek, isWaiting } from "../../lib/groceries";
import { potluckShopping } from "../../lib/groceries-data";
import { dishNudgeTargets } from "../../lib/nudges";
import { localDay } from "../../lib/pets";
import { loadPotluck, potluckWhen, type Dish, type PotluckData } from "../../lib/potluck-data";
import { supabase } from "../../lib/supabase";
import { colors, themed, ui } from "../../lib/theme";

// One Potluck (POT-002..008): when and where, who's coming (RSVPs with a
// headcount), what's needed and who's bringing what, and a warning on any
// dish that clashes with the allergy or diet of someone coming. The guest
// list, hosts and RSVPs are its Gathering's (GATH-004): answering here
// answers for the Gathering too.
export default function PotluckScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const userId = session?.user.id;

  const [data, setData] = useState<PotluckData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // What you've put on grocery lists for this Potluck (GROC-006).
  const [shopping, setShopping] = useState<Awaited<ReturnType<typeof potluckShopping>>>([]);
  const nudges = useNudges();

  const load = useCallback(
    () =>
      guarded(
        async () => {
          if (!userId) return;
          setData(await loadPotluck(id, userId));
          setIsLoading(false);
        },
        setError,
        () => setIsLoading(false)
      ),
    [id, userId]
  );

  useFocusEffect(
    useCallback(() => {
      load();
      potluckShopping(id).then(setShopping).catch(() => {});
    }, [load, id])
  );

  if (isLoading) return <LoadingScreen cards={4} />;
  if (!data || !userId) {
    return (
      <EmptyState
        icon="potluck"
        title="This Potluck isn't here"
        body={error ?? "It may have been deleted, or it's in a Burrow you're not part of."}
      />
    );
  }

  const { potluck, slots, dishes, rsvps, people, myKids, isHost, coming, hosts } = data;
  const nameOf = (profileId: string) => (profileId === userId ? "You" : people.get(profileId)?.name ?? "Someone");
  const { going, maybe } = headcount(rsvps);
  const looseDishes = dishes.filter((dish) => !dish.slot_id || !slots.some((slot) => slot.id === dish.slot_id));
  const withNeeds = coming.filter((person) => person.allergies.length || person.diets.length);
  // CORE-101: hosts can nudge people coming who haven't picked a dish.
  const noDish = isHost && new Date(potluck.starts_at) > new Date() ? dishNudgeTargets(coming, dishes, userId) : [];

  async function answer(profileId: string, status: RsvpStatus, extraGuests: number) {
    tap();
    const { error: rsvpError } = await setRsvp(potluck.gathering_id, profileId, status, extraGuests);
    if (rsvpError) Alert.alert("Couldn't save that", friendlyError(rsvpError));
    load();
  }

  function openDish(dish: Dish) {
    if (dish.brought_by === userId) {
      router.push({ pathname: "/potluck/dish-form", params: { potluckId: id, dishId: dish.id } });
    } else if (isHost) {
      Alert.alert(dish.name, `${nameOf(dish.brought_by)} is bringing this.`, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Take it off the list",
          style: "destructive",
          onPress: async () => {
            const { error: removeError } = await supabase.from("potluck_dishes").delete().eq("id", dish.id);
            if (removeError) Alert.alert("Couldn't remove it", friendlyError(removeError));
            load();
          },
        },
      ]);
    }
  }

  function recipeOpener(dish: Dish) {
    const recipeId = dish.recipe_id;
    return recipeId && data!.openRecipes.has(recipeId) ? () => router.push(`/recipes/${recipeId}`) : undefined;
  }

  return (
    <View style={{ flex: 1 }}>
      <NookScroll onRefresh={load}>
        <Stack.Screen
          options={{
            title: potluck.title,
            headerRight: isHost
              ? () => (
                  <HeaderIcon
                    icon="edit"
                    label="Edit Potluck"
                    onPress={() => router.push({ pathname: "/potluck/form", params: { potluckId: id } })}
                  />
                )
              : undefined,
          }}
        />
        {error ? <Text style={ui.error}>{error}</Text> : null}

        {/* When and where */}
        <Appear>
          <View style={[ui.card, { gap: 10 }]}>
            <Text style={styles.title}>{potluck.title}</Text>
            <Detail icon="clock" text={`${potluckWhen(potluck)} · ${countdown(potluck.starts_at)}`} />
            {potluck.place ? <Detail icon="place" text={potluck.place} /> : null}
            {potluck.notes ? <Text style={[ui.muted, { color: colors.text }]}>{potluck.notes}</Text> : null}
            <Text style={ui.muted}>Hosted by {hosts.map(nameOf).join(", ") || "nobody yet"}</Text>
          </View>
        </Appear>
        <NavCard
          icon="celebration"
          iconColor="#9a5b1c"
          iconBackground="#f3e3c8"
          title={potluck.gatherings ? `Part of ${potluck.gatherings.title}` : "The Gathering"}
          subtitle="Who's invited, and everything else about it"
          onPress={() => router.push(`/gatherings/${potluck.gathering_id}`)}
        />

        {/* RSVPs (POT-006) */}
        <SectionHeader title="Are you coming?" icon="group" />
        <RsvpCard userId={userId} myKids={myKids} rsvps={rsvps} nameOf={nameOf} onPick={answer} />
        <Text style={ui.muted}>
          {going || maybe
            ? `${going} coming${maybe ? `, ${maybe} maybe` : ""} — counting everyone's guests.`
            : "Nobody has answered yet."}
        </Text>
        {coming.length ? (
          <View style={styles.avatars}>
            {coming.slice(0, 10).map((person, i) => (
              <View key={person.id} style={[styles.avatarRing, { marginLeft: i ? -8 : 0 }]}>
                <Avatar name={person.name} icon={person.profile?.avatar_icon} color={person.profile?.avatar_color} photo={person.profile?.avatar_path} size={30} />
              </View>
            ))}
          </View>
        ) : null}

        {/* Allergies and diets of people coming (PROF-004 / POT-005) */}
        {withNeeds.length ? (
          <Banner
            icon="warning"
            tone="rose"
            title="Allergies and diets"
            body={withNeeds
              .map(
                (person) =>
                  `${person.name}: ${[
                    ...person.allergies.map((a) => `${allergens.find((x) => x.key === a)?.label ?? a} allergy`),
                    ...person.diets.map(dietLabel),
                  ].join(", ")}`
              )
              .join("\n")}
          />
        ) : null}

        {/* What's needed (POT-003) */}
        {slots.length ? <SectionHeader title="What's needed" icon="potluck" /> : null}
        {slots.map((slot, i) => {
          const room = slotRoom(slot, dishes);
          const filling = dishes.filter((dish) => dish.slot_id === slot.id);
          return (
            <Appear key={slot.id} index={i}>
              <View style={[ui.card, { gap: 10 }]}>
                <View style={[ui.row, { justifyContent: "space-between" }]}>
                  <Text style={ui.cardTitle}>{slot.label}</Text>
                  <Text style={[styles.pill, room.full ? styles.pillDone : null]}>
                    {room.full ? "Covered" : `${room.taken} of ${slot.wanted}`}
                  </Text>
                </View>
                {filling.map((dish) => (
                  <DishRow
                    key={dish.id}
                    dish={dish}
                    who={nameOf(dish.brought_by)}
                    warnings={dishWarnings(dish.tags, coming)}
                    onPress={dish.brought_by === userId || isHost ? () => openDish(dish) : undefined}
                    onRecipe={recipeOpener(dish)}
                  />
                ))}
                {room.open ? (
                  <Button
                    title="I'll bring this"
                    icon="add"
                    variant="secondary"
                    onPress={() =>
                      router.push({ pathname: "/potluck/dish-form", params: { potluckId: id, slotId: slot.id } })
                    }
                  />
                ) : null}
              </View>
            </Appear>
          );
        })}

        {/* Anything else people are bringing (POT-003) */}
        <SectionHeader title={slots.length ? "Also bringing" : "Who's bringing what"} icon="tucks" />
        {looseDishes.length === 0 ? (
          <Text style={ui.muted}>
            {slots.length ? "Nothing extra yet." : "Nobody's signed up yet — be the first."}
          </Text>
        ) : (
          <View style={[ui.card, { gap: 10 }]}>
            {looseDishes.map((dish) => (
              <DishRow
                key={dish.id}
                dish={dish}
                who={nameOf(dish.brought_by)}
                warnings={dishWarnings(dish.tags, coming)}
                onPress={dish.brought_by === userId || isHost ? () => openDish(dish) : undefined}
                onRecipe={recipeOpener(dish)}
              />
            ))}
          </View>
        )}
        <Button
          title="Add a dish"
          icon="potluck"
          onPress={() => router.push({ pathname: "/potluck/dish-form", params: { potluckId: id } })}
        />

        {/* Shopping for your dish (GROC-006): it waits on your grocery list
            until the week of, and that week this card asks if you're set. */}
        {dishes.some((dish) => dish.brought_by === userId) && localDay(new Date(potluck.starts_at)) >= localDay() ? (
          <NavCard
            icon="cart"
            iconColor="#4f7a3f"
            iconBackground="#e2ecd8"
            title={isPotluckWeek(localDay(new Date(potluck.starts_at))) ? "It's Potluck week. Got what you need?" : "Shopping for your dish"}
            subtitle={
              shopping.length
                ? `${shopping.length} thing${shopping.length === 1 ? " is" : "s are"} on your grocery list${shopping.some((item) => isWaiting(item)) ? " (joining it the week of)" : ""}. Tap to add more.`
                : "Pick what you need and put it on a grocery list. It joins the list the week of."
            }
            onPress={() => router.push({ pathname: "/groceries/add", params: { potluck: id } })}
          />
        ) : null}

        {isHost ? (
          <>
            <SectionHeader title="Hosting" icon="person" />
            <Button
              title="Change the Gathering"
              icon="edit"
              variant="secondary"
              onPress={() => router.push({ pathname: "/gatherings/form", params: { gatheringId: potluck.gathering_id } })}
            />
            {noDish.length ? (
              <NudgeButton
                title={noDish.length === 1 ? `Nudge ${noDish[0].name} to pick a dish` : `Nudge ${noDish.length} people to pick a dish`}
                hint={`Coming but not bringing anything yet: ${noDish.map((p) => p.name).join(", ")}.`}
                sent={nudges.isSent("dish")}
                busy={nudges.isBusy("dish")}
                onPress={() => nudges.nudge("dish", "dish", id, { many: noDish.length > 1, who: noDish.length === 1 ? noDish[0].name : `${noDish.length} people` })}
              />
            ) : null}
            <Text style={ui.muted}>Who's invited, the day and place, and co-hosts are set on the Gathering.</Text>
            <Text style={ui.muted}>Tap a dish to take it off the list if someone can't bring it any more.</Text>
          </>
        ) : null}
      </NookScroll>
      {nudges.sheet}
    </View>
  );
}

function Detail({ icon, text }: { icon: "clock" | "place" | "burrow"; text: string }) {
  return (
    <View style={[ui.row, { gap: 8 }]}>
      <Icon name={icon} size={16} color={colors.muted} />
      <Text style={{ color: colors.text, fontSize: 15, flex: 1 }}>{text}</Text>
    </View>
  );
}

function DishRow({
  dish,
  who,
  warnings,
  onPress,
  onRecipe,
}: {
  dish: Dish;
  who: string;
  warnings: string[];
  onPress?: () => void;
  // Opens the Recipe Box recipe it's made from (REC-009).
  onRecipe?: () => void;
}) {
  return (
    <Tap onPress={onPress} disabled={!onPress} style={{ gap: 6 }}>
      <View style={[ui.row, { justifyContent: "space-between" }]}>
        <View style={{ flex: 1 }}>
          <Text style={[ui.cardTitle, { fontSize: 15 }]}>{dish.name}</Text>
          <Text style={ui.muted}>
            {who}
            {dish.note ? ` · ${dish.note}` : ""}
          </Text>
        </View>
        {onPress ? <Icon name="chevron" size={13} color={colors.muted} /> : null}
      </View>
      {dish.tags.length ? (
        <View style={[ui.row, { flexWrap: "wrap", gap: 6 }]}>
          {dish.tags.map((tag) => (
            <Text key={tag} style={styles.tag}>
              {tagLabel(tag)}
            </Text>
          ))}
        </View>
      ) : null}
      {onRecipe ? (
        <Tap onPress={onRecipe} hitSlop={6} style={[ui.row, { gap: 5, alignSelf: "flex-start" }]} accessibilityRole="link">
          <Icon name="recipe" size={13} />
          <Text style={[ui.link, { fontSize: 13 }]}>See the recipe</Text>
        </Tap>
      ) : null}
      {warnings.map((warning) => (
        <View key={warning} style={[ui.row, styles.warning]}>
          <Icon name="warning" size={13} color={colors.heart} />
          <Text style={styles.warningText}>{warning}</Text>
        </View>
      ))}
    </Tap>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    title: { fontSize: 22, fontWeight: "800", color: colors.text, letterSpacing: -0.3 },
    avatars: { flexDirection: "row", marginTop: -4 },
    avatarRing: { borderRadius: 999, borderWidth: 2, borderColor: colors.background },
    pill: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.bark,
      backgroundColor: colors.barkSoft,
      paddingHorizontal: 9,
      paddingVertical: 3,
      borderRadius: 999,
      overflow: "hidden",
    },
    pillDone: { color: "#4f6b45", backgroundColor: "#dfe8d6" },
    tag: {
      fontSize: 12,
      color: colors.muted,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 999,
    },
    warning: { gap: 6, backgroundColor: colors.rose, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
    warningText: { color: colors.heart, fontSize: 13, fontWeight: "600", flex: 1 },
    stepper: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.barkSoft,
      alignItems: "center",
      justifyContent: "center",
    },
  })
);
