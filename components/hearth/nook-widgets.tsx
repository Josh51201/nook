import { useEffect, useState } from "react";
import { View } from "react-native";
import Animated, { FadeInRight } from "react-native-reanimated";

import { useAuth } from "../../lib/auth-context";
import { countdown, gatheringKindInfo } from "../../lib/gift-nook";
import { headcount, slotRoom, type Rsvp, type Slot } from "../../lib/potluck";
import { formatWhen } from "../../lib/potluck-data";
import { supabase } from "../../lib/supabase";
import { useLetterboxSummary } from "../../lib/use-letterbox";
import { fitCount } from "../../lib/widgets";
import { Icon, type IconName } from "../icon";
import { Text } from "../text";

// Live info a Nook can show on its Hearth tile (CORE-010). Each Nook lists
// what it has to say as "facts", most important first; the tile says how
// much room it has, and only the facts that fit are shown — so nothing
// spills over the edge, and a bigger tile simply shows more (CORE-030).

export type NookWidgetProps = {
  // small: centered lines under the icon; wide: beside the icon; large: in a panel.
  size: "small" | "wide" | "large";
  // The room the facts get, in points.
  space: { width: number; height: number };
  refreshKey: number;
  textColor: string;
  mutedColor: string;
  accentColor: string;
};

type NookWidget = {
  // The label over the panel on a large tile.
  label: string;
  Component: (props: NookWidgetProps) => React.ReactElement | null;
};

type Fact =
  // A bold line, with something short on the right (e.g. "in 12 days").
  | { kind: "headline"; text: string; trailing?: string }
  | { kind: "detail"; icon: IconName; text: string; trailing?: string; iconColor?: string; strong?: boolean }
  | { kind: "note"; text: string }
  | { kind: "progress"; fraction: number };

// Line heights are fixed so we know exactly how many fit.
const LINE = {
  large: { headline: 21, detail: 18, note: 16, progress: 6, gap: 7 },
  wide: { headline: 19, detail: 17, note: 16, progress: 5, gap: 4 },
  small: { headline: 16, detail: 16, note: 15, progress: 5, gap: 2 },
};

function Facts({ facts, size, space, textColor, mutedColor, accentColor }: { facts: Fact[] } & Omit<NookWidgetProps, "refreshKey">) {
  const line = LINE[size];
  const shown = facts.slice(0, fitCount(facts.map((f) => line[f.kind]), space.height, line.gap));
  const small = size === "small";

  return (
    <View style={{ gap: line.gap, maxHeight: Math.max(0, space.height), overflow: "hidden", alignSelf: "stretch" }}>
      {shown.map((fact, i) => {
        if (fact.kind === "progress") {
          return (
            <View
              key={i}
              style={{
                height: line.progress,
                borderRadius: line.progress / 2,
                backgroundColor: "rgba(0,0,0,0.08)",
                overflow: "hidden",
                width: small ? "70%" : "100%",
                alignSelf: "center",
              }}
            >
              <View style={{ width: `${Math.round(fact.fraction * 100)}%`, height: "100%", backgroundColor: accentColor }} />
            </View>
          );
        }
        if (small) {
          // Under the icon: one centered line each.
          const text = fact.kind === "note" ? fact.text : [fact.text, fact.trailing].filter(Boolean).join(" · ");
          return (
            <Text
              key={i}
              numberOfLines={1}
              style={{
                fontSize: 12,
                lineHeight: line[fact.kind],
                textAlign: "center",
                color: fact.kind === "headline" ? textColor : mutedColor,
                fontWeight: fact.kind === "headline" ? "700" : "400",
              }}
            >
              {text}
            </Text>
          );
        }
        if (fact.kind === "note") {
          return (
            <Text key={i} numberOfLines={1} style={{ fontSize: 12, lineHeight: line.note, color: mutedColor }}>
              {fact.text}
            </Text>
          );
        }
        const headline = fact.kind === "headline";
        const strong = headline || (fact.kind === "detail" && fact.strong);
        return (
          <Animated.View
            key={i}
            entering={FadeInRight.delay(i * 50).springify().damping(18)}
            style={{ flexDirection: "row", alignItems: "center", gap: 7, height: line[fact.kind] }}
          >
            {fact.kind === "detail" ? <Icon name={fact.icon} size={13} color={fact.iconColor ?? mutedColor} /> : null}
            <Text
              numberOfLines={1}
              style={{
                flex: 1,
                fontSize: headline ? (size === "large" ? 16 : 14) : 13,
                lineHeight: line[fact.kind],
                fontWeight: headline ? "800" : strong ? "700" : "400",
                color: strong || headline ? textColor : mutedColor,
              }}
            >
              {fact.text}
            </Text>
            {fact.trailing ? (
              <Text
                numberOfLines={1}
                style={{
                  fontSize: 12,
                  lineHeight: line[fact.kind],
                  fontWeight: headline ? "800" : "500",
                  color: headline ? accentColor : mutedColor,
                  maxWidth: space.width * 0.45,
                }}
              >
                {fact.trailing}
              </Text>
            ) : null}
          </Animated.View>
        );
      })}
    </View>
  );
}

// --- Gift Nook -----------------------------------------------------------------------

type UpcomingGathering = { id: string; title: string; kind: string; ends_at: string };

