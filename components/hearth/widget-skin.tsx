import { useId } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle, Defs, Ellipse, G, Line, LinearGradient, Path, Pattern, Rect, Stop } from "react-native-svg";

import { deepOf, isHex, shade } from "../../lib/colors";
import { edgeInset, edgePath, materialColors, materialOpacity, type Edge, type Hanger, type Material } from "../../lib/widget-skins";

// Draws what a widget is made of and how its edges are cut (CORE-122, 123),
// behind its words, and what it's hung up with (CORE-124), on top. The
// shapes and colors come from lib/widget-skins.

// How far a cut-edge widget's own shadow drops, for each shadow level
// (a smooth card's shadow is drawn by the Hearth grid instead).
const DROP = [0, 2, 3, 5];
const DROP_ALPHA = [0, 0.12, 0.15, 0.2];

export function SkinSurface({
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
}) {
  const id = `s${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const cut = edge !== "plain" && edge !== "stitch";
  const drop = cut ? DROP[level] : 0;
  const h = Math.max(1, height - drop);
  const d = edgePath(edge, width, h, radius);
  const colors = materialColors(material, color);
  const base = material === "plain" ? (fill ?? colors.base) : colors.base;
  const deep = deepOf(color && isHex(color) ? color : base);

  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <Texture id={id} material={material} ink={colors.ink} width={width} />
        {material === "glass" ? (
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
              <Path d={d} fill={base} fillOpacity={materialOpacity(material)} />
              {material !== "plain" ? <Path d={d} fill={`url(#${id})`} /> : null}
              {material === "glass" ? <Path d={d} fill={`url(#${id}g)`} stroke="#ffffff" strokeOpacity={0.75} strokeWidth={1.5} /> : null}
            </>
          )}
          <Extras material={material} width={width} height={h} d={d} />
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
    case "glass":
    case "plain":
      return null;
  }
}

// One-off touches: a notebook's margin, an index card's red line, a
// chalkboard's wooden frame and smudges.
function Extras({ material, width, height, d }: { material: Material; width: number; height: number; d: string }) {
  switch (material) {
    case "notebook":
      return <Line x1={10} y1={0} x2={10} y2={height} stroke="#e7a1a1" strokeWidth={1} />;
    case "index":
      return <Line x1={0} y1={25.5} x2={width} y2={25.5} stroke="#e79a9a" strokeWidth={1.2} />;
    case "chalkboard":
      return (
        <>
          <Ellipse cx={width * 0.3} cy={height * 0.35} rx={width * 0.25} ry={height * 0.12} fill="#ffffff" fillOpacity={0.04} />
          <Ellipse cx={width * 0.7} cy={height * 0.7} rx={width * 0.2} ry={height * 0.1} fill="#ffffff" fillOpacity={0.03} />
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

export function HangerArt({ hanger, color, width, height }: { hanger: Hanger; color?: string; width: number; height: number }) {
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
