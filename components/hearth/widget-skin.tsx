import { memo, useEffect, useId } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import Svg, { Circle, Defs, Ellipse, G, Line, LinearGradient, Path, Pattern, Rect, Stop } from "react-native-svg";

import { deepOf, isHex, shade } from "../../lib/colors";
import { gradientPresets } from "../../lib/decor";
import {
  edgeInset,
  edgePath,
  materialColors,
  materialOpacity,
  seasonalAccent,
  type Accent,
  type Edge,
  type Hanger,
  type Material,
  type Frame,
  type Print,
} from "../../lib/widget-skins";
import { PatternTile, patternTileSize } from "./wallpaper";

// Draws what a widget is made of and how its edges are cut (CORE-122, 123),
// behind its words, and what it's hung up with (CORE-124), on top. The
// shapes and colors come from lib/widget-skins.

// How far a cut-edge widget's own shadow drops, for each shadow level
// (a smooth card's shadow is drawn by the Hearth grid instead).
const DROP = [0, 2, 3, 5];
const DROP_ALPHA = [0, 0.12, 0.15, 0.2];

// Drawn again only when something about it changes: switching the Hearth
// into Edit re-draws every widget, and these don't need to be (performance).
export const SkinSurface = memo(SkinSurfaceDrawing);
export const HangerArt = memo(HangerDrawing);
export const AccentArt = memo(AccentDrawing);

function SkinSurfaceDrawing({
  material,
  edge,
  color,
  fill,
  outline,
  border,
  width,
  height,
  radius,
  level = 0,
  stitchOnly = false,
  print = "none",
  gradient = "none",
}: {
  material: Material;
  edge: Edge;
  // The widget's own color (a soft tint), if one was picked.
  color?: string;
  // For a plain card with cut edges: the color to fill it with.
  fill?: string;
  // A plain card in the Outline look: just the cut outline.
  outline?: string;
  border?: boolean;
  width: number;
  height: number;
  radius: number;
  // Shadow level (0..3), drawn here only for cut edges.
  level?: 0 | 1 | 2 | 3;
  // A plain card that only wants its stitching drawn over it.
  stitchOnly?: boolean;
  // A wallpaper pattern printed over it (CORE-128).
  print?: Print;
  // A gradient fill for a plain card (CORE-135): a key of gradientPresets.
  gradient?: string;
}) {
  const id = `s${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const cut = edge !== "plain" && edge !== "stitch";
  const drop = cut ? DROP[level] : 0;
  const h = Math.max(1, height - drop);
  const d = edgePath(edge, width, h, radius);
  const colors = materialColors(material, color);
  const base = material === "plain" ? (fill ?? colors.base) : colors.base;
  const deep = deepOf(color && isHex(color) ? color : base);
  const wash = material === "plain" ? gradientPresets.find((g) => g.key === gradient) : undefined;

  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <Texture id={id} material={material} ink={colors.ink} width={width} />
        {print !== "none" ? (
          <Pattern id={`${id}p`} patternUnits="userSpaceOnUse" {...patternTileSize(print)}>
            <PatternTile pattern={print} ink={colors.dark ? "#ffffff" : deep} opacity={colors.dark ? 0.09 : 0.11} />
          </Pattern>
        ) : null}
        {wash ? (
          <LinearGradient id={`${id}w`} x1="0" y1="0" x2="0.4" y2="1">
            <Stop offset="0" stopColor={wash.from} />
            <Stop offset="1" stopColor={wash.to} />
          </LinearGradient>
        ) : null}
        {material === "glass" || material === "tile" ? (
          <LinearGradient id={`${id}g`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#ffffff" stopOpacity={0.55} />
            <Stop offset="0.45" stopColor="#ffffff" stopOpacity={0.12} />
            <Stop offset="1" stopColor="#ffffff" stopOpacity={0.3} />
          </LinearGradient>
        ) : null}
      </Defs>
      {stitchOnly ? null : (
        <>
          {drop ? <Path d={d} fill={`rgba(0,0,0,${DROP_ALPHA[level]})`} transform={`translate(0 ${drop})`} /> : null}
          {outline ? (
            <Path d={d} fill="none" stroke={outline} strokeWidth={2} />
          ) : (
            <>
              <Path d={d} fill={wash ? `url(#${id}w)` : base} fillOpacity={materialOpacity(material)} />
              {material !== "plain" ? <Path d={d} fill={`url(#${id})`} /> : null}
              {material === "glass" ? <Path d={d} fill={`url(#${id}g)`} stroke="#ffffff" strokeOpacity={0.75} strokeWidth={1.5} /> : null}
              {material === "tile" ? <Path d={d} fill={`url(#${id}g)`} fillOpacity={0.6} /> : null}
            </>
          )}
          {print !== "none" && !outline ? <Path d={d} fill={`url(#${id}p)`} /> : null}
          <Extras material={material} width={width} height={h} d={d} ink={colors.ink} />
        </>
      )}
      {edge === "stitch" ? (
        <Path
          d={edgePath("plain", width - 12, h - 12, Math.max(0, radius - 6))}
          transform="translate(6 6)"
          fill="none"
          stroke={colors.dark ? "rgba(255,255,255,0.55)" : `${deep}88`}
          strokeWidth={1.4}
          strokeDasharray="5 4"
          strokeLinecap="round"
        />
      ) : null}
      {border ? <Path d={d} fill="none" stroke={colors.dark ? "rgba(255,255,255,0.6)" : deep} strokeWidth={2.5} /> : null}
    </Svg>
  );
}

