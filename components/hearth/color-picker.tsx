import { useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { ZoomIn } from "react-native-reanimated";
import { Text } from "../text";

import { hexToHsl, pickerColor, pickerGreys, pickerHues, pickerTiers } from "../../lib/colors";
import { tap } from "../../lib/feedback";
import { deepColor, tilePalette } from "../../lib/hearth-layout";
import { colors, themed } from "../../lib/theme";
import { Icon } from "../icon";
import { Tap } from "../motion";
import { Chip } from "../ui";

// Pick any color (CORE-042): the seven classic tints, then "More colors" for
// every hue in three strengths, plus greys. What's saved is always a soft tint
// that works with dark text; its deeper partner (Bold looks, icons, outlines)
// is worked out from it. `deep` shows each swatch in its deep form, for things
// like text that are drawn in the deep color.
export function ColorPicker({
  value,
  onChange,
  deep = false,
  fallback = tilePalette[0],
}: {
  value: string | undefined;
  onChange: (color: string) => void;
  deep?: boolean;
  // What's shown as selected when nothing has been picked yet.
  fallback?: string;
}) {
  const current = (value ?? fallback).toLowerCase();
  const isClassic = tilePalette.includes(current);
  const [more, setMore] = useState(!isClassic);
  const [tier, setTier] = useState(() => {
    if (isClassic) return 1;
    const { l } = hexToHsl(current);
    return l > 0.88 ? 0 : l > 0.81 ? 1 : 2;
  });

  function swatch(color: string, label?: string) {
    const selected = current === color.toLowerCase();
    const shown = deep ? deepColor(color) : color;
    return (
      <Tap
        key={color}
        pressedScale={0.85}
        onPress={() => {
          tap();
          onChange(color);
        }}
        style={[styles.swatch, { backgroundColor: shown }, selected && styles.selected]}
        accessibilityLabel={`${label ?? "Color"}${selected ? ", selected" : ""}`}
      >
        {selected ? (
          <Animated.View entering={ZoomIn.duration(160)}>
            <Icon name="check" size={16} color={deep ? "#ffffff" : colors.bark} />
          </Animated.View>
        ) : null}
      </Tap>
    );
  }

  return (
    <View style={{ gap: 10 }}>
      <View style={styles.row}>{tilePalette.map((color) => swatch(color))}</View>
      <Chip icon="palette" selected={more} onPress={() => setMore((m) => !m)}>
        {more ? "Fewer colors" : "More colors"}
      </Chip>
      {more ? (
        <View style={{ gap: 10 }}>
          <View style={styles.row}>
            {pickerTiers.map((t, i) => (
              <Chip key={t.label} selected={tier === i} onPress={() => setTier(i)}>
                {t.label}
              </Chip>
            ))}
          </View>
          <View style={styles.row}>{pickerHues.map((hue) => swatch(pickerColor(hue, tier), `Hue ${hue}`))}</View>
          <View style={styles.row}>{pickerGreys.map((grey) => swatch(grey, "Grey"))}</View>
          <Text style={styles.hint}>
            Want it deeper? Pick the Bold style and the color turns rich and dark.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    swatch: {
      width: 36,
      height: 36,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: "rgba(0,0,0,0.08)",
      alignItems: "center",
      justifyContent: "center",
    },
    selected: { borderWidth: 2.5, borderColor: colors.bark },
    hint: { fontSize: 13, color: colors.muted },
  })
);
