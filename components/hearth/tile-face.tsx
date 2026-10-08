import { StyleSheet, View } from "react-native";
import { Text } from "../text";

import { deepColor, itemColor, nookLabel, tileBevel, type NookItem } from "../../lib/hearth";
import { findNook } from "../../lib/nooks";
import { IconBadge } from "../icon";
import { nookWidgets } from "./nook-widgets";

const TEXT = "#2a2420";
const MUTED = "#6f625a";

// A Nook tile at whatever grid size it's been given (CORE-007/019): a lone
// icon at 1×1, icon + name (and what's next) when small, a row when wide,
// and room for the Nook's own live info in a panel (CORE-010) when big.
// Its icon and look — soft, bold or outline — are the person's to pick
// (CORE-030).
export function TileFace({
  item,
  width,
  height,
  refreshKey,
  themeText = TEXT,
}: {
  item: NookItem;
  width: number;
  height: number;
  refreshKey: number;
  themeText?: string;
}) {
  const nook = findNook(item.nookId);
  const widget = nookWidgets[item.nookId];
  const Widget = widget?.Component;
  const label = nookLabel(item);
  const icon = item.icon ?? nook?.icon ?? "category";
  const soft = itemColor(item);
  const look = item.look ?? "soft";

  // Colors for this look. The deep color is the chosen color's partner, or
  // the Nook's own icon color if no color was picked.
  const bold = look === "bold";
  const outline = look === "outline";
  const tileDeep = item.color ? deepColor(item.color) : nook?.iconColor ?? deepColor(soft);
  const text = bold ? "#ffffff" : outline ? themeText : TEXT;
  const muted = bold ? "rgba(255,255,255,0.8)" : outline ? `${themeText}99` : MUTED;
  const iconColor = bold ? "#ffffff" : item.color ? deepColor(item.color) : nook?.iconColor ?? MUTED;
  const badge = bold ? "rgba(255,255,255,0.2)" : outline ? `${tileDeep}18` : "rgba(255,255,255,0.65)";
  const panel = bold ? "rgba(255,255,255,0.15)" : outline ? `${tileDeep}10` : "rgba(255,255,255,0.58)";
  const frame = [
    styles.tile,
    { width, height },
    bold && { backgroundColor: tileDeep, boxShadow: tileBevel },
    look === "soft" && { backgroundColor: soft, boxShadow: tileBevel },
    outline && { borderWidth: 2, borderColor: tileDeep, backgroundColor: "transparent" },
  ];
  const widgetProps = { refreshKey, textColor: text, mutedColor: muted, accentColor: bold ? "#ffffff" : tileDeep };

  if (item.w === 1 || item.h === 1) {
    const size = Math.min(width, height) * 0.62;
    return (
      <View style={[frame, styles.iconOnly]}>
        <IconBadge name={icon} size={size} color={iconColor} background={badge} />
        {item.h === 1 && item.w > 1 ? (
          <Text style={[styles.title, { flex: 1, color: text }]} numberOfLines={1}>
            {label}
          </Text>
        ) : null}
      </View>
    );
  }

  const wide = item.w >= 3;
  const tall = item.h >= 3;

  return (
    <View style={frame}>
      {tall ? (
        <View style={{ flex: 1, gap: 12 }}>
          <View style={styles.row}>
            <IconBadge name={icon} size={52} color={iconColor} background={badge} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { fontSize: 19, color: text }]} numberOfLines={1}>
                {label}
              </Text>
              <Text style={[styles.tagline, { color: muted }]}>{nook?.tagline}</Text>
            </View>
          </View>
          {Widget ? (
            <View style={[styles.widgetArea, { backgroundColor: panel }]}>
              <Text style={[styles.widgetLabel, { color: muted }]}>{widget.label}</Text>
              <Widget size="large" {...widgetProps} />
            </View>
          ) : null}
        </View>
      ) : wide ? (
        <View style={[styles.row, { flex: 1 }]}>
          <IconBadge name={icon} size={52} color={iconColor} background={badge} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[styles.title, { color: text }]} numberOfLines={1}>
              {label}
            </Text>
            {Widget ? (
              <Widget size="wide" {...widgetProps} />
            ) : (
              <Text style={[styles.tagline, { color: muted }]}>{nook?.tagline}</Text>
            )}
          </View>
        </View>
      ) : (
        <View style={{ flex: 1, justifyContent: "space-between" }}>
          <IconBadge name={icon} size={46} color={iconColor} background={badge} />
          <View style={{ gap: 2 }}>
            <Text style={[styles.title, { color: text }]} numberOfLines={2}>
              {label}
            </Text>
            {Widget ? <Widget size="small" {...widgetProps} /> : null}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    borderRadius: 24,
    padding: 14,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.06)",
  },
  iconOnly: { padding: 8, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  title: { fontSize: 16, fontWeight: "700", color: TEXT },
  tagline: { fontSize: 13, color: MUTED },
  widgetArea: {
    flex: 1,
    borderRadius: 16,
    padding: 12,
    gap: 8,
  },
  widgetLabel: { fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.6 },
});
