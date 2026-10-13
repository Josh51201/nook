import { useEffect } from "react";
import { Platform, StyleSheet, View } from "react-native";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Defs, Ellipse, G, Line, Path, Pattern, Rect } from "react-native-svg";

import { deepOf, isHex, shade } from "../../lib/colors";
import { chainLinks, flameSize, flipDigits, JAR_HOLDS, jarMarbles, luckyNumbers, plantStage } from "../../lib/widget-faces";
import { materialColors } from "../../lib/widget-skins";
import { Icon } from "../icon";
import { Text } from "../text";
import type { Palette } from "./widgets";

// The drawings for widget faces (CORE-127). Which face a widget wears, and
// the sums behind them (how many links, leaves, marbles), are in
// lib/widget-faces.

// Bright paper colors for chains, bunting and marbles.
const FESTIVE = ["#d9574f", "#4f9a6a", "#e3ae45", "#4f86c6", "#c16fae", "#e3834a"];

const MONO = Platform.select({ ios: "Courier", default: "monospace" });

// --- Countdown ----------------------------------------------------------------------------

// A page-a-day pad: a binding with rings, today's number on the top page and
// a corner curling up.
export function TearOffPad({ days, size, palette }: { days: number; size: number; palette: Palette }) {
  const bind = Math.max(12, size * 0.14);
  const today = days === 0;
  return (
    <View style={{ width: size, alignItems: "center" }}>
      <View style={[pad.binding, { width: size, height: bind, backgroundColor: palette.deep }]}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={[pad.ring, { height: bind * 0.9, top: -bind * 0.45 }]} />
        ))}
      </View>
      <View style={[pad.page, { width: size, height: size * 0.9 }]}>
        <Text
          style={{ fontSize: size * (today ? 0.24 : 0.46), fontWeight: "800", color: "#2a2420", letterSpacing: -1 }}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {today ? "Today!" : String(Math.abs(days))}
        </Text>
        <Text style={{ fontSize: Math.max(8, size * 0.085), fontWeight: "800", color: "#8a7f78", letterSpacing: 1.2 }} numberOfLines={1}>
          {today ? "IT'S HERE" : days > 0 ? (days === 1 ? "DAY TO GO" : "DAYS TO GO") : "DAYS AGO"}
        </Text>
        <View style={[pad.curl, { width: size * 0.16, height: size * 0.16, borderTopLeftRadius: size * 0.16 }]} />
      </View>
      <View style={[pad.under, { width: size - 6 }]} />
      <View style={[pad.under, { width: size - 12, opacity: 0.7 }]} />
    </View>
  );
}

const pad = StyleSheet.create({
  binding: { borderTopLeftRadius: 6, borderTopRightRadius: 6, flexDirection: "row", justifyContent: "space-evenly" },
  ring: { width: 5, borderRadius: 3, backgroundColor: "#d8d3cd", borderWidth: 1, borderColor: "rgba(0,0,0,0.15)" },
  page: {
    backgroundColor: "#fffdf8",
    alignItems: "center",
    justifyContent: "center",
    borderBottomLeftRadius: 5,
    borderBottomRightRadius: 5,
    overflow: "hidden",
  },
  curl: { position: "absolute", right: 0, bottom: 0, backgroundColor: "#e9e1d5", boxShadow: "-1px -1px 2px rgba(0,0,0,0.12)" },
  under: { height: 2.5, backgroundColor: "#efe7dc", borderBottomLeftRadius: 2, borderBottomRightRadius: 2 },
});

