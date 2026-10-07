import { StyleSheet, Text, View } from "react-native";

import { tileColor, tileLabel, type HearthTile } from "../../lib/hearth";
import { findNook } from "../../lib/nooks";
import { Icon, IconBadge } from "../icon";
import { nookWidgets } from "./nook-widgets";

const TEXT = "#2a2420";
const MUTED = "#6f625a";
const BADGE = "rgba(255,255,255,0.65)";

// What a Hearth tile looks like at each size. Small = icon + name; Wide and
// Large have room for the Nook's live widget.
export function TileFace({
  tile,
  width,
  height,
  editing,
  refreshKey,
}: {
  tile: HearthTile;
  width: number;
  height: number;
  editing: boolean;
  refreshKey: number;
}) {
  const nook = findNook(tile.nookId);
  const Widget = nookWidgets[tile.nookId];
  const label = tileLabel(tile);
  const icon = nook?.icon ?? "category";
  const iconColor = nook?.iconColor ?? MUTED;

  return (
    <View style={[styles.tile, { width, height, backgroundColor: tileColor(tile) }]}>
      {tile.size === "small" ? (
        <View style={styles.small}>
          <IconBadge name={icon} size={48} color={iconColor} background={BADGE} />
          <Text style={styles.titleSmall} numberOfLines={2}>
            {label}
          </Text>
        </View>
      ) : tile.size === "wide" ? (
        <View style={styles.wide}>
          <IconBadge name={icon} size={54} color={iconColor} background={BADGE} />
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
        <View style={styles.large}>
          <View style={styles.largeHeader}>
            <IconBadge name={icon} size={56} color={iconColor} background={BADGE} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { fontSize: 20 }]} numberOfLines={1}>
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
      )}
      {editing ? (
        <View style={styles.editBadge}>
          <Icon name="more" size={14} color={MUTED} />
        </View>
      ) : null}
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
  small: { flex: 1, justifyContent: "space-between" },
  wide: { flex: 1, flexDirection: "row", alignItems: "center", gap: 14 },
  large: { flex: 1, gap: 12 },
  largeHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  titleSmall: { fontSize: 16, fontWeight: "700", color: TEXT },
  title: { fontSize: 17, fontWeight: "700", color: TEXT },
  tagline: { fontSize: 13, color: MUTED },
  widgetArea: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.55)",
    borderRadius: 16,
    padding: 12,
    gap: 8,
  },
  widgetLabel: { fontSize: 11, fontWeight: "800", color: MUTED, textTransform: "uppercase", letterSpacing: 0.6 },
  editBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.8)",
    alignItems: "center",
    justifyContent: "center",
  },
});
