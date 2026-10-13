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
import Svg, { Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from "react-native-svg";

import type { Corners, TileShape } from "../../lib/decor";
import { deepColor, itemColor, nookLabel, type NookItem } from "../../lib/hearth";
import { findNook } from "../../lib/nooks";
import { buildColors, doorwayOf, wreathShows } from "../../lib/tile-looks";
import { IconBadge, type IconName } from "../icon";
import { Text } from "../text";
import { nookWidgets } from "./nook-widgets";
import { Nameplate, ShapeDetails, shapeRoom, TileSurface, tileOutline, WreathRing } from "./tile-build";

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
  // The newer shapes (CORE-138).
  const soft = corners === "square" ? 4 : corners === "round" ? 18 : 10;
  if (shape === "hobbit") return { top: short / 2, bottom: short / 2 };
  if (shape === "mailbox") return { top: Math.min(short / 2, width / 2), bottom: soft };
  if (shape === "shutters" || shape === "drawer") return { top: soft, bottom: soft };
  if (shape === "shopfront") return { top: 4, bottom: soft };
  if (shape === "birdhouse") return { top: 0, bottom: soft };
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
  const shape = item.shape ?? "arch";
  const { top, bottom } = nookRadii(width, height, item.corners, shape);
  // Round windows and doors curve in, so their contents need a little more
  // room at the sides; shutters, awnings and roofs take room too (CORE-138).
  const short = Math.min(width, height);
  const room = shapeRoom(shape, width, height);
  const extra = (shape === "window" || shape === "hobbit" ? short * 0.14 : shape === "door" ? short * 0.05 : 0) + room.side;
  const lift = room.top;
  // What it's built from (CORE-137), and its doorway touches (CORE-139).
  const build = item.build && item.build !== "plain" ? item.build : null;
  const doorway = doorwayOf(item.doorway);
  const wreath = wreathShows(doorway.wreath, new Date());
  // A birdhouse is drawn as its own outline, roof and all.
  const drawn = Boolean(build) || shape === "birdhouse";
  // Window bars only suit a window that is roughly square; stretched into a
  // wide or tall pill they'd cut straight through the writing.
  const barsFit = Math.max(width, height) / Math.max(1, short) <= 1.5;
  // Ids for the shared gradients must be unique per tile.
  const gid = item.id.replace(/[^a-zA-Z0-9]/g, "");

  // Colors for this look. The deep color is the chosen color's partner, or
  // the Nook's own icon color if no color was picked.
  const bold = !build && look === "bold";
  const outline = !build && look === "outline";
  const tileDeep = item.color ? deepColor(item.color) : nook?.iconColor ?? deepColor(soft);
  const built = build ? buildColors(build, soft) : null;
  const text = built ? built.text : bold ? "#ffffff" : outline ? themeText : TEXT;
  const muted = built ? built.muted : bold ? "rgba(255,255,255,0.8)" : outline ? `${themeText}99` : MUTED;
  const iconColor = built ? built.icon : bold ? "#ffffff" : tileDeep;
  const badge = built ? built.badge : bold ? "rgba(255,255,255,0.2)" : outline ? `${tileDeep}18` : "rgba(255,255,255,0.7)";
  const panel = built ? built.panel : bold ? "rgba(255,255,255,0.15)" : outline ? `${tileDeep}10` : "rgba(255,255,255,0.58)";
  const frameLine = built ? built.frameLine : bold ? "rgba(255,255,255,0.32)" : outline ? `${tileDeep}55` : "rgba(255,255,255,0.75)";
  const lantern = built ? built.lantern : bold ? "#ffffff" : outline ? tileDeep : "#fff3d6";
  const surface = built ? { base: built.base, ink: built.ink } : { base: bold ? tileDeep : outline ? "transparent" : soft, ink: tileDeep };
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
    !drawn && bold && { backgroundColor: tileDeep },
    !drawn && look === "soft" && { backgroundColor: soft },
    !drawn && outline && { borderWidth: 2, borderColor: tileDeep, backgroundColor: "transparent" },
    // A border you asked for on a solid tile (CORE-042).
    !drawn && item.border && !outline && { borderWidth: 2.5, borderColor: bold ? "rgba(255,255,255,0.6)" : tileDeep },
    // Built from something, or a birdhouse: drawn by TileSurface instead.
    drawn && { backgroundColor: "transparent", borderWidth: 0 },
  ];
  const widgetProps = { refreshKey, textColor: text, mutedColor: muted, accentColor: bold ? "#ffffff" : tileDeep };

  // Radius of the lit top edge (never more than half the tile's width).
  const rt = Math.max(1.5, Math.min(top, width / 2 - 0.75, height - 1));

  const decoration = (
    <>
      {drawn ? (
        <TileSurface
          id={gid}
          build={build}
          colors={surface}
          outline={tileOutline(width, height, top, bottom, shape)}
          width={width}
          height={height}
          ownShadow={shape === "birdhouse"}
        />
      ) : null}
      <Lantern id={gid} width={width} height={height} color={lantern} strength={bold ? 0.22 : outline ? 0.1 : 0.6} />
      <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
        {/* The carved inner frame, and the lit top edge (CORE-028). */}
        <Path d={roundedPath(width, height, top, bottom, 5.75)} fill="none" stroke={frameLine} strokeWidth={1.5} />
        {!outline ? (
          <Path d={`M0.75 ${rt} A${rt - 0.75} ${rt - 0.75} 0 0 1 ${rt} 0.75 H${width - rt} A${rt - 0.75} ${rt - 0.75} 0 0 1 ${width - 0.75} ${rt}`} fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth={1.5} />
        ) : null}
      </Svg>
      {shape === "arch" ? (
        <View style={[styles.keystone, { backgroundColor: bold ? "rgba(255,255,255,0.55)" : tileDeep }]} />
      ) : null}
      {shape === "window" && barsFit ? (
        <>
          <View pointerEvents="none" style={[styles.mullionV, { backgroundColor: frameLine }]} />
          <View pointerEvents="none" style={[styles.mullionH, { backgroundColor: frameLine }]} />
        </>
      ) : null}
      {shape === "door" ? (
        <>
          <View pointerEvents="none" style={[styles.knob, { backgroundColor: bold ? "rgba(255,255,255,0.85)" : tileDeep }]} />
          <View pointerEvents="none" style={[styles.threshold, { backgroundColor: frameLine }]} />
        </>
      ) : null}
      {shape === "sign" ? (
        <>
          <View pointerEvents="none" style={[styles.nail, { left: 12, backgroundColor: bold ? "rgba(255,255,255,0.85)" : tileDeep }]} />
          <View pointerEvents="none" style={[styles.nail, { right: 12, backgroundColor: bold ? "rgba(255,255,255,0.85)" : tileDeep }]} />
          <View pointerEvents="none" style={[styles.grain, { top: "34%", backgroundColor: frameLine }]} />
          <View pointerEvents="none" style={[styles.grain, { top: "66%", backgroundColor: frameLine }]} />
        </>
      ) : null}
      <ShapeDetails shape={shape} width={width} height={height} deep={tileDeep} line={frameLine} />
      <Sheen id={gid} width={width} height={height} seed={item.id} />
    </>
  );

  // The Nook's icon, in a wreath when it's up (CORE-139).
  const iconBadge = (size: number) =>
    wreath ? (
      <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
        <View style={{ position: "absolute", left: -size * 0.27, top: -size * 0.27 }}>
          <WreathRing size={size * 1.54} />
        </View>
        <IconBadge name={icon as IconName} size={size} color={iconColor} background={badge} />
      </View>
    ) : (
      <IconBadge name={icon as IconName} size={size} color={iconColor} background={badge} />
    );
  // Its name, on a brass plate if it has one (CORE-139).
  const nameText = (style: object, center = false) =>
    doorway.nameplate ? (
      <Nameplate label={label} />
    ) : (
      <Text style={[styles.title, style, center && { textAlign: "center" }, { color: text }]} numberOfLines={1}>
        {label}
      </Text>
    );

  // One cell: just the icon in its alcove.
  if (item.w === 1 && item.h === 1) {
    return (
      <View style={[frame, styles.centered, { paddingTop: 8 + lift, paddingHorizontal: room.side }]}>
        {decoration}
        {iconBadge(Math.min(width - room.side * 2, height - lift) * (wreath ? 0.42 : 0.56))}
      </View>
    );
  }

  // One row tall: icon and name side by side.
  if (item.h === 1 || item.w === 1) {
    const size = Math.min(width, height) * 0.6;
    return (
      <View style={[frame, styles.centered, { flexDirection: item.h === 1 ? "row" : "column", gap: 10, paddingHorizontal: 16 + extra, paddingTop: 14 + lift }]}>
        {decoration}
        {iconBadge(wreath ? size * 0.75 : size)}
        {item.h === 1 ? <View style={{ flex: 1 }}>{nameText({})}</View> : null}
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
      <View style={[frame, { paddingTop: 24 + extra * 0.6 + lift, paddingHorizontal: 14 + extra }]}>
        {decoration}
        <View style={{ flex: 1, gap: 12 }}>
          <View style={[styles.row, { paddingHorizontal: 6 }]}>
            {iconBadge(wreath ? 40 : 52)}
            <View style={{ flex: 1 }}>
              {nameText({ fontSize: 19 })}
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
      <View style={[frame, styles.row, { paddingHorizontal: 20 + extra, paddingTop: 14 + lift }]}>
        {decoration}
        {iconBadge(wreath ? 42 : 56)}
        <View style={{ flex: 1, gap: 4 }}>
          {nameText({})}
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
    <View style={[frame, styles.centered, { gap: 8, paddingTop: 20 + lift, paddingHorizontal: 14 + extra }]}>
      {decoration}
      {iconBadge(wreath ? 38 : 50)}
      <View style={{ alignItems: "center", gap: 1, alignSelf: "stretch" }}>
        {nameText({}, true)}
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
