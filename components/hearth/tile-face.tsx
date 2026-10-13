import { useEffect, useId, useMemo } from "react";
import { BlurView } from "expo-blur";
import { Platform, StyleSheet, View } from "react-native";
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
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from "react-native-svg";

import type { Corners, TileShape } from "../../lib/decor";
import { deepColor, itemColor, nookLabel, type NookItem } from "../../lib/hearth";
import { findNook } from "../../lib/nooks";
import { tileMaterialOf } from "../../lib/tile-skins";
import { materialColors } from "../../lib/widget-skins";
import { IconBadge } from "../icon";
import { Text } from "../text";
import { nookWidgets } from "./nook-widgets";
import { SkinSurface } from "./widget-skin";

const TEXT = "#2a2420";
const MUTED = "#6f625a";

// The arch of a Nook tile: a rounded top like an alcove, softer at the
// bottom. Shared with the grid (for the shadow's shape) and the zoom into a
// Nook (CORE-034/036).
export function nookRadii(width: number, height: number, corners?: Corners, shape?: TileShape) {
  const short = Math.min(width, height);
  // A round window is as round as the tile allows; a door is a tall arch
  // with a flat threshold; a sign is a plank with softened corners (CORE-044).
  if (shape === "window") return { top: short / 2, bottom: short / 2 };
  if (shape === "door") return { top: Math.min(short / 2, width / 2), bottom: 6 };
  if (shape === "sign") return { top: corners === "square" ? 4 : corners === "round" ? 22 : 12, bottom: corners === "square" ? 4 : corners === "round" ? 22 : 12 };
  const top = Math.min(58, short * (short < 110 ? 0.42 : 0.32));
  const bottom = short < 110 ? 16 : 20;
  // Square: a barely-there arch. Round: a full dome and a soft base (CORE-042).
  if (corners === "square") return { top: Math.min(top, 14), bottom: 8 };
  if (corners === "round") return { top: Math.min(short / 2, top * 1.5), bottom: Math.min(short / 2, 32) };
  return { top, bottom };
}

// A rounded outline with a different radius on each corner, as a vector path.
// The tile's inner border and top highlight are drawn this way rather than as
// native borders/inset shadows, which the phone doesn't redraw when only the
// corner radii change (switching Round window back to Arched alcove).
// `inset` pulls the outline in from the tile's edge.
function roundedPath(width: number, height: number, top: number, bottom: number, inset: number) {
  const w = Math.max(0, width - inset * 2);
  const h = Math.max(0, height - inset * 2);
  let tl = Math.max(0, top - inset);
  let bl = Math.max(0, bottom - inset);
  // Corners can't overlap: shrink them together if they would.
  const k = Math.min(1, w / Math.max(1, tl * 2), w / Math.max(1, bl * 2), h / Math.max(1, tl + bl));
  tl *= k;
  bl *= k;
  const x = inset;
  const y = inset;
  return (
    `M${x} ${y + tl} A${tl} ${tl} 0 0 1 ${x + tl} ${y} H${x + w - tl} A${tl} ${tl} 0 0 1 ${x + w} ${y + tl} ` +
    `V${y + h - bl} A${bl} ${bl} 0 0 1 ${x + w - bl} ${y + h} H${x + bl} A${bl} ${bl} 0 0 1 ${x} ${y + h - bl} Z`
  );
}

