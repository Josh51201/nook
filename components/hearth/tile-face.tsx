import { useEffect, useMemo } from "react";
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
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from "react-native-svg";

import { deepColor, itemColor, nookLabel, tileBevel, type NookItem } from "../../lib/hearth";
import { findNook } from "../../lib/nooks";
import { IconBadge } from "../icon";
import { Text } from "../text";
import { nookWidgets } from "./nook-widgets";

const TEXT = "#2a2420";
const MUTED = "#6f625a";

// The arch of a Nook tile: a rounded top like an alcove, softer at the
// bottom. Shared with the grid (for the shadow's shape) and the zoom into a
// Nook (CORE-034/036).
export function nookRadii(width: number, height: number) {
  const short = Math.min(width, height);
  const top = Math.min(58, short * (short < 110 ? 0.42 : 0.32));
  return { top, bottom: short < 110 ? 16 : 20 };
}

// A Nook tile (CORE-007/019/036). Nooks are the heart of the app, so they
// don't look like widgets: each is a little arched alcove — a keystone at
// the top of the arch, a carved inner frame, lantern light glowing down
// from the top, and now and then a slow shimmer of light across it. Its
// icon sits in the alcove; bigger tiles add the Nook's own live info
// (CORE-010). Its icon and look — soft, bold or outline — are the person's
// to pick (CORE-030).
export function TileFace({
  item,
  width,
  height,
  refreshKey,
  themeText = TEXT,
}: {
  item: NookItem;
  width: number;
  height: number;
  refreshKey: number;
  themeText?: string;
}) {
  const nook = findNook(item.nookId);
  const widget = nookWidgets[item.nookId];
  const Widget = widget?.Component;
  const label = nookLabel(item);
  const icon = item.icon ?? nook?.icon ?? "category";
  const soft = itemColor(item);
  const look = item.look ?? "soft";
  const { top, bottom } = nookRadii(width, height);

  // Colors for this look. The deep color is the chosen color's partner, or
  // the Nook's own icon color if no color was picked.
  const bold = look === "bold";
  const outline = look === "outline";
  const tileDeep = item.color ? deepColor(item.color) : nook?.iconColor ?? deepColor(soft);
  const text = bold ? "#ffffff" : outline ? themeText : TEXT;
  const muted = bold ? "rgba(255,255,255,0.8)" : outline ? `${themeText}99` : MUTED;
  const iconColor = bold ? "#ffffff" : tileDeep;
  const badge = bold ? "rgba(255,255,255,0.2)" : outline ? `${tileDeep}18` : "rgba(255,255,255,0.7)";
  const panel = bold ? "rgba(255,255,255,0.15)" : outline ? `${tileDeep}10` : "rgba(255,255,255,0.58)";
  const frameLine = bold ? "rgba(255,255,255,0.32)" : outline ? `${tileDeep}55` : "rgba(255,255,255,0.75)";
  const lantern = bold ? "#ffffff" : outline ? tileDeep : "#fff3d6";
  const radii = {
    borderTopLeftRadius: top,
    borderTopRightRadius: top,
    borderBottomLeftRadius: bottom,
    borderBottomRightRadius: bottom,
  };
  const frame = [
    styles.tile,
    radii,
    { width, height },
    bold && { backgroundColor: tileDeep, boxShadow: tileBevel },
    look === "soft" && { backgroundColor: soft, boxShadow: tileBevel },
    outline && { borderWidth: 2, borderColor: tileDeep, backgroundColor: "transparent" },
  ];
  const widgetProps = { refreshKey, textColor: text, mutedColor: muted, accentColor: bold ? "#ffffff" : tileDeep };

  const decoration = (
    <>
      <Lantern width={width} height={height} color={lantern} strength={bold ? 0.22 : outline ? 0.1 : 0.6} />
      <View
        pointerEvents="none"
        style={[
          styles.innerFrame,
          {
            borderColor: frameLine,
            borderTopLeftRadius: top - 5,
            borderTopRightRadius: top - 5,
            borderBottomLeftRadius: bottom - 5,
            borderBottomRightRadius: bottom - 5,
          },
        ]}
      />
      <View style={[styles.keystone, { backgroundColor: bold ? "rgba(255,255,255,0.55)" : tileDeep }]} />
      <Sheen width={width} height={height} seed={item.id} />
    </>
  );

  // One cell: just the icon in its alcove.
  if (item.w === 1 && item.h === 1) {
    return (
      <View style={[frame, styles.centered, { paddingTop: 8 }]}>
        {decoration}
        <IconBadge name={icon} size={Math.min(width, height) * 0.56} color={iconColor} background={badge} />
      </View>
    );
  }

  // One row tall: icon and name side by side.
  if (item.h === 1 || item.w === 1) {
    const size = Math.min(width, height) * 0.6;
    return (
      <View style={[frame, styles.centered, { flexDirection: item.h === 1 ? "row" : "column", gap: 10, paddingHorizontal: 16 }]}>
        {decoration}
        <IconBadge name={icon} size={size} color={iconColor} background={badge} />
        {item.h === 1 ? (
          <Text style={[styles.title, { flex: 1, color: text }]} numberOfLines={1}>
            {label}
          </Text>
        ) : null}
      </View>
    );
  }

  const wide = item.w >= 3;
  const tall = item.h >= 3;
  // The room left for the Nook's live info in each layout below, so it
  // shows only what fits (padding, icon, name and panel taken off).
  const PAD = 14;

  if (tall) {
    return (
      <View style={[frame, { paddingTop: 24 }]}>
        {decoration}
        <View style={{ flex: 1, gap: 12 }}>
          <View style={[styles.row, { paddingHorizontal: 6 }]}>
            <IconBadge name={icon} size={52} color={iconColor} background={badge} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { fontSize: 19, color: text }]} numberOfLines={1}>
                {label}
              </Text>
              <Text style={[styles.tagline, { color: muted }]} numberOfLines={1}>
                {nook?.tagline}
              </Text>
            </View>
          </View>
          {Widget ? (
            <View style={[styles.widgetArea, { backgroundColor: panel }]}>
              <Text style={[styles.widgetLabel, { color: muted }]} numberOfLines={1}>
                {widget.label}
              </Text>
              <Widget
                size="large"
                space={{ width: width - PAD * 2 - 24, height: height - 24 - PAD - 52 - 12 - 24 - 14 - 8 }}
                {...widgetProps}
              />
            </View>
          ) : null}
        </View>
      </View>
    );
  }

  if (wide) {
    return (
      <View style={[frame, styles.row, { paddingHorizontal: 20 }]}>
        {decoration}
        <IconBadge name={icon} size={56} color={iconColor} background={badge} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[styles.title, { color: text }]} numberOfLines={1}>
            {label}
          </Text>
          {Widget ? (
            <Widget size="wide" space={{ width: width - 40 - 56 - 12, height: height - PAD * 2 - 21 - 4 }} {...widgetProps} />
          ) : (
            <Text style={[styles.tagline, { color: muted }]} numberOfLines={2}>
              {nook?.tagline}
            </Text>
          )}
        </View>
      </View>
    );
  }

  // Small: the icon in the alcove, the name beneath it.
  return (
    <View style={[frame, styles.centered, { gap: 8, paddingTop: 20 }]}>
      {decoration}
      <IconBadge name={icon} size={50} color={iconColor} background={badge} />
      <View style={{ alignItems: "center", gap: 1, alignSelf: "stretch" }}>
        <Text style={[styles.title, { color: text, textAlign: "center" }]} numberOfLines={1}>
          {label}
        </Text>
        {Widget ? (
          <View style={{ alignItems: "center", alignSelf: "stretch" }}>
            <Widget size="small" space={{ width: width - PAD * 2, height: height - 20 - PAD - 50 - 8 - 21 - 1 }} {...widgetProps} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

// Lantern light glowing down from the top of the arch.
function Lantern({ width, height, color, strength }: { width: number; height: number; color: string; strength: number }) {
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <RadialGradient id="lantern" cx="50%" cy="0%" rx="70%" ry="62%" fx="50%" fy="0%">
          <Stop offset="0" stopColor={color} stopOpacity={strength} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={width} height={height} fill="url(#lantern)" />
    </Svg>
  );
}

// Every so often a soft band of light drifts across the tile. Each tile
// starts at its own moment (from its id), so they never shimmer in unison.
function Sheen({ width, height, seed }: { width: number; height: number; seed: string }) {
  const reduceMotion = useReducedMotion();
  const p = useSharedValue(0);
  const delay = useMemo(() => {
    let hash = 0;
    for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) % 9973;
    return 1500 + (hash % 6000);
  }, [seed]);

  useEffect(() => {
    if (reduceMotion) return;
    p.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
          withDelay(7000, withTiming(0, { duration: 0 }))
        ),
        -1,
        false
      )
    );
  }, [p, delay, reduceMotion]);

  const band = Math.max(60, width * 0.45);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: -band * 1.5 + p.value * (width + band * 2) }, { rotate: "18deg" }],
  }));

  if (reduceMotion) return null;
  return (
    <Animated.View pointerEvents="none" style={[styles.sheen, { width: band, height: height * 1.8, top: -height * 0.4 }, style]}>
      <Svg width={band} height={height * 1.8}>
        <Defs>
          <LinearGradient id="sheen" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#ffffff" stopOpacity={0} />
            <Stop offset="0.5" stopColor="#ffffff" stopOpacity={0.28} />
            <Stop offset="1" stopColor="#ffffff" stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={band} height={height * 1.8} fill="url(#sheen)" />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  tile: {
    padding: 14,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.06)",
  },
  centered: { alignItems: "center", justifyContent: "center" },
  innerFrame: { position: "absolute", top: 5, left: 5, right: 5, bottom: 5, borderWidth: 1.5 },
  keystone: {
    position: "absolute",
    top: 0,
    alignSelf: "center",
    left: "50%",
    marginLeft: -8,
    width: 16,
    height: 7,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
  },
  sheen: { position: "absolute", left: 0 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  title: { fontSize: 16, lineHeight: 21, fontWeight: "800", color: TEXT },
  tagline: { fontSize: 13, color: MUTED },
  widgetArea: {
    flex: 1,
    borderRadius: 16,
    padding: 12,
    gap: 8,
    overflow: "hidden",
  },
  widgetLabel: { fontSize: 11, lineHeight: 14, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.6 },
});
