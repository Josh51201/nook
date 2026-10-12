import { useEffect, type ReactNode } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

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

const FADE_ROWS = 28;

// The strip along the bottom that a bar sits on (CORE-094): it's painted like
// the page (the Hearth's color), fading in above the bar, so widgets melt away
// behind it instead of showing around and under it, the same as the top bar.
// It stays put and just fades in or out, so it never rebuilds (and flickers)
// as sheets and drags come and go.
export function BottomDock({
  visible,
  background,
  bottom,
  children,
}: {
  visible: boolean;
  background: string;
  // The gap under the bar (the screen's safe area, plus a little).
  bottom: number;
  children: ReactNode;
}) {
  const { width } = useWindowDimensions();
  const shown = useSharedValue(0);
  useEffect(() => {
    shown.value = withTiming(visible ? 1 : 0, { duration: 180 });
  }, [visible, shown]);
  const style = useAnimatedStyle(() => ({ opacity: shown.value }));
  return (
    <Animated.View style={[styles.dock, { paddingBottom: bottom }, style]} pointerEvents={visible ? "box-none" : "none"}>
      <View style={[StyleSheet.absoluteFill, { top: -FADE_ROWS }]} pointerEvents="none">
        <Svg width={width} height={FADE_ROWS}>
          <Defs>
            <LinearGradient id="dock-fade" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={background} stopOpacity={0} />
              <Stop offset="1" stopColor={background} stopOpacity={1} />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={width} height={FADE_ROWS} fill="url(#dock-fade)" />
        </Svg>
        <View style={{ flex: 1, backgroundColor: background }} />
      </View>
      <View style={styles.dockBar}>{children}</View>
    </Animated.View>
  );
}

type BarAction = { key: string; label: string; icon: IconName; onPress: () => void; disabled?: boolean };

export function EditBar({
  visible,
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
  visible: boolean;
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
    <BottomDock visible={visible} background={background} bottom={bottom}>
      <View
        style={[styles.bar, { backgroundColor: background, borderColor: `${text}22` }]}
        onLayout={(e) => onLayout?.(e.nativeEvent.layout.height)}
      >
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
    </BottomDock>
  );
}

// Pasting a look (CORE-097): while it's showing, tapping things gives them
// the copied look, one tap each, until Done.
export function PaintBar({
  visible,
  look,
  accent,
  background,
  text,
  bottom,
  onDone,
}: {
  visible: boolean;
  look: Look;
  accent: string;
  background: string;
  text: string;
  bottom: number;
  onDone: () => void;
}) {
  const swatchColor = look.color ?? tilePalette[0];
  return (
    <BottomDock visible={visible} background={background} bottom={bottom}>
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
    </BottomDock>
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
              <Text style={[ui.cardTitle, { fontWeight: "700" }]}>{tool.label}</Text>
              <Text style={ui.muted}>{tool.hint}</Text>
            </View>
          </Tap>
        ))}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  dock: { position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 40 },
  dockBar: { marginHorizontal: 16 },
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
