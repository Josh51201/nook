import { StyleSheet, Text, View } from "react-native";

import { tileColor, tileLabel, type HearthTile } from "../../lib/hearth";
import { findNook } from "../../lib/nooks";
import { nookWidgets } from "./nook-widgets";

const TEXT = "#2a2420";
const MUTED = "#6f625a";

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

  return (
    <View
      style={[
        styles.tile,
        { width, height, backgroundColor: tileColor(tile) },
        editing && styles.editing,
      ]}
    >
      {tile.size === "small" ? (
        <View style={styles.centered}>
          <Text style={styles.emojiSmall}>{nook?.emoji}</Text>
          <Text style={styles.titleSmall} numberOfLines={2}>
            {label}
          </Text>
        </View>
      ) : tile.size === "wide" ? (
        <View style={styles.wide}>
          <Text style={styles.emojiWide}>{nook?.emoji}</Text>
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
            <Text style={styles.emojiLarge}>{nook?.emoji}</Text>
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
      {editing ? <Text style={styles.editBadge}>•••</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { borderRadius: 18, padding: 14, overflow: "hidden" },
  editing: { borderWidth: 2, borderColor: "rgba(0,0,0,0.15)", borderStyle: "dashed" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 6 },
  wide: { flex: 1, flexDirection: "row", alignItems: "center", gap: 14 },
  large: { flex: 1, gap: 12 },
  largeHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  emojiSmall: { fontSize: 34 },
  emojiWide: { fontSize: 38 },
  emojiLarge: { fontSize: 44 },
  titleSmall: { fontSize: 15, fontWeight: "600", color: TEXT, textAlign: "center" },
  title: { fontSize: 17, fontWeight: "700", color: TEXT },
  tagline: { fontSize: 13, color: MUTED },
  widgetArea: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.5)",
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  widgetLabel: { fontSize: 12, fontWeight: "700", color: MUTED, textTransform: "uppercase" },
  editBadge: {
    position: "absolute",
    top: 6,
    right: 10,
    fontSize: 16,
    fontWeight: "900",
    color: MUTED,
  },
});
