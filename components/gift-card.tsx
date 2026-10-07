import type { ReactNode } from "react";
import { Image, Linking, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { displayName, formatPrice, normalizeUrl, shelfFields, type Gift } from "../lib/gift-nook";
import { colors, ui } from "../lib/theme";

// One gift, as shown on any Wishbook. `footer` is where a family member's
// view adds Tuck controls; the owner's view passes nothing (GIFT-007).
// Suggestions never reach the owner's screens at all (RLS, GIFT-022).
export function GiftCard({
  gift,
  onPress,
  footer,
}: {
  gift: Gift;
  onPress?: () => void;
  footer?: ReactNode;
}) {
  const fields = shelfFields[gift.shelves?.key ?? ""] ?? [];
  const answered = fields.filter((field) => gift.details?.[field.key]);

  return (
    <TouchableOpacity style={ui.card} onPress={onPress} disabled={!onPress} activeOpacity={0.7}>
      <View style={styles.header}>
        {gift.image_url ? (
          <Image source={{ uri: gift.image_url }} style={styles.image} resizeMode="contain" />
        ) : null}
        <View style={{ flex: 1, gap: 4 }}>
          <View style={styles.titleRow}>
            <Text style={[ui.cardTitle, { flex: 1 }]}>{gift.title}</Text>
            <Text style={styles.badge}>{gift.is_repeatable ? "Many can give" : "One-and-done"}</Text>
          </View>
          <Text style={ui.muted}>
            {gift.is_most_wanted ? <Text style={styles.mostWanted}>❤️ Most wanted · </Text> : null}
            {gift.shelves?.label ?? "Other"}
            {gift.price != null ? ` · ${formatPrice(gift.price)}` : ""}
          </Text>
          {gift.suggested_by ? (
            <Text style={styles.suggested}>💡 Suggested by {displayName(gift.suggester)} · hidden from them</Text>
          ) : null}
        </View>
      </View>
      {answered.map((field) => (
        <Text key={field.key} style={styles.detail}>
          {field.label}: {gift.details[field.key]}
        </Text>
      ))}
      {gift.notes ? <Text style={styles.detail}>{gift.notes}</Text> : null}
      {gift.url ? (
        <Text style={ui.link} numberOfLines={1} onPress={() => Linking.openURL(normalizeUrl(gift.url!))}>
          🔗 Open link
        </Text>
      ) : null}
      {footer}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  titleRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  image: { width: 64, height: 64, borderRadius: 10, backgroundColor: colors.white },
  badge: {
    fontSize: 11,
    color: colors.bark,
    borderWidth: 1,
    borderColor: colors.bark,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: "hidden",
  },
  mostWanted: { color: "#b03a48", fontWeight: "700" },
  suggested: { fontSize: 13, color: colors.bark, fontStyle: "italic" },
  detail: { fontSize: 14, color: colors.text },
});
