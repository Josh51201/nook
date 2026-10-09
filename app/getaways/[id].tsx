import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { Faces } from "../../components/getaway-bits";
import { Icon, IconBadge } from "../../components/icon";
import { Appear, LoadingScreen, Tap } from "../../components/motion";
import { NookScroll } from "../../components/nook-scroll";
import { Text } from "../../components/text";
import { Button, EmptyState, NavCard, SectionHeader } from "../../components/ui";
import { useAuth } from "../../lib/auth-context";
import { displayName } from "../../lib/gift-nook";
import {
  balances,
  dueWords,
  itinerary,
  kindInfo,
  leftToPack,
  packProgress,
  rangeWords,
  sortTodos,
  totalSpent,
  tripState,
  weekdayWords,
  whenWords,
} from "../../lib/getaways";
import { useGetaway } from "../../lib/getaways-data";
import { findNook } from "../../lib/nooks";
import { formatMoney } from "../../lib/subscriptions";
import { supabase } from "../../lib/supabase";
import { colors, ui } from "../../lib/theme";

const nook = findNook("getaways")!;

// While you're away (TRIP-012): a Sitter Sheet link already made for these
// days, and your Home's pets, so a sitter can be set up in one tap.
function useAwayHelp(startsOn: string | undefined, endsOn: string | undefined) {
  const [help, setHelp] = useState<{ links: string[]; pets: { id: string; name: string }[] } | null>(null);
  useEffect(() => {
    if (!startsOn || !endsOn) return;
    let live = true;
    (async () => {
      const { data: homeId } = await supabase.rpc("my_home");
      const [links, pets] = await Promise.all([
        supabase.from("sitter_links").select("label").eq("home_id", homeId).lte("starts_on", endsOn).gte("ends_on", startsOn),
        supabase.from("pets").select("id, name").eq("home_id", homeId).order("name"),
      ]);
      if (live) {
        setHelp({
          links: ((links.data ?? []) as { label: string }[]).map((l) => l.label),
          pets: (pets.data ?? []) as { id: string; name: string }[],
        });
      }
    })().catch(() => live && setHelp({ links: [], pets: [] }));
    return () => {
      live = false;
    };
  }, [startsOn, endsOn]);
  return help;
}