// Room to leave inside, so words clear a cut edge or a chalkboard's frame.
export function skinPadding(material: Material, edge: Edge) {
  return edgeInset(edge) + (material === "chalkboard" ? 3 : 0);
}

// The repeating texture of each material.
function Texture({ id, material, ink, width }: { id: string; material: Material; ink: string; width: number }) {
  switch (material) {
    case "paper":
      return (
        <Pattern id={id} patternUnits="userSpaceOnUse" width={46} height={46}>
          <Line x1={6} y1={9} x2={14} y2={11} stroke={ink} strokeOpacity={0.22} strokeWidth={0.7} />
          <Line x1={28} y1={30} x2={33} y2={26} stroke={ink} strokeOpacity={0.18} strokeWidth={0.7} />
          <Line x1={36} y1={8} x2={41} y2={9} stroke={ink} strokeOpacity={0.15} strokeWidth={0.6} />
          <Circle cx={18} cy={38} r={0.7} fill={ink} fillOpacity={0.25} />
        </Pattern>
      );
    case "kraft":
      return (
        <Pattern id={id} patternUnits="userSpaceOnUse" width={30} height={30}>
          <Circle cx={4} cy={6} r={0.8} fill={ink} fillOpacity={0.45} />
          <Circle cx={19} cy={3} r={0.6} fill={ink} fillOpacity={0.35} />
          <Circle cx={25} cy={21} r={0.9} fill={ink} fillOpacity={0.4} />
          <Circle cx={10} cy={24} r={0.5} fill="#ffffff" fillOpacity={0.5} />
          <Line x1={12} y1={13} x2={20} y2={15} stroke={ink} strokeOpacity={0.3} strokeWidth={0.6} />
        </Pattern>
      );
    case "notebook":
      return (
        <Pattern id={id} patternUnits="userSpaceOnUse" width={width} height={20}>
          <Line x1={0} y1={19.5} x2={width} y2={19.5} stroke={ink} strokeOpacity={0.7} strokeWidth={0.8} />
        </Pattern>
      );
    case "graph":
      return (
        <Pattern id={id} patternUnits="userSpaceOnUse" width={12} height={12}>
          <Line x1={0} y1={0.3} x2={12} y2={0.3} stroke={ink} strokeOpacity={0.75} strokeWidth={0.6} />
          <Line x1={0.3} y1={0} x2={0.3} y2={12} stroke={ink} strokeOpacity={0.75} strokeWidth={0.6} />
        </Pattern>
      );
    case "index":
      return (
        <Pattern id={id} patternUnits="userSpaceOnUse" width={width} height={18} y={8}>
          <Line x1={0} y1={17.5} x2={width} y2={17.5} stroke={ink} strokeOpacity={0.55} strokeWidth={0.7} />
        </Pattern>
      );
    case "chalkboard":
      return (
        <Pattern id={id} patternUnits="userSpaceOnUse" width={60} height={60}>
          <Circle cx={12} cy={20} r={0.6} fill={ink} fillOpacity={0.15} />
          <Circle cx={44} cy={8} r={0.5} fill={ink} fillOpacity={0.12} />
          <Circle cx={30} cy={47} r={0.7} fill={ink} fillOpacity={0.12} />
        </Pattern>
      );
    case "wood":
      return (
        <Pattern id={id} patternUnits="userSpaceOnUse" width={140} height={17}>
          <Path d="M0 5 C35 2 70 9 140 5" stroke={ink} strokeOpacity={0.28} strokeWidth={1.1} fill="none" />
          <Path d="M0 12 C40 15 95 8 140 12" stroke={ink} strokeOpacity={0.18} strokeWidth={0.8} fill="none" />
          <Path d="M0 15.5 C50 14 90 17 140 15.5" stroke="#ffffff" strokeOpacity={0.07} strokeWidth={1} fill="none" />
        </Pattern>
      );
    case "cork":
      return (
        <Pattern id={id} patternUnits="userSpaceOnUse" width={22} height={22}>
          <Circle cx={3} cy={4} r={1.3} fill={ink} fillOpacity={0.35} />
          <Circle cx={14} cy={2} r={0.8} fill={ink} fillOpacity={0.3} />
          <Circle cx={9} cy={12} r={1.6} fill={ink} fillOpacity={0.25} />
          <Circle cx={18} cy={15} r={1} fill={ink} fillOpacity={0.4} />
          <Circle cx={5} cy={19} r={0.9} fill="#ffffff" fillOpacity={0.3} />
          <Circle cx={17} cy={7} r={0.7} fill="#ffffff" fillOpacity={0.35} />
        </Pattern>
      );
    case "felt":
      return (
        <Pattern id={id} patternUnits="userSpaceOnUse" width={6} height={6}>
          <Circle cx={1} cy={1} r={0.6} fill="#ffffff" fillOpacity={0.09} />
          <Circle cx={4} cy={3.5} r={0.6} fill="#000000" fillOpacity={0.09} />
          <Circle cx={2} cy={5} r={0.4} fill="#ffffff" fillOpacity={0.06} />
        </Pattern>
      );
    case "linen":
      return (
        <Pattern id={id} patternUnits="userSpaceOnUse" width={4} height={4}>
          <Line x1={0} y1={1} x2={4} y2={1} stroke={ink} strokeOpacity={0.14} strokeWidth={0.7} />
          <Line x1={1} y1={0} x2={1} y2={4} stroke={ink} strokeOpacity={0.1} strokeWidth={0.7} />
        </Pattern>
      );
    case "tile":
      // Square tiles with grout between them.
      return (
        <Pattern id={id} patternUnits="userSpaceOnUse" width={26} height={26}>
          <Line x1={0} y1={0.5} x2={26} y2={0.5} stroke={ink} strokeWidth={1.4} />
          <Line x1={0.5} y1={0} x2={0.5} y2={26} stroke={ink} strokeWidth={1.4} />
          <Line x1={2} y1={2.2} x2={24} y2={2.2} stroke="#ffffff" strokeOpacity={0.8} strokeWidth={1} />
        </Pattern>
      );
    case "glass":
    case "watercolor":
    case "plain":
      return null;
  }
}

