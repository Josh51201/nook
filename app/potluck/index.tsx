import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { View } from "react-native";
import { Text } from "../../components/text";

import { LoadingScreen } from "../../components/motion";
import { NookHero } from "../../components/nook-hero";
import { NookScroll } from "../../components/nook-scroll";
import { Button, EmptyState, HeaderIcon, NavCard, SectionHeader } from "../../components/ui";
import { HeaderWithHelp } from "../../components/help-button";
import { useAuth } from "../../lib/auth-context";
import { guarded } from "../../lib/feedback";
import { whenWords } from "../../lib/gatherings";
import { countdown } from "../../lib/gift-nook";
import { headcount, type Rsvp } from "../../lib/potluck";
import { formatWhen } from "../../lib/potluck-data";
import { findNook } from "../../lib/nooks";
import { supabase } from "../../lib/supabase";
import { colors, ui } from "../../lib/theme";

type Row = {
  id: string;
  title: string;
  starts_at: string;
  place: string | null;
  gatherings: { title: string; starts_at: string | null; ends_at: string; gathering_rsvps: Rsvp[] } | null;
  // The Gathering's answers (GATH-006), which are the Potluck's.
  potluck_rsvps: Rsvp[];
  potluck_dishes: { brought_by: string; name: string }[];
};

const rsvpWords = { going: "You're going", maybe: "You're a maybe", no: "You can't make it" };

// Potluck home (POT-001/002): every Potluck you're invited to, soonest
// first. Opened from a Burrow's page it shows just the ones that Burrow is
// invited to (?burrowId=).
export default function PotluckHome() {
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user.id;
  const { burrowId } = useLocalSearchParams<{ burrowId?: string }>();

  const [rows, setRows] = useState<Row[]>([]);
  const [burrowName, setBurrowName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    () =>
      guarded(
        async () => {
          const invited = burrowId ? ", gathering_burrows!inner(burrow_id)" : "";
          let query = supabase
            .from("potlucks")
            .select(
              `id, title, starts_at, place, gatherings${burrowId ? "!inner" : ""}(title, starts_at, ends_at, gathering_rsvps(profile_id, status, extra_guests)${invited}), potluck_dishes(brought_by, name)`
            )
            .order("starts_at");
          if (burrowId) query = query.eq("gatherings.gathering_burrows.burrow_id", burrowId);
          const { data, error: loadError } = await query;
          if (loadError) setError(loadError.message);
          setRows(
            ((data ?? []) as unknown as Row[]).map((row) => ({ ...row, potluck_rsvps: row.gatherings?.gathering_rsvps ?? [] }))
          );
          if (burrowId) {
            const { data: burrow } = await supabase.from("burrows").select("name").eq("id", burrowId).maybeSingle();
            setBurrowName(burrow?.name ?? null);
          }
          setIsLoading(false);
        },
        setError,
        () => setIsLoading(false)
      ),
    [burrowId]
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (isLoading) return <LoadingScreen cards={3} />;

  // Still "coming up" until the day is over.
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const upcoming = rows.filter((row) => new Date(row.starts_at) >= startOfToday);
  const past = rows.filter((row) => new Date(row.starts_at) < startOfToday).reverse();

  function card(row: Row, i: number) {
    const mine = row.potluck_rsvps.find((r) => r.profile_id === userId);
    const bringing = row.potluck_dishes.filter((d) => d.brought_by === userId).map((d) => d.name);
    const { going } = headcount(row.potluck_rsvps);
    const details = [
      mine ? rsvpWords[mine.status] : "Not answered yet",
      going ? `${going} coming` : null,
      bringing.length ? `you're bringing ${bringing.join(", ")}` : null,
    ].filter(Boolean);
    return (
      <NavCard
        key={row.id}
        index={i}
        icon="potluck"
        iconColor="#4f6b45"
        iconBackground="#dfe8d6"
        title={row.title}
        subtitle={[
          `${row.gatherings ? whenWords(row.gatherings) : formatWhen(row.starts_at)} · ${countdown(row.starts_at)}`,
          row.place,
        ]
          .filter(Boolean)
          .join(" · ")}
        onPress={() => router.push(`/potluck/${row.id}`)}
      >
        <Text style={[ui.muted, { marginTop: 6, marginLeft: 52, color: mine ? colors.text : colors.bark }]}>
          {details.join(" · ")}
        </Text>
      </NavCard>
    );
  }

  return (
    <NookScroll onRefresh={load}>
      <Stack.Screen
        options={{
          title: burrowName ? `${burrowName} Potlucks` : "Potluck Nook",
          headerRight: () => (
            <HeaderWithHelp>
              <HeaderIcon icon="settings" label="Potluck Nook settings" onPress={() => router.push("/potluck/settings")} />
            </HeaderWithHelp>
          ),
        }}
      />
      {error ? <Text style={ui.error}>{error}</Text> : null}

      <NookHero
        icon="potluck"
        accent={findNook("potluck")!.iconColor}
        tint={findNook("potluck")!.color}
        headline={upcoming[0] ? `${upcoming[0].title} ${countdown(upcoming[0].starts_at)}` : "No Potlucks planned"}
        facts={
          upcoming[0]
            ? [
                {
                  icon: "potluck",
                  text: (() => {
                    const mine = upcoming[0].potluck_dishes.filter((d) => d.brought_by === userId).map((d) => d.name);
                    return mine.length ? `You're bringing ${mine.join(", ")}` : "You haven't signed up to bring anything";
                  })(),
                },
                { icon: "group", text: `${headcount(upcoming[0].potluck_rsvps).going} coming` },
                ...(upcoming.length > 1 ? [{ icon: "calendar" as const, text: `${upcoming.length - 1} more after that` }] : []),
              ]
            : [{ icon: "sparkles", text: "Plan one and everyone signs up to bring something" }]
        }
      />

      <SectionHeader title="Coming up" icon="calendar" />
      {upcoming.length === 0 ? (
        <EmptyState
          icon="potluck"
          title="No Potlucks planned"
          body="Plan one for any get-together — Christmas, Sunday dinner, a cookout — and everyone invited signs up to bring something."
        />
      ) : (
        upcoming.map(card)
      )}
      <Button
        title="Plan a Potluck"
        icon="add"
        onPress={() => router.push({ pathname: "/potluck/form", params: burrowId ? { burrowId } : {} })}
      />

      {past.length > 0 ? (
        <View style={{ gap: 14, opacity: 0.75 }}>
          <SectionHeader title="Past" icon="given" />
          {past.map(card)}
        </View>
      ) : null}
    </NookScroll>
  );
}
