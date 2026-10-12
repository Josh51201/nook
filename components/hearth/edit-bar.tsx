import { StyleSheet, View } from "react-native";
import Animated, { FadeInDown, FadeOutDown } from "react-native-reanimated";

import { deepColor, tilePalette } from "../../lib/hearth-layout";
import type { Look } from "../../lib/hearth-looks";
import { ui } from "../../lib/theme";
import { BottomSheet } from "../bottom-sheet";
import { Icon, type IconName } from "../icon";
import { Tap } from "../motion";
import { Text } from "../text";

// Edit mode's toolbar (CORE-094): docked along the bottom so the Hearth
// stays where it is, with Undo and Redo (CORE-095) and the tools used most;
// the rest wait under More.

type BarAction = { key: string; label: string; icon: IconName; onPress: () => void; disabled?: boolean };

export function EditBar({
  accent,
  background,
  text,
  bottom,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onAdd,
  onDecorate,
  onPages,
  onTidy,
  onMore,
  onLayout,
}: {
  accent: string;
  background: string;
  text: string;
  bottom: number;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onAdd: () => void;
  onDecorate: () => void;
  // Pages on the Hearth; inside a Hollow (which has just the one) Tidy up.
  onPages?: () => void;
  onTidy: () => void;
  onMore: () => void;
  onLayout?: (height: number) => void;
}) {
  const actions: BarAction[] = [
    { key: "undo", label: "Undo", icon: "undo", onPress: onUndo, disabled: !canUndo },
    { key: "redo", label: "Redo", icon: "redo", onPress: onRedo, disabled: !canRedo },
    { key: "add", label: "Add", icon: "add", onPress: onAdd },
    { key: "decorate", label: "Decorate", icon: "palette", onPress: onDecorate },
    onPages
      ? { key: "pages", label: "Pages", icon: "widgets", onPress: onPages }
      : { key: "tidy", label: "Tidy up", icon: "tidy", onPress: onTidy },
    { key: "more", label: "More", icon: "more", onPress: onMore },
  ];
  return (
    <Animated.View
      entering={FadeInDown.duration(200)}
      exiting={FadeOutDown.duration(150)}
      style={[styles.wrap, { bottom }]}
      pointerEvents="box-none"
      onLayout={(e) => onLayout?.(e.nativeEvent.layout.height)}
    >
      <View style={[styles.bar, { backgroundColor: background, borderColor: `${text}22` }]}>
        {actions.map((a, i) => (
          <View key={a.key} style={styles.slot}>
            {i === 2 ? <View style={[styles.divider, { backgroundColor: `${text}1f` }]} /> : null}
            <Tap
              onPress={a.onPress}
              disabled={a.disabled}
              pressedScale={0.9}
              hitSlop={4}
              style={styles.action}
              accessibilityRole="button"
              accessibilityLabel={a.label}
              accessibilityState={{ disabled: a.disabled }}
            >
              <Icon name={a.icon} size={21} color={accent} />
              <Text style={{ color: text, fontSize: 11.5, fontWeight: "600" }} numberOfLines={1}>
                {a.label}
              </Text>
            </Tap>
          </View>
        ))}
      </View>
    </Animated.View>
  );
}

// Pasting a look (CORE-097): while it's showing, tapping things gives them
// the copied look, one tap each, until Done.
export function PaintBar({
  look,
  accent,
  background,
  text,
  bottom,
  onDone,
}: {
  look: Look;
  accent: string;
  background: string;
  text: string;
  bottom: number;
  onDone: () => void;
}) {
  const swatchColor = look.color ?? tilePalette[0];
  return (
    <Animated.View entering={FadeInDown.duration(200)} exiting={FadeOutDown.duration(150)} style={[styles.wrap, { bottom }]} pointerEvents="box-none">
      <View style={[styles.bar, styles.paint, { backgroundColor: background, borderColor: `${text}22` }]}>
        {look.kind === "text" ? (
          <View style={[styles.swatch, { borderColor: `${text}22`, backgroundColor: `${accent}12` }]}>
            <Text style={{ color: look.color ?? text, fontWeight: look.bold === false ? "500" : "800", fontSize: 17 }}>Aa</Text>
          </View>
        ) : (
          <View
            style={[
              styles.swatch,
              {
                backgroundColor: look.kind === "tile" && look.style === "outline" ? "transparent" : look.kind === "tile" && look.style === "bold" ? deepColor(swatchColor) : swatchColor,
                borderColor: look.kind === "tile" && (look.border || look.style === "outline") ? deepColor(swatchColor) : `${text}22`,
                borderRadius: look.kind === "tile" && look.corners === "square" ? 4 : look.kind === "tile" && look.corners === "round" ? 18 : 11,
              },
            ]}
          />
        )}
        <View style={{ flex: 1 }}>
          <Text style={{ color: text, fontWeight: "800" }}>Pasting a look</Text>
          <Text style={{ color: text, opacity: 0.75, fontSize: 13 }}>Tap things to give them this look.</Text>
        </View>
        <Tap onPress={onDone} hitSlop={10} accessibilityRole="button">
          <Text style={{ color: accent, fontWeight: "800" }}>Done</Text>
        </Tap>
      </View>
    </Animated.View>
  );
}

export type MoreTool ={ key: string; label: string; hint: string; icon: IconName; onPress: () => void };

// Everything else in Edit, with a word on what each does.
export function EditMoreSheet({
  visible,
  onClose,
  tools,
  accent,
}: {
  visible: boolean;
  onClose: () => void;
  tools: MoreTool[];
  accent: string;
}) {
  return (
    <BottomSheet visible={visible} onClose={onClose} header={<Text style={[ui.sectionTitle, { marginTop: 0 }]}>More tools</Text>}>
      <View style={{ gap: 4, paddingBottom: 24 }}>
        {tools.map((tool) => (
          <Tap
            key={tool.key}
            onPress={() => {
              onClose();
              tool.onPress();
            }}
            pressedScale={0.98}
            style={styles.row}
            accessibilityRole="button"
            accessibilityLabel={tool.label}
            accessibilityHint={tool.hint}
          >
            <View style={[styles.rowIcon, { backgroundColor: `${accent}1f` }]}>
              <Icon name={tool.icon} size={18} color={accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: "700", fontSize: 16 }}>{tool.label}</Text>
              <Text style={ui.muted}>{tool.hint}</Text>
            </View>
          </Tap>
        ))}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 16, right: 16, zIndex: 40 },
  bar: {
    flexDirection: "row",
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 8,
    boxShadow: "0px 8px 24px rgba(0,0,0,0.18)",
  },
  slot: { flex: 1, flexDirection: "row", alignItems: "center" },
  divider: { width: 1, height: 30, marginRight: 2 },
  action: { flex: 1, alignItems: "center", gap: 3, paddingVertical: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  paint: { alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  swatch: { width: 40, height: 40, borderWidth: 2, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  rowIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
});
