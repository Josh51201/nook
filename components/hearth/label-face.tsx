import { useMemo, useState } from "react";
import { PixelRatio, Text as RNText, View, type NativeSyntheticEvent, type TextLayoutEventData, type TextStyle } from "react-native";
import Svg, { Path } from "react-native-svg";

import { boldened, labelFamily, labelSlanted } from "../../lib/fonts";
import { deepColor, labelIsBold, labelLook, type LabelItem, type LabelLook } from "../../lib/hearth-layout";
import {
  decorInset,
  decorMinHeight,
  decorMinWidth,
  effectShadow,
  estimateMeasure,
  fitLabel,
  labelVAlign,
  letterSpacingEm,
  SIDE_PAD,
  splitWords,
  type Inset,
  type TextMeasure,
  underlineRoom,
} from "../../lib/label-fit";
import { currentBoldText, currentFont } from "../../lib/theme";
import { Icon } from "../icon";

// Text on the Hearth (CORE-009, CORE-076, CORE-077, CORE-082): a title,
// heading or caption in its own font and lettering (bold, italic, capitals,
// spacing, an underline, an effect), with an optional cozy decoration — a
// soft pill, a stitched patch, a ribbon, a little wooden sign or a flourish.
// It's sized to fill its space every time (lib/label-fit.ts): as big as the
// width and height allow (a heading or caption a set step smaller), wrapping onto more lines when there's room, so it
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
  // Older settings read the new way (the underline decoration, CAPITALS).
  const look = labelLook(item);
  const decor = look.decor;
  const tint = decor === "sign" ? CREAM : item.color ? deepColor(item.color) : item.size === "caption" ? theme.muted : theme.text;
  const weight = labelIsBold(item) ? 800 : item.size === "caption" ? 500 : 600;
  const family = labelFamily(item.font, boldened(weight, currentBoldText()), currentFont(), look.italic);
  const slanted = labelSlanted(item.font, currentFont(), look.italic);
  // Spacing in proportion to the size, so one measurement works for every size.
  const spacing = letterSpacingEm(look, item.size);
  const face: TextStyle = {
    color: tint,
    textTransform: caseStyle[look.letters],
    ...(family ? { fontFamily: family } : { fontWeight: String(weight) as TextStyle["fontWeight"], fontStyle: look.italic ? "italic" : "normal" }),
  };

  const key = `${item.text}|${family ?? weight}|${look.italic ? "i" : ""}|${look.letters}|${spacing}`;
  const [, remeasured] = useState(0);
  const words = useMemo(() => splitWords(item.text), [item.text]);
  const measure = measured.get(key) ?? estimateMeasure(item.text, item.font, look.letters === "upper", labelIsBold(item), spacing);

  // A divider keeps room beside its words for the line, arrow and count.
  const reserve = item.divider ? 10 + 24 + 10 + 16 + (folded && hiddenCount ? 70 : 0) : 0;
  const fit = fitLabel(measure, { ...item, decor }, { width, height }, {
    fontScale: PixelRatio.getFontScale(),
    reserve,
    underline: look.underline,
    italic: look.italic,
  });
  const fontSize = fit.fontSize;
  const textStyle: TextStyle = {
    ...face,
    textAlign: item.align,
    fontSize,
    lineHeight: fontSize * fit.lineHeight,
    letterSpacing: spacing * fontSize,
    ...effectShadow(look.effect, fontSize, tint, item.color, theme.accent),
    ...(slanted ? { transform: [{ skewX: "-10deg" }] } : null),
  };
  const valign = labelVAlign(item, height);
  const vJustify = valign === "top" ? "flex-start" : valign === "middle" ? "center" : "flex-end";
  // A little breathing room from the edge it sits against.
  const vPad = { paddingTop: valign === "top" ? 2 : 0, paddingBottom: valign === "bottom" ? 2 : 0 };
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
        style={{ width, height, flexDirection: "row", alignItems: vJustify, gap: 10, paddingHorizontal: SIDE_PAD, ...vPad }}
      >
        {measurer}
        {shown}
        <View style={{ flex: 1, minWidth: 24, height: 2, borderRadius: 1, backgroundColor: `${line}33`, alignSelf: "center" }} />
        {folded && hiddenCount ? (
          <RNText allowFontScaling={false} style={{ color: theme.muted, fontSize: 13, alignSelf: "center" }}>
            {hiddenCount} hidden
          </RNText>
        ) : null}
        <View style={{ transform: [{ rotate: folded ? "0deg" : "90deg" }], alignSelf: "center" }}>
          <Icon name="chevron" size={16} color={line} />
        </View>
      </View>
    );
  }

  const justify = item.align === "left" ? "flex-start" : item.align === "right" ? "flex-end" : "center";

  return (
    <View style={{ width, height, justifyContent: vJustify, paddingHorizontal: SIDE_PAD, ...vPad }}>
      {measurer}
      <View style={{ flexDirection: "row", justifyContent: justify }}>
        <Decorated
          decor={decor}
          tint={tint}
          soft={item.color}
          accent={theme.accent}
          inset={inset}
          minWidth={decorMinWidth({ ...item, decor }, width)}
          minHeight={decorMinHeight({ ...item, decor }, height)}
        >
          <Underlined style={look.underline} fontSize={fontSize} tint={tint} align={item.align}>
            {shown}
          </Underlined>
        </Decorated>
      </View>
    </View>
  );
}