// One Getaway (TRIP-001..012): the countdown, who's going, and a way into
// each part: packing, before you go, confirmations, day by day, and costs.
export default function GetawayPage() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const userId = session?.user.id;
  const { data, isLoading, reload } = useGetaway(id, userId);
  const help = useAwayHelp(data?.trip.starts_on, data?.trip.ends_on);

  if (isLoading && !data) return <LoadingScreen cards={4} />;
  if (!data) {
    return <EmptyState icon="plane" title="That Getaway isn't here" body="It may have been removed, or you were taken off it." />;
  }

  const { trip, today } = data;
  const kind = kindInfo(trip.kind);
  const state = tripState(trip, today);
  const pack = packProgress(data.items);
  const myLeft = userId ? leftToPack(data.items, userId) : 0;
  const todos = sortTodos(data.items.filter((i) => i.kind === "todo"));
  const todoLeft = todos.filter((t) => !t.done_at);
  const days = itinerary(trip, data.bookings, data.plans);
  const planned = days.reduce((n, d) => n + d.entries.length, 0);
  const spent = totalSpent(data.costs);
  const mine = userId ? balances(data.costs, data.coveredBy).get(userId) ?? 0 : 0;
  const nextBooking = data.bookings.find((b) => b.starts_on >= today) ?? null;
  const go = (path: string) => router.push(`/getaways/${path}?id=${trip.id}` as never);
  const dates = `startsOn=${trip.starts_on}&endsOn=${trip.ends_on}`;

  return (
    <NookScroll onRefresh={reload}>
      <Stack.Screen
        options={{
          title: kind.label,
          headerRight: () => (
            <Tap onPress={() => router.push({ pathname: "/getaways/form", params: { id: trip.id } })} hitSlop={10} style={[ui.row, { gap: 5 }]}>
              <Icon name="edit" size={17} />
              <Text style={{ color: colors.bark, fontSize: 17, fontWeight: "600" }}>Edit</Text>
            </Tap>
          ),
        }}
      />

      <Appear>
        <View style={[styles.hero, { backgroundColor: colors.dark ? `${nook.iconColor}26` : nook.color }]}>
          <IconBadge name={kind.icon} size={56} color={nook.iconColor} background={colors.surface} />
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={[styles.title, { color: colors.text }]}>{trip.title}</Text>
            <Text style={[ui.muted, { color: colors.text }]}>
              {[rangeWords(trip.starts_on, trip.ends_on, today), trip.place].filter(Boolean).join(" · ")}
            </Text>
            <Text style={{ color: nook.iconColor, fontSize: 18, fontWeight: "800" }}>{whenWords(trip, today)}</Text>
          </View>
        </View>
      </Appear>

      <Tap onPress={() => go("people")} style={[ui.card, ui.row, { gap: 12 }]} accessibilityRole="button" accessibilityLabel="Who's going">
        <Faces people={data.people} />
        <Text style={[ui.muted, { flex: 1, color: colors.text }]} numberOfLines={2}>
          {data.people.map((p) => (p.id === userId ? "You" : displayName(p))).join(", ")}
        </Text>
        <Icon name="chevron" size={16} color={colors.muted} />
      </Tap>

      <NavCard
        icon="clothes"
        title="Packing"
        subtitle={
          pack.total
            ? `${pack.done} of ${pack.total} packed${myLeft ? ` · ${myLeft} left for you` : ""}`
            : "Everyone's list, plus a shared one"
        }
        onPress={() => go("packing")}
        index={1}
      />
      <NavCard
        icon="todo"
        title="Before you go"
        subtitle={
          todoLeft.length
            ? `${todoLeft.length} left · ${todoLeft[0].text}${todoLeft[0].due_on ? ` (${dueWords(todoLeft[0].due_on, today)?.toLowerCase()})` : ""}`
            : todos.length
              ? "All done"
              : "Book the sitter, hold the mail…"
        }
        onPress={() => go("todos")}
        index={2}
      />
      <NavCard
        icon="doc"
        title="Confirmations"
        subtitle={
          data.bookings.length
            ? nextBooking
              ? `${data.bookings.length} saved · next: ${nextBooking.title}, ${weekdayWords(nextBooking.starts_on)}`
              : `${data.bookings.length} saved`
            : "Flights, places to stay, cars, tickets"
        }
        onPress={() => go("bookings")}
        index={3}
      />
      <NavCard
        icon="calendar"
        title="Day by day"
        subtitle={planned ? `${planned} thing${planned === 1 ? "" : "s"} planned over ${days.length} days` : "What you're doing each day"}
        onPress={() => go("itinerary")}
        index={4}
      />
      <NavCard
        icon="money"
        title="Costs"
        subtitle={
          data.costs.length
            ? `${formatMoney(spent)} spent · ${mine > 0 ? `you're owed ${formatMoney(mine)}` : mine < 0 ? `you owe ${formatMoney(-mine)}` : "you're all square"}`
            : "Who paid for what, and who owes whom"
        }
        onPress={() => go("costs")}
        index={5}
      />

      {state !== "past" && help ? (
        <>
          <SectionHeader title="While you're away" icon="hearth" />
          <View style={[ui.card, { gap: 10 }]}>
            {help.links.length ? (
              <View style={[ui.row, { gap: 10 }]}>
                <Icon name="check" size={18} color={nook.iconColor} />
                <Text style={[ui.muted, { flex: 1, color: colors.text }]}>Sitter Sheet link ready: {help.links.join(", ")}</Text>
              </View>
            ) : (
              <Text style={ui.muted}>Someone watching the house or the pets? Send them your Sitter Sheet for these days.</Text>
            )}
            <Button
              title={help.links.length ? "Make another sitter link" : "Make a sitter link for these days"}
              icon="sitter"
              variant="secondary"
              onPress={() => router.push(`/sitter/link?${dates}&label=${encodeURIComponent(trip.title)}` as never)}
            />
            {help.pets.map((pet) => (
              <Button
                key={pet.id}
                title={`Let a sitter feed ${pet.name} until ${weekdayWords(trip.ends_on)}`}
                icon="paw"
                variant="secondary"
                onPress={() => router.push(`/pets/helpers?petId=${pet.id}&until=${trip.ends_on}` as never)}
              />
            ))}
          </View>
        </>
      ) : null}

      {trip.notes ? (
        <>
          <SectionHeader title="Notes" icon="edit" />
          <View style={ui.card}>
            <Text style={[ui.muted, { color: colors.text }]}>{trip.notes}</Text>
          </View>
        </>
      ) : null}
    </NookScroll>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: "row", alignItems: "center", gap: 16, padding: 18, borderRadius: 24 },
  title: { fontSize: 24, fontWeight: "800", letterSpacing: -0.5 },
});