// One-off touches: a notebook's margin, an index card's red line, a
// chalkboard's wooden frame and smudges.
function Extras({ material, width, height, d, ink }: { material: Material; width: number; height: number; d: string; ink: string }) {
  switch (material) {
    case "watercolor":
      // Soft pools of paint, darker where they dried at the edge.
      return (
        <>
          <Ellipse cx={width * 0.28} cy={height * 0.3} rx={width * 0.34} ry={height * 0.26} fill={ink} fillOpacity={0.12} />
          <Ellipse cx={width * 0.72} cy={height * 0.62} rx={width * 0.32} ry={height * 0.3} fill={ink} fillOpacity={0.1} />
          <Ellipse cx={width * 0.45} cy={height * 0.82} rx={width * 0.28} ry={height * 0.16} fill={ink} fillOpacity={0.08} />
          <Ellipse cx={width * 0.72} cy={height * 0.62} rx={width * 0.32} ry={height * 0.3} fill="none" stroke={ink} strokeOpacity={0.07} strokeWidth={1.5} />
          <Path d={d} fill="none" stroke={ink} strokeOpacity={0.18} strokeWidth={3} />
        </>
      );
    case "notebook":
      return <Line x1={10} y1={0} x2={10} y2={height} stroke="#e7a1a1" strokeWidth={1} />;
    case "index":
      return <Line x1={0} y1={25.5} x2={width} y2={25.5} stroke="#e79a9a" strokeWidth={1.2} />;
    case "chalkboard":
      return (
        <>
          <Ellipse cx={width * 0.3} cy={height * 0.35} rx={width * 0.25} ry={height * 0.12} fill="#ffffff" fillOpacity={0.03} />
          <Ellipse cx={width * 0.7} cy={height * 0.7} rx={width * 0.2} ry={height * 0.1} fill="#ffffff" fillOpacity={0.02} />
          <Path d={d} fill="none" stroke="#a7743f" strokeWidth={10} />
          <Path d={d} fill="none" stroke="#5e3a1c" strokeOpacity={0.35} strokeWidth={1} transform="translate(0 0)" />
        </>
      );
    default:
      return null;
  }
}

