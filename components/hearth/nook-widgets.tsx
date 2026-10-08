import { useEffect, useState } from "react";
import { View } from "react-native";
import { Text } from "../text";
import Animated, { FadeInRight } from "react-native-reanimated";

import { useAuth } from "../../lib/auth-context";
import { countdown, gatheringKindInfo } from "../../lib/gift-nook";
import { headcount, slotRoom, type Rsvp, type Slot } from "../../lib/potluck";
import { formatWhen } from "../../lib/potluck-data";
import { supabase } from "../../lib/supabase";
import { Icon } from "../icon";

// Live info a Nook can show on its Hearth tile (CORE-010): one short line on
// a small tile, a little more on a wide one, and a full panel on a large
// one. Keyed by Nook id; Nooks without one just show their tagline.

export type NookWidgetProps = {
  size: "small" | "wide" | "large";
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

type UpcomingGathering = { id: string; title: string; kind: string; ends_at: string };

// GIFT-007: shows Gatherings only — never anything about claims.
function GiftNookWidget({ size, refreshKey, textColor, mutedColor }: NookWidgetProps) {
  const [upcoming, setUpcoming] = useState<UpcomingGathering[] | null>(null);

  useEffect(() => {
    supabase
      .from("gatherings")
      .select("id, title, kind, ends_at")
      .gt("ends_at", new Date().toISOString())
      .order("ends_at")
      .limit(4)
      .then(({ data }) => setUpcoming((data ?? []) as UpcomingGathering[]));
  }, [refreshKey]);

  if (!upcoming) return null;
  if (upcoming.length === 0) {
    return <Text style={{ color: mutedColor, fontSize: 13 }}>No Gatherings coming up</Text>;
  }
  if (size === "small") {
    return (
      <Text style={{ color: mutedColor, fontSize: 12 }} numberOfLines={1}>
        {upcoming[0].title} {countdown(upcoming[0].ends_at)}
      </Text>
    );
  }

  const shown = size === "large" ? upcoming : upcoming.slice(0, 1);
  return (
    <View style={{ gap: size === "large" ? 9 : 6 }}>
      {shown.map((gathering, i) => {
        const kind = gatheringKindInfo(gathering.kind);
        return (
          <Animated.View
            key={gathering.id}
            entering={FadeInRight.delay(i * 60).springify().damping(18)}
            style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
          >
            <Icon name={kind.icon} size={15} color={kind.color} />
            <Text style={{ color: textColor, fontSize: 14, flex: 1, fontWeight: i === 0 ? "700" : "500" }} numberOfLines={1}>
              {gathering.title}
            </Text>
            <Text style={{ color: mutedColor, fontSize: 12 }}>{countdown(gathering.ends_at)}</Text>
          </Animated.View>
        );
      })}
    </View>
  );
}

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
function PotluckWidget({ size, refreshKey, textColor, mutedColor, accentColor }: NookWidgetProps) {
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
  if (!next) return <Text style={{ color: mutedColor, fontSize: 13 }}>No Potlucks planned</Text>;

  const mine = next.potluck_dishes.filter((dish) => dish.brought_by === userId).map((dish) => dish.name);
  const open = next.potluck_slots.reduce((sum, slot) => sum + slotRoom(slot, next.potluck_dishes).open, 0);
  const { going } = headcount(next.potluck_rsvps);
  const bringing = mine.length ? `You're bringing ${mine.join(", ")}` : open ? `${open} spot${open === 1 ? "" : "s"} still open` : "Not signed up yet";

  if (size === "small") {
    return (
      <Text style={{ color: mutedColor, fontSize: 12 }} numberOfLines={1}>
        {next.title} {countdown(next.starts_at)}
      </Text>
    );
  }
  if (size === "wide") {
    return (
      <View style={{ gap: 2 }}>
        <Text style={{ color: textColor, fontSize: 14, fontWeight: "700" }} numberOfLines={1}>
          {next.title} · {countdown(next.starts_at)}
        </Text>
        <Text style={{ color: mutedColor, fontSize: 13 }} numberOfLines={1}>
          {bringing}
        </Text>
      </View>
    );
  }
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text style={{ color: textColor, fontSize: 16, fontWeight: "800", flex: 1 }} numberOfLines={1}>
          {next.title}
        </Text>
        <Text style={{ color: accentColor, fontSize: 13, fontWeight: "800" }}>{countdown(next.starts_at)}</Text>
      </View>
      <Detail icon="clock" text={formatWhen(next.starts_at)} color={mutedColor} />
      {next.place ? <Detail icon="place" text={next.place} color={mutedColor} /> : null}
      <Detail icon="group" text={going ? `${going} coming` : "Nobody's answered yet"} color={mutedColor} />
      <Detail icon={mine.length ? "check" : "potluck"} text={bringing} color={textColor} bold />
      {after ? (
        <Text style={{ color: mutedColor, fontSize: 12 }} numberOfLines={1}>
          Then {after.title} · {countdown(after.starts_at)}
        </Text>
      ) : null}
    </View>
  );
}

function Detail({
  icon,
  text,
  color,
  bold,
}: {
  icon: "clock" | "place" | "group" | "check" | "potluck";
  text: string;
  color: string;
  bold?: boolean;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
      <Icon name={icon} size={13} color={color} />
      <Text style={{ color, fontSize: 13, flex: 1, fontWeight: bold ? "700" : "400" }} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

export const nookWidgets: Record<string, NookWidget> = {
  "gift-nook": { label: "Coming up", Component: GiftNookWidget },
  potluck: { label: "Next Potluck", Component: PotluckWidget },
};
