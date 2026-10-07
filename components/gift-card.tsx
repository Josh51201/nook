import { Image } from "expo-image";
import type { ReactNode } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";

import {
  displayName,
  formatPrice,
  normalizeUrl,
  shelfFields,
  shelfIcons,
  type Gift,
} from "../lib/gift-nook";
import { colors, ui } from "../lib/theme";
import { Icon, IconBadge } from "./icon";
import { Appear, Tap } from "./motion";

// One gift, as shown on any Wishbook. `footer` is where a family member's
// view adds Tuck controls; the owner's view passes nothing (GIFT-007).
// Suggestions never reach the owner's screens at all (RLS, GIFT-022).
export function GiftCard({
  gift,
  onPress,
  footer,
  index = 0,
}: {
  gift: Gift;
  onPress?: () => void;
  footer?: ReactNode;
  index?: number;
}) {
  const fields = shelfFields[gift.shelves?.key ?? ""] ?? [];
  const answered = fields.filter((field) => gift.details?.[field.key]);

  return (
    <Appear index={index}>
      <Tap style={[ui.card, { gap: 8 }]} onPress={onPress} disabled={!onPress} pressedScale={0.985}>
        <View style={styles.header}>
          {gift.image_url ? (
            <Image
              source={{ uri: gift.image_url }}
              style={styles.image}
              contentFit="contain"
              transition={250}
            />
          ) : (
            <IconBadge name={shelfIcons[gift.shelves?.key ?? ""] ?? "category"} size={52} />
          )}
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={ui.cardTitle}>{gift.title}</Text>
            <Text style={ui.muted}>
              {gift.shelves?.label ?? "Other"}
              {gift.price != null ? `  ·  ${formatPrice(gift.price)}` : ""}
            </Text>
            <View style={[ui.row, { flexWrap: "wrap", gap: 6, marginTop: 2 }]}>
              {gift.is_most_wanted ? (
                <View style={[styles.pill, { backgroundColor: "#fbe3e7" }]}>
                  <Icon name="heart" size={11} color={colors.heart} />
                  <Text style={[styles.pillText, { color: colors.heart }]}>Most wanted</Text>
                </View>
              ) : null}
              <View style={styles.pill}>
                <Text style={styles.pillText}>{gift.is_repeatable ? "Many can give" : "One-and-done"}</Text>
              </View>
            </View>
          </View>
        </View>

        {gift.suggested_by ? (
          <View style={[ui.row, { gap: 6 }]}>
            <Icon name="suggest" size={14} />
            <Text style={styles.suggested}>
              Suggested by {displayName(gift.suggester)} · hidden from them
            </Text>
          </View>
        ) : null}
        {answered.length ? (
          <Text style={styles.detail}>
            {answered.map((field) => `${field.label}: ${gift.details[field.key]}`).join("   ·   ")}
          </Text>
        ) : null}
        {gift.notes ? <Text style={styles.detail}>{gift.notes}</Text> : null}
        {gift.url ? (
          <Tap
            onPress={() => Linking.openURL(normalizeUrl(gift.url!))}
            style={[ui.row, { gap: 6, alignSelf: "flex-start" }]}
            hitSlop={8}
            accessibilityLabel="Open the gift's link"
          >
            <Icon name="link" size={14} />
            <Text style={ui.link}>Open link</Text>
          </Tap>
        ) : null}
        {footer}
      </Tap>
    </Appear>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  image: { width: 64, height: 64, borderRadius: 14, backgroundColor: colors.white },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.barkSoft,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  pillText: { fontSize: 11, fontWeight: "600", color: colors.bark },
  suggested: { fontSize: 13, color: colors.bark, fontStyle: "italic", flex: 1 },
  detail: { fontSize: 14, color: colors.text, lineHeight: 20 },
});
