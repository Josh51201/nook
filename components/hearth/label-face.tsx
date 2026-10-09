import { useState } from "react";
import { View, type TextStyle } from "react-native";
import Svg, { Path } from "react-native-svg";

import { labelFamily } from "../../lib/fonts";
import { deepColor, labelIsBold, type LabelItem } from "../../lib/hearth-layout";
import { currentFont } from "../../lib/theme";
import { Icon } from "../icon";
import { Text } from "../text";

// Text on the Hearth (CORE-009, CORE-076): a title, heading or caption in
// its own font, with an optional cozy decoration — an underline, a soft
// pill, a stitched patch, a ribbon, a little wooden sign or a flourish.
// Slim text (half a row) sits in the middle of its space; taller text sits
// at the bottom, like a heading over what comes next.

type Theme = { text: string; muted: string; accent: string; background: string };

const baseSize = { title: 30, heading: 19, caption: 14 } as const;
const WOOD = "#a87650";
const WOOD_DARK = "#7c5236";
const CREAM = "#fff7ec";

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
  const decor = item.decor ?? "none";
  const boxed = decor === "pill" || decor === "stitched" || decor === "ribbon" || decor === "sign";
  const padV = boxed ? 4 : 1;
  // Never taller than the space allows.
  const room = Math.max(10, (height - padV * 2 - (decor === "underline" ? 6 : 0)) / 1.25);
  const fontSize = Math.min(item.caps ? baseSize[item.size] * 0.8 : baseSize[item.size], room);
  const tint = decor === "sign" ? CREAM : item.color ? deepColor(item.color) : item.size === "caption" ? theme.muted : theme.text;
  const weight = labelIsBold(item) ? 800 : item.size === "caption" ? 500 : 600;
  const family = labelFamily(item.font, weight, currentFont());
  const textStyle: TextStyle = {
    fontSize,
    lineHeight: fontSize * 1.2,
    color: tint,
    textAlign: item.align,
    letterSpacing: item.caps ? 1.4 : item.size === "title" ? -0.5 : 0,
    textTransform: item.caps ? "uppercase" : "none",
    ...(family ? { fontFamily: family } : { fontWeight: String(weight) as TextStyle["fontWeight"] }),
  };
  const slim = height < 50;
  const lines = slim ? 1 : 2;

  if (item.divider) {
    const line = item.color ? deepColor(item.color) : theme.text;
    return (
      <View style={{ width, height, flexDirection: "row", alignItems: slim ? "center" : "flex-end", gap: 10, paddingHorizontal: 4, paddingBottom: slim ? 0 : 4 }}>
        <Text numberOfLines={1} style={[textStyle, { flexShrink: 1, color: line }]}>
          {item.text}
        </Text>
        <View style={{ flex: 1, height: 2, borderRadius: 1, backgroundColor: `${line}33` }} />
        {folded && hiddenCount ? <Text style={{ color: theme.muted, fontSize: 13 }}>{hiddenCount} hidden</Text> : null}
        <View style={{ transform: [{ rotate: folded ? "0deg" : "90deg" }] }}>
          <Icon name="chevron" size={16} color={line} />
        </View>
      </View>
    );
  }

  const justify = item.align === "left" ? "flex-start" : item.align === "right" ? "flex-end" : "center";

  return (
    <View style={{ width, height, justifyContent: slim ? "center" : "flex-end", paddingHorizontal: 4, paddingBottom: slim ? 0 : 2 }}>
      <View style={{ flexDirection: "row", justifyContent: justify }}>
        <Decorated decor={decor} tint={tint} soft={item.color} accent={theme.accent} padV={padV}>
          <Text numberOfLines={lines} adjustsFontSizeToFit={slim} minimumFontScale={0.7} style={textStyle}>
            {item.text}
          </Text>
        </Decorated>
      </View>
    </View>
  );
}

function Decorated({
  decor,
  tint,
  soft,
  accent,
  padV,
  children,
}: {
  decor: NonNullable<LabelItem["decor"]>;
  tint: string;
  soft?: string;
  accent: string;
  padV: number;
  children: React.ReactNode;
}) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const fill = soft ?? `${accent}24`;

  switch (decor) {
    case "underline":
      return (
        <View style={{ flexShrink: 1, alignItems: "stretch" }}>
          {children}
          <View style={{ height: 3, borderRadius: 2, marginTop: 2, backgroundColor: `${tint}55`, marginHorizontal: 2 }} />
        </View>
      );
    case "pill":
      return (
        <View style={{ flexShrink: 1, paddingHorizontal: 14, paddingVertical: padV, borderRadius: 999, backgroundColor: fill }}>
          {children}
        </View>
      );
    case "stitched":
      return (
        <View
          style={{
            flexShrink: 1,
            paddingHorizontal: 14,
            paddingVertical: padV,
            borderRadius: 12,
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
        <View
          style={{ flexShrink: 1, paddingHorizontal: 22, paddingVertical: padV }}
          onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
        >
          {box.w ? (
            <Svg width={box.w} height={box.h} style={{ position: "absolute", left: 0, top: 0 }}>
              {/* A banner with notched tails. */}
              <Path
                d={`M0 0 H${box.w} L${box.w - 10} ${box.h / 2} L${box.w} ${box.h} H0 L10 ${box.h / 2} Z`}
                fill={soft ?? accent}
                opacity={soft ? 1 : 0.22}
              />
            </Svg>
          ) : null}
          {children}
        </View>
      );
    case "sign":
      return (
        <View
          style={{
            flexShrink: 1,
            paddingHorizontal: 18,
            paddingVertical: padV,
            borderRadius: 8,
            backgroundColor: soft ? deepColor(soft) : WOOD,
            borderBottomWidth: 3,
            borderBottomColor: WOOD_DARK,
            boxShadow: "0px 2px 4px rgba(60, 35, 15, 0.25)",
          }}
        >
          {/* Two little nails. */}
          <View style={{ position: "absolute", left: 6, top: "50%", marginTop: -2, width: 4, height: 4, borderRadius: 2, backgroundColor: CREAM, opacity: 0.7 }} />
          <View style={{ position: "absolute", right: 6, top: "50%", marginTop: -2, width: 4, height: 4, borderRadius: 2, backgroundColor: CREAM, opacity: 0.7 }} />
          {children}
        </View>
      );
    case "flourish":
      return (
        <View style={{ flexShrink: 1, flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Icon name="sparkles" size={14} color={`${tint}aa`} />
          <View style={{ flexShrink: 1 }}>{children}</View>
          <Icon name="sparkles" size={14} color={`${tint}aa`} />
        </View>
      );
    default:
      return <View style={{ flexShrink: 1 }}>{children}</View>;
  }
}