// GIFT-007: shows Gatherings only — never anything about claims.
function GiftNookWidget({ refreshKey, ...props }: NookWidgetProps) {
  const [upcoming, setUpcoming] = useState<UpcomingGathering[] | null>(null);

  useEffect(() => {
    supabase
      .from("gatherings")
      .select("id, title, kind, ends_at")
      .gt("ends_at", new Date().toISOString())
      .order("ends_at")
      .limit(8)
      .then(({ data }) => setUpcoming((data ?? []) as UpcomingGathering[]));
  }, [refreshKey]);

  if (!upcoming) return null;
  if (!upcoming.length) return <Facts facts={[{ kind: "note", text: "No Gatherings coming up" }]} {...props} />;

  const facts: Fact[] =
    props.size === "small"
      ? [{ kind: "headline", text: upcoming[0].title, trailing: countdown(upcoming[0].ends_at) }]
      : upcoming.map((g, i) => {
          const kind = gatheringKindInfo(g.kind);
          return { kind: "detail", icon: kind.icon, iconColor: kind.color, text: g.title, trailing: countdown(g.ends_at), strong: i === 0 };
        });
  if (props.size === "small" && upcoming[1]) facts.push({ kind: "note", text: `Then ${upcoming[1].title}` });
  return <Facts facts={facts} {...props} />;
}

// --- Potluck Nook ----------------------------------------------------------------------

type NextPotluck = {
  id: string;
  title: string;
  starts_at: string;
  place: string | null;
  potluck_slots: Slot[];
  potluck_dishes: { slot_id: string | null; brought_by: string; name: string }[];
  potluck_rsvps: Rsvp[];
};

// The next Potluck: when, what you're bringing, and what's still needed.
function PotluckWidget({ refreshKey, ...props }: NookWidgetProps) {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [potlucks, setPotlucks] = useState<NextPotluck[] | null>(null);

  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    supabase
      .from("potlucks")
      .select(
        "id, title, starts_at, place, potluck_slots(id, label, wanted), potluck_dishes(slot_id, brought_by, name), potluck_rsvps(profile_id, status, extra_guests)"
      )
      .gte("starts_at", today.toISOString())
      .order("starts_at")
      .limit(2)
      .then(({ data }) => setPotlucks((data ?? []) as unknown as NextPotluck[]));
  }, [refreshKey]);

  if (!potlucks) return null;
  const [next, after] = potlucks;
  if (!next) return <Facts facts={[{ kind: "note", text: "No Potlucks planned" }]} {...props} />;

  const mine = next.potluck_dishes.filter((dish) => dish.brought_by === userId).map((dish) => dish.name);
  const open = next.potluck_slots.reduce((sum, slot) => sum + slotRoom(slot, next.potluck_dishes).open, 0);
  const { going } = headcount(next.potluck_rsvps);
  const bringing = mine.length ? `You're bringing ${mine.join(", ")}` : open ? `${open} spot${open === 1 ? "" : "s"} still open` : "Not signed up yet";

  const facts: Fact[] = [
    { kind: "headline", text: next.title, trailing: countdown(next.starts_at) },
    { kind: "detail", icon: mine.length ? "check" : "potluck", text: bringing, strong: true },
    { kind: "detail", icon: "clock", text: formatWhen(next.starts_at) },
    ...(next.place ? [{ kind: "detail" as const, icon: "place" as const, text: next.place }] : []),
    { kind: "detail", icon: "group", text: going ? `${going} coming` : "Nobody's answered yet" },
    ...(after ? [{ kind: "note" as const, text: `Then ${after.title} · ${countdown(after.starts_at)}` }] : []),
  ];
  return <Facts facts={facts} {...props} />;
}

// --- Letterbox Nook ----------------------------------------------------------------------

// Card season while it's on (Oct–Jan), otherwise the next birthday.
function LetterboxWidget({ refreshKey, ...props }: NookWidgetProps) {
  const summary = useLetterboxSummary(refreshKey);
  if (!summary) return null;

  const inSeason = [9, 10, 11, 0].includes(new Date().getMonth()) && summary.total > 0;
  const left = summary.toSend.length;
  const when = (days: number) => (days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`);
  const birthdays: Fact[] = summary.birthdays.slice(0, 3).map((b, i) => ({
    kind: "detail",
    icon: "birthday",
    text: `${b.name.split(" ")[0]}'s birthday`,
    trailing: when(b.days),
    strong: i === 0,
  }));
  const cards: Fact[] = summary.total
    ? [
        {
          kind: "headline",
          text: left ? `${left} card${left === 1 ? "" : "s"} to send` : "All cards sent!",
          trailing: `${summary.sent}/${summary.total}`,
        },
        { kind: "progress", fraction: summary.sent / summary.total },
        ...summary.toSend.slice(0, 4).map((h): Fact => ({ kind: "detail", icon: "mail", text: h.name })),
      ]
    : [];

  let facts: Fact[] = inSeason ? [...cards.slice(0, 2), ...birthdays.slice(0, 1), ...cards.slice(2), ...birthdays.slice(1)] : [...birthdays, ...cards];
  if (!facts.length) facts = [{ kind: "note", text: "Add family to get started" }];
  return <Facts facts={facts} {...props} />;
}

export const nookWidgets: Record<string, NookWidget> = {
  "gift-nook": { label: "Coming up", Component: GiftNookWidget },
  potluck: { label: "Next Potluck", Component: PotluckWidget },
  letterbox: { label: "Cards & birthdays", Component: LetterboxWidget },
};
