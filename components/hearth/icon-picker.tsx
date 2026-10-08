import { StyleSheet, View } from "react-native";
import { Text } from "../text";
import Animated, { ZoomIn } from "react-native-reanimated";

import { tap } from "../../lib/feedback";
import { colors, themed, ui } from "../../lib/theme";
import { Icon, type IconName } from "../icon";
import { Tap } from "../motion";

// Icons a person can choose for their own tiles and widgets (CORE-030).
export const pickableIcons: IconName[] = [
  "hearth", "burrow", "heart", "star", "sparkles", "flame", "sun", "moon",
  "leaf", "tree", "flower", "paw", "coffee", "cookie", "food", "potluck",
  "gift", "tucks", "cart", "money", "calendar", "bell", "todo", "edit",
  "books", "school", "work", "music", "camera", "game", "gamepad", "bike",
  "car", "plane", "sailboat", "globe", "dumbbell", "pill", "drop", "bolt",
  "cloud", "umbrella", "phone", "mail", "key", "paint", "baby", "church",
];

// A grid of icons to pick from, plus "Usual" to go back to the default.
export function IconPicker({
  value,
  fallback,
  onChange,
}: {
  value: IconName | undefined;
  // The icon shown when nothing is picked.
  fallback: IconName;
  onChange: (icon: IconName | undefined) => void;
}) {
  function pick(icon: IconName | undefined) {
    tap();
    onChange(icon);
  }
  return (
    <View style={{ gap: 8 }}>
      <Tap onPress={() => pick(undefined)} style={[ui.row, styles.usual, !value && styles.selected]}>
        <Icon name={fallback} size={18} color={value ? colors.bark : colors.onAccent} />
        <Text style={[ui.secondaryButtonText, !value && { color: colors.onAccent }]}>Usual icon</Text>
      </Tap>
      <View style={styles.grid}>
        {pickableIcons.map((icon) => {
          const selected = value === icon;
          return (
            <Tap
              key={icon}
              onPress={() => pick(icon)}
              pressedScale={0.85}
              style={[styles.cell, selected && styles.selected]}
              accessibilityLabel={`Use the ${icon} icon`}
              accessibilityState={{ selected }}
            >
              {selected ? (
                <Animated.View entering={ZoomIn.duration(160)}>
                  <Icon name={icon} size={22} color={colors.onAccent} />
                </Animated.View>
              ) : (
                <Icon name={icon} size={22} />
              )}
            </Tap>
          );
        })}
      </View>
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    cell: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor: colors.barkSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    usual: {
      alignSelf: "flex-start",
      gap: 8,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 12,
      backgroundColor: colors.barkSoft,
    },
    selected: { backgroundColor: colors.bark },
  })
);
