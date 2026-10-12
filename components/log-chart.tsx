import { useState } from "react";
import { View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Svg, { Circle, Line, Path, Rect } from "react-native-svg";

import { tap } from "../lib/feedback";
import {
  chartPoints,
  dayWords,
  formatEntry,
  formatNumber,
  nearestIndex,
  niceTicks,
  scaleWord,
  timeWords,
  yesNoDays,
  type LittleLog,
  type LogEntry,
} from "../lib/little-log";
import { localDay } from "../lib/pets";
import { colors } from "../lib/theme";
import { Text } from "./text";

// Little Log's charts (LOG-004). Quiet on purpose: hairline gridlines, a
// 2px line in the log's color with a faint wash under it, a ringed dot at
// the latest value with that value beside it, and nothing else shouting.
// Put a finger on the chart and slide to read any entry. Drawn to sit on
// a card (rings are the card's color).

const AXIS = 34; // room for the value labels on the left
const TOP = 46; // room above the plot for the reading card
const BOTTOM = 8;

type Props = {
  log: Pick<LittleLog, "kind" | "unit" | "labels" | "color">;
  // Oldest first.
  entries: LogEntry[];
  width: number;
  height?: number;
};

const linePath = (points: { x: number; y: number | null }[]) =>
  points
    .filter((p): p is { x: number; y: number } => p.y !== null)
    .map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");

export function LogChart({ log, entries, width, height = 190 }: Props) {
  const [picked, setPicked] = useState<number | null>(null);
  const plotted = entries.filter((e) => e.value !== null);
  const plotW = Math.max(10, width - AXIS - 10);
  const plotH = height - TOP - BOTTOM;

  // Scale logs always run 1..5; numbers fit their values with round ticks.
  const values = plotted.flatMap((e) => [e.value!, ...(e.value2 !== null ? [e.value2] : [])]);
  const ticks = log.kind === "scale" ? [1, 3, 5] : niceTicks(Math.min(...values), Math.max(...values));
  const domain: [number, number] = [ticks[0] ?? 0, ticks[ticks.length - 1] ?? 1];
  const points = chartPoints(plotted, plotW, plotH, domain).map((p) => ({
    x: p.x + AXIS,
    y: p.y === null ? null : p.y + TOP,
    y2: p.y2 === null ? null : p.y2 + TOP,
  }));
  const yOf = (v: number) => TOP + plotH - ((v - domain[0]) / (domain[1] - domain[0] || 1)) * plotH;

  const pick = (x: number) => {
    if (!points.length) return;
    const index = nearestIndex(points, x);
    if (index !== picked) {
      tap();
      setPicked(index);
    }
  };
  const gesture = Gesture.Exclusive(
    Gesture.Pan()
      .runOnJS(true)
      .activeOffsetX([-6, 6])
      .failOffsetY([-12, 12])
      .onStart((e) => pick(e.x))
      .onUpdate((e) => pick(e.x))
      .onEnd(() => setPicked(null)),
    Gesture.Tap()
      .runOnJS(true)
      .onEnd((e) => (picked === null ? pick(e.x) : setPicked(null)))
  );

  if (!plotted.length) return null;

  const last = points[points.length - 1];
  const lastEntry = plotted[plotted.length - 1];
  const line1 = linePath(points);
  const line2 = log.kind === "pair" ? linePath(points.map((p) => ({ x: p.x, y: p.y2 }))) : "";
  const area =
    log.kind === "number" && points.length > 1
      ? `${line1} L${last.x.toFixed(1)},${(TOP + plotH).toFixed(1)} L${points[0].x.toFixed(1)},${(TOP + plotH).toFixed(1)} Z`
      : "";
  const showDots = points.length <= 31;
  const reading = picked !== null ? plotted[picked] : null;
  const readingAt = picked !== null ? points[picked] : null;
  const latestLabel =
    log.kind === "scale" ? scaleWord(lastEntry.value!) : log.kind === "pair" ? `${formatNumber(lastEntry.value!)}/${formatNumber(lastEntry.value2!)}` : formatNumber(lastEntry.value!);

  return (
    <View style={{ gap: 6 }}>
      {log.kind === "pair" ? <PairLegend log={log} /> : null}
      <GestureDetector gesture={gesture}>
        <View collapsable={false} accessible accessibilityLabel={`Chart of ${plotted.length} entries. Latest ${formatEntry(log, lastEntry)}.`}>
          <Svg width={width} height={height}>
            {ticks.map((t) => (
              <Line key={t} x1={AXIS} x2={width - 4} y1={yOf(t)} y2={yOf(t)} stroke={colors.border} strokeWidth={1} />
            ))}
            {area ? <Path d={area} fill={log.color} fillOpacity={0.1} /> : null}
            {line2 ? (
              <Path d={line2} stroke={log.color} strokeWidth={2} strokeDasharray="5 4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            ) : null}
            <Path d={line1} stroke={log.color} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            {showDots
              ? points.flatMap((p, i) => [
                  p.y !== null ? <Circle key={`a${i}`} cx={p.x} cy={p.y} r={3} fill={log.color} stroke={colors.surface} strokeWidth={1.5} /> : null,
                  p.y2 !== null ? <Circle key={`b${i}`} cx={p.x} cy={p.y2} r={3} fill={colors.surface} stroke={log.color} strokeWidth={1.5} /> : null,
                ])
              : null}
            {last.y !== null ? <Circle cx={last.x} cy={last.y} r={5} fill={log.color} stroke={colors.surface} strokeWidth={2} /> : null}
            {readingAt ? (
              <>
                <Line x1={readingAt.x} x2={readingAt.x} y1={TOP - 4} y2={TOP + plotH} stroke={colors.muted} strokeWidth={1} />
                {readingAt.y !== null ? <Circle cx={readingAt.x} cy={readingAt.y} r={6} fill={log.color} stroke={colors.surface} strokeWidth={2} /> : null}
                {readingAt.y2 !== null ? <Circle cx={readingAt.x} cy={readingAt.y2} r={6} fill={colors.surface} stroke={log.color} strokeWidth={2} /> : null}
              </>
            ) : null}
          </Svg>
          {/* Value labels on the left, in the page's own muted ink. */}
          {ticks.map((t) => (
            <Text
              key={t}
              style={{ position: "absolute", left: 0, width: AXIS - 6, top: yOf(t) - 8, fontSize: 11, color: colors.muted, textAlign: "right" }}
              numberOfLines={1}
            >
              {log.kind === "scale" ? t : compact(t)}
            </Text>
          ))}
          {reading && readingAt ? (
            <Reading x={readingAt.x} width={width} text={formatEntry(log, reading)} sub={`${dayWords(localDay(new Date(reading.logged_at)))} · ${timeWords(reading.logged_at)}`} />
          ) : (
            <Text
              style={{ position: "absolute", top: TOP - 22, right: Math.max(0, width - last.x - 40), fontSize: 13, fontWeight: "700", color: colors.text }}
              numberOfLines={1}
            >
              {latestLabel}
            </Text>
          )}
        </View>
      </GestureDetector>
    </View>
  );
}

// 1,200 -> 1.2K on the axis.
function compact(v: number) {
  if (Math.abs(v) >= 10000) return `${formatNumber(v / 1000)}K`;
  return formatNumber(v);
}

// What the finger is on: a little card above the chart.
function Reading({ x, width, text, sub }: { x: number; width: number; text: string; sub: string }) {
  const cardW = 150;
  const left = Math.max(0, Math.min(width - cardW, x - cardW / 2));
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: 0,
        left,
        width: cardW,
        paddingVertical: 5,
        paddingHorizontal: 8,
        borderRadius: 10,
        backgroundColor: colors.text,
        alignItems: "center",
      }}
    >
      <Text style={{ color: colors.background, fontWeight: "800", fontSize: 14 }} numberOfLines={1}>
        {text}
      </Text>
      <Text style={{ color: colors.background, fontSize: 11, opacity: 0.8 }} numberOfLines={1}>
        {sub}
      </Text>
    </View>
  );
}

