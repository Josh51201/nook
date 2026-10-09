import { useMemo, useState } from "react";
import { PixelRatio, Text as RNText, View, type NativeSyntheticEvent, type TextLayoutEventData, type TextStyle } from "react-native";
import Svg, { Path } from "react-native-svg";

import { boldened, labelFamily } from "../../lib/fonts";
import { deepColor, labelIsBold, type LabelItem } from "../../lib/hearth-layout";
import {
  decorInset,
  estimateMeasure,
  fitText,
  labelRules,
  SIDE_PAD,
  SLIM_HEIGHT,
  splitWords,
  type Inset,
  type TextMeasure,
} from "../../lib/label-fit";
import { currentBoldText, currentFont } from "../../lib/theme";
import { Icon } from "../icon";

// Text on the Hearth (CORE-009, CORE-076, CORE-077): a title, heading or
// caption in its own font, with an optional cozy decoration — an underline, a
// soft pill, a stitched patch, a ribbon, a little wooden sign or a flourish.
// It's sized to fit its space every time (lib/label-fit.ts): as big as the
// width and height allow, wrapping onto more lines when there's room, so it
// grows and shrinks as you resize it instead of turning into "R…".
// Slim text (half a row) sits in the middle of its space; taller text sits
// at the bottom, like a heading over what comes next.

type Theme = { text: string; muted: string; accent: string; background: string };

const WOOD = "#a87650";
const WOOD_DARK = "#7c5236";
const CREAM = "#fff7ec";
// Text is measured once at this size, and every other size is worked out
// from it. Kept for the session, so text doesn't re-measure on every visit.
const MEASURE_SIZE = 50;
const measured = new Map<string, TextMeasure>();

export function LabelFace({
  item,
  width,
  height,
  theme,
  folded,
  hiddenCount,
}: {
  item: LabelItem;
  width: number;
  height: number;
  theme: Theme;
  // A divider (CORE-064): folded shut right now, and how much it hides.
  folded?: boolean;
  hiddenCount?: number;
}) {
  const decor = item.divider ? "none" : item.decor ?? "none";
  const tint = decor === "sign" ? CREAM : item.color ? deepColor(item.color) : item.size === "caption" ? theme.muted : theme.text;
  const weight = labelIsBold(item) ? 800 : item.size === "caption" ? 500 : 600;
  const family = labelFamily(item.font, boldened(weight, currentBoldText()), currentFont());
  // Spacing in proportion to the size, so one measurement works for every size.
  const spacing = item.caps ? 0.08 : item.size === "title" ? -0.012 : 0;
  const face: TextStyle = {
    color: tint,
    textTransform: item.caps ? "uppercase" : "none",
    ...(family ? { fontFamily: family } : { fontWeight: String(weight) as TextStyle["fontWeight"] }),
  };

  const key = `${item.text}|${family ?? weight}|${item.caps ? 1 : 0}|${spacing}`;
  const [, remeasured] = useState(0);
  const words = useMemo(() => splitWords(item.text), [item.text]);
  const measure = measured.get(key) ?? estimateMeasure(item.text, item.font, item.caps, labelIsBold(item));

  // A divider keeps room beside its words for the line, arrow and count.
  const reserve = item.divider ? 10 + 24 + 10 + 16 + (folded && hiddenCount ? 70 : 0) : 0;
  const rules = { ...labelRules(item, { width, height }, PixelRatio.getFontScale()), reserve };
  const fit = fitText(measure, { width, height }, rules);
  const fontSize = fit.fontSize;
  const textStyle: TextStyle = {
    ...face,
    textAlign: item.align,
    fontSize,
    lineHeight: fontSize * rules.lineHeight,
    letterSpacing: spacing * fontSize,
  };
  const slim = height < SLIM_HEIGHT;
  const inset = decorInset(decor, fontSize, fit.snug);

  // Measures each word (and a space) once, out of sight. Until that's back,
  // the fit uses a guess from the letters.
  const measurer =
    words.length && !measured.has(key) ? (
      <View
        pointerEvents="none"
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
        style={{ position: "absolute", left: 0, top: 0, width: 0, height: 0, overflow: "hidden", opacity: 0 }}
      >
        <View style={{ width: 6000, alignItems: "flex-start" }}>
          <RNText
            allowFontScaling={false}
            style={{ ...face, fontSize: MEASURE_SIZE, lineHeight: MEASURE_SIZE * 1.3, letterSpacing: spacing * MEASURE_SIZE }}
            onTextLayout={(e: NativeSyntheticEvent<TextLayoutEventData>) => {
              const lines = e.nativeEvent.lines;
              // Each word on its own line, then "x x" and "xx" to find a space.
              if (lines.length !== words.length + 2) return;
              const em = lines.map((l) => l.width / MEASURE_SIZE);
              measured.set(key, { words: em.slice(0, words.length), space: Math.max(0.15, em[words.length] - em[words.length + 1]) });
              remeasured((n) => n + 1);
            }}
          >
            {[...words, "x x", "xx"].join("\n")}
          </RNText>
        </View>
      </View>
    ) : null;

  // The phone's own text size is already counted in the fit (labelRules), so
  // it isn't applied a second time on top.
  const shown = (
    <RNText
      allowFontScaling={false}
      numberOfLines={fit.fits ? fit.room : fit.lines}
      ellipsizeMode="tail"
      style={item.divider ? [textStyle, { flexShrink: 1, color: item.color ? deepColor(item.color) : theme.text }] : textStyle}
    >
      {item.text}
    </RNText>
  );

  if (item.divider) {
    const line = item.color ? deepColor(item.color) : theme.text;
    return (
      <View
        style={{ width, height, flexDirection: "row", alignItems: slim ? "center" : "flex-end", gap: 10, paddingHorizontal: SIDE_PAD, paddingBottom: slim ? 0 : 4 }}
      >
        {measurer}
        {shown}
        <View style={{ flex: 1, minWidth: 24, height: 2, borderRadius: 1, backgroundColor: `${line}33`, marginBottom: slim ? 0 : fontSize * 0.55 }} />
        {folded && hiddenCount ? (
          <RNText allowFontScaling={false} style={{ color: theme.muted, fontSize: 13, marginBottom: slim ? 0 : fontSize * 0.3 }}>
            {hiddenCount} hidden
          </RNText>
        ) : null}
        <View style={{ transform: [{ rotate: folded ? "0deg" : "90deg" }], marginBottom: slim ? 0 : fontSize * 0.3 }}>
          <Icon name="chevron" size={16} color={line} />
        </View>
      </View>
    );
  }

  const justify = item.align === "left" ? "flex-start" : item.align === "right" ? "flex-end" : "center";

  return (
    <View style={{ width, height, justifyContent: slim ? "center" : "flex-end", paddingHorizontal: SIDE_PAD, paddingBottom: slim ? 0 : 2 }}>
      {measurer}
      <View style={{ flexDirection: "row", justifyContent: justify }}>
        <Decorated decor={decor} tint={tint} soft={item.color} accent={theme.accent} inset={inset}>
          {shown}
        </Decorated>
      </View>
    </View>
  );
}