// A row of flip-clock cards, one per digit.
export function FlipDigits({ days, width, height }: { days: number; width: number; height: number }) {
  const digits = flipDigits(days);
  const gap = 5;
  const w = Math.max(18, Math.min(60, (width - gap * (digits.length - 1)) / digits.length, height / 1.4));
  const h = w * 1.4;
  return (
    <View style={{ flexDirection: "row", gap }}>
      {digits.map((digit, i) => (
        <View key={i} style={[flip.card, { width: w, height: h, borderRadius: w * 0.14 }]}>
          <View style={[flip.top, { height: h / 2, borderTopLeftRadius: w * 0.14, borderTopRightRadius: w * 0.14 }]} />
          <Text style={{ fontSize: h * 0.68, fontWeight: "800", color: "#f6f1ea", fontVariant: ["tabular-nums"] }}>{digit}</Text>
          <View style={[flip.split, { top: h / 2 - 0.75 }]} />
          <View style={[flip.hinge, { left: -2, top: h / 2 - 3 }]} />
          <View style={[flip.hinge, { right: -2, top: h / 2 - 3 }]} />
        </View>
      ))}
    </View>
  );
}

const flip = StyleSheet.create({
  card: { backgroundColor: "#2b2624", alignItems: "center", justifyContent: "center", boxShadow: "0px 2px 3px rgba(0,0,0,0.25)" },
  top: { position: "absolute", top: 0, left: 0, right: 0, backgroundColor: "rgba(255,255,255,0.07)" },
  split: { position: "absolute", left: 0, right: 0, height: 1.5, backgroundColor: "rgba(0,0,0,0.55)" },
  hinge: { position: "absolute", width: 4, height: 6, borderRadius: 1, backgroundColor: "#77706b" },
});

