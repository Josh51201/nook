import { useCallback, useEffect, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
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
import Svg, { Circle, Ellipse, G, Line, Path, Polygon, Polyline, Rect } from "react-native-svg";
import { scheduleOnRN } from "react-native-worklets";

import { itemColor, type HearthItem, type HollowDecor, type HollowItem, type HollowLook } from "../../lib/hearth-layout";
import { findNook } from "../../lib/nooks";
import { widgetKindInfo } from "../../lib/widgets";
import { Icon, type IconName } from "../icon";

const TEXT = "#2a2420";
const MUTED = "#6f625a";
const GLOW = "#ffcf7a";

// The door, in the drawing's 100×100 space. Every look puts its door here.
const DOOR = { x: 42, y: 60, w: 16, h: 32 };

const doorColors: Record<HollowLook, string> = {
  house: "#7a4a2e",
  stump: "#5e3b22",
  hill: "#4f6b45",
  mushroom: "#8a5a3b",
};

// Where smoke leaves a chimney, and where fireflies drift, per look.
const chimneys: Partial<Record<HollowLook, { x: number; y: number }>> = {
  house: { x: 67.5, y: 15 },
  hill: { x: 69.5, y: 29 },
};
const fireflySpots: Partial<Record<HollowLook, { x: number; y: number }[]>> = {
  stump: [
    { x: 14, y: 40 },
    { x: 86, y: 30 },
    { x: 78, y: 62 },
  ],
  mushroom: [
    { x: 10, y: 70 },
    { x: 90, y: 66 },
    { x: 50, y: 14 },
  ],
};

// A Hollow on the Hearth (CORE-022/024/031): a little house, stump, burrow
// hill or mushroom with a real door. It's alive while you look at it —
// chimney smoke, fireflies, decorations like string lights or snow — and
// when `opening` turns true the door swings open on its hinge, warm light
// bursts out, and `onOpened` fires so the Hollow's screen can take over.
// Bigger Hollows show little icons of what's inside. All the idle motion
// stops when the phone's Reduce Motion setting is on.
export function HollowFace({
  item,
  width,
  height,
  opening = false,
  onOpened,
}: {
  item: HollowItem;
  width: number;
  height: number;
  opening?: boolean;
  onOpened?: () => void;
}) {
  const open = useSharedValue(0);
  const reduceMotion = useReducedMotion();

  // Latest onOpened, without re-running the animation when it changes.
  const onOpenedRef = useRef(onOpened);
  onOpenedRef.current = onOpened;
  const opened = useCallback(() => onOpenedRef.current?.(), []);

  useEffect(() => {
    if (opening) {
      open.value = withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) }, (finished) => {
        if (finished) scheduleOnRN(opened);
      });
    } else {
      open.value = withTiming(0, { duration: 320, easing: Easing.inOut(Easing.cubic) });
    }
  }, [opening, open, opened]);

  const wide = item.w >= 3;
  const tiny = item.w === 1 || item.h === 1;
  const art = tiny
    ? Math.min(width, height) * 0.86
    : wide
      ? Math.min(height - 20, width * 0.42)
      : Math.min(width - 24, height - 54);
  const k = art / 100;
  const decor = item.decor ?? "none";
  const alive = !reduceMotion;

  const doorStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 400 },
      // Rotate around the door's left edge (its hinge).
      { translateX: (-DOOR.w * k) / 2 },
      { rotateY: `${-open.value * 80}deg` },
      { translateX: (DOOR.w * k) / 2 },
    ],
  }));
  const leanIn = useAnimatedStyle(() => ({ transform: [{ scale: 1 + open.value * 0.06 }] }));
  const glow = useAnimatedStyle(() => ({ opacity: 0.55 + open.value * 0.45 }));
  // Warm light spilling out of the open door.
  const burst = useAnimatedStyle(() => ({
    opacity: reduceMotion ? 0 : open.value < 0.25 ? open.value * 2.8 : Math.max(0, 0.7 - (open.value - 0.25) * 0.93),
    transform: [{ scale: 0.3 + open.value * 4.5 }],
  }));

  const count = item.items.length;
  const peek = item.items.slice(0, 4).map(peekIcon);

  return (
    <Animated.View
      style={[
        styles.tile,
        { width, height, backgroundColor: itemColor(item) },
        wide ? styles.wide : styles.tall,
        tiny && { padding: 4 },
        leanIn,
      ]}
    >
      {alive && decor === "snow" ? <Snowfall width={width} height={height} /> : null}
      <View style={{ width: art, height: art }} accessibilityLabel={`${item.name}, a ${item.look}`}>
        {item.look === "stump" ? <Stump /> : item.look === "hill" ? <Hill /> : item.look === "mushroom" ? <Mushroom /> : <House />}
        {decor !== "none" ? <Decor look={item.look} decor={decor} alive={alive} /> : null}

        {/* What's behind the door: warm light. */}
        <Animated.View
          style={[
            styles.doorway,
            {
              left: DOOR.x * k,
              top: DOOR.y * k,
              width: DOOR.w * k,
              height: DOOR.h * k,
              borderTopLeftRadius: (DOOR.w * k) / 2,
              borderTopRightRadius: (DOOR.w * k) / 2,
            },
            glow,
          ]}
        />
        <Animated.View
          pointerEvents="none"
          style={[
            styles.burst,
            {
              left: (DOOR.x + DOOR.w / 2) * k - art * 0.15,
              top: (DOOR.y + DOOR.h / 2) * k - art * 0.15,
              width: art * 0.3,
              height: art * 0.3,
              borderRadius: art * 0.15,
            },
            burst,
          ]}
        />
        <Animated.View
          style={[
            styles.door,
            {
              left: DOOR.x * k,
              top: DOOR.y * k,
              width: DOOR.w * k,
              height: DOOR.h * k,
              borderTopLeftRadius: (DOOR.w * k) / 2,
              borderTopRightRadius: (DOOR.w * k) / 2,
              backgroundColor: doorColors[item.look],
            },
            doorStyle,
          ]}
        >
          <View style={[styles.knob, { width: 2.6 * k, height: 2.6 * k, borderRadius: 1.3 * k, right: 2.4 * k, top: DOOR.h * k * 0.55 }]} />
        </Animated.View>

        {alive && chimneys[item.look] ? <Smoke from={chimneys[item.look]!} k={k} /> : null}
        {alive && fireflySpots[item.look] ? <Fireflies spots={fireflySpots[item.look]!} k={k} /> : null}
      </View>

      {!tiny ? (
        <View style={wide ? { flex: 1, gap: 4 } : { alignItems: "center", gap: 1 }}>
          <Text style={[styles.name, !wide && { textAlign: "center" }]} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.count}>{count === 0 ? "Empty — drag things in" : `${count} inside`}</Text>
          {wide && peek.length ? (
            <View style={styles.peek}>
              {peek.map((icon, i) => (
                <View key={i} style={styles.peekIcon}>
                  <Icon name={icon} size={13} color={TEXT} />
                </View>
              ))}
              {count > peek.length ? <Text style={styles.count}>+{count - peek.length}</Text> : null}
            </View>
          ) : null}
        </View>
      ) : null}
    </Animated.View>
  );
}