// --- Hangers (CORE-124) ------------------------------------------------------------------

// How far a hanger may reach outside the widget.
const OUT = 22;

function HangerDrawing({ hanger, color, width, height }: { hanger: Hanger; color?: string; width: number; height: number }) {
  if (hanger === "none") return null;
  const soft = color && isHex(color) ? color : "#f3c9b8";
  const deep = deepOf(soft);
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: -OUT,
        top: -OUT,
        width: width + OUT * 2,
        height: height + OUT * 2,
      }}
    >
      <Svg width={width + OUT * 2} height={height + OUT * 2}>
        <G transform={`translate(${OUT} ${OUT})`}>
          <HangerShape hanger={hanger} soft={soft} deep={deep} width={width} height={height} />
        </G>
      </Svg>
    </View>
  );
}

function Tape({ x, y, angle, soft }: { x: number; y: number; angle: number; soft: string }) {
  const stripe = shade(soft, -0.18);
  return (
    <G transform={`translate(${x} ${y}) rotate(${angle})`}>
      <Rect x={-22} y={-8} width={44} height={16} fill={shade(soft, 0.2)} fillOpacity={0.82} />
      <Line x1={-22} y1={-3} x2={22} y2={-3} stroke={stripe} strokeOpacity={0.45} strokeWidth={1.5} />
      <Line x1={-22} y1={3} x2={22} y2={3} stroke={stripe} strokeOpacity={0.45} strokeWidth={1.5} />
      <Path d="M-22 -8 l2 3 l-2 3 l2 3 l-2 3 l2 2" stroke="#ffffff" strokeOpacity={0.5} strokeWidth={0.8} fill="none" />
    </G>
  );
}

