import { useEffect } from "react";
import { StyleSheet, useWindowDimensions } from "react-native";
import Animated, {
  Easing,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { Icon, type IconName } from "../icon";

export type ZoomRect = { x: number; y: number; width: number; height: number };

// Stepping into a Nook (CORE-034): its tile grows to fill the screen,
// melting from the tile's color into the Nook's background while its icon
// swells and fades, then the Nook appears. Coming back, it shrinks into the
// tile again. `direction` "in" grows, "out" shrinks; onDone fires at the end.
export function NookZoom({
  rect,
  radii = { top: 24, bottom: 24 },
  color,
  background,
  icon,
  iconColor,
  direction,
  onDone,
}: {
  rect: ZoomRect;
  // The tile's corners to start from (Nook tiles are arched).
  radii?: { top: number; bottom: number };
  color: string;
  background: string;
  icon: IconName;
  iconColor: string;
  direction: "in" | "out";
  onDone: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const p = useSharedValue(direction === "in" ? 0 : 1);

  useEffect(() => {
    p.value = withTiming(
      direction === "in" ? 1 : 0,
      { duration: direction === "in" ? 380 : 320, easing: Easing.inOut(Easing.cubic) },
      (finished) => {
        if (finished) scheduleOnRN(onDone);
      }
    );
  }, [direction, p, onDone]);

  const box = useAnimatedStyle(() => ({
    left: interpolate(p.value, [0, 1], [rect.x, 0]),
    top: interpolate(p.value, [0, 1], [rect.y, 0]),
    width: interpolate(p.value, [0, 1], [rect.width, width]),
    height: interpolate(p.value, [0, 1], [rect.height, height]),
    borderTopLeftRadius: interpolate(p.value, [0, 1], [radii.top, 0]),
    borderTopRightRadius: interpolate(p.value, [0, 1], [radii.top, 0]),
    borderBottomLeftRadius: interpolate(p.value, [0, 1], [radii.bottom, 0]),
    borderBottomRightRadius: interpolate(p.value, [0, 1], [radii.bottom, 0]),
    backgroundColor: interpolateColor(p.value, [0, 0.55, 1], [color, color, background]),
    // Coming back out, the tile fades away once it's home.
    opacity: direction === "out" ? interpolate(p.value, [0, 0.12], [0, 1], "clamp") : 1,
  }));
  const glyph = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0, 0.7], [1, 0], "clamp"),
    transform: [{ scale: interpolate(p.value, [0, 1], [1, 2.6]) }],
  }));

  return (
    <Animated.View pointerEvents="none" style={[styles.box, box]}>
      <Animated.View style={glyph}>
        <Icon name={icon} size={40} color={iconColor} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  box: { position: "absolute", alignItems: "center", justifyContent: "center", overflow: "hidden", zIndex: 50 },
});