// The shape around the words. Its padding comes from decorInset, the same
// numbers the fit used, and grows with the text so a slim pill and a big
// pill look like the same pill.
function Decorated({
  decor,
  tint,
  soft,
  accent,
  inset,
  children,
}: {
  decor: NonNullable<LabelItem["decor"]>;
  tint: string;
  soft?: string;
  accent: string;
  inset: Inset;
  children: React.ReactNode;
}) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const fill = soft ?? `${accent}24`;
  const pad = { paddingHorizontal: inset.padX, paddingVertical: inset.padY };

  switch (decor) {
    case "underline": {
      const thick = Math.max(2, inset.outerY * 0.55);
      return (
        <View style={{ flexShrink: 1, alignItems: "stretch" }}>
          {children}
          <View style={{ height: thick, borderRadius: thick, marginTop: inset.outerY - thick, backgroundColor: `${tint}55`, marginHorizontal: 2 }} />
        </View>
      );
    }
    case "pill":
      return <View style={{ flexShrink: 1, ...pad, borderRadius: 999, backgroundColor: fill }}>{children}</View>;
    case "stitched":
      return (
        <View
          style={{
            flexShrink: 1,
            ...pad,
            borderRadius: Math.max(8, inset.padX * 0.9),
            backgroundColor: fill,
            borderWidth: 1.5,
            borderStyle: "dashed",
            borderColor: `${tint}88`,
          }}
        >
          {children}
        </View>
      );
    case "ribbon":
      return (
        <View style={{ flexShrink: 1, ...pad }} onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
          {box.w ? (
            <Svg width={box.w} height={box.h} style={{ position: "absolute", left: 0, top: 0 }}>
              {/* A banner with notched tails, as deep as the text is big. */}
              <Path
                d={`M0 0 H${box.w} L${box.w - inset.tail} ${box.h / 2} L${box.w} ${box.h} H0 L${inset.tail} ${box.h / 2} Z`}
                fill={soft ?? accent}
                opacity={soft ? 1 : 0.22}
              />
            </Svg>
          ) : null}
          {children}
        </View>
      );
    case "sign": {
      const nail = Math.max(3, Math.min(5, inset.padX * 0.25));
      const nailStyle = {
        position: "absolute",
        top: "50%",
        marginTop: -nail / 2,
        width: nail,
        height: nail,
        borderRadius: nail,
        backgroundColor: CREAM,
        opacity: 0.7,
      } as const;
      return (
        <View
          style={{
            flexShrink: 1,
            ...pad,
            borderRadius: Math.max(6, inset.padY * 2),
            backgroundColor: soft ? deepColor(soft) : WOOD,
            borderBottomWidth: 3,
            borderBottomColor: WOOD_DARK,
            boxShadow: "0px 2px 4px rgba(60, 35, 15, 0.25)",
          }}
        >
          {/* Two little nails. */}
          <View style={[nailStyle, { left: inset.padX / 2 - nail / 2 }]} />
          <View style={[nailStyle, { right: inset.padX / 2 - nail / 2 }]} />
          {children}
        </View>
      );
    }
    case "flourish":
      return (
        <View style={{ flexShrink: 1, flexDirection: "row", alignItems: "center", gap: inset.gap }}>
          <Icon name="sparkles" size={inset.icon} color={`${tint}aa`} />
          <View style={{ flexShrink: 1 }}>{children}</View>
          <Icon name="sparkles" size={inset.icon} color={`${tint}aa`} />
        </View>
      );
    default:
      return <View style={{ flexShrink: 1 }}>{children}</View>;
  }
}
