import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import Animated, { FadeInRight } from "react-native-reanimated";

import { countdown, gatheringKindInfo } from "../../lib/gift-nook";
import { supabase } from "../../lib/supabase";
import { Icon } from "../icon";

// Live info a Nook can show on its Hearth tile when it's big enough
// (CORE-010). Keyed by Nook id; Nooks without a widget just show their
// tagline.

type WidgetProps = { size: "wide" | "large"; refreshKey: number; textColor: string; mutedColor: string };

type UpcomingGathering = { id: string; title: string; kind: string; ends_at: string };

// GIFT-007: shows Gatherings only — never anything about claims.
function GiftNookWidget({ size, refreshKey, textColor, mutedColor }: WidgetProps) {
  const [upcoming, setUpcoming] = useState<UpcomingGathering[] | null>(null);

  useEffect(() => {
    supabase
      .from("gatherings")
      .select("id, title, kind, ends_at")
      .gt("ends_at", new Date().toISOString())
      .order("ends_at")
      .limit(3)
      .then(({ data }) => setUpcoming((data ?? []) as UpcomingGathering[]));
  }, [refreshKey]);

  if (!upcoming) return null;
  if (upcoming.length === 0) {
    return <Text style={{ color: mutedColor, fontSize: 13 }}>No Gatherings coming up</Text>;
  }

  const shown = size === "large" ? upcoming : upcoming.slice(0, 1);
  return (
    <View style={{ gap: 6 }}>
      {shown.map((gathering, i) => {
        const kind = gatheringKindInfo(gathering.kind);
        return (
          <Animated.View
            key={gathering.id}
            entering={FadeInRight.delay(i * 60).springify().damping(18)}
            style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
          >
            <Icon name={kind.icon} size={14} color={kind.color} />
            <Text style={{ color: textColor, fontSize: 13, flex: 1 }} numberOfLines={1}>
              {gathering.title}
              <Text style={{ color: mutedColor }}> · {countdown(gathering.ends_at)}</Text>
            </Text>
          </Animated.View>
        );
      })}
    </View>
  );
}

export const nookWidgets: Record<string, (props: WidgetProps) => React.ReactElement | null> = {
  "gift-nook": GiftNookWidget,
};