function peekIcon(item: HearthItem): IconName {
  if (item.icon) return item.icon;
  if (item.kind === "nook") return findNook(item.nookId)?.icon ?? "category";
  if (item.kind === "widget") return widgetKindInfo(item.widget.kind).icon;
  return "text";
}

// --- Idle life ------------------------------------------------------------------

function useLoop(duration: number, delay = 0) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withDelay(delay, withRepeat(withTiming(1, { duration, easing: Easing.linear }), -1, false));
  }, [progress, duration, delay]);
  return progress;
}

// Three puffs of smoke curling up from the chimney, one after another.
function Smoke({ from, k }: { from: { x: number; y: number }; k: number }) {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <Puff key={i} from={from} k={k} delay={i * 900} />
      ))}
    </>
  );
}

function Puff({ from, k, delay }: { from: { x: number; y: number }; k: number; delay: number }) {
  const p = useLoop(2700, delay);
  const size = 7 * k;
  const style = useAnimatedStyle(() => ({
    opacity: p.value < 0.1 ? p.value * 5 : 0.5 * (1 - p.value),
    transform: [
      { translateX: Math.sin(p.value * Math.PI * 1.5) * 4 * k + p.value * 5 * k },
      { translateY: -p.value * 24 * k },
      { scale: 0.6 + p.value * 1.1 },
    ],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.puff,
        { left: from.x * k - size / 2, top: from.y * k - size / 2, width: size, height: size, borderRadius: size / 2 },
        style,
      ]}
    />
  );
}

