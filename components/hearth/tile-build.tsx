import { StyleSheet, View } from "react-native";
import Svg, { Circle, Defs, Ellipse, G, Line, Path, Pattern, RadialGradient, Rect, Stop } from "react-native-svg";

import { shade } from "../../lib/colors";
import type { TileShape } from "../../lib/decor";
import type { BuildColors, TileBuild } from "../../lib/tile-looks";
import { Text } from "../text";

// What a Nook tile is built from, and the doorway touches around it
// (CORE-137..139). Colors and choices are in lib/tile-looks.

// The outline of a tile with a different radius at the top and bottom, or a
// birdhouse with a pointed roof.
export function tileOutline(width: number, height: number, top: number, bottom: number, shape: TileShape) {
  if (shape === "birdhouse") {
    const eave = Math.min(height * 0.3, width * 0.42);
    const b = Math.min(bottom, width / 4);
    return `M${width / 2} 0 L${width} ${eave} V${height - b} A${b} ${b} 0 0 1 ${width - b} ${height} H${b} A${b} ${b} 0 0 1 0 ${height - b} V${eave} Z`;
  }
  const tl = Math.max(0, Math.min(top, width / 2, height / 2));
  const bl = Math.max(0, Math.min(bottom, width / 2, height - tl));
  return `M0 ${tl} A${tl} ${tl} 0 0 1 ${tl} 0 H${width - tl} A${tl} ${tl} 0 0 1 ${width} ${tl} V${height - bl} A${bl} ${bl} 0 0 1 ${width - bl} ${height} H${bl} A${bl} ${bl} 0 0 1 0 ${height - bl} Z`;
}

// The tile's surface: its building material, filling its outline.
export function TileSurface({
  id,
  build,
  colors,
  outline,
  width,
  height,
  ownShadow,
}: {
  id: string;
  build: Exclude<TileBuild, "plain"> | null;
  colors: { base: string; ink: string };
  outline: string;
  width: number;
  height: number;
  // A birdhouse draws its own shadow, in its own shape.
  ownShadow: boolean;
}) {
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>{build ? <BuildTexture id={`b${id}`} build={build} ink={colors.ink} /> : null}</Defs>
      {ownShadow ? <Path d={outline} fill="#000000" fillOpacity={0.14} transform="translate(0 3) scale(1 0.985)" /> : null}
      <Path d={outline} fill={colors.base} />
      {build ? <Path d={outline} fill={`url(#b${id})`} /> : null}
      {build === "stainedglass" ? <StainedGlass width={width} height={height} outline={outline} /> : null}
      {build === "chalkboard" ? <Path d={outline} fill="none" stroke="#a7743f" strokeWidth={9} /> : null}
    </Svg>
  );
}