function HangerShape({ hanger, soft, deep, width, height }: { hanger: Hanger; soft: string; deep: string; width: number; height: number }) {
  const mid = width / 2;
  switch (hanger) {
    case "tape":
      return width >= 120 ? (
        <>
          <Tape x={10} y={8} angle={-38} soft={soft} />
          <Tape x={width - 10} y={8} angle={38} soft={soft} />
        </>
      ) : (
        <Tape x={mid} y={0} angle={-4} soft={soft} />
      );
    case "pin":
      return (
        <>
          <Ellipse cx={mid + 3} cy={9} rx={6} ry={3} fill="#000000" fillOpacity={0.15} />
          <Circle cx={mid} cy={4} r={7} fill={deep} />
          <Circle cx={mid - 2.2} cy={1.8} r={2.4} fill="#ffffff" fillOpacity={0.55} />
        </>
      );
    case "magnet":
      return (
        <>
          <Ellipse cx={mid + 2} cy={10} rx={10} ry={4} fill="#000000" fillOpacity={0.14} />
          <Circle cx={mid} cy={3} r={10} fill={deep} />
          <Circle cx={mid} cy={3} r={10} fill="none" stroke="#000000" strokeOpacity={0.12} strokeWidth={1.5} />
          <Ellipse cx={mid - 3} cy={-1} rx={4} ry={2.5} fill="#ffffff" fillOpacity={0.4} />
        </>
      );
    case "clip":
      return (
        <Path
          transform={`translate(${Math.min(22, width * 0.18)} -12)`}
          d="M5 26 V5 a4 4 0 0 1 8 0 V28 a6.5 6.5 0 0 1 -13 0 V9"
          stroke="#97a1ab"
          strokeWidth={2.2}
          strokeLinecap="round"
          fill="none"
        />
      );
    case "clothespin":
      return (
        <>
          <Line x1={-OUT} y1={-6} x2={width + OUT} y2={-4} stroke="#b4935f" strokeWidth={1.4} />
          <G transform={`translate(${mid} 0) rotate(-3)`}>
            <Rect x={-6} y={-14} width={5.5} height={30} rx={2} fill="#dcb57d" />
            <Rect x={0.5} y={-14} width={5.5} height={30} rx={2} fill="#cfa66d" />
            <Rect x={-7} y={-2} width={14} height={4} rx={1} fill="#a9b0b7" />
          </G>
        </>
      );
    case "nail": {
      const top = -16;
      return (
        <>
          <Path
            d={`M${width * 0.22} 7 L${mid} ${top} L${width * 0.78} 7`}
            stroke="#b4935f"
            strokeWidth={1.6}
            fill="none"
            strokeLinejoin="round"
          />
          <Circle cx={width * 0.22} cy={7} r={2.2} fill="#8d8f93" />
          <Circle cx={width * 0.78} cy={7} r={2.2} fill="#8d8f93" />
          <Circle cx={mid} cy={top} r={3.6} fill="#7d8186" />
          <Circle cx={mid - 1} cy={top - 1} r={1.2} fill="#ffffff" fillOpacity={0.6} />
        </>
      );
    }
    case "shelf":
      return (
        <>
          <Rect x={-8} y={height - 1} width={width + 16} height={9} rx={2} fill="#a26d40" />
          <Rect x={-8} y={height - 1} width={width + 16} height={2.5} rx={1} fill="#c58e5c" />
          <Path d={`M${width * 0.15} ${height + 8} l0 9 l8 -9 Z`} fill="#8a5a32" />
          <Path d={`M${width * 0.85} ${height + 8} l0 9 l-8 -9 Z`} fill="#8a5a32" />
        </>
      );
    case "none":
      return null;
  }
}

// --- Accents (CORE-128, 130) --------------------------------------------------------------

const A = 30;

// A little decoration on a corner: a sticker, a daisy, a sprig of holly, a
// bow, or a cup of cocoa that steams. It keeps clear of whatever's hanging
// the widget up.
function AccentDrawing({
  accent,
  hanger,
  color,
  width,
  height,
  still = false,
}: {
  accent: Accent;
  hanger: Hanger;
  color?: string;
  width: number;
  height: number;
  still?: boolean;
}) {
  if (accent === "none") return null;
  // "Follows the season" shows today's (CORE-136).
  if (accent === "season") accent = seasonalAccent(new Date());
  const topMiddle = hanger === "pin" || hanger === "magnet" || hanger === "clothespin" || hanger === "nail";
  const spot: { left: number; top: number; turn: number } =
    accent === "heart" || accent === "star"
      ? { left: width - A + 4, top: height - A + 4, turn: 14 }
      : accent === "daisy" || accent === "leaf" || accent === "pumpkin" || accent === "snowflake"
        ? { left: -6, top: height - A + 6, turn: -10 }
        : accent === "sun"
          ? { left: width - A + 6, top: -8, turn: 0 }
        : accent === "holly"
          ? { left: -6, top: -6, turn: -20 }
          : accent === "bow"
            ? topMiddle
              ? { left: 8, top: -10, turn: -12 }
              : { left: width / 2 - A / 2, top: -12, turn: 0 }
            : { left: width - A - 2, top: height - A + 8, turn: 0 };
  const ribbon = color && isHex(color) ? deepOf(color) : "#d9574f";
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: spot.left, top: spot.top, width: A, height: A, transform: [{ rotate: `${spot.turn}deg` }] }}>
      {accent === "mug" ? <Steam still={still} /> : null}
      <Svg width={A} height={A}>
        <AccentShape accent={accent} ribbon={ribbon} />
      </Svg>
    </View>
  );
}

