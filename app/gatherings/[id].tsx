import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";

import { Avatar } from "../../components/avatar";
import { Icon, IconBadge, type IconName } from "../../components/icon";
import { Appear, LoadingScreen } from "../../components/motion";
import { NookScroll } from "../../components/nook-scroll";
import { RsvpCard } from "../../components/rsvp";
import { Text } from "../../components/text";
import { EmptyState, HeaderIcon, NavCard, SectionHeader } from "../../components/ui";
import { useAuth } from "../../lib/auth-context";
import { addItem, gatheringWidgets, newItemId, removeEverywhere, useHearthLayout } from "../../lib/hearth";
import { fullMessage, overflowing } from "../../lib/hearth-limits";
import { gatheringWhenOver, gatheringWidget, widgetKindInfo } from "../../lib/widgets";
import { friendlyError, guarded, tap } from "../../lib/feedback";
import { guestSummary, rsvpChoices, whenWords, type Guest } from "../../lib/gatherings";
import { addPotluck, loadGathering, setRsvp, type GatheringData } from "../../lib/gatherings-data";
import { countdown, displayName, gatheringKindInfo, isArchived } from "../../lib/gift-nook";
import type { Rsvp, RsvpStatus } from "../../lib/potluck";
import { colors, themed, ui } from "../../lib/theme";