function BuildTexture({ id, build, ink }: { id: string; build: Exclude<TileBuild, "plain">; ink: string }) {
  switch (build) {
    case "painted":
      // Upright planks, a little worn.
      return (
        <Pattern id={id} patternUnits="userSpaceOnUse" width={22} height={60}>
          <Line x1={0.6} y1={0} x2={0.6} y2={60} stroke={ink} strokeOpacity={0.5} strokeWidth={1.2} />
          <Path d="M8 6 C9 20 7 36 9 54" stroke={ink} strokeOpacity={0.18} strokeWidth={0.8} fill="none" />
        </Pattern>
      );
    case "brick":
      return (
        <Pattern id={id} patternUnits="userSpaceOnUse" width={28} height={16}>
          {/* Soft mortar, so the Nook's name still reads over it. */}
          <Line x1={0} y1={0.75} x2={28} y2={0.75} stroke={ink} strokeOpacity={0.4} strokeWidth={1.5} />
          <Line x1={0} y1={8.75} x2={28} y2={8.75} stroke={ink} strokeOpacity={0.4} strokeWidth={1.5} />
          <Line x1={14} y1={0} x2={14} y2={8} stroke={ink} strokeOpacity={0.4} strokeWidth={1.5} />
          <Line x1={0.75} y1={8} x2={0.75} y2={16} stroke={ink} strokeOpacity={0.4} strokeWidth={1.5} />
          <Rect x={2} y={2.5} width={10} height={1.2} fill="#ffffff" fillOpacity={0.12} />
        </Pattern>
      );
    case "stone":
      return (
        <Pattern id={id} patternUnits="userSpaceOnUse" width={44} height={36}>
          <Rect x={1} y={1} width={20} height={15} rx={5} fill="#ffffff" fillOpacity={0.12} stroke={ink} strokeOpacity={0.55} strokeWidth={1.2} />
          <Rect x={23} y={1} width={20} height={15} rx={6} fill="#000000" fillOpacity={0.04} stroke={ink} strokeOpacity={0.55} strokeWidth={1.2} />
          <Rect x={-10} y={19} width={20} height={16} rx={6} fill="#000000" fillOpacity={0.05} stroke={ink} strokeOpacity={0.55} strokeWidth={1.2} />
          <Rect x={12} y={19} width={21} height={16} rx={5} fill="#ffffff" fillOpacity={0.1} stroke={ink} strokeOpacity={0.55} strokeWidth={1.2} />
          <Rect x={35} y={19} width={20} height={16} rx={6} fill="#000000" fillOpacity={0.05} stroke={ink} strokeOpacity={0.55} strokeWidth={1.2} />
        </Pattern>
      );
    case "tile":
      return (
        <Pattern id={id} patternUnits="userSpaceOnUse" width={22} height={22}>
          <Line x1={0} y1={0.6} x2={22} y2={0.6} stroke={ink} strokeWidth={1.2} />
          <Line x1={0.6} y1={0} x2={0.6} y2={22} stroke={ink} strokeWidth={1.2} />
          <Line x1={2} y1={2} x2={20} y2={2} stroke="#ffffff" strokeOpacity={0.8} />
        </Pattern>
      );
    case "wood":
      return (
        <Pattern id={id} patternUnits="userSpaceOnUse" width={140} height={17}>
          <Path d="M0 5 C35 2 70 9 140 5" stroke={ink} strokeOpacity={0.28} strokeWidth={1.1} fill="none" />
          <Path d="M0 12 C40 15 95 8 140 12" stroke={ink} strokeOpacity={0.18} strokeWidth={0.8} fill="none" />
        </Pattern>
      );
    case "felt":
      return (
        <Pattern id={id} patternUnits="userSpaceOnUse" width={6} height={6}>
          <Circle cx={1} cy={1} r={0.6} fill="#ffffff" fillOpacity={0.09} />
          <Circle cx={4} cy={3.5} r={0.6} fill="#000000" fillOpacity={0.09} />
        </Pattern>
      );
    case "chalkboard":
    case "stainedglass":
      return (
        <Pattern id={id} patternUnits="userSpaceOnUse" width={60} height={60}>
          <Circle cx={12} cy={20} r={0.6} fill="#ffffff" fillOpacity={0.12} />
        </Pattern>
      );
  }
}

// Jewel-colored panes with dark lead between them, washed pale so the
// Nook's name still reads.
const PANES = ["#e57373", "#64b5f6", "#ffd54f", "#81c784", "#ba68c8", "#ffb74d"];

function StainedGlass({ width, height, outline }: { width: number; height: number; outline: string }) {
  const cols = 3;
  const rows = Math.max(3, Math.round(height / (width / cols)));
  const cw = width / cols;
  const rh = height / rows;
  return (
    <>
      {Array.from({ length: cols * rows }, (_, i) => {
        const c = i % cols;
        const r = Math.floor(i / cols);
        const lean = ((i * 7) % 5) - 2;
        return (
          <Path
            key={i}
            d={`M${c * cw} ${r * rh + lean} L${(c + 1) * cw} ${r * rh - lean} L${(c + 1) * cw} ${(r + 1) * rh + lean} L${c * cw} ${(r + 1) * rh - lean} Z`}
            fill={PANES[(i * 5 + r) % PANES.length]}
            fillOpacity={0.28}
            stroke="#4a4440"
            strokeOpacity={0.55}
            strokeWidth={1.6}
          />
        );
      })}
      <Path d={outline} fill="none" stroke="#4a4440" strokeOpacity={0.6} strokeWidth={3} />
    </>
  );
}

// --- The shape's own details (CORE-138) ---------------------------------------------------------

// How much room each shape's details take, so the icon and name keep clear.
export function shapeRoom(shape: TileShape, width: number, height: number) {
  switch (shape) {
    case "shutters":
      return { top: 0, side: Math.min(22, width * 0.15) };
    case "shopfront":
      return { top: Math.min(26, height * 0.2), side: 0 };
    case "birdhouse":
      return { top: Math.min(height * 0.3, width * 0.42) * 0.55, side: 0 };
    case "drawer":
      return { top: 8, side: 0 };
    case "mailbox":
      return { top: 0, side: Math.min(14, width * 0.1) };
    default:
      return { top: 0, side: 0 };
  }
}

