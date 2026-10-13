import { useEffect } from "react";
import { StyleSheet, useWindowDimensions } from "react-native";
import Animated, {
  Easing,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { Icon, type IconName } from "../icon";

export type ZoomRect = { x: number; y: number; width: number; height: number };

// Stepping into a Nook (CORE-034): its tile grows to fill the screen,
// melting from the tile's color into the Nook's background while its icon
// swells and fades, then the Nook appears. Coming back, it shrinks into the
// tile again. `direction` "in" grows, "out" shrinks; onDone fires at the end.
// With `door`, going in, the tile first swings open like a door onto warm
// light (CORE-140), then the light grows to fill the screen.
const WARM = "#ffe8b8";
const DOOR_MS = 300;

export function NookZoom({
  rect,
  radii = { top: 24, bottom: 24 },
  color,
  background,
  icon,
  iconColor,
  direction,
  door = false,
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
  door?: boolean;
  onDone: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const reduce = useReducedMotion();
  const swings = door && direction === "in" && !reduce;
  const p = useSharedValue(direction === "in" ? 0 : 1);
  // 0 shut, 1 wide open.
  const swing = useSharedValue(0);

  useEffect(() => {
    const zoom = withTiming(
      direction === "in" ? 1 : 0,
      { duration: direction === "in" ? 380 : 320, easing: Easing.inOut(Easing.cubic) },
      (finished) => {
        if (finished) scheduleOnRN(onDone);
      }
    );
    if (swings) {
      swing.value = withTiming(1, { duration: DOOR_MS, easing: Easing.out(Easing.cubic) });
      p.value = withSequence(withTiming(0, { duration: DOOR_MS * 0.8 }), zoom);
    } else {
      p.value = zoom;
    }
  }, [direction, p, swing, swings, onDone]);

  const box = useAnimatedStyle(() => ({
    left: interpolate(p.value, [0, 1], [rect.x, 0]),
    top: interpolate(p.value, [0, 1], [rect.y, 0]),
    width: interpolate(p.value, [0, 1], [rect.width, width]),
    height: interpolate(p.value, [0, 1], [rect.height, height]),
    borderTopLeftRadius: interpolate(p.value, [0, 1], [radii.top, 0]),
    borderTopRightRadius: interpolate(p.value, [0, 1], [radii.top, 0]),
    borderBottomLeftRadius: interpolate(p.value, [0, 1], [radii.bottom, 0]),
    borderBottomRightRadius: interpolate(p.value, [0, 1], [radii.bottom, 0]),
    backgroundColor: swings ? interpolateColor(p.value, [0, 0.6, 1], [WARM, WARM, background]) : interpolateColor(p.value, [0, 0.55, 1], [color, color, background]),
    // Coming back out, the tile fades away once it's home.
    opacity: direction === "out" ? interpolate(p.value, [0, 0.12], [0, 1], "clamp") : 1,
  }));
  const glyph = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0, 0.7], [1, 0], "clamp"),
    transform: [{ scale: interpolate(p.value, [0, 1], [1, 2.6]) }],
  }));

  // The door itself: the tile, swinging open from its left edge.
  const leaf = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0, 0.25], [1, 0], "clamp"),
    transform: [{ perspective: 600 }, { rotateY: `${-swing.value * 105}deg` }],
  }));

  return (
    <>
      <Animated.View pointerEvents="none" style={[styles.box, box]}>
        {swings ? null : (
          <Animated.View style={glyph}>
            <Icon name={icon} size={40} color={iconColor} />
          </Animated.View>
        )}
      </Animated.View>
      {swings ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.door,
            {
              left: rect.x,
              top: rect.y,
              width: rect.width,
              height: rect.height,
              backgroundColor: color,
              borderTopLeftRadius: radii.top,
              borderTopRightRadius: radii.top,
              borderBottomLeftRadius: radii.bottom,
              borderBottomRightRadius: radii.bottom,
              transformOrigin: "0% 50%",
            },
            leaf,
          ]}
        >
          <Icon name={icon} size={40} color={iconColor} />
        </Animated.View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  box: { position: "absolute", alignItems: "center", justifyContent: "center", overflow: "hidden", zIndex: 50 },
  door: { position: "absolute", alignItems: "center", justifyContent: "center", zIndex: 51, boxShadow: "4px 0px 10px rgba(0,0,0,0.25)" },
});
