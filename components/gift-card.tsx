import type { ReactNode } from "react";
import { Linking, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { normalizeUrl, shelfFields, type Gift } from "../lib/gift-nook";
import { colors, ui } from "../lib/theme";

// One gift, as shown on any Wishbook. `footer` is where a family member's
// view adds Tuck controls; the owner's view passes nothing (GIFT-007).
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
        <Text style={[ui.cardTitle, { flex: 1 }]}>{gift.title}</Text>
        <Text style={styles.badge}>{gift.is_repeatable ? "Many can give" : "One-and-done"}</Text>
      </View>
      <Text style={ui.muted}>{gift.shelves?.label ?? "Other"}</Text>
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
  header: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
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
  detail: { fontSize: 14, color: colors.text },
});