// Little glowing fireflies drifting in lazy loops.
function Fireflies({ spots, k }: { spots: { x: number; y: number }[]; k: number }) {
  return (
    <>
      {spots.map((spot, i) => (
        <Firefly key={i} spot={spot} k={k} duration={3200 + i * 700} delay={i * 400} />
      ))}
    </>
  );
}

function Firefly({ spot, k, duration, delay }: { spot: { x: number; y: number }; k: number; duration: number; delay: number }) {
  const p = useLoop(duration, delay);
  const size = 3.6 * k;
  const style = useAnimatedStyle(() => {
    const t = p.value * Math.PI * 2;
    return {
      opacity: 0.25 + 0.75 * Math.abs(Math.sin(t * 1.5)),
      transform: [{ translateX: Math.sin(t) * 7 * k }, { translateY: Math.sin(t * 2) * 4 * k }],
    };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.firefly,
        { left: spot.x * k - size / 2, top: spot.y * k - size / 2, width: size, height: size, borderRadius: size / 2 },
        style,
      ]}
    />
  );
}

// Snowflakes drifting down the whole tile.
function Snowfall({ width, height }: { width: number; height: number }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {[0.12, 0.34, 0.58, 0.8, 0.92].map((x, i) => (
        <Flake key={i} x={x * width} height={height} duration={4200 + i * 600} delay={i * 750} />
      ))}
    </View>
  );
}

function Flake({ x, height, duration, delay }: { x: number; height: number; duration: number; delay: number }) {
  const p = useLoop(duration, delay);
  const style = useAnimatedStyle(() => ({
    opacity: p.value < 0.1 ? p.value * 9 : 0.9,
    transform: [{ translateY: -8 + p.value * (height + 16) }, { translateX: Math.sin(p.value * Math.PI * 3) * 6 }],
  }));
  return <Animated.View style={[styles.flake, { left: x }, style]} />;
}

// --- Decorations ------------------------------------------------------------------

// Points along each look's roofline, for string lights.
function roofline(look: HollowLook): [number, number][] {
  const points: [number, number][] = [];
  if (look === "house") {
    for (let t = 0.08; t <= 0.95; t += 0.145) points.push([12 + (50 - 12) * t, 47 + (14 - 47) * t]);
    for (let t = 0.12; t <= 0.95; t += 0.145) points.push([50 + (88 - 50) * t, 14 + (47 - 14) * t]);
  } else if (look === "stump") {
    for (let a = 15; a <= 165; a += 25) {
      const rad = (a * Math.PI) / 180;
      points.push([50 + 30 * Math.cos(rad), 34 + 9 * Math.sin(rad)]);
    }
  } else if (look === "hill") {
    for (let x = 16; x <= 84; x += 11.3) points.push([x, 40 + ((x - 50) ** 2 * 42) / 1600]);
  } else {
    for (let x = 14; x <= 86; x += 12) points.push([x, 56 + Math.sin(((x - 14) / 72) * Math.PI) * 3]);
  }
  return points;
}

const bulbColors = ["#f3d38a", "#c2415a", "#4f7fb0", "#7fae6a"];

