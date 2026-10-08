import { useEffect } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import type { AmbienceKind } from "../../lib/decor";

// The weather in the air over the Hearth (CORE-047): leaves, snow, petals,
// fireflies or drifting sunbeam dust. Drawn over everything but never
// touchable, and paused while editing so it can't get in the way of dragging.
// Holds still (shows nothing) if the phone's Reduce Motion is on.

const COUNTS: Record<AmbienceKind, number> = { leaves: 14, snow: 28, petals: 18, fireflies: 12, motes: 16 };
const LEAF_COLORS = ["#c8602d", "#d98e2b", "#a8442a", "#8a6a1c", "#b5532a"];
const PETAL_COLORS = ["#f4b6c8", "#fbd5df", "#f7c6d3", "#ffffff"];

// A repeatable "random" number for particle i, so particles don't jump about
// when the screen redraws.
function rand(i: number, salt: number) {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

export function AmbienceLayer({ kind }: { kind: AmbienceKind }) {
  const { width, height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  if (reduceMotion) return null;
  const falling = kind === "leaves" || kind === "snow" || kind === "petals";
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {Array.from({ length: COUNTS[kind] }, (_, i) =>
        falling ? (
          <Faller key={`${kind}${i}`} kind={kind} i={i} width={width} height={height} />
        ) : (
          <Glimmer key={`${kind}${i}`} kind={kind} i={i} width={width} height={height} />
        )
      )}
    </View>
  );
}

// Leaves, snow and petals: drift down the screen, swaying as they go.
function Faller({ kind, i, width, height }: { kind: "leaves" | "snow" | "petals"; i: number; width: number; height: number }) {
  const progress = useSharedValue(0);
  const size = kind === "snow" ? 3 + rand(i, 1) * 5 : kind === "leaves" ? 11 + rand(i, 1) * 8 : 8 + rand(i, 1) * 6;
  const duration = (kind === "snow" ? 9000 : kind === "leaves" ? 11000 : 12000) + rand(i, 2) * 6000;
  const startAt = rand(i, 3);
  const left = rand(i, 4) * width;
  const sway = 14 + rand(i, 5) * 26;
  const phase = rand(i, 6) * Math.PI * 2;
  const spin = (rand(i, 7) > 0.5 ? 1 : -1) * (180 + rand(i, 8) * 360);
  const color =
    kind === "leaves"
      ? LEAF_COLORS[i % LEAF_COLORS.length]
      : kind === "petals"
        ? PETAL_COLORS[i % PETAL_COLORS.length]
        : "#ffffff";

  useEffect(() => {
    progress.value = startAt;
    progress.value = withSequence(
      withTiming(1, { duration: duration * (1 - startAt), easing: Easing.linear }),
      withRepeat(withSequence(withTiming(0, { duration: 0 }), withTiming(1, { duration, easing: Easing.linear })), -1)
    );
  }, []);

  const style = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      opacity: p < 0.06 ? p / 0.06 : p > 0.94 ? (1 - p) / 0.06 : 1,
      transform: [
        { translateX: left + Math.sin(p * Math.PI * 2 * 2 + phase) * sway },
        { translateY: -24 + p * (height + 48) },
        { rotate: `${p * spin}deg` },
      ],
    };
  });

  return (
    <Animated.View style={[styles.particle, style]}>
      {kind === "snow" ? (
        <View style={{ width: size, height: size, borderRadius: size, backgroundColor: color, boxShadow: "0px 0px 3px rgba(110,140,185,0.55)" }} />
      ) : kind === "leaves" ? (
        <View
          style={{
            width: size,
            height: size * 0.62,
            backgroundColor: color,
            borderTopLeftRadius: size,
            borderBottomRightRadius: size,
            borderTopRightRadius: 2,
            borderBottomLeftRadius: 2,
          }}
        />
      ) : (
        <View
          style={{
            width: size,
            height: size * 0.7,
            backgroundColor: color,
            borderRadius: size,
            borderTopRightRadius: 1,
            boxShadow: "0px 0px 2px rgba(200,110,140,0.4)",
          }}
        />
      )}
    </Animated.View>
  );
}

// Fireflies and sunbeam dust: hang in the air, wandering a little and
// glowing on and off.
function Glimmer({ kind, i, width, height }: { kind: "fireflies" | "motes"; i: number; width: number; height: number }) {
  const drift = useSharedValue(0);
  const glow = useSharedValue(0);
  const firefly = kind === "fireflies";
  const x = rand(i, 1) * width;
  const y = firefly ? height * (0.15 + rand(i, 2) * 0.8) : rand(i, 2) * height;
  const range = firefly ? 28 + rand(i, 3) * 40 : 18 + rand(i, 3) * 30;
  const phase = rand(i, 4) * Math.PI * 2;
  const size = firefly ? 5 + rand(i, 5) * 3 : 3 + rand(i, 5) * 4;
  const wander = (firefly ? 7000 : 14000) + rand(i, 6) * 6000;
  const pulse = (firefly ? 1500 : 3500) + rand(i, 7) * 2500;

  useEffect(() => {
    drift.value = withDelay(rand(i, 8) * 2000, withRepeat(withTiming(1, { duration: wander, easing: Easing.linear }), -1));
    glow.value = withDelay(
      rand(i, 9) * 3000,
      withRepeat(
        withSequence(withTiming(1, { duration: pulse, easing: Easing.inOut(Easing.quad) }), withTiming(0.05, { duration: pulse, easing: Easing.inOut(Easing.quad) })),
        -1
      )
    );
  }, []);

  const style = useAnimatedStyle(() => {
    const t = drift.value * Math.PI * 2;
    return {
      opacity: glow.value * (firefly ? 1 : 0.7),
      transform: [
        { translateX: x + Math.sin(t + phase) * range },
        { translateY: y + (firefly ? Math.cos(t * 2 + phase) * range * 0.5 : Math.cos(t + phase) * range) },
      ],
    };
  });

  return (
    <Animated.View style={[styles.particle, style]}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size,
          backgroundColor: firefly ? "#f7c948" : "#fff3c4",
          boxShadow: firefly ? "0px 0px 9px 3px rgba(247,201,72,0.8)" : "0px 0px 6px 2px rgba(255,236,170,0.85)",
        }}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  particle: { position: "absolute", top: 0, left: 0 },
});
