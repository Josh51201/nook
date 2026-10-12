import { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import Animated, { ZoomIn } from "react-native-reanimated";

import { fridgePlace, placeKey } from "../../lib/fridge";
import type { NewsContext, NewsNotice } from "../../lib/hearth-news";
import { supabase } from "../../lib/supabase";

// What's new on the Hearth (CORE-114..116): your unread notices, loaded once
// for the whole Hearth (the inbox bell's count comes from the same request),
// plus which Fridge doors have a note you haven't seen.

// Enough to cover any Hearth; the bell's count is exact either way.
const NEWS_LIMIT = 200;

export function useHearthNews(refreshKey: number, homeId: string | null, fridgeNews: Set<string>) {
  const [state, setState] = useState<{ count: number; notices: NewsNotice[] }>({ count: 0, notices: [] });
  useEffect(() => {
    let cancelled = false;
    supabase
      .from("notifications")
      .select("nook, kind, title, data, created_at", { count: "exact" })
      .is("read_at", null)
      .order("created_at", { ascending: false })
      .limit(NEWS_LIMIT)
      .then(({ data, count, error }) => {
        if (cancelled || error) return;
        setState({ count: count ?? 0, notices: (data ?? []) as NewsNotice[] });
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const ctx = useMemo<NewsContext>(
    () => ({
      notices: state.notices,
      fridgeHasNews: (widget, onHomePage) => {
        const place = fridgePlace(widget.settings, { onHomePage, homeId });
        return place ? fridgeNews.has(placeKey(place)) : false;
      },
    }),
    [state.notices, homeId, fridgeNews]
  );
  return { unread: state.count, news: ctx };
}

export const NEWS_RED = "#c2415a";

// The little dot on a tile, widget or Hollow with something new (CORE-115),
// sitting on its top-right corner with a ring of the Hearth's background so
// it reads on any tile color. `radius` is that corner's rounding, so on a
// round or arched tile it sits on the curve rather than out in the air.
export function NewsDot({ ring, radius = 0, size = 14 }: { ring: string; radius?: number; size?: number }) {
  // Where a 45° line from the corner meets the curve.
  const inset = radius * (1 - Math.SQRT1_2) - size / 2;
  return (
    <Animated.View
      entering={ZoomIn.springify().damping(12)}
      pointerEvents="none"
      style={{ position: "absolute", top: Math.max(-size / 3, inset), right: Math.max(-size / 3, inset) }}
    >
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 2.5,
          borderColor: ring,
          backgroundColor: NEWS_RED,
        }}
      />
    </Animated.View>
  );
}