function Decor({ look, decor, alive }: { look: HollowLook; decor: HollowDecor; alive: boolean }) {
  const twinkle = useSharedValue(1);
  useEffect(() => {
    if (!alive || decor !== "lights") return;
    twinkle.value = withRepeat(withSequence(withTiming(0.55, { duration: 700 }), withTiming(1, { duration: 700 })), -1, false);
  }, [alive, decor, twinkle]);
  const twinkleStyle = useAnimatedStyle(() => ({ opacity: twinkle.value }));

  if (decor === "lights") {
    const points = roofline(look);
    return (
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width="100%" height="100%" viewBox="0 0 100 100" style={StyleSheet.absoluteFill}>
          <Polyline points={points.map((p) => p.join(",")).join(" ")} fill="none" stroke="#5a3a22" strokeWidth={0.7} />
        </Svg>
        <TwinkleLayer style={twinkleStyle} points={points} offset={0} />
        <TwinkleLayer points={points} offset={1} />
      </View>
    );
  }
  if (decor === "snow") {
    return (
      <Svg width="100%" height="100%" viewBox="0 0 100 100" style={StyleSheet.absoluteFill} pointerEvents="none">
        {look === "house" ? (
          <Polyline points="11,47 50,12 89,47" fill="none" stroke="#ffffff" strokeWidth={5} strokeLinejoin="round" strokeLinecap="round" />
        ) : look === "stump" ? (
          <G>
            <Ellipse cx={50} cy={31.5} rx={30} ry={8} fill="#ffffff" />
            <Circle cx={30} cy={37} r={2.4} fill="#ffffff" />
            <Circle cx={66} cy={38} r={2} fill="#ffffff" />
          </G>
        ) : look === "hill" ? (
          <Path d="M24 50 C34 39 66 39 76 50" fill="none" stroke="#ffffff" strokeWidth={6} strokeLinecap="round" />
        ) : (
          <Path d="M16 42 C24 26 76 26 84 42" fill="none" stroke="#ffffff" strokeWidth={6} strokeLinecap="round" />
        )}
        <Rect x={6} y={91} width={88} height={5} rx={2.5} fill="#ffffff" />
      </Svg>
    );
  }
  if (decor === "flowers") {
    const flowers: [number, string][] = [
      [10, "#efb3c6"],
      [21, "#ffffff"],
      [31, "#c8b6e2"],
      [69, "#efb3c6"],
      [80, "#f3d38a"],
      [90, "#c8b6e2"],
    ];
    return (
      <Svg width="100%" height="100%" viewBox="0 0 100 100" style={StyleSheet.absoluteFill} pointerEvents="none">
        {flowers.map(([x, color], i) => (
          <G key={i}>
            <Line x1={x} y1={95} x2={x} y2={88} stroke="#4f6b45" strokeWidth={1.2} />
            <Circle cx={x - 1.8} cy={87} r={1.8} fill={color} />
            <Circle cx={x + 1.8} cy={87} r={1.8} fill={color} />
            <Circle cx={x} cy={85.2} r={1.8} fill={color} />
            <Circle cx={x} cy={88.8} r={1.8} fill={color} />
            <Circle cx={x} cy={87} r={1.1} fill="#f3b33d" />
          </G>
        ))}
      </Svg>
    );
  }
  return null;
}

// Every other bulb twinkles, so the string never goes dark all at once.
function TwinkleLayer({
  points,
  offset,
  style,
}: {
  points: [number, number][];
  offset: 0 | 1;
  style?: ReturnType<typeof useAnimatedStyle>;
}) {
  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]}>
      <Svg width="100%" height="100%" viewBox="0 0 100 100">
        {points.map(([x, y], i) =>
          i % 2 === offset ? <Circle key={i} cx={x} cy={y + 1.6} r={2.1} fill={bulbColors[i % bulbColors.length]} /> : null
        )}
      </Svg>
    </Animated.View>
  );
}

// --- The looks -------------------------------------------------------------------

function House() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      <Rect x={63} y={16} width={9} height={20} rx={1.5} fill="#8a5a3b" />
      <Rect x={18} y={44} width={64} height={48} rx={4} fill="#fbf0e0" />
      <Polygon points="10,48 50,13 90,48" fill="#b0552d" stroke="#b0552d" strokeWidth={5} strokeLinejoin="round" />
      <Rect x={25} y={56} width={12} height={12} rx={2} fill={GLOW} />
      <Rect x={63} y={56} width={12} height={12} rx={2} fill={GLOW} />
      <Line x1={31} y1={56} x2={31} y2={68} stroke="#fbf0e0" strokeWidth={1.4} />
      <Line x1={69} y1={56} x2={69} y2={68} stroke="#fbf0e0" strokeWidth={1.4} />
      <Rect x={14} y={91} width={72} height={4} rx={2} fill="#8a5a3b" opacity={0.35} />
    </Svg>
  );
}