// Two lines need a key (identity is never color alone): solid and dashed.
function PairLegend({ log }: { log: Pick<LittleLog, "labels" | "color"> }) {
  const [first, second] = log.labels ?? ["First", "Second"];
  const key = (dashed: boolean) => (
    <Svg width={22} height={8}>
      <Line x1={1} x2={21} y1={4} y2={4} stroke={log.color} strokeWidth={2} strokeLinecap="round" strokeDasharray={dashed ? "5 4" : undefined} />
    </Svg>
  );
  return (
    <View style={{ flexDirection: "row", gap: 16, alignItems: "center" }}>
      <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
        {key(false)}
        <Text style={{ fontSize: 13, color: colors.muted }}>{first}</Text>
      </View>
      <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
        {key(true)}
        <Text style={{ fontSize: 13, color: colors.muted }}>{second}</Text>
      </View>
    </View>
  );
}

// A tiny trend line for lists and the Hearth: no axes, just the shape and
// a dot on the latest. `entries` oldest first.
export function Sparkline({
  entries,
  color,
  width,
  height,
  ring = colors.surface,
}: {
  entries: Pick<LogEntry, "logged_at" | "value" | "value2">[];
  color: string;
  width: number;
  height: number;
  ring?: string;
}) {
  const plotted = entries.filter((e) => e.value !== null);
  if (plotted.length < 2 || width < 10) return null;
  const values = plotted.map((e) => e.value!);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const pad = 4;
  const points = chartPoints(plotted, width - pad * 2, height - pad * 2, low === high ? [low - 1, high + 1] : [low, high]).map((p) => ({
    x: p.x + pad,
    y: p.y === null ? null : p.y + pad,
  }));
  const last = points[points.length - 1];
  return (
    <Svg width={width} height={height}>
      <Path d={linePath(points)} stroke={color} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {last.y !== null ? <Circle cx={last.x} cy={last.y} r={3.5} fill={color} stroke={ring} strokeWidth={1.5} /> : null}
    </Svg>
  );
}

