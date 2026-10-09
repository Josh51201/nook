import { View } from "react-native";
import Animated, { SlideInDown, SlideOutDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { tap } from "../../lib/feedback";
import type { Nudge } from "../../lib/hearth-layout";
import { Icon, type IconName } from "../icon";
import { Tap } from "../motion";
import { Text } from "../text";

// Moving a tile with arrows (CORE-075, CORE-076): a small bar docked at the
// bottom of the Hearth, so the Hearth stays in full view and you can watch
// the tile — glowing — step around, with the page following it. Tap another
// tile to move that one instead; Done when it's where you want it.
export function MoveBar({
  name,
  at,
  can,
  onNudge,
  onDone,
  theme,
}: {
  name: string;
  at: { x: number; y: number };
  can: (way: Nudge) => boolean;
  onNudge: (way: Nudge) => void;
  onDone: () => void;
  theme: { background: string; text: string; muted: string; accent: string };
}) {
  const insets = useSafeAreaInsets();
  const ways: { way: Nudge; icon: IconName; label: string }[] = [
    { way: "left", icon: "arrowLeft", label: "Move left" },
    { way: "up", icon: "arrowUp", label: "Move up" },
    { way: "down", icon: "arrowDown", label: "Move down" },
    { way: "right", icon: "arrowRight", label: "Move right" },
  ];
  return (
    <Animated.View
      entering={SlideInDown.duration(240)}
      exiting={SlideOutDown.duration(200)}
      style={{
        position: "absolute",
        left: 12,
        right: 12,
        bottom: Math.max(insets.bottom, 12),
        padding: 14,
        gap: 12,
        borderRadius: 22,
        backgroundColor: theme.background,
        borderWidth: 1,
        borderColor: `${theme.accent}33`,
        boxShadow: "0px 10px 30px -8px rgba(0,0,0,0.35)",
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.text, fontSize: 16, fontWeight: "700" }} numberOfLines={1}>
            Moving {name}
          </Text>
          <Text style={{ color: theme.muted, fontSize: 13 }} accessibilityLiveRegion="polite">
            Row {Math.floor(at.y) + 1}
            {at.y % 1 ? "½" : ""}, column {Math.round(at.x) + 1}
          </Text>
        </View>
        <Tap
          onPress={onDone}
          style={{ paddingVertical: 10, paddingHorizontal: 18, borderRadius: 999, backgroundColor: theme.accent }}
          accessibilityRole="button"
          accessibilityLabel="Done moving"
        >
          <Text style={{ color: theme.background, fontWeight: "700", fontSize: 15 }}>Done</Text>
        </Tap>
      </View>
      <View style={{ flexDirection: "row", gap: 10 }}>
        {ways.map(({ way, icon, label }) => {
          const enabled = can(way);
          return (
            <Tap
              key={way}
              disabled={!enabled}
              onPress={() => {
                tap();
                onNudge(way);
              }}
              pressedScale={0.9}
              style={{
                flex: 1,
                height: 54,
                borderRadius: 16,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: `${theme.accent}1f`,
                opacity: enabled ? 1 : 0.35,
              }}
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityState={{ disabled: !enabled }}
            >
              <Icon name={icon} size={22} color={theme.accent} />
            </Tap>
          );
        })}
      </View>
      <Text style={{ color: theme.muted, fontSize: 12.5, textAlign: "center" }}>
        Anything in the way shifts down. Tap another tile to move that one.
      </Text>
    </Animated.View>
  );
}
