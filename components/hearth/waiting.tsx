import { useEffect, useState, useSyncExternalStore } from "react";
import { View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

import { GIVE_UP_MS, markWaiting, onWaitingChange, waitingCount, waitingPill } from "../../lib/hearth-waiting";
import { Icon } from "../icon";
import { Skeleton, Tap } from "../motion";
import { Text } from "../text";

// Loading on the Hearth (CORE-103): the soft placeholder a widget or Nook
// tile shows until its data arrives, and the little pill at the top of the
// Hearth that says things are still on their way.

// Counts this placeholder as waiting while it's on screen, until it gives
// up. Returns whether it has.
function useMarkWaiting() {
  const [gaveUp, setGaveUp] = useState(false);
  useEffect(() => {
    const unmark = markWaiting();
    const timer = setTimeout(() => {
      unmark();
      setGaveUp(true);
    }, GIVE_UP_MS);
    return () => {
      clearTimeout(timer);
      unmark();
    };
  }, []);
  return gaveUp;
}

// Pulsing bars in the widget's own colors where its content will go. `rows`
// is how many lines to sketch; `align` follows how the real content sits.
export function WaitingBars({
  color,
  rows = 3,
  align = "flex-start",
  icon = false,
}: {
  color: string;
  rows?: number;
  align?: "flex-start" | "center";
  // A round blob instead of bars, for a widget shrunk to an icon.
  icon?: boolean;
}) {
  // Waited too long: leave the space quiet rather than pulse forever.
  if (useMarkWaiting()) return null;
  if (icon) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", opacity: 0.35 }} accessibilityLabel="Loading">
        <Skeleton height={28} width={28} radius={14} color={color} />
      </View>
    );
  }
  const widths = ["78%", "56%", "66%", "44%"] as const;
  return (
    <View
      // The bars are the widget's own muted text color, softened, so they
      // read on light, bold and outlined widgets alike.
      style={{ flex: 1, justifyContent: "center", alignItems: align, gap: 8, paddingVertical: 4, opacity: 0.35 }}
      accessibilityLabel="Loading"
    >
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} height={i === 0 ? 14 : 10} width={widths[i % widths.length]} radius={6} color={color} />
      ))}
    </View>
  );
}

// "Bringing in your Nooks…" at the top of the Hearth while any placeholder
// is up. Quick loads show nothing; a very slow one offers to try again.
export function WaitingPill({ accent, text, onRetry }: { accent: string; text: string; onRetry: () => void }) {
  const count = useSyncExternalStore(onWaitingChange, waitingCount);
  const [since, setSince] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // The clock starts when something starts waiting, and stops when nothing is.
  useEffect(() => {
    if (count > 0) setSince((start) => start ?? Date.now());
    else setSince(null);
  }, [count]);

  useEffect(() => {
    if (since === null) return;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [since]);

  const state = since === null ? null : waitingPill(count, now - since);
  if (!state) return null;

  return (
    <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(250)} style={{ alignSelf: "center" }}>
      <Tap
        onPress={state === "slow" ? onRetry : undefined}
        disabled={state !== "slow"}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingVertical: 7,
          paddingHorizontal: 14,
          borderRadius: 999,
          backgroundColor: `${accent}18`,
        }}
        accessibilityRole={state === "slow" ? "button" : undefined}
        accessibilityLiveRegion="polite"
      >
        {state === "slow" ? (
          <Icon name="undo" size={14} color={accent} />
        ) : (
          <Skeleton height={10} width={10} radius={5} color={accent} />
        )}
        <Text style={{ color: text, fontSize: 14, fontWeight: "600" }}>
          {state === "slow" ? "Still loading. Tap to try again" : "Bringing in your Nooks…"}
        </Text>
      </Tap>
    </Animated.View>
  );
}
