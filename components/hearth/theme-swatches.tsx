import { StyleSheet, View } from "react-native";
import Animated, { ZoomIn } from "react-native-reanimated";

import { hslToHex, pickerHues } from "../../lib/colors";
import { normalizeAccent } from "../../lib/custom-theme";
import { tap } from "../../lib/feedback";
import { colors, themed } from "../../lib/theme";
import { Icon } from "../icon";
import { Tap } from "../motion";

// Swatches for building a theme (CORE-043). Backgrounds and accents live in
// different ranges (a light theme wants a pale background and a deep accent,
// a dark theme the reverse), so each picker offers only colors that will
// read well.
type Mode = "background" | "accent";

const TONES: Record<"light" | "dark", Record<Mode, { s: number; l: number }[]>> = {
  light: {
    background: [
      { s: 0.5, l: 0.96 },
      { s: 0.45, l: 0.93 },
      { s: 0.42, l: 0.89 },
    ],
    accent: [
      { s: 0.55, l: 0.4 },
      { s: 0.6, l: 0.32 },
    ],
  },
  dark: {
    background: [
      { s: 0.3, l: 0.1 },
      { s: 0.3, l: 0.15 },
      { s: 0.28, l: 0.2 },
    ],
    accent: [
      { s: 0.7, l: 0.78 },
      { s: 0.65, l: 0.68 },
    ],
  },
};

const GREYS: Record<"light" | "dark", Record<Mode, string[]>> = {
  light: { background: ["#faf8f5", "#f1eeea", "#e6e2dd"], accent: ["#5a524c", "#3f3a36"] },
  dark: { background: ["#141414", "#1c1b1d", "#252427"], accent: ["#d6d0ca", "#b8b0a8"] },
};

// Accent swatches are shown as they'll really come out (bright yellows and
// greens deepened for contrast), so what you pick is what you get.
export function swatchRows(dark: boolean, mode: Mode) {
  const kind = dark ? "dark" : "light";
  return TONES[kind][mode].map((tone) => {
    const colors = pickerHues.map((hue) => {
      const hex = hslToHex(hue, tone.s, tone.l);
      return mode === "accent" ? normalizeAccent(hex, dark) : hex;
    });
    return [...new Set(colors)];
  });
}

export function ThemeSwatches({
  dark,
  mode,
  value,
  onChange,
}: {
  dark: boolean;
  mode: Mode;
  value: string;
  onChange: (color: string) => void;
}) {
  const current = value.toLowerCase();
  const rows = [...swatchRows(dark, mode), GREYS[dark ? "dark" : "light"][mode]];

  return (
    <View style={{ gap: 8 }}>
      {rows.map((row, i) => (
        <View key={i} style={styles.row}>
          {row.map((color) => {
            const selected = current === color.toLowerCase();
            return (
              <Tap
                key={color}
                pressedScale={0.85}
                onPress={() => {
                  tap();
                  onChange(color);
                }}
                style={[styles.swatch, { backgroundColor: color }, selected && styles.selected]}
                accessibilityLabel={selected ? "Selected color" : "Pick this color"}
              >
                {selected ? (
                  <Animated.View entering={ZoomIn.duration(160)}>
                    <Icon name="check" size={15} color={mode === "accent" && !dark ? "#ffffff" : dark && mode === "accent" ? "#241f2b" : colors.bark} />
                  </Animated.View>
                ) : null}
              </Tap>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    row: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
    swatch: {
      width: 30,
      height: 30,
      borderRadius: 15,
      borderWidth: 1,
      borderColor: "rgba(128,128,128,0.25)",
      alignItems: "center",
      justifyContent: "center",
    },
    selected: { borderWidth: 2.5, borderColor: colors.bark },
  })
);
