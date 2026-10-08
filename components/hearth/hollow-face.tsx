import { useCallback, useEffect, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import Svg, { Circle, Ellipse, Line, Path, Polygon, Rect } from "react-native-svg";
import { scheduleOnRN } from "react-native-worklets";

import { itemColor, tileBevel, type HollowItem } from "../../lib/hearth-layout";

const TEXT = "#2a2420";
const MUTED = "#6f625a";
const GLOW = "#ffcf7a";

// The door, in the drawing's 100×100 space. Shared by the house and stump.
const DOOR = { x: 42, y: 60, w: 16, h: 32 };

// A Hollow on the Hearth (CORE-022/024): a little house or tree stump with a
// real door. When `opening` turns true the door swings open on its hinge
// while the tile leans in a touch, then `onOpened` fires so the Hollow's
// screen can take over. Turning `opening` back off closes the door again
// (what you see when you come back out).
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

  // Latest onOpened, without re-running the animation when it changes.
  const onOpenedRef = useRef(onOpened);
  onOpenedRef.current = onOpened;
  const opened = useCallback(() => onOpenedRef.current?.(), []);

  useEffect(() => {
    if (opening) {
      open.value = withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) }, (finished) => {
        if (finished) scheduleOnRN(opened);
      });
    } else {
      open.value = withTiming(0, { duration: 320, easing: Easing.inOut(Easing.cubic) });
    }
  }, [opening, open, opened]);

  const wide = item.w >= 3;
  const tiny = item.w === 1 || item.h === 1;
  const label = !tiny;
  const art = tiny
    ? Math.min(width, height) * 0.86
    : wide
      ? Math.min(height - 20, width * 0.42)
      : Math.min(width - 24, height - 54);
  const k = art / 100;

  const doorStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 400 },
      // Rotate around the door's left edge (its hinge).
      { translateX: (-DOOR.w * k) / 2 },
      { rotateY: `${-open.value * 78}deg` },
      { translateX: (DOOR.w * k) / 2 },
    ],
  }));
  const leanIn = useAnimatedStyle(() => ({ transform: [{ scale: 1 + open.value * 0.05 }] }));
  const glow = useAnimatedStyle(() => ({ opacity: 0.55 + open.value * 0.45 }));

  const count = item.items.length;

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
      <View style={{ width: art, height: art }} accessibilityLabel={`${item.name}, a ${item.look}`}>
        {item.look === "stump" ? <Stump /> : <House />}
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
          style={[
            styles.door,
            {
              left: DOOR.x * k,
              top: DOOR.y * k,
              width: DOOR.w * k,
              height: DOOR.h * k,
              borderTopLeftRadius: (DOOR.w * k) / 2,
              borderTopRightRadius: (DOOR.w * k) / 2,
              backgroundColor: item.look === "stump" ? "#5e3b22" : "#7a4a2e",
            },
            doorStyle,
          ]}
        >
          <View style={[styles.knob, { width: 2.6 * k, height: 2.6 * k, borderRadius: 1.3 * k, right: 2.4 * k, top: DOOR.h * k * 0.55 }]} />
        </Animated.View>
      </View>

      {label ? (
        <View style={wide ? { flex: 1, gap: 2 } : { alignItems: "center", gap: 1 }}>
          <Text style={[styles.name, !wide && { textAlign: "center" }]} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.count}>{count === 0 ? "Empty" : `${count} inside`}</Text>
        </View>
      ) : null}
    </Animated.View>
  );
}

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

const styles = StyleSheet.create({
  tile: {
    borderRadius: 24,
    padding: 10,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.06)",
    boxShadow: tileBevel,
  },
  tall: { alignItems: "center", justifyContent: "center", gap: 4 },
  wide: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 16 },
  doorway: { position: "absolute", backgroundColor: GLOW },
  door: { position: "absolute", backfaceVisibility: "hidden" },
  knob: { position: "absolute", backgroundColor: "#f3d38a" },
  name: { fontSize: 16, fontWeight: "800", color: TEXT },
  count: { fontSize: 12, color: MUTED },
});