function AccentShape({ accent, ribbon }: { accent: Accent; ribbon: string }) {
  switch (accent) {
    case "heart":
      return (
        <>
          <Path d="M15 26 C4 18 2 12 5 8 C8 4 13 5 15 9 C17 5 22 4 25 8 C28 12 26 18 15 26 Z" fill="#e5627a" stroke="#ffffff" strokeWidth={2.5} strokeLinejoin="round" />
          <Ellipse cx={9.5} cy={10} rx={2} ry={1.2} fill="#ffffff" fillOpacity={0.55} transform="rotate(-35 9.5 10)" />
        </>
      );
    case "star":
      return (
        <Path
          d="M15 3 L18.4 10.9 L27 11.6 L20.5 17.2 L22.5 25.6 L15 21.2 L7.5 25.6 L9.5 17.2 L3 11.6 L11.6 10.9 Z"
          fill="#f2c14e"
          stroke="#ffffff"
          strokeWidth={2.5}
          strokeLinejoin="round"
        />
      );
    case "daisy":
      return (
        <G transform="translate(15 15)">
          {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
            <Ellipse key={a} cx={0} cy={-7.5} rx={3.2} ry={6} fill="#ffffff" stroke="#e0dbd3" strokeWidth={0.8} transform={`rotate(${a})`} />
          ))}
          <Circle cx={0} cy={0} r={4} fill="#f3c34a" />
        </G>
      );
    case "holly":
      return (
        <>
          <Path d="M15 15 L6 9 L8 13 L3 13 L7 16 L4 19 L9 18 L15 15 Z" fill="#3f8a4f" />
          <Path d="M15 15 L21 6 L20 11 L25 9 L22 13 L27 14 L21 16 L15 15 Z" fill="#4e9c5d" />
          <Circle cx={14} cy={17} r={2.8} fill="#d23b3b" />
          <Circle cx={18} cy={18.5} r={2.6} fill="#c22f33" />
          <Circle cx={15.5} cy={20.5} r={2.4} fill="#de4a45" />
        </>
      );
    case "bow":
      return (
        <>
          <Path d="M15 15 L9 27 L12 27 L15 19 Z M15 15 L21 27 L18 27 L15 19 Z" fill={ribbon} fillOpacity={0.85} />
          <Ellipse cx={8.5} cy={12} rx={7} ry={4.5} fill={ribbon} transform="rotate(-18 8.5 12)" />
          <Ellipse cx={21.5} cy={12} rx={7} ry={4.5} fill={ribbon} transform="rotate(18 21.5 12)" />
          <Circle cx={15} cy={14} r={3.4} fill={shade(ribbon, -0.2)} />
        </>
      );
    case "mug":
      return (
        <>
          <Path d="M22 14 C28 14 28 22 21 22" stroke="#d4694f" strokeWidth={2.5} fill="none" />
          <Rect x={6} y={11} width={17} height={17} rx={4} fill="#e9775b" />
          <Ellipse cx={14.5} cy={12} rx={8.5} ry={2.4} fill="#7a4a2c" />
          <Rect x={9} y={17} width={4} height={4} rx={1} fill="#ffffff" fillOpacity={0.5} />
        </>
      );
    case "snowflake":
      return (
        <G transform="translate(15 15)">
          {[0, 60, 120].map((a) => (
            <G key={a} transform={`rotate(${a})`}>
              <Line x1={0} y1={-11} x2={0} y2={11} stroke="#ffffff" strokeWidth={2.4} strokeLinecap="round" />
              <Path d="M-3 -8 L0 -5 L3 -8 M-3 8 L0 5 L3 8" stroke="#ffffff" strokeWidth={1.6} fill="none" strokeLinecap="round" />
            </G>
          ))}
          <Circle cx={0} cy={0} r={11.5} fill="none" stroke="#9fc3e6" strokeOpacity={0.35} strokeWidth={1} />
        </G>
      );
    case "leaf":
      return (
        <G transform="rotate(-25 15 15)">
          <Path d="M15 3 C24 8 25 20 15 27 C5 20 6 8 15 3 Z" fill="#e0823a" />
          <Path d="M15 6 L15 27 M15 12 L10 9 M15 12 L20 9 M15 18 L9 15 M15 18 L21 15" stroke="#b5571f" strokeWidth={1} fill="none" />
        </G>
      );
    case "pumpkin":
      return (
        <>
          <Ellipse cx={9.5} cy={18} rx={6} ry={8} fill="#e07a2f" />
          <Ellipse cx={20.5} cy={18} rx={6} ry={8} fill="#e07a2f" />
          <Ellipse cx={15} cy={18} rx={6.5} ry={8.5} fill="#ef8d3c" />
          <Path d="M15 10 C15 6 17 4 19 4" stroke="#5b8a3c" strokeWidth={2.4} fill="none" strokeLinecap="round" />
        </>
      );
    case "sun":
      return (
        <G transform="translate(15 15)">
          {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
            <Line key={a} x1={0} y1={-9} x2={0} y2={-13.5} stroke="#f2b33d" strokeWidth={2.4} strokeLinecap="round" transform={`rotate(${a})`} />
          ))}
          <Circle cx={0} cy={0} r={7} fill="#f6c94e" />
        </G>
      );
    case "none":
    case "season":
      return null;
  }
}

