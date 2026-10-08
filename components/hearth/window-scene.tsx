import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
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
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";

import type { Condition, WindowFrame } from "../../lib/weather";

// A window on the Hearth (CORE-057): a little frame you look out of, with the
// weather outside it — sun or moon, drifting clouds, rain, snow, fog or a
// flash of lightning — live from a place you picked, or a sky you chose.
// Holds still while you're editing, and if the phone's Reduce Motion is on.

const FRAMES: Record<WindowFrame, { frame: string; edge: string; sill: string; curtain: string; tie: string }> = {
  wood: { frame: "#8a5a3b", edge: "#5e3b22", sill: "#a06c47", curtain: "#e8c9a8", tie: "#b07a52" },
  white: { frame: "#f7f3ee", edge: "#d8d0c6", sill: "#ffffff", curtain: "#d9e4ef", tie: "#9fb6cf" },
  sage: { frame: "#7d9471", edge: "#55684c", sill: "#93a988", curtain: "#f3e6b8", tie: "#c9a94f" },
};

function sky(condition: Condition, isDay: boolean): [string, string] {
  if (!isDay) {
    if (condition === "thunder") return ["#161b26", "#2c3341"];
    if (condition === "clear" || condition === "partly") return ["#0f1a3a", "#2c3c6e"];
    return ["#222a37", "#3d4656"];
  }
  switch (condition) {
    case "clear":
      return ["#79b4e4", "#d2e9f8"];
    case "partly":
      return ["#88bbe2", "#d8e9f4"];
    case "snow":
      return ["#c2cad4", "#eef1f4"];
    case "rain":
      return ["#8695a4", "#b8c2cb"];
    case "thunder":
      return ["#5a6470", "#8b95a0"];
    default:
      return ["#a7b4c1", "#d6dce1"];
  }
}

