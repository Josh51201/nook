import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { Faces } from "../../components/getaway-bits";
import { HeaderWithHelp } from "../../components/help-button";
import { IconBadge } from "../../components/icon";
import { Appear, LoadingScreen, Tap } from "../../components/motion";
import { NookHero } from "../../components/nook-hero";
import { NookScroll } from "../../components/nook-scroll";
import { Text } from "../../components/text";
import { Button, EmptyState, HeaderIcon, SectionHeader } from "../../components/ui";
import { useAuth } from "../../lib/auth-context";
import { groupGetaways, kindInfo, leftToPack, nextGetaway, rangeWords, tripState, whenWords, type Getaway } from "../../lib/getaways";
import { useGetaways } from "../../lib/getaways-data";
import { findNook } from "../../lib/nooks";
import { colors, ui } from "../../lib/theme";

const nook = findNook("getaways")!;

// Getaway home (TRIP-001, TRIP-010): a countdown to the next one, then
// what's happening now, what's coming up, and past trips.
export default function GetawaysHome() {
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user.id;
  const { data, error, isLoading, reload } = useGetaways(userId);
  const [showPast, setShowPast] = useState(false);

  if (isLoading && !data) return <LoadingScreen cards={3} />;
  if (!data) {
    return (
      <NookScroll onRefresh={reload}>
        <EmptyState icon="plane" title="Couldn't open Getaways" body={error ?? "Check your connection and try again."} />
      </NookScroll>
    );
  }

  const groups = groupGetaways(data.trips, data.today);
  const next = nextGetaway(data.trips, data.today);
  const nextItems = next ? data.items.filter((i) => i.getaway_id === next.id) : [];
  const toPack = next && userId ? leftToPack(nextItems, userId) : 0;
  const toDo = nextItems.filter((i) => i.kind === "todo" && !i.done_at).length;

  const headline = !next
    ? data.trips.length
      ? "Where to next?"
      : "Plan your first Getaway"
    : tripState(next, data.today) === "now"
      ? `${next.title}: ${whenWords(next, data.today).toLowerCase()}`
      : `${next.title} ${whenWords(next, data.today).toLowerCase()}`;

  function card(trip: Getaway, index: number) {
    const kind = kindInfo(trip.kind);
    const people = data!.travelers
      .filter((t) => t.getaway_id === trip.id)
      .map((t) => data!.profiles.get(t.profile_id) ?? { id: t.profile_id, display_name: null });
    const items = data!.items.filter((i) => i.getaway_id === trip.id);
    const packLeft = userId ? leftToPack(items, userId) : 0;
    const past = tripState(trip, data!.today) === "past";
    return (
      <Appear key={trip.id} index={index}>
        <Tap
          onPress={() => router.push(`/getaways/${trip.id}`)}
          style={[ui.card, styles.card, past && { opacity: 0.8 }]}
          accessibilityRole="button"
          accessibilityLabel={`${trip.title}, ${rangeWords(trip.starts_on, trip.ends_on, data!.today)}, ${whenWords(trip, data!.today)}`}
        >
          <IconBadge name={kind.icon} size={44} color={nook.iconColor} background={colors.dark ? `${nook.iconColor}33` : nook.color} />
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={ui.cardTitle} numberOfLines={1}>
              {trip.title}
            </Text>
            <Text style={[ui.muted, { fontSize: 13 }]} numberOfLines={1}>
              {[rangeWords(trip.starts_on, trip.ends_on, data!.today), trip.place].filter(Boolean).join(" · ")}
            </Text>
            <View style={[ui.row, { gap: 10, marginTop: 4 }]}>
              <Faces people={people} size={24} max={5} />
              {!past && packLeft ? <Text style={[ui.muted, { fontSize: 12 }]}>{packLeft} to pack</Text> : null}
            </View>
          </View>
          <Text style={[ui.muted, { fontSize: 13, fontWeight: "600", color: past ? colors.muted : nook.iconColor }]}>
            {whenWords(trip, data!.today)}
          </Text>
        </Tap>
      </Appear>
    );
  }

  return (
    <NookScroll onRefresh={reload}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <HeaderWithHelp nook="getaways">
              <HeaderIcon icon="settings" label="Getaway Nook settings" onPress={() => router.push("/getaways/settings")} />
            </HeaderWithHelp>
          ),
        }}
      />

      <NookHero
        icon={next ? kindInfo(next.kind).icon : "plane"}
        accent={nook.iconColor}
        tint={nook.color}
        headline={headline}
        facts={
          next
            ? [
                { icon: "calendar", text: rangeWords(next.starts_on, next.ends_on, data.today) },
                ...(toPack ? [{ icon: "clothes" as const, text: `${toPack} thing${toPack === 1 ? "" : "s"} left to pack` }] : []),
                ...(toDo ? [{ icon: "todo" as const, text: `${toDo} before-you-go task${toDo === 1 ? "" : "s"}` }] : []),
              ]
            : [{ icon: "group", text: "Planned together with the people going" }]
        }
      />

      {!data.trips.length ? (
        <>
          <EmptyState
            icon="plane"
            title="No Getaways yet"
            body="A beach week, a weekend at Grandma's, a road trip: add who's going, and you'll all share the packing lists, a before-you-go checklist, the confirmations and a day-by-day plan."
          />
          <Button title="Plan a Getaway" icon="add" onPress={() => router.push("/getaways/form")} />
        </>
      ) : (
        <>
          {groups.now.length ? (
            <View style={{ gap: 10 }}>
              <SectionHeader title="Happening now" icon="sun" />
              {groups.now.map(card)}
            </View>
          ) : null}
          {groups.upcoming.length ? (
            <View style={{ gap: 10 }}>
              <SectionHeader title="Coming up" icon="calendar" />
              {groups.upcoming.map(card)}
            </View>
          ) : null}

          <Button title="Plan a Getaway" icon="add" onPress={() => router.push("/getaways/form")} />

          {groups.past.length ? (
            <View style={{ gap: 10 }}>
              <SectionHeader
                title="Past Getaways"
                icon="clock"
                right={
                  <Tap onPress={() => setShowPast((v) => !v)} hitSlop={8}>
                    <Text style={ui.link}>{showPast ? "Hide" : `Show ${groups.past.length}`}</Text>
                  </Tap>
                }
              />
              {showPast ? groups.past.map(card) : null}
            </View>
          ) : null}
        </>
      )}
    </NookScroll>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
});