// Wisps of steam rising off the cocoa (CORE-130). Still while editing or
// when the phone asks for less motion.
function Steam({ still }: { still: boolean }) {
  const reduce = useReducedMotion();
  const rise = useSharedValue(0);
  const moving = !still && !reduce;
  useEffect(() => {
    if (moving) rise.value = withRepeat(withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }), -1, false);
    else {
      cancelAnimation(rise);
      rise.value = 0.4;
    }
  }, [moving, rise]);
  const style = useAnimatedStyle(() => ({
    opacity: 0.75 * Math.sin(Math.PI * rise.value),
    transform: [{ translateY: -10 * rise.value }],
  }));
  return (
    <Animated.View style={[{ position: "absolute", left: 6, top: -14, width: 18, height: 22 }, style]}>
      <Svg width={18} height={22}>
        <Path d="M5 20 C2 15 8 12 5 7 C3 4 6 2 5 0" stroke="#ffffff" strokeWidth={1.8} fill="none" strokeLinecap="round" />
        <Path d="M12 20 C9 15 15 12 12 7 C10 4 13 2 12 0" stroke="#ffffff" strokeWidth={1.8} fill="none" strokeLinecap="round" />
      </Svg>
    </Animated.View>
  );
}

// --- Picture frames (CORE-133) -------------------------------------------------------------

const FRAME_COLORS = {
  wood: { outer: "#8a5a3b", inner: "#5e3b22", highlight: "#b07a52" },
  gold: { outer: "#d4a63c", inner: "#9a7418", highlight: "#f3d98a" },
  white: { outer: "#fbf7f2", inner: "#d9d2c9", highlight: "#ffffff" },
  polaroid: { outer: "#fdfbf7", inner: "#e4ddd3", highlight: "#ffffff" },
} as const;

// How thick a frame is on each side; a polaroid's bottom is deeper.
export function frameSides(frame: Exclude<Frame, "none">, width: number) {
  const side = Math.round(Math.max(6, Math.min(12, width * 0.055)));
  return { side, bottom: frame === "polaroid" ? side * 3 : side };
}

// A picture frame with the widget sitting in it.
export function PictureFrame({ frame, width, height, radius, children }: { frame: Exclude<Frame, "none">; width: number; height: number; radius: number; children: React.ReactNode }) {
  const c = FRAME_COLORS[frame];
  const { side, bottom } = frameSides(frame, width);
  // The frame's corners match the widget's, so its shadow fits.
  const r = radius;
  return (
    <View
      style={{
        width,
        height,
        borderRadius: r,
        backgroundColor: c.outer,
        paddingTop: side,
        paddingLeft: side,
        paddingRight: side,
        paddingBottom: bottom,
        boxShadow: `inset 0px 1.5px 0px ${c.highlight}, inset 0px -2px 0px ${c.inner}`,
      }}
    >
      <View style={{ flex: 1, borderRadius: Math.max(2, r - 4), overflow: "hidden", boxShadow: `inset 0px 1px 3px rgba(0,0,0,0.35)` }}>{children}</View>
    </View>
  );
}
