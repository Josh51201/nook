import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { Text } from "../../components/text";

import { Avatar } from "../../components/avatar";
import { Icon } from "../../components/icon";
import { Appear, LoadingScreen, Tap } from "../../components/motion";
import { NookScroll } from "../../components/nook-scroll";
import { Banner, Button, Chip, EmptyState, HeaderIcon, NavCard, SectionHeader } from "../../components/ui";
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
import { formatWhen, loadPotluck, type Dish, type PotluckData } from "../../lib/potluck-data";
import { supabase } from "../../lib/supabase";
import { colors, themed, ui } from "../../lib/theme";

const statuses: { key: RsvpStatus; label: string }[] = [
  { key: "going", label: "Going" },
  { key: "maybe", label: "Maybe" },
  { key: "no", label: "Can't make it" },
];

// One Potluck (POT-002..008): when and where, who's coming (RSVPs with a
// headcount), what's needed and who's bringing what, and a warning on any
// dish that clashes with the allergy or diet of someone coming.
export default function PotluckScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const userId = session?.user.id;

  const [data, setData] = useState<PotluckData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    }, [load])
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
  const myRsvp = rsvps.find((r) => r.profile_id === userId);
  const looseDishes = dishes.filter((dish) => !dish.slot_id || !slots.some((slot) => slot.id === dish.slot_id));
  const withNeeds = coming.filter((person) => person.allergies.length || person.diets.length);

  async function setRsvp(profileId: string, status: RsvpStatus, extraGuests?: number) {
    tap();
    const current = rsvps.find((r) => r.profile_id === profileId);
    const { error: rsvpError } = await supabase.from("potluck_rsvps").upsert({
      potluck_id: id,
      profile_id: profileId,
      status,
      extra_guests: extraGuests ?? current?.extra_guests ?? 0,
      updated_at: new Date().toISOString(),
    });
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

  function addCoHost() {
    const choices = data!.members.filter(
      (m) => !hosts.includes(m.profile_id) && !m.profiles?.is_managed
    );
    if (!choices.length) {
      Alert.alert("Everyone's already hosting", "Everyone in the Burrow who can sign in is already a host.");
      return;
    }
    Alert.alert("Add a co-host", "Co-hosts can change the Potluck and its spots.", [
      ...choices.slice(0, 8).map((m) => ({
        text: nameOf(m.profile_id),
        onPress: async () => {
          const { error: hostError } = await supabase
            .from("potluck_hosts")
            .insert({ potluck_id: id, profile_id: m.profile_id });
          if (hostError) Alert.alert("Couldn't add them", friendlyError(hostError));
          load();
        },
      })),
      { text: "Cancel", style: "cancel" as const },
    ]);
  }

  return (
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
          <Detail icon="clock" text={`${formatWhen(potluck.starts_at)} · ${countdown(potluck.starts_at)}`} />
          {potluck.place ? <Detail icon="place" text={potluck.place} /> : null}
          {potluck.burrows?.name ? <Detail icon="burrow" text={potluck.burrows.name} /> : null}
          {potluck.notes ? <Text style={[ui.muted, { color: colors.text }]}>{potluck.notes}</Text> : null}
          <Text style={ui.muted}>Hosted by {hosts.map(nameOf).join(", ") || "nobody yet"}</Text>
        </View>
      </Appear>
      {potluck.gathering_id && potluck.gatherings ? (
        <NavCard
          icon="gift"
          title={`Part of ${potluck.gatherings.title}`}
          subtitle="See the Gathering in the Gift Nook"
          onPress={() => router.push(`/gift-nook/gathering/${potluck.gathering_id}`)}
        />
      ) : null}

      {/* RSVPs (POT-006) */}
      <SectionHeader title="Are you coming?" icon="group" />
      <View style={[ui.card, { gap: 12 }]}>
        <RsvpRow
          name="You"
          status={myRsvp?.status}
          onPick={(status) => setRsvp(userId, status)}
        />
        {myRsvp && myRsvp.status !== "no" ? (
          <View style={[ui.row, { justifyContent: "space-between" }]}>
            <Text style={ui.muted}>Bringing extra guests</Text>
            <View style={[ui.row, { gap: 14 }]}>
              <Stepper
                icon="minus"
                label="One fewer guest"
                disabled={myRsvp.extra_guests <= 0}
                onPress={() => setRsvp(userId, myRsvp.status, myRsvp.extra_guests - 1)}
              />
              <Text style={[ui.cardTitle, { minWidth: 20, textAlign: "center" }]}>{myRsvp.extra_guests}</Text>
              <Stepper
                icon="add"
                label="One more guest"
                disabled={myRsvp.extra_guests >= 20}
                onPress={() => setRsvp(userId, myRsvp.status, myRsvp.extra_guests + 1)}
              />
            </View>
          </View>
        ) : null}
        {myKids.map((kidId) => (
          <RsvpRow
            key={kidId}
            name={nameOf(kidId)}
            status={rsvps.find((r) => r.profile_id === kidId)?.status}
            onPick={(status) => setRsvp(kidId, status)}
          />
        ))}
      </View>
      <Text style={ui.muted}>
        {going || maybe
          ? `${going} coming${maybe ? `, ${maybe} maybe` : ""} — counting everyone's guests.`
          : "Nobody has answered yet."}
      </Text>
      {coming.length ? (
        <View style={styles.avatars}>
          {coming.slice(0, 10).map((person, i) => (
            <View key={person.id} style={[styles.avatarRing, { marginLeft: i ? -8 : 0 }]}>
              <Avatar name={person.name} icon={person.profile?.avatar_icon} color={person.profile?.avatar_color} size={30} />
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
            />
          ))}
        </View>
      )}
      <Button
        title="Add a dish"
        icon="potluck"
        onPress={() => router.push({ pathname: "/potluck/dish-form", params: { potluckId: id } })}
      />

      {isHost ? (
        <>
          <SectionHeader title="Hosting" icon="person" />
          <Button title="Add a co-host" icon="invite" variant="secondary" onPress={addCoHost} />
          <Text style={ui.muted}>Tap a dish to take it off the list if someone can't bring it any more.</Text>
        </>
      ) : null}
    </NookScroll>
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

function RsvpRow({
  name,
  status,
  onPick,
}: {
  name: string;
  status: RsvpStatus | undefined;
  onPick: (status: RsvpStatus) => void;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={ui.cardTitle}>{name}</Text>
      <View style={ui.chips}>
        {statuses.map((option) => (
          <Chip key={option.key} selected={status === option.key} onPress={() => onPick(option.key)}>
            {option.label}
          </Chip>
        ))}
      </View>
    </View>
  );
}

function Stepper({
  icon,
  label,
  disabled,
  onPress,
}: {
  icon: "add" | "minus";
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Tap
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      pressedScale={0.85}
      style={styles.stepper}
      accessibilityLabel={label}
    >
      <Icon name={icon} size={16} />
    </Tap>
  );
}

function DishRow({
  dish,
  who,
  warnings,
  onPress,
}: {
  dish: Dish;
  who: string;
  warnings: string[];
  onPress?: () => void;
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
