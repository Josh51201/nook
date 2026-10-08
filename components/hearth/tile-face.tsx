import { StyleSheet, Text, View } from "react-native";

import { itemColor, nookLabel, tileBevel, type NookItem } from "../../lib/hearth";
import { findNook } from "../../lib/nooks";
import { IconBadge } from "../icon";
import { nookWidgets } from "./nook-widgets";

const TEXT = "#2a2420";
const MUTED = "#6f625a";
const BADGE = "rgba(255,255,255,0.65)";

// A Nook tile at whatever grid size it's been given (CORE-007/019): a lone
// icon at 1×1, icon + name when small, a row when wide, and room for the
// Nook's own live info (CORE-010) when it's big.
export function TileFace({
  item,
  width,
  height,
  refreshKey,
}: {
  item: NookItem;
  width: number;
  height: number;
  refreshKey: number;
}) {
  const nook = findNook(item.nookId);
  const Widget = nookWidgets[item.nookId];
  const label = nookLabel(item);
  const icon = nook?.icon ?? "category";
  const iconColor = nook?.iconColor ?? MUTED;
  const background = itemColor(item);

  if (item.w === 1 || item.h === 1) {
    const size = Math.min(width, height) * 0.62;
    return (
      <View style={[styles.tile, styles.iconOnly, { width, height, backgroundColor: background }]}>
        <IconBadge name={icon} size={size} color={iconColor} background={BADGE} />
        {item.h === 1 && item.w > 1 ? (
          <Text style={[styles.title, { flex: 1 }]} numberOfLines={1}>
            {label}
          </Text>
        ) : null}
      </View>
    );
  }

  const wide = item.w >= 3;
  const tall = item.h >= 3;

  return (
    <View style={[styles.tile, { width, height, backgroundColor: background }]}>
      {tall ? (
        <View style={{ flex: 1, gap: 12 }}>
          <View style={styles.row}>
            <IconBadge name={icon} size={52} color={iconColor} background={BADGE} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { fontSize: 19 }]} numberOfLines={1}>
                {label}
              </Text>
              <Text style={styles.tagline}>{nook?.tagline}</Text>
            </View>
          </View>
          {Widget ? (
            <View style={styles.widgetArea}>
              <Text style={styles.widgetLabel}>Coming up</Text>
              <Widget size="large" refreshKey={refreshKey} textColor={TEXT} mutedColor={MUTED} />
            </View>
          ) : null}
        </View>
      ) : wide ? (
        <View style={[styles.row, { flex: 1 }]}>
          <IconBadge name={icon} size={52} color={iconColor} background={BADGE} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.title} numberOfLines={1}>
              {label}
            </Text>
            {Widget ? (
              <Widget size="wide" refreshKey={refreshKey} textColor={TEXT} mutedColor={MUTED} />
            ) : (
              <Text style={styles.tagline}>{nook?.tagline}</Text>
            )}
          </View>
        </View>
      ) : (
        <View style={{ flex: 1, justifyContent: "space-between" }}>
          <IconBadge name={icon} size={46} color={iconColor} background={BADGE} />
          <Text style={styles.title} numberOfLines={2}>
            {label}
          </Text>
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
    boxShadow: tileBevel,
  },
  iconOnly: { padding: 8, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  title: { fontSize: 16, fontWeight: "700", color: TEXT },
  tagline: { fontSize: 13, color: MUTED },
  widgetArea: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.55)",
    borderRadius: 16,
    padding: 12,
    gap: 8,
  },
  widgetLabel: { fontSize: 11, fontWeight: "800", color: MUTED, textTransform: "uppercase", letterSpacing: 0.6 },
});