// One Gathering (GATH-001..007): when and where, are you coming, what it
// has (gift lists in the Gift Nook, a Potluck), and who's invited with
// their answers. Hosts can change it. At the top, you can put it on your
// Hearth as a widget (GATH-009).
export default function GatheringScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const userId = session?.user.id;
  const [data, setData] = useState<GatheringData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    () =>
      guarded(
        async () => {
          if (!userId) return;
          setData(await loadGathering(id, userId));
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
        icon="celebration"
        title="This Gathering isn't here"
        body={error ?? "It may have been deleted, or you're not invited to it."}
      />
    );
  }

  const { gathering, guests, burrows, potluckId, canHost, myKids, honorees } = data;
  const kind = gatheringKindInfo(gathering.kind);
  const archived = isArchived(gathering);
  const nameOf = (profileId: string) =>
    profileId === userId ? "You" : displayName(guests.find((g) => g.profile_id === profileId));
  const rsvps: Rsvp[] = guests
    .filter((g) => g.status)
    .map((g) => ({ profile_id: g.profile_id, status: g.status!, extra_guests: g.extra_guests }));
  const hosts = guests.filter((g) => g.is_host);
  const amInvited = guests.some((g) => g.profile_id === userId);
  const pickedAlone = guests.filter((g) => g.invited_alone).length;
  const forWhom = honorees.map(nameOf);

  async function answer(profileId: string, status: RsvpStatus, extraGuests: number) {
    tap();
    const { error: rsvpError } = await setRsvp(id, profileId, status, extraGuests);
    if (rsvpError) Alert.alert("Couldn't save that", friendlyError(rsvpError));
    load();
  }

  async function startPotluck() {
    try {
      const potluck = await addPotluck(id);
      tap("success");
      router.push({ pathname: "/potluck/form", params: { potluckId: potluck } });
    } catch (potluckError) {
      Alert.alert("Couldn't add a Potluck", friendlyError(potluckError as { message?: string }));
    }
  }

  // Answered first (going, maybe, can't), then the rest.
  const order: (RsvpStatus | null)[] = ["going", "maybe", "no", null];
  const groups = order
    .map((status) => ({ status, people: guests.filter((g) => (g.status ?? null) === status) }))
    .filter((group) => group.people.length);

  return (
    <NookScroll onRefresh={load}>
      <Stack.Screen
        options={{
          title: gathering.title,
          headerRight: canHost
            ? () => (
                <HeaderIcon
                  icon="edit"
                  label="Change this Gathering"
                  onPress={() => router.push({ pathname: "/gatherings/form", params: { gatheringId: id } })}
                />
              )
            : undefined,
        }}
      />
      {error ? <Text style={ui.error}>{error}</Text> : null}

      <HearthPin gatheringId={id} title={gathering.title} over={archived} />

      <Appear>
        <View style={[ui.card, { gap: 10 }]}>
          <View style={[ui.row, { gap: 14 }]}>
            <IconBadge name={kind.icon} size={56} color={kind.color} background={`${kind.color}1f`} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.title}>{gathering.title}</Text>
              <Text style={{ fontSize: 15, fontWeight: "700", color: kind.color }}>
                {archived ? "Already happened" : countdown(gathering.ends_at)}
              </Text>
            </View>
          </View>
          <Detail icon="calendar" text={whenWords(gathering)} />
          {gathering.place ? <Detail icon="place" text={gathering.place} /> : null}
          {forWhom.length ? <Detail icon="heart" text={`For ${forWhom.join(" & ")}`} /> : null}
          {gathering.notes ? <Text style={[ui.muted, { color: colors.text }]}>{gathering.notes}</Text> : null}
          <Text style={ui.muted}>
            {hosts.length ? `Hosted by ${hosts.map((h) => nameOf(h.profile_id)).join(", ")}` : "Anyone invited can change it"}
          </Text>
        </View>
      </Appear>

      {!archived && amInvited ? (
        <>
          <SectionHeader title="Are you coming?" icon="group" />
          <RsvpCard userId={userId} myKids={myKids} rsvps={rsvps} nameOf={nameOf} onPick={answer} />
        </>
      ) : !archived && myKids.length ? (
        <>
          <SectionHeader title="Are they coming?" icon="group" />
          <RsvpCard userId={userId} myKids={myKids} rsvps={rsvps} nameOf={nameOf} onPick={answer} />
        </>
      ) : null}

      {gathering.gifts || potluckId || (canHost && !archived) ? <SectionHeader title="What's part of it" icon="sparkles" /> : null}
      {gathering.gifts ? (
        <NavCard
          icon="gift"
          iconColor="#a5532f"
          iconBackground="#f6d9c4"
          title="Gift lists"
          subtitle={forWhom.length ? `${forWhom.join(" & ")}'s Wishbook${forWhom.length > 1 ? "s" : ""} in the Gift Nook` : "Everyone's Wishbooks, in the Gift Nook"}
          onPress={() => router.push(`/gift-nook/gathering/${id}`)}
        />
      ) : null}
      {potluckId ? (
        <NavCard
          icon="potluck"
          iconColor="#4f6b45"
          iconBackground="#dfe8d6"
          title="Potluck"
          subtitle="Who's bringing what"
          onPress={() => router.push(`/potluck/${potluckId}`)}
        />
      ) : canHost && !archived ? (
        <NavCard
          icon="potluck"
          iconColor="#4f6b45"
          iconBackground="#dfe8d6"
          title="Add a Potluck"
          subtitle="Sort out who's bringing what to eat"
          onPress={startPotluck}
        />
      ) : null}
      {!gathering.gifts && canHost && !archived ? (
        <NavCard
          icon="gift"
          iconColor="#a5532f"
          iconBackground="#f6d9c4"
          title="Add gift lists"
          subtitle="Turn it on in Change, and it shows in the Gift Nook"
          onPress={() => router.push({ pathname: "/gatherings/form", params: { gatheringId: id, gifts: "1" } })}
        />
      ) : null}

      <SectionHeader title={`Who's invited (${guests.length})`} icon="invite" />
      <Text style={ui.muted}>
        {[
          burrows.length ? `Everyone in ${burrows.map((b) => b.name).join(", ")}` : null,
          pickedAlone ? `${pickedAlone} ${pickedAlone === 1 ? "person" : "people"} picked one by one` : null,
        ]
          .filter(Boolean)
          .join(", plus ")}
      </Text>
      <Text style={[ui.cardTitle, { color: kind.color }]}>{guestSummary(guests)}</Text>
      {groups.map((group) => (
        <View key={group.status ?? "waiting"} style={[ui.card, { gap: 10 }]}>
          <Text style={[ui.muted, { fontWeight: "700" }]}>
            {group.status ? rsvpChoices.find((c) => c.key === group.status)!.label : "Hasn't answered"} · {group.people.length}
          </Text>
          {group.people.map((guest) => (
            <GuestRow key={guest.profile_id} guest={guest} me={guest.profile_id === userId} />
          ))}
        </View>
      ))}
    </NookScroll>
  );
}