// Yes/no logs: a square per day, filled for yes, a soft square for no,
// an outline for not logged. Rows of 7, oldest top left.
export function YesNoGrid({ entries, color, days, width, today }: { entries: LogEntry[]; color: string; days: number; width: number; today?: string }) {
  const cells = yesNoDays(entries, days, today);
  const gap = 4;
  const size = Math.min(28, (width - gap * 6) / 7);
  const rows = Math.ceil(cells.length / 7);
  return (
    <View style={{ gap: 8 }}>
      <Svg width={size * 7 + gap * 6} height={rows * size + (rows - 1) * gap}>
        {cells.map((cell, i) => (
          <Rect
            key={cell.day}
            x={(i % 7) * (size + gap)}
            y={Math.floor(i / 7) * (size + gap)}
            width={size}
            height={size}
            rx={4}
            fill={cell.state === "yes" ? color : cell.state === "no" ? colors.barkSoft : "none"}
            stroke={cell.state === null ? colors.border : "none"}
            strokeWidth={1}
          />
        ))}
      </Svg>
      <View style={{ flexDirection: "row", gap: 14, flexWrap: "wrap" }}>
        <Swatch fill={color} label="Yes" />
        <Swatch fill={colors.barkSoft} label="No" />
        <Swatch fill="none" stroke={colors.border} label="Not logged" />
      </View>
    </View>
  );
}

function Swatch({ fill, stroke, label }: { fill: string; stroke?: string; label: string }) {
  return (
    <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
      <Svg width={12} height={12}>
        <Rect x={0.5} y={0.5} width={11} height={11} rx={3} fill={fill} stroke={stroke ?? "none"} strokeWidth={1} />
      </Svg>
      <Text style={{ fontSize: 12, color: colors.muted }}>{label}</Text>
    </View>
  );
}