// A Nook tile (CORE-007/019/036). Nooks are the heart of the app, so they
// don't look like widgets: each is a little arched alcove — a keystone at
// the top of the arch, a carved inner frame, lantern light glowing down
// from the top, and now and then a slow shimmer of light across it. Its
// icon sits in the alcove; bigger tiles add the Nook's own live info
// (CORE-010). Its icon and look — soft, bold or outline — are the person's
// to pick (CORE-030), or it can be made of one of a few widget materials,
// drawn in its own shape, with its name on a brass nameplate (CORE-137, 139).
export function TileFace({
  item,
  width,
  height,
  refreshKey,
  themeText = TEXT,
  still = false,
}: {
  item: NookItem;
  width: number;
  height: number;
  refreshKey: number;
  themeText?: string;
  // While editing: frosted glass doesn't live-blur (performance).
  still?: boolean;
}) {
  const nook = findNook(item.nookId);
  const widget = nookWidgets[item.nookId];
  const Widget = widget?.Component;
  const label = nookLabel(item);
  const icon = item.icon ?? nook?.icon ?? "category";
  const soft = itemColor(item);
  const look = item.look ?? "soft";
  const shape = item.shape ?? "arch";
  const { top, bottom } = nookRadii(width, height, item.corners, shape);
  // Round windows and doors curve in, so their contents need a little more
  // room at the sides.
  const short = Math.min(width, height);
  const extra = shape === "window" ? short * 0.14 : shape === "door" ? short * 0.05 : 0;
  // Window bars only suit a window that is roughly square; stretched into a
  // wide or tall pill they'd cut straight through the writing.
  const barsFit = Math.max(width, height) / Math.max(1, short) <= 1.5;
  // Ids for the shared gradients must be unique per tile.
  const gid = item.id.replace(/[^a-zA-Z0-9]/g, "");

  // What it's made of (CORE-137). A material takes the place of the soft,
  // bold and outline looks, and a picked color tints it.
  const material = tileMaterialOf(item.material);
  const made = material !== "plain" ? materialColors(material, item.color) : null;
  const dark = Boolean(made?.dark);

  // Colors for this look. The deep color is the chosen color's partner, or
  // the Nook's own icon color if no color was picked.
  const bold = !made && look === "bold";
  const outline = !made && look === "outline";
  const tileDeep = item.color ? deepColor(item.color) : nook?.iconColor ?? deepColor(soft);
  // Bold tiles and dark materials (wood, felt, chalkboard) take light marks.
  const light = bold || dark;
  const text = made ? made.text : bold ? "#ffffff" : outline ? themeText : TEXT;
  const muted = made ? made.muted : bold ? "rgba(255,255,255,0.8)" : outline ? `${themeText}99` : MUTED;
  const iconColor = dark ? made!.accent : bold ? "#ffffff" : tileDeep;
  const badge = light ? "rgba(255,255,255,0.2)" : outline ? `${tileDeep}18` : "rgba(255,255,255,0.7)";
  const panel = made ? made.panel : bold ? "rgba(255,255,255,0.15)" : outline ? `${tileDeep}10` : "rgba(255,255,255,0.58)";
  const frameLine = light ? "rgba(255,255,255,0.32)" : outline ? `${tileDeep}55` : "rgba(255,255,255,0.75)";
  const lantern = dark ? "#ffe6b0" : bold ? "#ffffff" : outline ? tileDeep : "#fff3d6";
  // Door knob and sign nails.
  const trim = light ? "rgba(255,255,255,0.85)" : tileDeep;
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
    bold && { backgroundColor: tileDeep },
    !made && look === "soft" && { backgroundColor: soft },
    outline && { borderWidth: 2, borderColor: tileDeep, backgroundColor: "transparent" },
    // A border you asked for on a solid tile (CORE-042).
    item.border && !outline && !made && { borderWidth: 2.5, borderColor: bold ? "rgba(255,255,255,0.6)" : tileDeep },
    // Made of something: drawn by SkinSurface, in the tile's own shape.
    made && { backgroundColor: "transparent", borderWidth: 0 },
  ];
  const widgetProps = { refreshKey, textColor: text, mutedColor: muted, accentColor: light ? iconColor : tileDeep };

  // Radius of the lit top edge (never more than half the tile's width).
  const rt = Math.max(1.5, Math.min(top, width / 2 - 0.75, height - 1));

  const decoration = (
    <>
      {made ? (
        <>
          <SkinSurface
            material={material}
            edge="plain"
            color={item.color}
            border={item.border}
            width={width}
            height={height}
            radius={top}
            path={roundedPath(width, height, top, bottom, 0)}
          />
          {/* Frosted glass really blurs what's behind it on iPhone (CORE-132). */}
          {material === "glass" && Platform.OS === "ios" && !still ? (
            <BlurView intensity={28} tint="light" style={[StyleSheet.absoluteFill, { zIndex: -1 }]} />
          ) : null}
        </>
      ) : null}
      <Lantern id={gid} width={width} height={height} color={lantern} strength={dark ? 0.25 : bold ? 0.22 : outline ? 0.1 : 0.6} />
      <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
        {/* The carved inner frame (a chalkboard has its wooden one), and the
            lit top edge (CORE-028). */}
        {material !== "chalkboard" ? (
          <Path d={roundedPath(width, height, top, bottom, 5.75)} fill="none" stroke={frameLine} strokeWidth={1.5} />
        ) : null}
        {!outline ? (
          <Path d={`M0.75 ${rt} A${rt - 0.75} ${rt - 0.75} 0 0 1 ${rt} 0.75 H${width - rt} A${rt - 0.75} ${rt - 0.75} 0 0 1 ${width - 0.75} ${rt}`} fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth={1.5} />
        ) : null}
      </Svg>
      {shape === "arch" ? (
        <View style={[styles.keystone, { backgroundColor: light ? "rgba(255,255,255,0.55)" : tileDeep }]} />
      ) : null}
      {shape === "window" && barsFit ? (
        <>
          <View pointerEvents="none" style={[styles.mullionV, { backgroundColor: frameLine }]} />
          <View pointerEvents="none" style={[styles.mullionH, { backgroundColor: frameLine }]} />
        </>
      ) : null}
      {shape === "door" ? (
        <>
          <View pointerEvents="none" style={[styles.knob, { backgroundColor: trim }]} />
          <View pointerEvents="none" style={[styles.threshold, { backgroundColor: frameLine }]} />
        </>
      ) : null}
      {shape === "sign" ? (
        <>
          <View pointerEvents="none" style={[styles.nail, { left: 12, backgroundColor: trim }]} />
          <View pointerEvents="none" style={[styles.nail, { right: 12, backgroundColor: trim }]} />
          <View pointerEvents="none" style={[styles.grain, { top: "34%", backgroundColor: frameLine }]} />
          <View pointerEvents="none" style={[styles.grain, { top: "66%", backgroundColor: frameLine }]} />
        </>
      ) : null}
      <Sheen id={gid} width={width} height={height} seed={item.id} />
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
      <View style={[frame, styles.centered, { flexDirection: item.h === 1 ? "row" : "column", gap: 10, paddingHorizontal: 16 + extra }]}>
        {decoration}
        <IconBadge name={icon} size={size} color={iconColor} background={badge} />
        {item.h === 1 ? (
          item.nameplate ? (
            <View style={{ flex: 1 }}>
              <Nameplate label={label} />
            </View>
          ) : (
            <Text style={[styles.title, { flex: 1, color: text }]} numberOfLines={1}>
              {label}
            </Text>
          )
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
      <View style={[frame, { paddingTop: 24 + extra * 0.6, paddingHorizontal: 14 + extra }]}>
        {decoration}
        <View style={{ flex: 1, gap: 12 }}>
          <View style={[styles.row, { paddingHorizontal: 6 }]}>
            <IconBadge name={icon} size={52} color={iconColor} background={badge} />
            <View style={{ flex: 1 }}>
              {item.nameplate ? (
                <Nameplate label={label} big />
              ) : (
                <Text style={[styles.title, { fontSize: 19, color: text }]} numberOfLines={1}>
                  {label}
                </Text>
              )}
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
      <View style={[frame, styles.row, { paddingHorizontal: 20 + extra }]}>
        {decoration}
        <IconBadge name={icon} size={56} color={iconColor} background={badge} />
        <View style={{ flex: 1, gap: 4 }}>
          {item.nameplate ? (
            <Nameplate label={label} />
          ) : (
            <Text style={[styles.title, { color: text }]} numberOfLines={1}>
              {label}
            </Text>
          )}
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
    <View style={[frame, styles.centered, { gap: 8, paddingTop: 20, paddingHorizontal: 14 + extra }]}>
      {decoration}
      <IconBadge name={icon} size={50} color={iconColor} background={badge} />
      <View style={{ alignItems: "center", gap: 1, alignSelf: "stretch" }}>
        {item.nameplate ? (
          <Nameplate label={label} center />
        ) : (
          <Text style={[styles.title, { color: text, textAlign: "center" }]} numberOfLines={1}>
            {label}
          </Text>
        )}
        {Widget ? (
          <View style={{ alignItems: "center", alignSelf: "stretch" }}>
            <Widget size="small" space={{ width: width - PAD * 2, height: height - 20 - PAD - 50 - 8 - 21 - 1 }} {...widgetProps} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

// The Nook's name on a little brass plate, screwed on at each end (CORE-139).
// It's as wide as the name, up to the room there is, and the name shortens
// with "…" rather than running off it. Its height matches a plain title's,
// so the Nook's live info below keeps its room.
function Nameplate({ label, center = false, big = false }: { label: string; center?: boolean; big?: boolean }) {
  return (
    <View style={[styles.plate, big && styles.plateBig, center && { alignSelf: "center" }]}>
      <View style={[styles.screw, { left: 4 }]} />
      <View style={[styles.screw, { right: 4 }]} />
      <Text style={[styles.plateText, big && styles.plateTextBig]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

// A little lamp hung beside a Nook tile's top left corner, reaching just
// outside it, that glows when the Nook has news, in place of the news dot
// (CORE-139). `height` is the tile's.
export function PorchLight({ lit, height }: { lit: boolean; height: number }) {
  const id = `porch${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <View pointerEvents="none" style={[styles.porch, { top: Math.max(4, Math.min(height * 0.16, 24)) }]}>
      <Svg width={22} height={34}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#ffd77a" stopOpacity={0.9} />
            <Stop offset="1" stopColor="#ffd77a" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        {lit ? <Circle cx={11} cy={15} r={11} fill={`url(#${id})`} /> : null}
        <Path d="M11 0 V5" stroke="#4b4540" strokeWidth={2} />
        <Path d="M5 8 L11 4 L17 8 Z" fill="#3b3632" />
        <Rect x={6} y={8} width={10} height={14} rx={1.5} fill={lit ? "#ffe39a" : "#cfd3d6"} fillOpacity={lit ? 1 : 0.8} stroke="#3b3632" strokeWidth={1.6} />
        <Path d="M11 8 V22" stroke="#3b3632" strokeWidth={0.8} />
        <Rect x={5} y={22} width={12} height={2.5} rx={1} fill="#3b3632" />
      </Svg>
    </View>
  );
}

// Lantern light glowing down from the top of the arch.
function Lantern({ id, width, height, color, strength }: { id: string; width: number; height: number; color: string; strength: number }) {
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <RadialGradient id={`lantern${id}`} cx="50%" cy="0%" rx="70%" ry="62%" fx="50%" fy="0%">
          <Stop offset="0" stopColor={color} stopOpacity={strength} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={width} height={height} fill={`url(#lantern${id})`} />
    </Svg>
  );
}

// Every so often a soft band of light drifts across the tile. Each tile
// starts at its own moment (from its id), so they never shimmer in unison.
function Sheen({ id, width, height, seed }: { id: string; width: number; height: number; seed: string }) {
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
          <LinearGradient id={`sheen${id}`} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#ffffff" stopOpacity={0} />
            <Stop offset="0.5" stopColor="#ffffff" stopOpacity={0.28} />
            <Stop offset="1" stopColor="#ffffff" stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={band} height={height * 1.8} fill={`url(#sheen${id})`} />
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
  mullionV: { position: "absolute", top: 8, bottom: 8, left: "50%", marginLeft: -1, width: 2, borderRadius: 1 },
  mullionH: { position: "absolute", left: 8, right: 8, top: "50%", marginTop: -1, height: 2, borderRadius: 1 },
  knob: { position: "absolute", right: 14, top: "52%", width: 9, height: 9, borderRadius: 5 },
  threshold: { position: "absolute", left: 10, right: 10, bottom: 9, height: 2, borderRadius: 1 },
  nail: { position: "absolute", top: 9, width: 7, height: 7, borderRadius: 4 },
  grain: { position: "absolute", left: 22, right: 22, height: 1.5, borderRadius: 1, opacity: 0.6 },
  sheen: { position: "absolute", left: 0 },
  porch: { position: "absolute", left: -9, width: 22, height: 34 },
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
  plate: {
    alignSelf: "flex-start",
    maxWidth: "100%",
    minHeight: 21,
    justifyContent: "center",
    paddingHorizontal: 13,
    borderRadius: 4,
    backgroundColor: "#d4ae58",
    borderWidth: 1,
    borderColor: "#9a7418",
    boxShadow: "inset 0px 1px 0px #f3d98a, 0px 1px 1.5px rgba(0,0,0,0.25)",
  },
  plateBig: { minHeight: 25 },
  screw: { position: "absolute", top: "50%", marginTop: -2, width: 4, height: 4, borderRadius: 2, backgroundColor: "#8a6a1c" },
  plateText: { fontSize: 13, lineHeight: 17, fontWeight: "800", color: "#3b2a0e", letterSpacing: 0.3 },
  plateTextBig: { fontSize: 16, lineHeight: 20 },
  widgetLabel: { fontSize: 11, lineHeight: 14, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.6 },
});