// A paper chain: one link per day to go, alternating colors and turns, in
// as many rows as fit. Links that don't fit are counted.
export function PaperChain({ days, width, height, palette }: { days: number; width: number; height: number; palette: Palette }) {
  const linkW = 24;
  const linkH = 15;
  const step = 15;
  const rowH = linkH + 6;
  const perRow = Math.max(1, Math.floor((width - linkW) / step) + 1);
  const rows = Math.max(1, Math.floor(height / rowH));
  const { shown, more } = chainLinks(days, perRow * rows - (days > perRow * rows ? 1 : 0));
  const lines: number[][] = [];
  for (let i = 0; i < shown; i++) {
    const row = Math.floor(i / perRow);
    (lines[row] ??= []).push(i);
  }
  if (!shown) {
    return <Icon name="celebration" size={Math.min(48, height)} color={palette.accent} />;
  }
  return (
    <View style={{ gap: 6, alignItems: "center" }}>
      {lines.map((line, r) => (
        <View key={r} style={{ flexDirection: "row", alignItems: "center" }}>
          {line.map((i) => {
            const side = i % 2 === 1;
            return (
              <View
                key={i}
                style={{
                  width: side ? linkW * 0.55 : linkW,
                  height: linkH,
                  marginLeft: i % perRow === 0 ? 0 : side ? -5 : -4,
                  borderRadius: linkH / 2,
                  borderWidth: side ? 3 : 4,
                  borderColor: FESTIVE[i % FESTIVE.length],
                  zIndex: side ? 1 : 0,
                }}
              />
            );
          })}
          {more && r === lines.length - 1 ? (
            <Text style={{ marginLeft: 6, fontSize: 12, fontWeight: "800", color: palette.muted }} numberOfLines={1}>
              +{more}
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

// --- Quote --------------------------------------------------------------------------------

// A sheet in a typewriter: the roller across the top, the words typed below.
export function TypewriterQuote({ text, width, height }: { text: string; width: number; height: number }) {
  const fontSize = Math.max(11, Math.min(16, width * 0.055 + height * 0.02));
  const lines = Math.max(2, Math.floor((height - 40) / (fontSize * 1.45)));
  return (
    <View style={{ flex: 1 }}>
      <View style={type.paper}>
        <Text style={{ fontFamily: MONO, fontSize, lineHeight: fontSize * 1.45, color: "#2c2a28" }} numberOfLines={lines}>
          {text}
          <Text style={{ fontFamily: MONO, color: "#b8463a" }}> ▍</Text>
        </Text>
      </View>
      <View style={type.roller}>
        <View style={[type.knob, { left: -6 }]} />
        <View style={[type.knob, { right: -6 }]} />
      </View>
    </View>
  );
}

const type = StyleSheet.create({
  roller: { position: "absolute", top: 0, left: 0, right: 0, height: 12, borderRadius: 6, backgroundColor: "#3b3634" },
  knob: { position: "absolute", top: -3, width: 9, height: 18, borderRadius: 3, backgroundColor: "#24201e" },
  paper: {
    flex: 1,
    marginTop: 6,
    marginHorizontal: 8,
    paddingTop: 14,
    paddingHorizontal: 10,
    paddingBottom: 8,
    backgroundColor: "#fffdf6",
    boxShadow: "0px 1px 3px rgba(0,0,0,0.15)",
  },
});

// The slip of paper from a fortune cookie, with the day's lucky numbers.
export function FortuneSlip({ text, width, height, palette }: { text: string; width: number; height: number; palette: Palette }) {
  const fontSize = Math.max(12, Math.min(17, width * 0.06));
  const lines = Math.max(1, Math.floor((height - 60) / (fontSize * 1.35)));
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 8 }}>
      {height > 120 ? <Icon name="cookie" size={18} color={palette.accent} /> : null}
      <View style={fortune.slip}>
        <Text
          style={{ fontFamily: "Fraunces_600SemiBold", fontSize, lineHeight: fontSize * 1.35, color: "#a8392e", textAlign: "center" }}
          numberOfLines={lines}
        >
          {text}
        </Text>
        <Text style={{ fontFamily: MONO, fontSize: 9, color: "#9a7c6c", textAlign: "center", marginTop: 4 }} numberOfLines={1}>
          Lucky numbers {luckyNumbers(new Date()).join(" ")}
        </Text>
      </View>
    </View>
  );
}

const fortune = StyleSheet.create({
  slip: {
    alignSelf: "stretch",
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#fffefa",
    transform: [{ rotate: "-2deg" }],
    boxShadow: "0px 1px 3px rgba(0,0,0,0.18)",
  },
});

// A round (or oval) embroidery hoop with the words stitched on its fabric.
// It's its own frame: no card behind it.
export function HoopQuote({ text, width, height, color }: { text: string; width: number; height: number; color?: string }) {
  const fabric = color && isHex(color) ? shade(color, 0.55) : "#f6efe1";
  const thread = color && isHex(color) ? deepOf(color) : "#b4505f";
  const cx = width / 2;
  const cy = height / 2 + 2;
  const rx = width / 2 - 6;
  const ry = height / 2 - 9;
  // The biggest box of words that sits inside the oval.
  const boxW = rx * 1.3;
  const boxH = ry * 1.2;
  const fontSize = Math.max(14, Math.min(30, Math.sqrt((boxW * boxH) / Math.max(12, text.length)) * 1.15));
  const lines = Math.max(1, Math.floor(boxH / (fontSize * 1.05)));
  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <Pattern id="weave" patternUnits="userSpaceOnUse" width={4} height={4}>
            <Line x1={0} y1={1} x2={4} y2={1} stroke="#7a6a55" strokeOpacity={0.12} strokeWidth={0.7} />
            <Line x1={1} y1={0} x2={1} y2={4} stroke="#7a6a55" strokeOpacity={0.09} strokeWidth={0.7} />
          </Pattern>
        </Defs>
        <Ellipse cx={cx} cy={cy + 3} rx={rx} ry={ry} fill="#000000" fillOpacity={0.14} />
        <Ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={fabric} />
        <Ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="url(#weave)" />
        <Ellipse cx={cx} cy={cy} rx={rx - 1} ry={ry - 1} fill="none" stroke="#c79a5e" strokeWidth={8} />
        <Ellipse cx={cx} cy={cy} rx={rx - 5} ry={ry - 5} fill="none" stroke="#8f6634" strokeOpacity={0.45} strokeWidth={1} />
        <Ellipse cx={cx} cy={cy} rx={rx + 3} ry={ry + 3} fill="none" stroke="#e3bd84" strokeOpacity={0.6} strokeWidth={1} />
        <Rect x={cx - 7} y={cy - ry - 8} width={14} height={9} rx={2} fill="#a0a4a9" />
        <Circle cx={cx} cy={cy - ry - 9} r={3} fill="#878b90" />
        {/* A little stitched flower under the words. */}
        <G transform={`translate(${cx} ${cy + ry * 0.8})`}>
          {[0, 72, 144, 216, 288].map((a) => (
            <Ellipse
              key={a}
              cx={0}
              cy={-4}
              rx={2.4}
              ry={4}
              fill="none"
              stroke={thread}
              strokeWidth={1}
              strokeDasharray="1.5 1.2"
              transform={`rotate(${a})`}
            />
          ))}
          <Circle cx={0} cy={0} r={1.6} fill="#e3ae45" />
        </G>
      </Svg>
      <View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center", paddingBottom: ry * 0.22 }]}>
        <Text
          style={{ width: boxW, fontFamily: "Caveat_700Bold", fontSize, lineHeight: fontSize * 1.05, color: thread, textAlign: "center" }}
          numberOfLines={lines}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
        >
          {text}
        </Text>
      </View>
    </View>
  );
}

// --- Habit streak ---------------------------------------------------------------------------

// A candle whose flame grows with the streak; out (just a wisp) when it's
// broken. The flame flickers (CORE-130), except while editing or when the
// phone asks for less motion.
export function CandleArt({
  streak,
  doneToday,
  size,
  still = false,
}: {
  streak: number;
  doneToday: boolean;
  size: number;
  still?: boolean;
}) {
  const flame = flameSize(streak, doneToday);
  const w = size;
  const h = size;
  const bodyW = w * 0.26;
  // The flame's tip reaches at most near the top, however big it gets.
  const top = h * 0.5;
  const cx = w / 2;
  const f = h * 0.24 * flame;
  return (
    <View style={{ width: w, height: h }}>
      <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
        {flame ? <Circle cx={cx} cy={top - f * 0.55} r={f * 1.25} fill="#ffcf6b" fillOpacity={0.22} /> : null}
        <Ellipse cx={cx} cy={h - 4} rx={w * 0.32} ry={4} fill="#c9a46b" />
        <Rect x={cx - bodyW / 2} y={top} width={bodyW} height={h - top - 5} rx={2} fill="#fbf3e4" />
        <Path
          d={`M${cx - bodyW / 2} ${top + 2} q${bodyW * 0.2} 7 ${bodyW * 0.32} 0 q${bodyW * 0.15} 10 ${bodyW * 0.35} 0`}
          stroke="#efe2cc"
          strokeWidth={2}
          fill="none"
        />
        <Rect x={cx + bodyW * 0.18} y={top} width={bodyW * 0.12} height={h - top - 5} fill="#000000" fillOpacity={0.05} />
        <Line x1={cx} y1={top} x2={cx} y2={top - 5} stroke="#3a2a1e" strokeWidth={1.5} />
        {flame ? null : (
          <Path
            d={`M${cx} ${top - 6} c4 -5 -4 -8 0 -13 c3 -4 -2 -6 1 -9`}
            stroke="#9a948e"
            strokeOpacity={0.6}
            strokeWidth={1.4}
            fill="none"
            strokeLinecap="round"
          />
        )}
      </Svg>
      {flame ? (
        <Flicker still={still} origin={[cx, top - 2]} size={[w, h]}>
          <Path
            d={`M${cx} ${top - 4 - f * 1.6} C${cx + f * 0.75} ${top - 4 - f * 0.7} ${cx + f * 0.55} ${top - 2} ${cx} ${top - 2} C${cx - f * 0.55} ${top - 2} ${cx - f * 0.75} ${top - 4 - f * 0.7} ${cx} ${top - 4 - f * 1.6} Z`}
            fill="#f39a2e"
          />
          <Path
            d={`M${cx} ${top - 4 - f * 0.9} C${cx + f * 0.35} ${top - 4 - f * 0.4} ${cx + f * 0.3} ${top - 3} ${cx} ${top - 3} C${cx - f * 0.3} ${top - 3} ${cx - f * 0.35} ${top - 4 - f * 0.4} ${cx} ${top - 4 - f * 0.9} Z`}
            fill="#ffe28a"
          />
        </Flicker>
      ) : null}
    </View>
  );
}

// A flame that stretches and dips a little, now and then.
function Flicker({
  still,
  origin,
  size,
  children,
}: {
  still: boolean;
  origin: [number, number];
  size: [number, number];
  children: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  const stretch = useSharedValue(1);
  const moving = !still && !reduce;
  useEffect(() => {
    if (moving) {
      stretch.value = withRepeat(
        withSequence(
          withTiming(1.08, { duration: 170 }),
          withTiming(0.94, { duration: 230 }),
          withTiming(1.04, { duration: 190 }),
          withTiming(1, { duration: 260 }),
        ),
        -1,
        false,
      );
    } else {
      cancelAnimation(stretch);
      stretch.value = 1;
    }
  }, [moving, stretch]);
  const style = useAnimatedStyle(() => ({ transform: [{ scaleY: stretch.value }, { scaleX: 2 - stretch.value }] }));
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { transformOrigin: [origin[0], origin[1], 0] }, style]}>
      <Svg width={size[0]} height={size[1]}>
        {children}
      </Svg>
    </Animated.View>
  );
}

// A plant in a pot that grows a pair of leaves every couple of days and
// flowers at a week.
export function PlantArt({ streak, size }: { streak: number; size: number }) {
  const { pairs, flower, height } = plantStage(streak);
  const w = size;
  const h = size;
  const cx = w / 2;
  const potTop = h * 0.66;
  const leaf = Math.max(4, w * 0.09);
  // Room above for the flower.
  const stemTop = potTop - (potTop - (leaf * 1.6 + 4)) * height;
  const leaves = Array.from({ length: Math.max(1, pairs) }, (_, i) => potTop - ((potTop - stemTop) * (i + 0.6)) / Math.max(1, pairs) - 2);
  return (
    <Svg width={w} height={h}>
      <Path
        d={`M${cx} ${potTop} C${cx - 2} ${(potTop + stemTop) / 2} ${cx + 2} ${(potTop + stemTop) / 2} ${cx} ${stemTop}`}
        stroke="#5a8f4e"
        strokeWidth={2}
        fill="none"
      />
      {leaves.map((y, i) => (
        <G key={i}>
          <Ellipse
            cx={cx - leaf * 0.9}
            cy={y}
            rx={leaf}
            ry={leaf * 0.45}
            fill="#6dab5f"
            transform={`rotate(-28 ${cx - leaf * 0.9} ${y})`}
          />
          <Ellipse
            cx={cx + leaf * 0.9}
            cy={y - 3}
            rx={leaf}
            ry={leaf * 0.45}
            fill="#7dbb6c"
            transform={`rotate(28 ${cx + leaf * 0.9} ${y - 3})`}
          />
        </G>
      ))}
      {flower ? (
        <G transform={`translate(${cx} ${stemTop - 2})`}>
          {[0, 60, 120, 180, 240, 300].map((a) => (
            <Ellipse key={a} cx={0} cy={-leaf * 0.7} rx={leaf * 0.42} ry={leaf * 0.72} fill="#f29bb4" transform={`rotate(${a})`} />
          ))}
          <Circle cx={0} cy={0} r={leaf * 0.42} fill="#f3c34a" />
        </G>
      ) : null}
      <Path
        d={`M${cx - w * 0.24} ${potTop} L${cx + w * 0.24} ${potTop} L${cx + w * 0.18} ${h - 2} L${cx - w * 0.18} ${h - 2} Z`}
        fill="#c8734f"
      />
      <Rect x={cx - w * 0.27} y={potTop - 2} width={w * 0.54} height={h * 0.08} rx={2} fill="#b5603f" />
    </Svg>
  );
}

// A glass jar that gets a marble for every day of the streak.
export function JarArt({ streak, size }: { streak: number; size: number }) {
  const count = jarMarbles(streak);
  const w = size * 0.72;
  const h = size;
  const x0 = (size - w) / 2;
  const lid = h * 0.11;
  const perRow = 5;
  const r = (w - 10) / (perRow * 2);
  const rows = Math.ceil(JAR_HOLDS / perRow);
  const floor = h - 5 - r;
  const rise = Math.min(r * 1.75, (h - lid - 12 - r) / rows);
  return (
    <Svg width={size} height={h}>
      <Rect
        x={x0}
        y={lid}
        width={w}
        height={h - lid - 2}
        rx={w * 0.16}
        fill="#ffffff"
        fillOpacity={0.35}
        stroke="#9fb6c1"
        strokeWidth={1.5}
      />
      {Array.from({ length: count }, (_, i) => {
        const row = Math.floor(i / perRow);
        const col = i % perRow;
        // A touch out of line, so they look dropped in rather than placed.
        const x = x0 + 5 + r + col * r * 2 + (((row * 3 + col) % 3) - 1) * r * 0.08;
        return (
          <G key={i}>
            <Circle cx={x} cy={floor - row * rise} r={r * 0.92} fill={FESTIVE[(i * 7) % FESTIVE.length]} />
            <Circle cx={x - r * 0.3} cy={floor - row * rise - r * 0.3} r={r * 0.28} fill="#ffffff" fillOpacity={0.55} />
          </G>
        );
      })}
      <Rect x={x0 + w * 0.12} y={lid + 6} width={w * 0.08} height={h * 0.5} rx={2} fill="#ffffff" fillOpacity={0.45} />
      <Rect x={x0 - 2} y={2} width={w + 4} height={lid} rx={3} fill="#c9a46b" />
      <Line x1={x0} y1={2 + lid * 0.5} x2={x0 + w} y2={2 + lid * 0.5} stroke="#a8844f" strokeWidth={1} />
    </Svg>
  );
}

// --- On the menu --------------------------------------------------------------------------

// A felt letter board in a wooden frame, with white letters pressed into its
// grooves. It's its own frame: no card behind it.
export function LetterBoard({
  title,
  lines,
  empty,
  width,
  height,
  radius,
  color,
}: {
  title?: string;
  lines: { key: string; label: string; text: string }[];
  empty: string;
  width: number;
  height: number;
  radius: number;
  color?: string;
}) {
  const felt = color && isHex(color) ? materialColors("chalkboard", color).base : "#1f1d1c";
  const room = height - 14 - 20 - (title ? 22 : 0);
  const fit = Math.max(1, Math.floor(room / 34));
  const shown = lines.filter((l) => l.text).length ? lines.slice(0, fit) : [];
  return (
    <View style={[board.frame, { width, height, borderRadius: Math.min(radius, 16) }]}>
      <View style={[board.felt, { backgroundColor: felt, borderRadius: Math.max(2, Math.min(radius, 16) - 6) }]}>
        <Svg style={StyleSheet.absoluteFill} width={width} height={height}>
          {Array.from({ length: Math.ceil(height / 6) }, (_, i) => (
            <Line key={i} x1={0} y1={i * 6 + 3} x2={width} y2={i * 6 + 3} stroke="#ffffff" strokeOpacity={0.06} strokeWidth={1} />
          ))}
        </Svg>
        {title ? (
          <Text style={[board.letters, { color: "#f2d27a", fontSize: 13, textAlign: "center", marginBottom: 6 }]} numberOfLines={1}>
            {title.toUpperCase()}
          </Text>
        ) : null}
        {shown.length ? (
          shown.map((l) => (
            <View key={l.key} style={{ marginBottom: 6 }}>
              <Text style={[board.letters, { color: "#cfc8c0", fontSize: 10 }]} numberOfLines={1}>
                {l.label.toUpperCase()}
              </Text>
              <Text style={[board.letters, { color: "#ffffff", fontSize: 13 }]} numberOfLines={1}>
                {(l.text || "—").toUpperCase()}
              </Text>
            </View>
          ))
        ) : (
          <Text style={[board.letters, { color: "#ffffff", fontSize: 13, textAlign: "center", marginTop: 8 }]}>{empty.toUpperCase()}</Text>
        )}
      </View>
    </View>
  );
}

const board = StyleSheet.create({
  frame: { padding: 7, backgroundColor: "#b98a56", boxShadow: "0px 3px 6px rgba(0,0,0,0.25), inset 0px 1px 0px rgba(255,255,255,0.3)" },
  felt: { flex: 1, paddingHorizontal: 12, paddingVertical: 10, overflow: "hidden", boxShadow: "inset 0px 2px 4px rgba(0,0,0,0.5)" },
  letters: { fontWeight: "700", letterSpacing: 1.6 },
});

// --- Greeting -------------------------------------------------------------------------------

// Little paper flags strung across the top.
export function Bunting({ width }: { width: number }) {
  const h = 26;
  const n = Math.max(4, Math.floor(width / 22));
  const step = width / n;
  const sag = 6;
  const y = (x: number) => 3 + sag * Math.sin((Math.PI * x) / width);
  return (
    <Svg width={width} height={h}>
      <Path d={`M0 3 Q${width / 2} ${3 + sag * 2} ${width} 3`} stroke="#9b7b55" strokeWidth={1.2} fill="none" />
      {Array.from({ length: n }, (_, i) => {
        const a = i * step + step * 0.12;
        const b = (i + 1) * step - step * 0.12;
        const m = (a + b) / 2;
        return <Path key={i} d={`M${a} ${y(a)} L${b} ${y(b)} L${m} ${y(m) + h * 0.7} Z`} fill={FESTIVE[i % FESTIVE.length]} />;
      })}
    </Svg>
  );
}

// A wooden plank with the greeting carved into it. It's its own frame.
export function CarvedSign({
  line,
  sub,
  width,
  height,
  radius,
  color,
}: {
  line: string;
  sub?: string;
  width: number;
  height: number;
  radius: number;
  color?: string;
}) {
  const wood = materialColors("wood", color).base;
  const ink = shade(wood, -0.6);
  const r = Math.min(radius, 14);
  const fontSize = Math.max(16, Math.min(34, height * 0.32, width * 0.09));
  return (
    <View
      style={{
        width,
        height,
        borderRadius: r,
        backgroundColor: wood,
        boxShadow: "0px 3px 6px rgba(0,0,0,0.25), inset 0px 1.5px 0px rgba(255,255,255,0.25)",
        overflow: "hidden",
      }}
    >
      <Svg style={StyleSheet.absoluteFill} width={width} height={height}>
        <Defs>
          <Pattern id="grain" patternUnits="userSpaceOnUse" width={140} height={17}>
            <Path d="M0 5 C35 2 70 9 140 5" stroke="#3d2414" strokeOpacity={0.25} strokeWidth={1.1} fill="none" />
            <Path d="M0 12 C40 15 95 8 140 12" stroke="#3d2414" strokeOpacity={0.16} strokeWidth={0.8} fill="none" />
          </Pattern>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill="url(#grain)" />
        <Rect
          x={6}
          y={6}
          width={width - 12}
          height={height - 12}
          rx={Math.max(2, r - 5)}
          fill="none"
          stroke={ink}
          strokeOpacity={0.45}
          strokeWidth={2}
        />
        <Rect
          x={7}
          y={7.5}
          width={width - 14}
          height={height - 14}
          rx={Math.max(2, r - 6)}
          fill="none"
          stroke="#ffffff"
          strokeOpacity={0.18}
          strokeWidth={1}
        />
      </Svg>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 }}>
        <Text style={[carve.text, { fontSize, color: ink }]} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.6}>
          {line}
        </Text>
        {sub && height > 90 ? (
          <Text style={[carve.text, { fontSize: 12, color: ink, opacity: 0.85, fontFamily: "Fraunces_600SemiBold" }]} numberOfLines={1}>
            {sub}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const carve = StyleSheet.create({
  text: {
    fontFamily: "Fraunces_800ExtraBold",
    textAlign: "center",
    textShadowColor: "rgba(255,255,255,0.3)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 0,
  },
});