const caseStyle: Record<LabelLook["letters"], TextStyle["textTransform"]> = {
  typed: "none",
  upper: "uppercase",
  lower: "lowercase",
  title: "capitalize",
};

// A line under the words (CORE-082): thin, a soft bar, or a hand-drawn wave.
// It's as wide as the words, inside any decoration, and its room was counted
// in the fit (underlineRoom).
function Underlined({
  style,
  fontSize,
  tint,
  align,
  children,
}: {
  style: LabelLook["underline"];
  fontSize: number;
  tint: string;
  align: LabelItem["align"];
  children: React.ReactNode;
}) {
  const [lineWidth, setLineWidth] = useState(0);
  if (style === "none") return <>{children}</>;
  const room = underlineRoom(style, fontSize);
  const self = align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center";
  let line: React.ReactNode;
  if (style === "wavy") {
    line = (
      <View style={{ height: room.height, marginTop: room.gap, alignSelf: "stretch" }} onLayout={(e) => setLineWidth(e.nativeEvent.layout.width)}>
        {lineWidth ? (
          <Svg width={lineWidth} height={room.height}>
            <Path d={wavePath(lineWidth, room.height, fontSize)} stroke={tint} strokeWidth={room.stroke} strokeLinecap="round" fill="none" />
          </Svg>
        ) : null}
      </View>
    );
  } else {
    line = (
      <View
        style={{
          height: room.height,
          marginTop: room.gap,
          borderRadius: room.height,
          backgroundColor: style === "bar" ? `${tint}55` : tint,
          marginHorizontal: style === "bar" ? 2 : 0,
        }}
      />
    );
  }
  return (
    <View style={{ alignSelf: self, flexShrink: 1, maxWidth: "100%" }}>
      {children}
      {line}
    </View>
  );
}

// A gentle wave across the width, about half a letter per bump.
function wavePath(width: number, height: number, fontSize: number) {
  const mid = height / 2;
  const amp = Math.max(1, mid - Math.max(1.5, fontSize * 0.07) / 2);
  const half = Math.max(4, fontSize * 0.22);
  let d = `M1 ${mid}`;
  let up = true;
  for (let x = 1; x < width - 1; x += half) {
    const end = Math.min(width - 1, x + half);
    d += ` Q${(x + end) / 2} ${up ? mid - amp : mid + amp} ${end} ${mid}`;
    up = !up;
  }
  return d;
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
  minWidth,
  minHeight,
  children,
}: {
  decor: NonNullable<LabelItem["decor"]>;
  tint: string;
  soft?: string;
  accent: string;
  inset: Inset;
  // Stretched across its space (CORE-078); the words keep their own line-up
  // inside it.
  minWidth: number;
  // Stretched up and down (CORE-081), with the words in the middle.
  minHeight: number;
  children: React.ReactNode;
}) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const fill = soft ?? `${accent}24`;
  const pad = { paddingHorizontal: inset.padX, paddingVertical: inset.padY, minWidth, minHeight, justifyContent: "center" } as const;

  switch (decor) {
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
        <View style={{ flexShrink: 1, flexDirection: "row", alignItems: "center", gap: inset.gap, minWidth }}>
          <Icon name="sparkles" size={inset.icon} color={`${tint}aa`} />
          {/* Stretched, the sparkles go out to the ends. */}
          <View style={{ flexShrink: 1, flexGrow: minWidth ? 1 : 0 }}>{children}</View>
          <Icon name="sparkles" size={inset.icon} color={`${tint}aa`} />
        </View>
      );
    default:
      return <View style={{ flexShrink: 1 }}>{children}</View>;
  }
}