// A repeatable "random" number, so things don't jump about on redraw.
function rand(i: number, salt: number) {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

export function WindowScene({
  width,
  height,
  condition,
  isDay,
  frame = "wood",
  curtains = true,
  radius = 24,
  still = false,
}: {
  width: number;
  height: number;
  condition: Condition;
  isDay: boolean;
  frame?: WindowFrame;
  curtains?: boolean;
  radius?: number;
  still?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const calm = still || reduceMotion;
  const colors = FRAMES[frame];
  const border = Math.max(5, Math.min(12, Math.min(width, height) * 0.07));
  const sillHeight = Math.max(6, border * 1.2);
  const openW = Math.max(10, width - border * 2);
  const openH = Math.max(10, height - border * 2 - sillHeight * 0.6);
  const [top, bottom] = sky(condition, isDay);
  const snowy = condition === "snow";
  const cloudCount = condition === "clear" ? 0 : condition === "partly" ? 2 : 3;
  const cloudColor = !isDay ? "#5a6475" : condition === "rain" || condition === "thunder" ? "#9aa4ae" : "#ffffff";
  const rainCount = condition === "drizzle" ? 12 : condition === "rain" ? 22 : condition === "thunder" ? 26 : 0;

  return (
    <View style={{ width, height, borderRadius: radius, backgroundColor: colors.frame, padding: border, paddingBottom: border + sillHeight * 0.6, overflow: "hidden" }}>
      <View style={{ width: openW, height: openH, borderRadius: Math.max(4, radius - border - 4), overflow: "hidden", borderWidth: 2, borderColor: colors.edge }}>
        {/* The sky, and hills along the bottom (snowy in snow). */}
        <Svg width={openW} height={openH} style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={top} />
              <Stop offset="1" stopColor={bottom} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width={openW} height={openH} fill="url(#sky)" />
          {!isDay && (condition === "clear" || condition === "partly")
            ? Array.from({ length: 14 }, (_, i) => (
                <Circle key={i} cx={rand(i, 1) * openW} cy={rand(i, 2) * openH * 0.6} r={rand(i, 3) * 1.1 + 0.5} fill="#ffffff" fillOpacity={0.5 + rand(i, 4) * 0.5} />
              ))
            : null}
          <Path
            d={`M0 ${openH * 0.84} Q ${openW * 0.22} ${openH * 0.7} ${openW * 0.45} ${openH * 0.82} T ${openW} ${openH * 0.78} L ${openW} ${openH} L 0 ${openH} Z`}
            fill={snowy ? "#f4f7fa" : isDay ? "#7fa36b" : "#2f3f2c"}
          />
          <Path
            d={`M0 ${openH * 0.92} Q ${openW * 0.35} ${openH * 0.82} ${openW * 0.7} ${openH * 0.9} T ${openW} ${openH * 0.88} L ${openW} ${openH} L 0 ${openH} Z`}
            fill={snowy ? "#ffffff" : isDay ? "#6a9058" : "#263524"}
          />
        </Svg>

        {/* Sun or moon. */}
        {condition === "clear" || condition === "partly" ? (
          isDay ? (
            <View style={[styles.body, { left: openW * 0.68, top: openH * 0.12, width: openH * 0.24, height: openH * 0.24, backgroundColor: "#ffd466", boxShadow: "0px 0px 16px 6px rgba(255,212,102,0.6)" }]} />
          ) : (
            <View style={[styles.body, { left: openW * 0.7, top: openH * 0.12, width: openH * 0.2, height: openH * 0.2, backgroundColor: "#f6f1d8", boxShadow: "0px 0px 10px 3px rgba(246,241,216,0.35)" }]}>
              <View style={{ position: "absolute", left: openH * 0.06, top: -openH * 0.02, width: openH * 0.2, height: openH * 0.2, borderRadius: openH, backgroundColor: top }} />
            </View>
          )
        ) : null}

        {Array.from({ length: cloudCount }, (_, i) => (
          <Cloud key={`c${i}`} i={i} width={openW} height={openH} color={cloudColor} still={calm} />
        ))}
        {condition === "fog" ? [0, 1, 2].map((i) => <FogBand key={`f${i}`} i={i} width={openW} height={openH} still={calm} />) : null}
        {Array.from({ length: rainCount }, (_, i) => (
          <Drop key={`r${i}`} i={i} width={openW} height={openH} heavy={condition !== "drizzle"} still={calm} />
        ))}
        {snowy ? Array.from({ length: 22 }, (_, i) => <Flake key={`s${i}`} i={i} width={openW} height={openH} still={calm} />) : null}
        {condition === "thunder" && !calm ? <Flash /> : null}

        {/* Window bars. */}
        <View style={[styles.barV, { backgroundColor: colors.frame, borderColor: colors.edge }]} />
        <View style={[styles.barH, { backgroundColor: colors.frame, borderColor: colors.edge }]} />

        {curtains ? (
          <>
            <View style={[styles.curtain, { left: 0, width: openW * 0.2, backgroundColor: colors.curtain, borderBottomRightRadius: openW * 0.2 }]}>
              <View style={[styles.tie, { right: 0, top: openH * 0.55, backgroundColor: colors.tie }]} />
            </View>
            <View style={[styles.curtain, { right: 0, width: openW * 0.2, backgroundColor: colors.curtain, borderBottomLeftRadius: openW * 0.2 }]}>
              <View style={[styles.tie, { left: 0, top: openH * 0.55, backgroundColor: colors.tie }]} />
            </View>
          </>
        ) : null}
      </View>
      {/* The sill. */}
      <View style={[styles.sill, { height: sillHeight, backgroundColor: colors.sill, borderTopColor: colors.edge }]} />
    </View>
  );
}

function useLoop(duration: number, delay: number, still: boolean, startAt = 0) {
  const p = useSharedValue(startAt);
  useEffect(() => {
    if (still) {
      p.value = startAt;
      return;
    }
    p.value = startAt;
    p.value = withDelay(
      delay,
      withSequence(
        withTiming(1, { duration: duration * (1 - startAt), easing: Easing.linear }),
        withRepeat(withSequence(withTiming(0, { duration: 0 }), withTiming(1, { duration, easing: Easing.linear })), -1)
      )
    );
  }, [still]);
  return p;
}

function Cloud({ i, width, height, color, still }: { i: number; width: number; height: number; color: string; still: boolean }) {
  const size = width * (0.32 + rand(i, 1) * 0.18);
  const p = useLoop(26000 + rand(i, 2) * 16000, 0, still, rand(i, 3));
  const y = height * (0.08 + rand(i, 4) * 0.3);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: -size + p.value * (width + size) }, { translateY: y }] }));
  return (
    <Animated.View style={[styles.layer, style]}>
      <Svg width={size} height={size * 0.5}>
        <Circle cx={size * 0.3} cy={size * 0.32} r={size * 0.17} fill={color} fillOpacity={0.92} />
        <Circle cx={size * 0.52} cy={size * 0.24} r={size * 0.22} fill={color} fillOpacity={0.92} />
        <Circle cx={size * 0.72} cy={size * 0.33} r={size * 0.16} fill={color} fillOpacity={0.92} />
        <Rect x={size * 0.14} y={size * 0.32} width={size * 0.72} height={size * 0.16} rx={size * 0.08} fill={color} fillOpacity={0.92} />
      </Svg>
    </Animated.View>
  );
}