// "Put it on my Hearth" (GATH-009): a widget with its day, who's coming,
// your gift shopping and the Potluck, all in one. Once it's on, tapping
// here offers to go there or take it off.
function HearthPin({ gatheringId, title, over }: { gatheringId: string; title: string; over: boolean }) {
  const router = useRouter();
  const { layout, save, isLoading } = useHearthLayout();
  const pinned = gatheringWidgets(layout, gatheringId);
  const onHearth = pinned.length > 0;

  if (isLoading || (over && !onHearth)) return null;

  async function pin() {
    const size = widgetKindInfo("gathering").size;
    const items = addItem(layout, { id: newItemId("w"), kind: "widget", widget: gatheringWidget(gatheringId, title), ...size });
    // A page only holds so much (CORE-066).
    const full = overflowing(layout, { ...layout, items });
    if (full) {
      const message = fullMessage(full);
      return Alert.alert(message.title, message.body);
    }
    try {
      await save({ items });
      tap("success");
    } catch (saveError) {
      Alert.alert("Couldn't put it on your Hearth", friendlyError(saveError as { message?: string }));
    }
  }

  function takeOff() {
    tap();
    const ids = new Set(pinned.map((item) => item.id));
    save(removeEverywhere(layout, (item) => ids.has(item.id))).catch(
      (saveError) => Alert.alert("Couldn't take it off", friendlyError(saveError as { message?: string }))
    );
  }

  if (!onHearth) {
    return (
      <NavCard
        icon="hearth"
        iconColor={colors.bark}
        iconBackground={colors.barkSoft}
        title="Put it on my Hearth"
        subtitle="The day, who's coming, your gifts and the Potluck, all in one place"
        right={<Icon name="add" size={20} color={colors.bark} />}
        onPress={pin}
      />
    );
  }
  return (
    <NavCard
      icon="hearth"
      iconColor="#3f7a4f"
      iconBackground="#dcebdc"
      title="On your Hearth"
      subtitle={`${over ? "" : `${gatheringWhenOver.find((c) => c.key === pinned[0].widget.settings.whenOver)?.hint ?? ""} `}Tap to go there or take it off.`}
      right={<Icon name="check" size={20} color="#3f7a4f" />}
      onPress={() =>
        Alert.alert("On your Hearth", undefined, [
          { text: "Go to my Hearth", onPress: () => router.navigate("/hearth") },
          { text: "Take it off", style: "destructive", onPress: takeOff },
          { text: "Cancel", style: "cancel" },
        ])
      }
    />
  );
}

function GuestRow({ guest, me }: { guest: Guest; me: boolean }) {
  return (
    <View style={[ui.row, { gap: 10 }]}>
      <Avatar name={guest.display_name} icon={guest.avatar_icon} color={guest.avatar_color} photo={guest.avatar_path} size={32} />
      <Text style={[ui.cardTitle, { flex: 1, fontSize: 15 }]}>
        {displayName(guest)}
        {me ? " (you)" : ""}
      </Text>
      {guest.extra_guests && guest.status !== "no" ? <Text style={ui.muted}>+{guest.extra_guests}</Text> : null}
      {guest.is_host ? <Text style={styles.hostTag}>Host</Text> : null}
    </View>
  );
}

function Detail({ icon, text }: { icon: IconName; text: string }) {
  return (
    <View style={[ui.row, { gap: 8, alignItems: "flex-start" }]}>
      <View style={{ height: 21, justifyContent: "center" }}>
        <Icon name={icon} size={16} color={colors.muted} />
      </View>
      <Text style={{ color: colors.text, fontSize: 15, lineHeight: 21, flex: 1 }}>{text}</Text>
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    title: { fontSize: 22, fontWeight: "800", color: colors.text, letterSpacing: -0.3 },
    hostTag: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.bark,
      backgroundColor: colors.barkSoft,
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 999,
      overflow: "hidden",
    },
  })
);
