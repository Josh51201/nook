import { useMemo } from "react";
import { StyleSheet, View } from "react-native";

import { COLUMNS, deepColor, itemColor, type HearthItem } from "../../lib/hearth-layout";
import { starters, type StarterId } from "../../lib/hearth-starters";
import { findNook } from "../../lib/nooks";
import { ui } from "../../lib/theme";
import { widgetKindInfo } from "../../lib/widgets";
import { BottomSheet } from "../bottom-sheet";
import { Icon, type IconName } from "../icon";
import { Tap } from "../motion";
import { Text } from "../text";

// Starter layouts (CORE-096): pick a ready-made Hearth to begin from. Each
// shows a little sketch of its top, so you can see what you'd get.

export function StarterSheet({
  visible,
  onClose,
  onPick,
  fresh,
  accent,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (id: StarterId) => void;
  // The page you're on is still brand new, so a layout becomes it.
  fresh: boolean;
  accent: string;
}) {
  // Built once, just to draw.
  const sketches = useMemo(() => starters.map((starter) => starter.build()), []);
  return (
    <BottomSheet visible={visible} onClose={onClose} header={<Text style={[ui.sectionTitle, { marginTop: 0 }]}>Start from a layout</Text>}>
      <View style={{ gap: 12, paddingBottom: 24 }}>
        <Text style={ui.muted}>
          {fresh
            ? "Your Hearth becomes the layout you pick. Everything in it can be moved, changed or removed after."
            : "It comes in as a new page, so nothing here is replaced. Everything in it can be moved, changed or removed after."}
        </Text>
        {starters.map((starter, i) => (
          <Tap
            key={starter.id}
            onPress={() => onPick(starter.id)}
            pressedScale={0.98}
            style={[styles.card, { borderColor: `${accent}33` }]}
            accessibilityRole="button"
            accessibilityLabel={`${starter.name}. ${starter.description}`}
          >
            <Sketch items={sketches[i]} />
            <View style={{ flex: 1, gap: 4 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Icon name={starter.icon} size={16} color={accent} />
                <Text style={[ui.cardTitle, { fontWeight: "800", flexShrink: 1 }]}>{starter.name}</Text>
              </View>
              <Text style={ui.muted}>{starter.description}</Text>
            </View>
          </Tap>
        ))}
      </View>
    </BottomSheet>
  );
}

const SKETCH_WIDTH = 84;
const SKETCH_HEIGHT = 112;
const CELL = SKETCH_WIDTH / COLUMNS;

// The top of a layout in miniature: each thing as a soft block in its own
// color with its icon; text as a line; decorations as a dot.
function Sketch({ items }: { items: HearthItem[] }) {
  return (
    <View style={styles.sketch} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {items.map((item) => {
        const left = item.x * CELL + 1;
        const top = item.y * CELL + 1;
        const width = item.w * CELL - 2;
        const height = item.h * CELL - 2;
        if (top > SKETCH_HEIGHT) return null;
        const color = itemColor(item);
        if (item.kind === "label") {
          return <View key={item.id} style={[styles.line, { left: left + 2, top: top + height / 2 - 2, width: width * 0.7, backgroundColor: deepColor(color) }]} />;
        }
        if (item.kind === "trinket") {
          const size = Math.min(width, height) * 0.7;
          return <View key={item.id} style={[styles.dot, { left: left + (width - size) / 2, top: top + (height - size) / 2, width: size, height: size, borderRadius: size / 2, backgroundColor: color }]} />;
        }
        const icon: IconName | undefined =
          item.kind === "widget" ? widgetKindInfo(item.widget.kind).icon : item.kind === "nook" ? findNook(item.nookId)?.icon : undefined;
        const iconColor = item.kind === "nook" ? findNook(item.nookId)?.iconColor ?? deepColor(color) : deepColor(color);
        return (
          <View key={item.id} style={[styles.block, { left, top, width, height, backgroundColor: color }]}>
            {icon && Math.min(width, height) >= 14 ? <Icon name={icon} size={Math.min(14, Math.min(width, height) * 0.55)} color={iconColor} /> : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: "row", gap: 14, alignItems: "center", borderWidth: 1.5, borderRadius: 18, padding: 12 },
  sketch: { width: SKETCH_WIDTH, height: SKETCH_HEIGHT, overflow: "hidden", borderRadius: 10, backgroundColor: "rgba(0,0,0,0.04)" },
  block: { position: "absolute", borderRadius: 5, alignItems: "center", justifyContent: "center", borderWidth: 0.5, borderColor: "rgba(0,0,0,0.08)" },
  line: { position: "absolute", height: 3, borderRadius: 2 },
  dot: { position: "absolute", opacity: 0.85 },
});
