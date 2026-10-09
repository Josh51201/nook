import { useState } from "react";
import { View, type LayoutChangeEvent } from "react-native";
import Svg, { Circle, Line, Path, Text as SvgText } from "react-native-svg";

import { FEVER_C, formatTemp, tempRange, whenWords, type ChartPoint, type TempUnit } from "../lib/sickday";
import { colors } from "../lib/theme";
import { Tap } from "./motion";
import { Text } from "./text";

// The temperature over a sick spell (SICK-006): one thin line, a dot per
// reading, and a dashed line where a fever starts. Tap anywhere to read the
// nearest reading. Every reading is also listed in words on the page.
export function TempChart({ points, unit, accent }: { points: ChartPoint[]; unit: TempUnit; accent: string }) {
  const [width, setWidth] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const height = 170;
  const pad = { left: 40, right: 12, top: 14, bottom: 24 };

  const { lo, hi } = tempRange(points);
  const first = points[0]?.at ?? 0;
  const last = points[points.length - 1]?.at ?? 1;
  const span = Math.max(last - first, 60 * 60 * 1000);
  const plotW = Math.max(1, width - pad.left - pad.right);
  const plotH = height - pad.top - pad.bottom;
  const x = (at: number) => pad.left + (points.length === 1 ? plotW / 2 : ((at - first) / span) * plotW);
  const y = (c: number) => pad.top + (1 - (c - lo) / (hi - lo)) * plotH;

  const line = points.map((p, i) => `${i ? "L" : "M"}${x(p.at).toFixed(1)},${y(p.c).toFixed(1)}`).join(" ");
  const feverY = y(FEVER_C);
  // Three quiet grid lines: bottom, middle, top, in the person's unit.
  const ticks = [lo + 0.3, (lo + hi) / 2, hi - 0.3];
  const show = picked != null ? points[picked] : null;

  function pick(locationX: number) {
    if (!points.length) return;
    let best = 0;
    for (let i = 1; i < points.length; i++) if (Math.abs(x(points[i].at) - locationX) < Math.abs(x(points[best].at) - locationX)) best = i;
    setPicked(best === picked ? null : best);
  }

  const top = points.reduce((m, p) => Math.max(m, p.c), -Infinity);
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontSize: 13, color: colors.muted }}>
        {show ? `${formatTemp(show.c, unit)} · ${whenWords(show.at)}` : `Highest ${formatTemp(top, unit)} · tap to read one`}
      </Text>
      <Tap
        onPress={(e) => pick(e.nativeEvent.locationX)}
        onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
        accessibilityRole="image"
        accessibilityLabel={`Temperature chart: ${points.length} readings, highest ${formatTemp(top, unit)}, latest ${formatTemp(points[points.length - 1].c, unit)}.`}
        style={{ height }}
        pressedScale={1}
      >
        {width ? (
          <Svg width={width} height={height}>
            {ticks.map((c) => (
              <Line key={c} x1={pad.left} x2={width - pad.right} y1={y(c)} y2={y(c)} stroke={colors.border} strokeWidth={1} />
            ))}
            {ticks.map((c) => (
              <SvgText key={`l${c}`} x={pad.left - 6} y={y(c) + 4} fontSize={11} fill={colors.muted} textAnchor="end">
                {formatTemp(c, unit, false)}
              </SvgText>
            ))}
            <Line x1={pad.left} x2={width - pad.right} y1={feverY} y2={feverY} stroke={colors.muted} strokeWidth={1} strokeDasharray="4 4" />
            <SvgText x={width - pad.right} y={feverY - 5} fontSize={11} fill={colors.muted} textAnchor="end">
              Fever
            </SvgText>
            {points.length > 1 ? <Path d={line} stroke={accent} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" /> : null}
            {show ? <Line x1={x(show.at)} x2={x(show.at)} y1={pad.top} y2={height - pad.bottom} stroke={colors.muted} strokeWidth={1} /> : null}
            {points.map((p, i) => (
              <Circle
                key={p.at + ":" + i}
                cx={x(p.at)}
                cy={y(p.c)}
                r={i === picked ? 6 : 4}
                fill={p.c >= FEVER_C ? accent : colors.surface}
                stroke={i === picked ? colors.surface : accent}
                strokeWidth={2}
              />
            ))}
            <SvgText x={pad.left} y={height - 6} fontSize={11} fill={colors.muted}>
              {whenWords(first)}
            </SvgText>
            {points.length > 1 ? (
              <SvgText x={width - pad.right} y={height - 6} fontSize={11} fill={colors.muted} textAnchor="end">
                {whenWords(last)}
              </SvgText>
            ) : null}
          </Svg>
        ) : null}
      </Tap>
    </View>
  );
}