function FogBand({ i, width, height, still }: { i: number; width: number; height: number; still: boolean }) {
  const p = useLoop(18000 + i * 5000, 0, still, rand(i, 5));
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: -width + p.value * width * 2 }] }));
  return (
    <Animated.View
      style={[
        styles.layer,
        { top: height * (0.3 + i * 0.18), width: width * 1.4, height: height * 0.16, borderRadius: height, backgroundColor: "rgba(255,255,255,0.45)" },
        style,
      ]}
    />
  );
}

function Drop({ i, width, height, heavy, still }: { i: number; width: number; height: number; heavy: boolean; still: boolean }) {
  const p = useLoop((heavy ? 700 : 1100) + rand(i, 1) * 400, rand(i, 2) * 900, still, rand(i, 3));
  const x = rand(i, 4) * (width + 20) - 10;
  const length = heavy ? 11 : 7;
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x - p.value * 8 }, { translateY: -length + p.value * (height + length) }, { rotate: "14deg" }],
  }));
  return <Animated.View style={[styles.layer, { width: 1.6, height: length, borderRadius: 1, backgroundColor: "rgba(225,235,245,0.85)" }, style]} />;
}

function Flake({ i, width, height, still }: { i: number; width: number; height: number; still: boolean }) {
  const p = useLoop(5000 + rand(i, 1) * 4000, 0, still, rand(i, 2));
  const x = rand(i, 3) * width;
  const size = 2.5 + rand(i, 4) * 3;
  const phase = rand(i, 5) * Math.PI * 2;
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x + Math.sin(p.value * Math.PI * 4 + phase) * 8 }, { translateY: -size + p.value * (height + size) }],
  }));
  return <Animated.View style={[styles.layer, { width: size, height: size, borderRadius: size, backgroundColor: "#ffffff" }, style]} />;
}

function Flash() {
  const o = useSharedValue(0);
  useEffect(() => {
    o.value = withRepeat(
      withSequence(
        withDelay(5000, withTiming(0.85, { duration: 70 })),
        withTiming(0.1, { duration: 120 }),
        withTiming(0.6, { duration: 60 }),
        withTiming(0, { duration: 400 })
      ),
      -1
    );
  }, []);
  const style = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: "#ffffff" }, style]} />;
}

const styles = StyleSheet.create({
  layer: { position: "absolute", top: 0, left: 0 },
  body: { position: "absolute", borderRadius: 999 },
  barV: { position: "absolute", top: 0, bottom: 0, left: "50%", width: 6, marginLeft: -3, borderLeftWidth: 1, borderRightWidth: 1 },
  barH: { position: "absolute", left: 0, right: 0, top: "50%", height: 6, marginTop: -3, borderTopWidth: 1, borderBottomWidth: 1 },
  curtain: { position: "absolute", top: 0, bottom: "18%" },
  tie: { position: "absolute", width: "60%", height: 5, borderRadius: 3 },
  sill: { position: "absolute", left: 0, right: 0, bottom: 0, borderTopWidth: 1.5 },
});