function Stump() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      <Path d="M14 92 C20 86 22 80 22 74 L78 74 C78 80 80 86 86 92 Z" fill="#7d5233" />
      <Rect x={20} y={32} width={60} height={60} rx={8} fill="#9a6a43" />
      <Line x1={30} y1={40} x2={30} y2={86} stroke="#7d5233" strokeWidth={1.6} strokeLinecap="round" />
      <Line x1={70} y1={42} x2={70} y2={84} stroke="#7d5233" strokeWidth={1.6} strokeLinecap="round" />
      <Ellipse cx={50} cy={33} rx={30} ry={9} fill="#e8c79a" />
      <Ellipse cx={50} cy={33} rx={20} ry={5.6} fill="none" stroke="#c9a06f" strokeWidth={1.3} />
      <Ellipse cx={50} cy={33} rx={9} ry={2.6} fill="none" stroke="#c9a06f" strokeWidth={1.3} />
      <Circle cx={33} cy={57} r={5.5} fill={GLOW} />
      <Rect x={83} y={80} width={4} height={10} rx={1.5} fill="#f4e6cf" />
      <Path d="M77 82 C77 74 93 74 93 82 Z" fill="#c2415a" />
      <Circle cx={82} cy={78} r={1.3} fill="#fff" />
      <Circle cx={88} cy={79} r={1} fill="#fff" />
    </Svg>
  );
}

// A grassy hill with a round green door — a real burrow.
function Hill() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      <Rect x={66} y={30} width={7} height={14} rx={1.5} fill="#8a5a3b" />
      <Path d="M2 94 C8 56 28 38 50 38 C72 38 92 56 98 94 Z" fill="#7d9a5f" />
      <Path d="M12 70 C20 54 34 44 50 43" fill="none" stroke="#93b075" strokeWidth={3} strokeLinecap="round" />
      <Rect x={39} y={57} width={22} height={37} rx={11} fill="#8a5a3b" />
      <Circle cx={25} cy={72} r={6.5} fill="#8a5a3b" />
      <Circle cx={25} cy={72} r={4.8} fill={GLOW} />
      <Circle cx={75} cy={72} r={6.5} fill="#8a5a3b" />
      <Circle cx={75} cy={72} r={4.8} fill={GLOW} />
      <Path d="M16 90 l2 -5 l2 5 M80 89 l2 -6 l2 6 M88 92 l1.5 -4 l1.5 4" stroke="#5f7d47" strokeWidth={1.4} fill="none" />
      <Rect x={6} y={92} width={88} height={4} rx={2} fill="#5f7d47" opacity={0.4} />
    </Svg>
  );
}

// A spotted mushroom with a door in its stem.
function Mushroom() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      <Path d="M30 93 L33 54 L67 54 L70 93 Z" fill="#f4e6cf" />
      <Path d="M33 54 L67 54 L66.4 62 C56 66 44 66 33.6 62 Z" fill="#e5d0b2" />
      <Path d="M8 56 C8 22 92 22 92 56 C78 62 22 62 8 56 Z" fill="#c2415a" />
      <Circle cx={30} cy={40} r={5} fill="#fff" />
      <Circle cx={53} cy={31} r={4.2} fill="#fff" />
      <Circle cx={73} cy={42} r={5.6} fill="#fff" />
      <Circle cx={45} cy={48} r={3} fill="#fff" />
      <Circle cx={85} cy={51} r={2.4} fill="#fff" />
      <Circle cx={17} cy={51} r={2.8} fill="#fff" />
      <Circle cx={37} cy={72} r={3.4} fill={GLOW} />
      <Circle cx={63} cy={72} r={3.4} fill={GLOW} />
      <Rect x={14} y={91} width={72} height={4} rx={2} fill="#8a5a3b" opacity={0.3} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  tile: {
    borderRadius: 24,
    padding: 10,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.06)",
    boxShadow: "inset 0px 1.5px 0px rgba(255, 255, 255, 0.55), inset 0px -2px 0px rgba(0, 0, 0, 0.04)",
  },
  tall: { alignItems: "center", justifyContent: "center", gap: 4 },
  wide: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 16 },
  doorway: { position: "absolute", backgroundColor: GLOW },
  door: { position: "absolute", backfaceVisibility: "hidden" },
  knob: { position: "absolute", backgroundColor: "#f3d38a" },
  burst: { position: "absolute", backgroundColor: GLOW },
  puff: { position: "absolute", backgroundColor: "#ffffff" },
  firefly: { position: "absolute", backgroundColor: "#fff3a6", boxShadow: "0px 0px 6px 2px rgba(255, 220, 110, 0.8)" },
  flake: { position: "absolute", top: 0, width: 5, height: 5, borderRadius: 2.5, backgroundColor: "#ffffff" },
  name: { fontSize: 16, fontWeight: "800", color: TEXT },
  count: { fontSize: 12, color: MUTED },
  peek: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 },
  peekIcon: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
});
