import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";

import { HeaderWithHelp } from "../../components/help-button";
import { Icon, IconBadge } from "../../components/icon";
import { Appear, LoadingScreen, Tap } from "../../components/motion";
import { NookHero } from "../../components/nook-hero";
import { NookScroll } from "../../components/nook-scroll";
import { Text } from "../../components/text";
import { Button, EmptyState, HeaderIcon, SectionHeader } from "../../components/ui";
import { useAuth } from "../../lib/auth-context";
import { guarded } from "../../lib/feedback";
import { groupGatherings, rsvpLabel, whenWords } from "../../lib/gatherings";
import { loadGatherings, type GatheringListItem } from "../../lib/gatherings-data";
import { countdown, gatheringKindInfo } from "../../lib/gift-nook";
import { findNook } from "../../lib/nooks";
import { supabase } from "../../lib/supabase";
import { colors, themed, ui } from "../../lib/theme";

const nook = findNook("gatherings")!;

// Gathering home (GATH-001): every get-together you're invited to, whatever
// it's for — this week first, then later on, then ones that just happened.
// Each says whether it has gift lists or a Potluck, and what you answered.
//   ?burrowId=…  only the ones that Burrow is invited to (from its page)
export default function GatheringsHome() {
  const router = useRouter();
  const { burrowId } = useLocalSearchParams<{ burrowId?: string }>();
  const { session } = useAuth();
  const userId = session?.user.id;
  const [rows, setRows] = useState<GatheringListItem[] | null>(null);
  const [burrowName, setBurrowName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPast, setShowPast] = useState(false);

  const load = useCallback(
    () =>
      guarded(async () => {
        setRows(await loadGatherings(burrowId));
        if (burrowId) {
          const { data } = await supabase.from("burrows").select("name").eq("id", burrowId).maybeSingle();
          setBurrowName(data?.name ?? null);
        }
      }, setError, () => {}),
    [burrowId]
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (!rows) {
    if (error) {
      return (
        <NookScroll onRefresh={load}>
          <EmptyState icon="celebration" title="Couldn't open Gatherings" body={error} />
        </NookScroll>
      );
    }
    return <LoadingScreen cards={3} />;
  }

  const groups = groupGatherings(rows);
  const next = groups.thisWeek[0] ?? groups.later[0];
  const toAnswer = [...groups.thisWeek, ...groups.later].filter(
    (g) => !g.gathering_rsvps.some((r) => r.profile_id === userId)
  ).length;

  function plan() {
    router.push({ pathname: "/gatherings/form", params: burrowId ? { burrowId } : {} });
  }

  function card(gathering: GatheringListItem, index: number) {
    const kind = gatheringKindInfo(gathering.kind);
    const mine = gathering.gathering_rsvps.find((r) => r.profile_id === userId)?.status ?? null;
    const past = new Date(gathering.ends_at).getTime() < Date.now();
    const extras = [gathering.gifts ? "Gift lists" : null, gathering.potlucks.length ? "Potluck" : null].filter(Boolean);
    return (
      <Appear key={gathering.id} index={index}>
        <Tap
          onPress={() => router.push(`/gatherings/${gathering.id}`)}
          style={[ui.card, styles.card, past && { opacity: 0.8 }]}
          accessibilityRole="button"
          accessibilityLabel={`${gathering.title}, ${whenWords(gathering)}, ${countdown(gathering.ends_at)}. You: ${rsvpLabel(mine)}`}
        >
          <IconBadge name={kind.icon} size={44} color={kind.color} background={`${kind.color}1f`} />
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={ui.cardTitle}>{gathering.title}</Text>
            <Text style={[ui.muted, { fontSize: 13 }]}>
              {[whenWords(gathering), gathering.place].filter(Boolean).join(" · ")}
            </Text>
            <View style={[ui.row, { gap: 8, marginTop: 3, flexWrap: "wrap" }]}>
              {!past ? (
                <Text style={[styles.pill, mine === "going" && styles.pillGoing, !mine && styles.pillAsk]}>
                  {mine ? rsvpLabel(mine) : "Are you coming?"}
                </Text>
              ) : null}
              {extras.length ? <Text style={[ui.muted, { fontSize: 12 }]}>{extras.join(" · ")}</Text> : null}
            </View>
          </View>
          <Text style={[ui.muted, { fontSize: 13, fontWeight: "600", color: past ? colors.muted : kind.color, maxWidth: 90, textAlign: "right" }]}>
            {countdown(gathering.ends_at)}
          </Text>
        </Tap>
      </Appear>
    );
  }

  return (
    <NookScroll onRefresh={load}>
      <Stack.Screen
        options={{
          title: burrowName ? `${burrowName}'s Gatherings` : "Gathering Nook",
          headerRight: () => (
            <HeaderWithHelp nook="gatherings">
              <HeaderIcon icon="settings" label="Gathering Nook settings" onPress={() => router.push("/gatherings/settings")} />
            </HeaderWithHelp>
          ),
        }}
      />

      <NookHero
        icon={next ? gatheringKindInfo(next.kind).icon : nook.icon}
        accent={nook.iconColor}
        tint={nook.color}
        headline={next ? `${next.title} ${countdown(next.ends_at)}` : rows.length ? "Nothing planned yet" : "Plan your first Gathering"}
        facts={
          next
            ? [
                { icon: "calendar", text: whenWords(next) },
                ...(next.place ? [{ icon: "place" as const, text: next.place }] : []),
                ...(toAnswer ? [{ icon: "invite" as const, text: `${toAnswer} waiting for your answer` }] : []),
              ]
            : [{ icon: "group", text: "Invite whole Burrows, or just a few people" }]
        }
      />

      <Button title="Plan a Gathering" icon="add" onPress={plan} />

      {!groups.thisWeek.length && !groups.later.length ? (
        <EmptyState
          icon="celebration"
          title="Nothing coming up"
          body="A birthday, Christmas at Grandma's, a game night: plan it here, invite who's coming, and add gift lists or a Potluck if it needs them."
        />
      ) : null}

      {groups.thisWeek.length ? (
        <View style={{ gap: 10 }}>
          <SectionHeader title="This week" icon="sun" />
          {groups.thisWeek.map(card)}
        </View>
      ) : null}
      {groups.later.length ? (
        <View style={{ gap: 10 }}>
          <SectionHeader title="Coming up" icon="calendar" />
          {groups.later.map(card)}
        </View>
      ) : null}

      {groups.past.length ? (
        <View style={{ gap: 10 }}>
          <SectionHeader
            title="Recently"
            icon="clock"
            right={
              <Tap onPress={() => setShowPast((v) => !v)} hitSlop={8} style={[ui.row, { gap: 4 }]}>
                <Text style={ui.link}>{showPast ? "Hide" : `Show ${groups.past.length}`}</Text>
                <Icon name="chevron" size={11} color={colors.bark} />
              </Tap>
            }
          />
          {showPast ? groups.past.map(card) : null}
        </View>
      ) : null}
    </NookScroll>
  );
}

const styles = themed(() =>
  StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  pill: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.muted,
    backgroundColor: colors.barkSoft,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: "hidden",
  },
  pillGoing: { color: "#3f7a4f", backgroundColor: "#dfe8d6" },
  pillAsk: { color: colors.bark },
  })
);
