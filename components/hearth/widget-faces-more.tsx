import { useEffect, useId, useRef, type ReactNode } from "react";
import { Platform, StyleSheet, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, ClipPath, Defs, Ellipse, G, Line, Path, Pattern, Rect, Text as SvgText } from "react-native-svg";

import { deepOf, isHex, shade } from "../../lib/colors";
import { cakeCandles, slipCount, sundialAngle, timeFraction, wheelAngle } from "../../lib/widget-faces";
import { edgePath, materialColors } from "../../lib/widget-skins";
import { Icon, type IconName } from "../icon";
import { Text, WidgetFontScope } from "../text";
import { Flicker } from "./widget-faces";

// More widget faces (CORE-131): clocks, travel paper, kitchen timers, jars,
// a spinner wheel, a birthday cake, signs and the paper some lists are
// written on. The sums behind them are in lib/widget-faces.

const FESTIVE = ["#d9574f", "#4f9a6a", "#e3ae45", "#4f86c6", "#c16fae", "#e3834a"];
const MONO = Platform.select({ ios: "Courier", default: "monospace" });
const SHADOW = "0px 3px 6px rgba(0,0,0,0.22)";

// Swings back and forth from `origin` (a pendulum), unless held still.
function Swing({ still, origin, degrees, ms, children }: { still: boolean; origin: [number, number]; degrees: number; ms: number; children: ReactNode }) {
  const reduce = useReducedMotion();
  const angle = useSharedValue(0);
  const moving = !still && !reduce;
  useEffect(() => {
    if (moving) {
      angle.value = -degrees;
      angle.value = withRepeat(withTiming(degrees, { duration: ms, easing: Easing.inOut(Easing.sin) }), -1, true);
    } else {
      cancelAnimation(angle);
      angle.value = 0;
    }
  }, [moving, angle, degrees, ms]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${angle.value}deg` }] }));
  return <Animated.View style={[StyleSheet.absoluteFill, { transformOrigin: [origin[0], origin[1], 0] }, style]}>{children}</Animated.View>;
}

function hands(cx: number, cy: number, r: number, now: Date) {
  const minutes = now.getMinutes();
  const hours = (now.getHours() % 12) + minutes / 60;
  const at = (angle: number, length: number) => {
    const rad = ((angle - 90) * Math.PI) / 180;
    return { x2: cx + Math.cos(rad) * length, y2: cy + Math.sin(rad) * length };
  };
  return { hour: at(hours * 30, r * 0.5), minute: at(minutes * 6, r * 0.78) };
}

// --- Clock ----------------------------------------------------------------------------------

// A little carved house with a clock face, a bird's door under the roof and
// a pendulum swinging below. It's its own frame.
export function CuckooClock({ now, width, height, color, still }: { now: Date; width: number; height: number; color?: string; still: boolean }) {
  const wood = materialColors("wood", color).base;
  const roof = shade(wood, -0.35);
  const w = Math.min(width - 8, height * 0.78);
  const x0 = (width - w) / 2;
  const roofH = w * 0.32;
  const bodyTop = roofH - 2;
  const bodyH = Math.min(height * 0.56, w * 0.82);
  const cx = width / 2;
  const dialR = Math.min(w * 0.26, bodyH * 0.3);
  const dialY = bodyTop + bodyH * 0.6;
  const { hour, minute } = hands(cx, dialY, dialR, now);
  const bottom = bodyTop + bodyH;
  const swingTo = height - 6;
  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        {/* Chains and pinecone weights. */}
        <Line x1={cx - w * 0.22} y1={bottom} x2={cx - w * 0.22} y2={swingTo - 18} stroke="#a2865c" strokeWidth={1.2} strokeDasharray="2 2" />
        <Line x1={cx + w * 0.22} y1={bottom} x2={cx + w * 0.22} y2={swingTo - 30} stroke="#a2865c" strokeWidth={1.2} strokeDasharray="2 2" />
        <Ellipse cx={cx - w * 0.22} cy={swingTo - 10} rx={5} ry={9} fill="#6f4a26" />
        <Ellipse cx={cx + w * 0.22} cy={swingTo - 22} rx={5} ry={9} fill="#6f4a26" />
        {/* The house. */}
        <Rect x={x0 + w * 0.08} y={bodyTop + 3} width={w * 0.84} height={bodyH} rx={4} fill="#000000" fillOpacity={0.15} />
        <Rect x={x0 + w * 0.08} y={bodyTop} width={w * 0.84} height={bodyH} rx={4} fill={wood} />
        <Path d={`M${x0} ${roofH} L${cx} 2 L${x0 + w} ${roofH} Z`} fill={roof} />
        {Array.from({ length: 7 }, (_, i) => (
          <Circle key={i} cx={x0 + (w * (i + 0.5)) / 7} cy={roofH + 1} r={w / 15} fill={roof} />
        ))}
        {/* The bird's little door. */}
        <Path d={`M${cx - w * 0.08} ${bodyTop + bodyH * 0.24} v${-w * 0.06} a${w * 0.08} ${w * 0.08} 0 0 1 ${w * 0.16} 0 v${w * 0.06} Z`} fill={shade(wood, -0.5)} />
        <Circle cx={cx} cy={dialY} r={dialR + 3} fill={shade(wood, -0.25)} />
        <Circle cx={cx} cy={dialY} r={dialR} fill="#fbf5e8" />
        {Array.from({ length: 12 }, (_, i) => {
          const rad = ((i * 30 - 90) * Math.PI) / 180;
          return <Circle key={i} cx={cx + Math.cos(rad) * dialR * 0.82} cy={dialY + Math.sin(rad) * dialR * 0.82} r={i % 3 === 0 ? 1.6 : 0.9} fill="#5a4636" />;
        })}
        <Line x1={cx} y1={dialY} {...hour} stroke="#3b2a1e" strokeWidth={2.4} strokeLinecap="round" />
        <Line x1={cx} y1={dialY} {...minute} stroke="#3b2a1e" strokeWidth={1.5} strokeLinecap="round" />
        <Circle cx={cx} cy={dialY} r={2} fill="#3b2a1e" />
      </Svg>
      <Swing still={still} origin={[cx, bottom]} degrees={14} ms={1000}>
        <Svg width={width} height={height}>
          <Line x1={cx} y1={bottom} x2={cx} y2={swingTo - 12} stroke="#c9a04f" strokeWidth={1.6} />
          <Circle cx={cx} cy={swingTo - 10} r={Math.max(5, w * 0.06)} fill="#d8b25a" stroke="#a37d2c" strokeWidth={1} />
        </Svg>
      </Swing>
    </View>
  );
}

// A stone sundial whose shadow points at the hour; it rests at night.
export function Sundial({ now, size, ink }: { now: Date; size: number; ink: string }) {
  const angle = sundialAngle(now);
  const c = size / 2;
  const r = c - 3;
  const rad = angle === null ? 0 : ((angle - 90) * Math.PI) / 180;
  return (
    <Svg width={size} height={size}>
      <Circle cx={c} cy={c + 2} r={r} fill="#000000" fillOpacity={0.12} />
      <Circle cx={c} cy={c} r={r} fill="#d4cfc5" />
      <Circle cx={c} cy={c} r={r - 4} fill="none" stroke="#a8a297" strokeWidth={1.5} />
      {Array.from({ length: 13 }, (_, i) => {
        const a = ((i * 15 - 180) * Math.PI) / 180;
        return (
          <Line
            key={i}
            x1={c + Math.cos(a) * (r - 6)}
            y1={c + Math.sin(a) * (r - 6)}
            x2={c + Math.cos(a) * (r - (i % 3 === 0 ? 14 : 10))}
            y2={c + Math.sin(a) * (r - (i % 3 === 0 ? 14 : 10))}
            stroke="#7d776d"
            strokeWidth={i % 3 === 0 ? 2 : 1}
          />
        );
      })}
      {angle !== null ? (
        <Path
          d={`M${c} ${c} L${c + Math.cos(rad - 0.08) * r * 0.78} ${c + Math.sin(rad - 0.08) * r * 0.78} L${c + Math.cos(rad + 0.08) * r * 0.78} ${c + Math.sin(rad + 0.08) * r * 0.78} Z`}
          fill="#3d3a35"
          fillOpacity={0.45}
        />
      ) : null}
      <Path d={`M${c - 2} ${c} L${c} ${c - r * 0.45} L${c + 2} ${c} Z`} fill="#8a7a5a" />
      <Circle cx={c} cy={c} r={3} fill="#8a7a5a" />
      {angle === null ? <Path d={`M${c + r * 0.3} ${c + r * 0.35} a7 7 0 1 1 -6 -10 a5.5 5.5 0 0 0 6 10 Z`} fill={ink} fillOpacity={0.6} /> : null}
    </Svg>
  );
}

// --- Getaway --------------------------------------------------------------------------------

export type TripCard = { title: string; place: string | null; icon: IconName; big: string; caption: string; packing: string | null };

// A manila luggage tag on a string, with where you're going on it.
export function LuggageTag({ trip, width, height, color }: { trip: TripCard; width: number; height: number; color?: string }) {
  const paper = color && isHex(color) ? shade(color, 0.3) : "#ead19b";
  const ink = "#3b2a1a";
  const notch = Math.min(26, height * 0.22);
  const d = `M${notch} 4 H${width - 6} a6 6 0 0 1 6 6 V${height - 10} a6 6 0 0 1 -6 6 H${notch} L4 ${height - 4 - notch} V${4 + notch} Z`;
  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Path d={d} fill="#000000" fillOpacity={0.15} transform="translate(0 3)" />
        <Path d={d} fill={paper} />
        <Circle cx={notch * 0.9} cy={height / 2} r={6} fill="#fffaf0" stroke="#b9975a" strokeWidth={3} />
        <Path d={`M${notch * 0.9} ${height / 2} C${-6} ${height / 2 - 20} ${-4} ${height / 2 + 30} ${-12} ${height / 2 + 10}`} stroke="#c9a46b" strokeWidth={2} fill="none" />
        <Line x1={notch + 20} y1={height * 0.4} x2={width - 14} y2={height * 0.4} stroke={ink} strokeOpacity={0.2} />
        <Line x1={notch + 20} y1={height * 0.68} x2={width - 14} y2={height * 0.68} stroke={ink} strokeOpacity={0.2} />
      </Svg>
      <View style={{ position: "absolute", left: notch + 18, right: 12, top: 10, bottom: 10, justifyContent: "space-between" }}>
        <Text style={{ fontSize: 9, fontWeight: "800", letterSpacing: 1.4, color: ink, opacity: 0.6 }} numberOfLines={1}>
          DESTINATION
        </Text>
        <Text style={{ fontFamily: "Caveat_700Bold", fontSize: Math.min(28, height * 0.2), color: ink }} numberOfLines={1} adjustsFontSizeToFit>
          {trip.place || trip.title}
        </Text>
        <Text style={{ fontSize: 13, fontWeight: "800", color: ink }} numberOfLines={1}>
          {trip.big} <Text style={{ fontSize: 11, fontWeight: "600" }}>{trip.caption}</Text>
        </Text>
        {trip.packing && height > 130 ? (
          <Text style={{ fontSize: 11, color: ink, opacity: 0.75 }} numberOfLines={1}>
            {trip.packing}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

// A boarding pass: a colored band, from home to where you're going, and a
// tear-off stub with the days to go.
export function BoardingPass({ trip, width, height, color }: { trip: TripCard; width: number; height: number; color?: string }) {
  const band = color && isHex(color) ? deepOf(color) : "#3f6fb5";
  const stubX = Math.round(width * 0.7);
  const bandH = Math.min(30, height * 0.24);
  const r = 7;
  const d = `M8 0 H${stubX - r} a${r} ${r} 0 0 0 ${r * 2} 0 H${width - 8} a8 8 0 0 1 8 8 V${height - 8} a8 8 0 0 1 -8 8 H${stubX + r} a${r} ${r} 0 0 0 ${-r * 2} 0 H8 a8 8 0 0 1 -8 -8 V8 a8 8 0 0 1 8 -8 Z`;
  const dest = (trip.place || trip.title).toUpperCase();
  const clip = `pass${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <View style={{ width, height, boxShadow: SHADOW, borderRadius: 8 }}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <ClipPath id={clip}>
            <Path d={d} />
          </ClipPath>
        </Defs>
        <Path d={d} fill="#fffdf8" />
        {/* The band stays inside the ticket, so the stub's notch still shows. */}
        <Rect x={0} y={0} width={width} height={bandH} fill={band} clipPath={`url(#${clip})`} />
        <Path d={d} fill="none" stroke="#000000" strokeOpacity={0.06} />
        <Line x1={stubX} y1={r + 3} x2={stubX} y2={height - r - 3} stroke="#c9c2b8" strokeWidth={1.2} strokeDasharray="3 3" />
      </Svg>
      <View style={{ position: "absolute", left: 10, right: 10, top: 0, height: bandH, flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Icon name="plane" size={13} color="#ffffff" />
        <Text style={{ color: "#ffffff", fontSize: 11, fontWeight: "800", letterSpacing: 1.2 }} numberOfLines={1}>
          BOARDING PASS
        </Text>
      </View>
      <View style={{ position: "absolute", left: 12, width: stubX - 20, top: bandH + 6, bottom: 8, justifyContent: "space-between" }}>
        <Text style={{ fontSize: 9, color: "#8a8178", fontWeight: "700", letterSpacing: 1 }} numberOfLines={1}>
          FROM HOME · TO
        </Text>
        <Text style={{ fontSize: Math.min(22, height * 0.17), fontWeight: "900", color: "#2a2420", letterSpacing: 0.5 }} numberOfLines={1} adjustsFontSizeToFit>
          {dest}
        </Text>
        <Text style={{ fontFamily: MONO, fontSize: 10, color: "#6f665e" }} numberOfLines={1}>
          {trip.packing ?? "SEAT 1A · GATE H"}
        </Text>
      </View>
      <View style={{ position: "absolute", left: stubX + 4, right: 4, top: bandH + 4, bottom: 6, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: Math.min(26, height * 0.2), fontWeight: "900", color: band }} numberOfLines={1} adjustsFontSizeToFit>
          {trip.big}
        </Text>
        <Text style={{ fontSize: 9, fontWeight: "700", color: "#8a8178", textAlign: "center" }} numberOfLines={2}>
          {trip.caption}
        </Text>
      </View>
    </View>
  );
}

// The back of a postcard: a stamp, a postmark and a note in handwriting.
export function Postcard({ trip, width, height, color }: { trip: TripCard; width: number; height: number; color?: string }) {
  const stamp = color && isHex(color) ? color : "#f4c2d7";
  const sw = Math.min(44, width * 0.24);
  const sh = sw * 1.15;
  return (
    <View style={{ width, height, backgroundColor: "#fbf6ea", borderRadius: 6, boxShadow: SHADOW, overflow: "hidden" }}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <G transform={`translate(${width - sw - 10} 10)`}>
          <Path d={edgePath("stamp", sw, sh, 0)} fill="#ffffff" />
          <Rect x={5} y={5} width={sw - 10} height={sh - 10} fill={stamp} />
        </G>
        <Circle cx={width - sw - 14} cy={sh + 4} r={sw * 0.42} fill="none" stroke="#7d6f8a" strokeOpacity={0.5} strokeWidth={1.4} />
        {[0, 1, 2].map((i) => (
          <Path
            key={i}
            d={`M${width - sw * 2.4} ${sh - 4 + i * 6} q6 -4 12 0 t12 0 t12 0 t12 0`}
            stroke="#7d6f8a"
            strokeOpacity={0.45}
            strokeWidth={1.2}
            fill="none"
          />
        ))}
      </Svg>
      <View style={{ position: "absolute", left: width - sw - 10 + 5, top: 15, width: sw - 10, height: sh - 10, alignItems: "center", justifyContent: "center" }}>
        <Icon name={trip.icon} size={sw * 0.45} color={deepOf(stamp)} />
      </View>
      <View style={{ flex: 1, padding: 12, justifyContent: "flex-end", gap: 2 }}>
        <Text style={{ fontFamily: "Caveat_600SemiBold", fontSize: 15, color: "#4b4f7a" }} numberOfLines={1}>
          Greetings from
        </Text>
        <Text style={{ fontFamily: "Caveat_700Bold", fontSize: Math.min(30, height * 0.22), color: "#2f3566", lineHeight: Math.min(32, height * 0.24) }} numberOfLines={1} adjustsFontSizeToFit>
          {trip.place || trip.title}
        </Text>
        <Text style={{ fontFamily: "Caveat_600SemiBold", fontSize: 16, color: "#4b4f7a" }} numberOfLines={1}>
          {trip.big} {trip.caption}
          {trip.packing && height > 150 ? ` · ${trip.packing}` : ""}
        </Text>
      </View>
    </View>
  );
}

// --- Paper some lists are written on (wrapped around the usual insides) -----------------------

// The paper behind a receipt, a notepad or a recipe card, and how much room
// to leave at the top for its binding or header.
export function chromeInset(face: string) {
  return face === "notepad" ? 16 : face === "card" ? 18 : 4;
}

// The font the words on it are written in, unless the widget has its own.
export function chromeFont(face: string) {
  return face === "receipt" ? "typewriter" : face === "card" ? "handwritten" : "app";
}

export function chromePaper(face: string) {
  return face === "notepad" ? "#fff2a6" : face === "card" ? "#fffdf6" : "#fdfdfb";
}

export function PaperChrome({ face, width, height }: { face: string; width: number; height: number }) {
  if (face === "receipt") {
    // Torn off the roll in a zigzag at the bottom.
    const teeth = Math.max(6, Math.round(width / 12));
    const step = width / teeth;
    let zig = `M0 0 H${width} V${height - 8}`;
    for (let i = teeth - 1; i >= 0; i--) zig += ` L${i * step + step / 2} ${height - 2} L${i * step} ${height - 8}`;
    zig += " Z";
    return (
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Path d={zig} fill="#000000" fillOpacity={0.12} transform="translate(0 3)" />
        <Path d={zig} fill={chromePaper(face)} />
        <Line x1={10} y1={6} x2={width - 10} y2={6} stroke="#9a948c" strokeDasharray="4 3" />
      </Svg>
    );
  }
  if (face === "notepad") {
    const rings = Math.max(4, Math.floor(width / 18));
    return (
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Rect x={0} y={9} width={width} height={height - 9} rx={4} fill="#000000" fillOpacity={0.12} transform="translate(0 3)" />
        <Rect x={0} y={9} width={width} height={height - 9} rx={4} fill={chromePaper(face)} />
        {Array.from({ length: Math.floor((height - 30) / 20) }, (_, i) => (
          <Line key={i} x1={0} y1={46 + i * 20} x2={width} y2={46 + i * 20} stroke="#9fb8d6" strokeOpacity={0.6} />
        ))}
        {Array.from({ length: rings }, (_, i) => {
          const x = ((i + 0.5) * width) / rings;
          return (
            <G key={i}>
              <Circle cx={x} cy={16} r={2.6} fill="#6b6460" />
              <Path d={`M${x} 16 C${x - 1} 4 ${x + 7} 2 ${x + 5} 12`} stroke="#9aa1a8" strokeWidth={2} fill="none" />
            </G>
          );
        })}
      </Svg>
    );
  }
  // A recipe card: a red line under its header, faint blue lines below.
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
      <Rect x={0} y={0} width={width} height={height} rx={6} fill="#000000" fillOpacity={0.12} transform="translate(0 3)" />
      <Rect x={0} y={0} width={width} height={height} rx={6} fill={chromePaper(face)} />
      <SvgText x={12} y={14} fontSize={9} fontWeight="bold" fill="#c0504a" letterSpacing={1.4}>
        RECIPE
      </SvgText>
      <Line x1={0} y1={20} x2={width} y2={20} stroke="#e79a9a" strokeWidth={1.2} />
      {Array.from({ length: Math.floor((height - 24) / 18) }, (_, i) => (
        <Line key={i} x1={0} y1={38 + i * 18} x2={width} y2={38 + i * 18} stroke="#a8c3e2" strokeOpacity={0.55} />
      ))}
    </Svg>
  );
}

export function PaperFont({ face, own, children }: { face: string; own: string; children: ReactNode }) {
  if (own !== "app") return <>{children}</>;
  return <WidgetFontScope font={chromeFont(face) as "typewriter" | "handwritten" | "app"}>{children}</WidgetFontScope>;
}

// --- Kitchen timer --------------------------------------------------------------------------

// A twist-dial kitchen timer: the dial turns back toward zero as time runs out.
export function EggTimer({ total, left, size, color }: { total: number; left: number; size: number; color?: string }) {
  const body = color && isHex(color) ? shade(color, -0.05) : "#f6d77a";
  const c = size / 2;
  const r = c - 3;
  const minutes = left / 60;
  const scale = total > 3600 ? 120 : 60;
  const turn = -(minutes / scale) * 360;
  return (
    <Svg width={size} height={size}>
      <Ellipse cx={c} cy={c + 3} rx={r} ry={r} fill="#000000" fillOpacity={0.12} />
      <Circle cx={c} cy={c} r={r} fill={body} />
      <Circle cx={c} cy={c} r={r * 0.78} fill="#fffdf6" />
      <G transform={`rotate(${turn} ${c} ${c})`}>
        {Array.from({ length: 12 }, (_, i) => {
          const a = ((i * 30 - 90) * Math.PI) / 180;
          return (
            <Line
              key={i}
              x1={c + Math.cos(a) * r * 0.62}
              y1={c + Math.sin(a) * r * 0.62}
              x2={c + Math.cos(a) * r * 0.74}
              y2={c + Math.sin(a) * r * 0.74}
              stroke="#5a4b3c"
              strokeWidth={i % 3 === 0 ? 2.2 : 1.2}
            />
          );
        })}
        <Rect x={c - r * 0.08} y={c - r * 0.5} width={r * 0.16} height={r} rx={r * 0.08} fill={shade(body, -0.15)} />
      </G>
      <Path d={`M${c - 5} 2 L${c + 5} 2 L${c} 11 Z`} fill="#d9574f" />
    </Svg>
  );
}

// An hourglass: the sand in the top is what's left; it trickles while running.
export function Hourglass({ total, left, running, size }: { total: number; left: number; running: boolean; size: number }) {
  const f = timeFraction(total, left);
  const w = size * 0.62;
  const x0 = (size - w) / 2;
  const top = 8;
  const bottom = size - 8;
  const mid = (top + bottom) / 2;
  const cx = size / 2;
  const bulb = mid - top - 4;
  // Sand left in the top sits in its narrow end; the rest piles at the bottom.
  const topLevel = mid - 3 - bulb * f;
  const pile = bulb * (1 - f);
  const widthAt = (y: number) => (w / 2 - 4) * (Math.abs(mid - y) / (mid - top)) + 1.5;
  return (
    <Svg width={size} height={size}>
      <Rect x={x0 - 4} y={2} width={w + 8} height={7} rx={2} fill="#9a6a3e" />
      <Rect x={x0 - 4} y={size - 9} width={w + 8} height={7} rx={2} fill="#9a6a3e" />
      <Line x1={x0} y1={8} x2={x0} y2={size - 8} stroke="#7d5530" strokeWidth={2} />
      <Line x1={x0 + w} y1={8} x2={x0 + w} y2={size - 8} stroke="#7d5530" strokeWidth={2} />
      <Path
        d={`M${x0 + 4} ${top + 1} L${x0 + w - 4} ${top + 1} L${cx + 2} ${mid} L${x0 + w - 4} ${bottom - 1} L${x0 + 4} ${bottom - 1} L${cx - 2} ${mid} Z`}
        fill="#e8f2f6"
        fillOpacity={0.65}
        stroke="#a9c2cc"
        strokeWidth={1.2}
      />
      {f > 0.01 ? <Path d={`M${cx - widthAt(topLevel)} ${topLevel} L${cx + widthAt(topLevel)} ${topLevel} L${cx + 1.5} ${mid - 1} L${cx - 1.5} ${mid - 1} Z`} fill="#e2b866" /> : null}
      {pile > 0.5 ? (
        <Path d={`M${cx - widthAt(bottom - 2)} ${bottom - 2} Q${cx} ${bottom - 2 - pile * 1.6} ${cx + widthAt(bottom - 2)} ${bottom - 2} Z`} fill="#e2b866" />
      ) : null}
      {running && f > 0 ? <Line x1={cx} y1={mid} x2={cx} y2={bottom - 3 - pile * 0.8} stroke="#e2b866" strokeWidth={1.2} /> : null}
    </Svg>
  );
}

// --- Gratitude jar --------------------------------------------------------------------------

// A jar, cookie jar or fishbowl holding a folded slip for each good thing.
export function SlipJar({ shape, lines, size }: { shape: "mason" | "cookie" | "bowl"; lines: number; size: number }) {
  const count = slipCount(lines);
  const c = size / 2;
  const w = shape === "mason" ? size * 0.66 : size * 0.86;
  const x0 = c - w / 2;
  const floor = size - 6;
  const inner = w - 14;
  const perRow = 5;
  const sw = inner / perRow;
  const glass = (
    <>
      {shape === "mason" ? (
        <>
          <Rect x={x0} y={size * 0.14} width={w} height={size * 0.84} rx={w * 0.16} fill="#ffffff" fillOpacity={0.35} stroke="#9fb6c1" strokeWidth={1.5} />
          <Rect x={x0 - 2} y={2} width={w + 4} height={size * 0.12} rx={3} fill="#c9a46b" />
        </>
      ) : shape === "cookie" ? (
        <>
          <Path
            d={`M${x0 + 6} ${size * 0.24} H${x0 + w - 6} Q${x0 + w} ${size * 0.24} ${x0 + w} ${size * 0.36} V${size - 14} Q${x0 + w} ${size - 2} ${x0 + w - 12} ${size - 2} H${x0 + 12} Q${x0} ${size - 2} ${x0} ${size - 14} V${size * 0.36} Q${x0} ${size * 0.24} ${x0 + 6} ${size * 0.24} Z`}
            fill="#ffffff"
            fillOpacity={0.35}
            stroke="#9fb6c1"
            strokeWidth={1.5}
          />
          <Ellipse cx={c} cy={size * 0.2} rx={w / 2 - 2} ry={size * 0.06} fill="#e3a6a6" />
          <Circle cx={c} cy={size * 0.1} r={size * 0.06} fill="#d48d8d" />
        </>
      ) : (
        <>
          <Path
            d={`M${c - w * 0.28} ${size * 0.12} A${w / 2} ${w / 2} 0 1 0 ${c + w * 0.28} ${size * 0.12} Z`}
            fill="#dff0f7"
            fillOpacity={0.45}
            stroke="#9fb6c1"
            strokeWidth={1.5}
          />
          <Line x1={c - w * 0.3} y1={size * 0.12} x2={c + w * 0.3} y2={size * 0.12} stroke="#9fb6c1" strokeWidth={2.5} strokeLinecap="round" />
        </>
      )}
    </>
  );
  return (
    <Svg width={size} height={size}>
      {glass}
      {Array.from({ length: count }, (_, i) => {
        const row = Math.floor(i / perRow);
        const col = i % perRow;
        const x = x0 + 7 + col * sw + (row % 2 ? sw * 0.3 : 0);
        const y = floor - 8 - row * 7;
        const turn = ((i * 37) % 50) - 25;
        return (
          <Rect key={i} x={x} y={y} width={sw * 0.9} height={6} rx={1} fill={FESTIVE[(i * 5) % FESTIVE.length]} fillOpacity={0.8} transform={`rotate(${turn} ${x + sw * 0.45} ${y + 3})`} />
        );
      })}
    </Svg>
  );
}

// --- Whose turn? ---------------------------------------------------------------------------

// A spinner wheel with everyone's name on it; the one under the pointer is up.
export function SpinnerWheel({ names, index, size, spinning }: { names: string[]; index: number; size: number; spinning: boolean }) {
  const reduce = useReducedMotion();
  const angle = useSharedValue(wheelAngle(index, names.length));
  const last = useRef(angle.value);
  useEffect(() => {
    const next = wheelAngle(index, names.length, last.current, spinning ? 0 : 0);
    last.current = next;
    angle.value = reduce ? next : withTiming(next, { duration: spinning ? 140 : 600, easing: Easing.out(Easing.cubic) });
  }, [index, names.length, spinning, reduce, angle]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${angle.value}deg` }] }));
  const c = size / 2;
  const r = c - 4;
  const n = Math.max(1, names.length);
  const slice = (2 * Math.PI) / n;
  return (
    <View style={{ width: size, height: size + 6 }}>
      <Animated.View style={[{ position: "absolute", top: 6, left: 0, width: size, height: size }, style]}>
        <Svg width={size} height={size}>
          {names.map((name, i) => {
            const a0 = i * slice - Math.PI / 2;
            const a1 = a0 + slice;
            const large = slice > Math.PI ? 1 : 0;
            const d =
              n === 1
                ? `M${c} ${c - r} A${r} ${r} 0 1 1 ${c - 0.01} ${c - r} Z`
                : `M${c} ${c} L${c + Math.cos(a0) * r} ${c + Math.sin(a0) * r} A${r} ${r} 0 ${large} 1 ${c + Math.cos(a1) * r} ${c + Math.sin(a1) * r} Z`;
            const mid = (a0 + a1) / 2;
            const deg = (mid * 180) / Math.PI;
            return (
              <G key={`${i}-${name}`}>
                <Path d={d} fill={FESTIVE[i % FESTIVE.length]} stroke="#ffffff" strokeWidth={1.5} />
                <SvgText
                  x={c + Math.cos(mid) * r * 0.58}
                  y={c + Math.sin(mid) * r * 0.58 + 4}
                  fontSize={Math.max(8, Math.min(13, r * 0.22))}
                  fontWeight="bold"
                  fill="#ffffff"
                  textAnchor="middle"
                  transform={`rotate(${deg + 90} ${c + Math.cos(mid) * r * 0.58} ${c + Math.sin(mid) * r * 0.58})`}
                >
                  {name.length > 8 ? `${name.slice(0, 7)}…` : name}
                </SvgText>
              </G>
            );
          })}
          <Circle cx={c} cy={c} r={r * 0.14} fill="#ffffff" stroke="#d6d0c8" strokeWidth={1.5} />
        </Svg>
      </Animated.View>
      <Svg width={size} height={16} style={{ position: "absolute", top: 0, left: 0 }}>
        <Path d={`M${c - 7} 1 L${c + 7} 1 L${c} 14 Z`} fill="#3b3430" />
      </Svg>
    </View>
  );
}

// --- Birthdays ------------------------------------------------------------------------------

// A two-layer cake with a candle for each year (or a number candle for each
// digit), the flames flickering.
export function Cake({ turning, size, still }: { turning: number | null; size: number; still: boolean }) {
  const { count, digits } = cakeCandles(turning);
  const w = size * 0.86;
  const x0 = (size - w) / 2;
  const cx = size / 2;
  const plateY = size - 6;
  const lowTop = size * 0.62;
  const highTop = size * 0.42;
  const topW = w * 0.72;
  const candleTop = highTop - size * 0.17;
  const spots = digits ? digits.map((_, i) => cx + (i - (digits.length - 1) / 2) * size * 0.16) : Array.from({ length: count }, (_, i) => cx - topW / 2 + ((i + 0.5) * topW) / count);
  const flames = spots.map((x) => [x, candleTop - 2] as const);
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Ellipse cx={cx} cy={plateY} rx={w / 2 + 4} ry={5} fill="#e9e4dc" />
        <Rect x={x0} y={lowTop} width={w} height={plateY - lowTop - 2} rx={6} fill="#f2c6a8" />
        <Path d={`M${x0} ${lowTop + 6} q${w / 8} 10 ${w / 4} 0 t${w / 4} 0 t${w / 4} 0 t${w / 4} 0 V${lowTop} H${x0} Z`} fill="#fff6f0" />
        <Rect x={cx - topW / 2} y={highTop} width={topW} height={lowTop - highTop + 2} rx={6} fill="#f4a9bf" />
        <Path d={`M${cx - topW / 2} ${highTop + 5} q${topW / 6} 9 ${topW / 3} 0 t${topW / 3} 0 t${topW / 3} 0 V${highTop} H${cx - topW / 2} Z`} fill="#fff6f0" />
        {digits
          ? digits.map((digit, i) => (
              <G key={i}>
                <Rect x={spots[i] - size * 0.06} y={candleTop} width={size * 0.12} height={highTop - candleTop} rx={2} fill={FESTIVE[i % FESTIVE.length]} />
                <SvgText x={spots[i]} y={candleTop + (highTop - candleTop) * 0.72} fontSize={size * 0.11} fontWeight="bold" fill="#ffffff" textAnchor="middle">
                  {digit}
                </SvgText>
              </G>
            ))
          : spots.map((x, i) => <Rect key={i} x={x - 1.6} y={candleTop} width={3.2} height={highTop - candleTop} rx={1} fill={FESTIVE[i % FESTIVE.length]} />)}
      </Svg>
      <Flicker still={still} origin={[cx, candleTop]} size={[size, size]}>
        {flames.map(([x, y], i) => (
          <G key={i}>
            <Ellipse cx={x} cy={y - 3} rx={2.2} ry={4} fill="#f39a2e" />
            <Ellipse cx={x} cy={y - 2} rx={1} ry={2} fill="#ffe28a" />
          </G>
        ))}
      </Flicker>
    </View>
  );
}

// --- Greeting --------------------------------------------------------------------------------

// A neon sign glowing on a dark board. It's its own frame.
export function NeonSign({ line, sub, width, height, radius, color }: { line: string; sub?: string; width: number; height: number; radius: number; color?: string }) {
  const glow = color && isHex(color) ? shade(deepOf(color), 0.35) : "#ff7ab6";
  const second = "#7fe3ff";
  const fontSize = Math.max(16, Math.min(34, height * 0.3, width * 0.085));
  return (
    <View style={{ width, height, borderRadius: Math.min(radius, 14), backgroundColor: "#1e1b22", boxShadow: SHADOW, overflow: "hidden", alignItems: "center", justifyContent: "center", paddingHorizontal: 14 }}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <Pattern id="bricks" patternUnits="userSpaceOnUse" width={28} height={14}>
            <Rect x={0} y={0} width={28} height={14} fill="#231f27" />
            <Line x1={0} y1={13.5} x2={28} y2={13.5} stroke="#18151b" />
            <Line x1={14} y1={0} x2={14} y2={7} stroke="#18151b" />
            <Line x1={0} y1={7} x2={28} y2={7} stroke="#18151b" />
            <Line x1={4} y1={7} x2={4} y2={14} stroke="#18151b" />
          </Pattern>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill="url(#bricks)" />
        {[8, width - 8].map((x) => (
          <Circle key={x} cx={x} cy={8} r={2} fill="#555058" />
        ))}
      </Svg>
      <Text
        style={{ fontFamily: "Caveat_700Bold", fontSize: fontSize * 1.15, color: "#ffffff", textAlign: "center", textShadowColor: glow, textShadowRadius: 10, textShadowOffset: { width: 0, height: 0 } }}
        numberOfLines={2}
        adjustsFontSizeToFit
        minimumFontScale={0.6}
      >
        {line}
      </Text>
      {sub && height > 90 ? (
        <Text style={{ fontSize: 12, fontWeight: "700", color: "#e9fbff", textShadowColor: second, textShadowRadius: 6, textShadowOffset: { width: 0, height: 0 }, letterSpacing: 1 }} numberOfLines={1}>
          {sub}
        </Text>
      ) : null}
    </View>
  );
}

// A woven coir doormat with the greeting on it. It's its own frame.
export function Doormat({ line, sub, width, height, radius, color }: { line: string; sub?: string; width: number; height: number; radius: number; color?: string }) {
  const coir = color && isHex(color) ? shade(materialColors("kraft", color).base, -0.15) : "#b98a52";
  const ink = "#3b2412";
  const fontSize = Math.max(15, Math.min(30, height * 0.28, width * 0.08));
  return (
    <View style={{ width, height, borderRadius: Math.min(radius, 10), backgroundColor: coir, boxShadow: SHADOW, overflow: "hidden", alignItems: "center", justifyContent: "center", paddingHorizontal: 16 }}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <Pattern id="coir" patternUnits="userSpaceOnUse" width={4} height={4}>
            <Line x1={0} y1={0} x2={4} y2={4} stroke="#5c3a1a" strokeOpacity={0.22} strokeWidth={0.8} />
            <Line x1={4} y1={0} x2={0} y2={4} stroke="#ffffff" strokeOpacity={0.08} strokeWidth={0.8} />
          </Pattern>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill="url(#coir)" />
        <Rect x={7} y={7} width={width - 14} height={height - 14} rx={Math.max(2, Math.min(radius, 10) - 5)} fill="none" stroke={ink} strokeOpacity={0.55} strokeWidth={3} strokeDasharray="8 4" />
      </Svg>
      <Text style={{ fontFamily: "Fraunces_900Black", fontSize, color: ink, textAlign: "center", letterSpacing: 0.5 }} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.6}>
        {line}
      </Text>
      {sub && height > 90 ? (
        <Text style={{ fontFamily: "Fraunces_700Bold", fontSize: 12, color: ink, opacity: 0.8 }} numberOfLines={1}>
          {sub}
        </Text>
      ) : null}
    </View>
  );
}