export function ShapeDetails({ shape, width, height, deep, line }: { shape: TileShape; width: number; height: number; deep: string; line: string }) {
  switch (shape) {
    case "hobbit":
      // Round planks, a knob in the middle.
      return (
        <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
          {[0.3, 0.5, 0.7].map((x) => (
            <Line key={x} x1={width * x} y1={4} x2={width * x} y2={height - 4} stroke={line} strokeWidth={1.4} />
          ))}
          <Circle cx={width * 0.5} cy={height * 0.56} r={Math.max(3.5, width * 0.035)} fill="#d8b25a" stroke="#a37d2c" />
        </Svg>
      );
    case "shutters": {
      const sw = shapeRoom(shape, width, height).side;
      return (
        <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
          {[0, width - sw].map((x) => (
            <G key={x}>
              <Rect x={x} y={0} width={sw} height={height} fill={deep} />
              {Array.from({ length: Math.floor(height / 7) }, (_, i) => (
                <Line key={i} x1={x + 3} y1={6 + i * 7} x2={x + sw - 3} y2={4 + i * 7} stroke="#ffffff" strokeOpacity={0.25} strokeWidth={1.2} />
              ))}
            </G>
          ))}
        </Svg>
      );
    }
    case "shopfront": {
      // A striped awning with a scalloped edge.
      const h = shapeRoom(shape, width, height).top;
      const n = Math.max(4, Math.round(width / 18));
      const step = width / n;
      let edge = `M0 0 H${width} V${h - 4}`;
      for (let i = n - 1; i >= 0; i--) edge += ` A${step / 2} ${step / 2 - 1} 0 0 1 ${i * step} ${h - 4}`;
      edge += " Z";
      return (
        <Svg width={width} height={h + 6} style={{ position: "absolute", top: 0, left: 0 }} pointerEvents="none">
          <Path d={edge} fill="#ffffff" />
          {Array.from({ length: n }, (_, i) =>
            i % 2 === 0 ? <Rect key={i} x={i * step} y={0} width={step} height={h - 4} fill={deep} /> : null
          )}
          {Array.from({ length: n }, (_, i) => (
            <Path key={`s${i}`} d={`M${i * step} ${h - 4} A${step / 2} ${step / 2 - 1} 0 0 0 ${(i + 1) * step} ${h - 4}`} fill={i % 2 === 0 ? deep : "#ffffff"} />
          ))}
        </Svg>
      );
    }
    case "mailbox":
      // A slot near the top and a little red flag.
      return (
        <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
          <Rect x={width * 0.3} y={height * 0.12} width={width * 0.4} height={4} rx={2} fill="#000000" fillOpacity={0.3} />
          <Rect x={width - 9} y={height * 0.3} width={3} height={height * 0.32} fill="#8d8f93" />
          <Rect x={width - 23} y={height * 0.3} width={14} height={9} fill="#d9574f" />
        </Svg>
      );
    case "drawer":
      // A brass pull and a little card holder.
      return (
        <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
          <Path d={`M${width / 2 - 16} 10 Q${width / 2} 22 ${width / 2 + 16} 10`} stroke="#c9a04f" strokeWidth={3.2} fill="none" strokeLinecap="round" />
          <Circle cx={width / 2 - 16} cy={10} r={3} fill="#a37d2c" />
          <Circle cx={width / 2 + 16} cy={10} r={3} fill="#a37d2c" />
        </Svg>
      );
    case "birdhouse": {
      // The roof's edge, a round door and a perch.
      const eave = Math.min(height * 0.3, width * 0.42);
      return (
        <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
          <Path d={`M-2 ${eave + 2} L${width / 2} -1 L${width + 2} ${eave + 2}`} stroke={deep} strokeWidth={7} fill="none" strokeLinejoin="round" />
          <Circle cx={width / 2} cy={eave * 0.62} r={Math.max(4, eave * 0.16)} fill="#3b2a1e" fillOpacity={0.75} />
          <Line x1={width / 2} y1={eave * 0.62 + eave * 0.2} x2={width / 2} y2={eave * 0.62 + eave * 0.34} stroke="#8a5a32" strokeWidth={3} strokeLinecap="round" />
        </Svg>
      );
    }
    default:
      return null;
  }
}

// --- Doorway details (CORE-139) ------------------------------------------------------------------

