import { useEffect, useState, type ReactNode } from "react";
import { View } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { tap } from "../lib/feedback";
import { colors, ui } from "../lib/theme";
import { Icon, type IconName } from "./icon";
import { Tap } from "./motion";
import { Text } from "./text";

// A part of a long menu that opens and closes (CORE-074). Closed, it's one
// tidy row: an icon, a name, and a few words on what's chosen right now
// ("Soft · Round corners"), so you can see everything at a glance and open
// only the part you want. Whether each part is open is remembered (by `id`)
// while the app is open, so a menu comes back the way you left it.

const remembered = new Map<string, boolean>();

export function Collapsible({
  id,
  title,
  icon,
  summary,
  defaultOpen = false,
  children,
}: {
  id: string;
  title: string;
  icon: IconName;
  summary?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(() => remembered.get(id) ?? defaultOpen);
  const turn = useSharedValue(open ? 1 : 0);

  useEffect(() => {
    turn.value = withTiming(open ? 1 : 0, { duration: 180 });
  }, [open, turn]);

  const chevronStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value * 90}deg` }] }));

  function toggle() {
    tap();
    const next = !open;
    remembered.set(id, next);
    setOpen(next);
  }

  return (
    <Animated.View layout={LinearTransition.duration(200)} style={[ui.card, { gap: 0, padding: 0 }]}>
      <Tap
        onPress={toggle}
        pressedScale={0.98}
        style={[ui.row, { gap: 12, padding: 14 }]}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={summary ? `${title}: ${summary}` : title}
        accessibilityHint={open ? "Closes this part" : "Opens this part"}
      >
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 12,
            backgroundColor: colors.barkSoft,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name={icon} size={17} />
        </View>
        <View style={{ flex: 1, gap: 1 }}>
          <Text style={ui.cardTitle}>{title}</Text>
          {summary && !open ? (
            <Text style={[ui.muted, { fontSize: 13, lineHeight: 18 }]} numberOfLines={1}>
              {summary}
            </Text>
          ) : null}
        </View>
        <Animated.View style={chevronStyle}>
          <Icon name="chevron" size={14} color={colors.muted} />
        </Animated.View>
      </Tap>
      {open ? (
        <Animated.View
          entering={FadeIn.duration(180)}
          exiting={FadeOut.duration(120)}
          style={{ gap: 14, paddingHorizontal: 14, paddingBottom: 16 }}
        >
          {children}
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}
