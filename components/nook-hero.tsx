import { StyleSheet, View } from "react-native";
import { Text } from "./text";

import { colors, themed } from "../lib/theme";
import { Icon, type IconName } from "./icon";
import { Appear } from "./motion";

// The warm header at the top of a Nook's home (CORE-033): the Nook's icon
// glowing in its own color, a headline about what's next, and a few quick
// facts — so each Nook greets you like the Hearth does, instead of opening
// straight onto a list.
export function NookHero({
  icon,
  accent,
  tint,
  headline,
  facts,
}: {
  icon: IconName;
  // The Nook's deep color (its icon color) and soft color (its tile color).
  accent: string;
  tint: string;
  headline: string;
  facts: { icon: IconName; text: string }[];
}) {
  const background = colors.dark ? `${accent}26` : tint;
  return (
    <Appear>
      <View style={[styles.hero, { backgroundColor: background }]}>
        {/* A big, faint copy of the icon tucked in the corner. */}
        <View style={styles.watermark} pointerEvents="none">
          <Icon name={icon} size={132} color={accent} />
        </View>
        <View style={[styles.badge, { boxShadow: `0px 0px 22px 4px ${accent}55, inset 0px 1.5px 0px rgba(255,255,255,0.5)` }]}>
          <Icon name={icon} size={30} color={accent} />
        </View>
        <View style={{ flex: 1, gap: 6 }}>
          {/* Nothing here is cut short: on a narrow phone or with big text
              the lines wrap instead of trailing off into "…". */}
          <Text style={styles.headline}>{headline}</Text>
          {facts.map((fact) => (
            <View key={fact.text} style={styles.fact}>
              <View style={styles.factIcon}>
                <Icon name={fact.icon} size={14} color={accent} />
              </View>
              <Text style={styles.factText}>{fact.text}</Text>
            </View>
          ))}
        </View>
      </View>
    </Appear>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    hero: {
      flexDirection: "row",
      alignItems: "center",
      gap: 16,
      padding: 18,
      borderRadius: 24,
      overflow: "hidden",
      boxShadow: colors.dark
        ? "0px 10px 24px -14px rgba(0,0,0,0.7)"
        : `0px 10px 24px -14px rgba(${colors.shade}, 0.35), inset 0px 1.5px 0px rgba(255,255,255,0.55)`,
    },
    watermark: { position: "absolute", right: -26, bottom: -30, opacity: 0.09, transform: [{ rotate: "-12deg" }] },
    badge: {
      width: 60,
      height: 60,
      borderRadius: 22,
      backgroundColor: colors.dark ? colors.surface : "rgba(255,255,255,0.72)",
      alignItems: "center",
      justifyContent: "center",
    },
    headline: { fontSize: 19, fontWeight: "800", color: colors.text, letterSpacing: -0.3 },
    // Icons line up with the first line when a fact wraps onto two.
    fact: { flexDirection: "row", alignItems: "flex-start", gap: 7 },
    factIcon: { height: 20, justifyContent: "center" },
    factText: { fontSize: 14, lineHeight: 20, color: colors.text, opacity: 0.8, flex: 1, flexShrink: 1 },
  })
);