// A brass plate with the Nook's name on it.
export function Nameplate({ label, fontSize = 13 }: { label: string; fontSize?: number }) {
  return (
    <View style={styles.plate}>
      <View style={[styles.screw, { left: 3 }]} />
      <View style={[styles.screw, { right: 3 }]} />
      <Text style={[styles.plateText, { fontSize }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

// A wreath of greenery and berries around the Nook's icon.
export function WreathRing({ size }: { size: number }) {
  const c = size / 2;
  const r = c - 5;
  return (
    <Svg width={size} height={size} style={{ position: "absolute" }} pointerEvents="none">
      <Circle cx={c} cy={c} r={r} fill="none" stroke="#3f8a4f" strokeWidth={5} />
      {Array.from({ length: 24 }, (_, i) => {
        const a = (i / 24) * Math.PI * 2;
        const x = c + Math.cos(a) * (r + (i % 2 ? 1.5 : -1.5));
        const y = c + Math.sin(a) * (r + (i % 2 ? 1.5 : -1.5));
        return <Ellipse key={i} cx={x} cy={y} rx={5.5} ry={3} fill={i % 3 ? "#3f8a4f" : "#57a065"} transform={`rotate(${(a * 180) / Math.PI + 60} ${x} ${y})`} />;
      })}
      {[0.3, 1.4, 2.5, 3.9, 5.1].map((a) => (
        <Circle key={a} cx={c + Math.cos(a) * r} cy={c + Math.sin(a) * r} r={2.2} fill="#d23b3b" />
      ))}
      <G transform={`translate(${c} ${c + r})`}>
        <Ellipse cx={-5} cy={0} rx={5} ry={3} fill="#d23b3b" />
        <Ellipse cx={5} cy={0} rx={5} ry={3} fill="#d23b3b" />
        <Circle cx={0} cy={0} r={2.4} fill="#a82a2a" />
      </G>
    </Svg>
  );
}

// A wall lantern beside the door; it glows when the Nook has news.
export function PorchLight({ lit }: { lit: boolean }) {
  return (
    <View pointerEvents="none" style={{ width: 22, height: 34 }}>
      <Svg width={22} height={34}>
        <Defs>
          <RadialGradient id="porchGlow" cx="50%" cy="55%" r="50%">
            <Stop offset="0" stopColor="#ffd77a" stopOpacity={0.85} />
            <Stop offset="1" stopColor="#ffd77a" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        {lit ? <Circle cx={11} cy={19} r={11} fill="url(#porchGlow)" /> : null}
        <Path d="M11 0 V5" stroke="#4b4540" strokeWidth={2} />
        <Path d="M5 8 L11 4 L17 8 Z" fill="#3b3632" />
        <Rect x={6} y={8} width={10} height={14} rx={1.5} fill={lit ? "#ffe39a" : "#cfd3d6"} fillOpacity={lit ? 1 : 0.7} stroke="#3b3632" strokeWidth={1.6} />
        <Line x1={11} y1={8} x2={11} y2={22} stroke="#3b3632" strokeWidth={0.8} />
        <Rect x={5} y={22} width={12} height={2.5} rx={1} fill="#3b3632" />
      </Svg>
    </View>
  );
}

// A window box of flowers along the bottom of the tile.
export function FlowerBox({ width }: { width: number }) {
  const w = Math.max(40, width * 0.72);
  const flowers = Math.max(3, Math.floor(w / 14));
  const colors = ["#f29bb4", "#f3c34a", "#ffffff", "#c88ee0"];
  return (
    <View pointerEvents="none" style={{ width: w, height: 24 }}>
      <Svg width={w} height={24}>
        {Array.from({ length: flowers }, (_, i) => {
          const x = ((i + 0.5) * w) / flowers;
          return (
            <G key={i}>
              <Ellipse cx={x - 3} cy={9} rx={3} ry={1.6} fill="#5c9a52" transform={`rotate(-30 ${x - 3} 9)`} />
              <Circle cx={x} cy={6 - (i % 2) * 2} r={3.4} fill={colors[i % colors.length]} />
              <Circle cx={x} cy={6 - (i % 2) * 2} r={1.3} fill="#e0a43a" />
            </G>
          );
        })}
        <Rect x={0} y={11} width={w} height={11} rx={2} fill="#9c6a40" />
        <Rect x={0} y={11} width={w} height={3} rx={1} fill="#b98256" />
      </Svg>
    </View>
  );
}

// A little mat on the step under the door.
export function DoormatUnder({ width, color }: { width: number; color: string }) {
  const w = Math.max(36, width * 0.56);
  return (
    <View pointerEvents="none" style={[styles.mat, { width: w, backgroundColor: shade(color, -0.25) }]}>
      <View style={[styles.matInner, { borderColor: shade(color, -0.5) }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  plate: {
    alignSelf: "center",
    maxWidth: "100%",
    paddingHorizontal: 12,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: "#d9b45a",
    borderWidth: 1,
    borderColor: "#a37d2c",
    boxShadow: "inset 0px 1px 0px rgba(255,255,255,0.6), 0px 1px 2px rgba(0,0,0,0.25)",
  },
  screw: { position: "absolute", top: "50%", marginTop: -1.5, width: 3, height: 3, borderRadius: 2, backgroundColor: "#8a6a24" },
  plateText: { color: "#3d2a0f", fontWeight: "800", letterSpacing: 0.4, textAlign: "center" },
  mat: { height: 8, borderRadius: 2, padding: 1.5, boxShadow: "0px 1px 2px rgba(0,0,0,0.2)" },
  matInner: { flex: 1, borderWidth: 1, borderRadius: 1, borderStyle: "dashed" },
});
