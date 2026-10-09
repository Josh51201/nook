import { View } from "react-native";

import { tap } from "../../lib/feedback";
import type { Nudge } from "../../lib/hearth-layout";
import { colors, ui } from "../../lib/theme";
import { Icon, type IconName } from "../icon";
import { Tap } from "../motion";
import { Text } from "../text";

// Arrow buttons that move a tile one step at a time (CORE-075), for anyone
// who finds dragging fiddly. `can` says which ways it can go from here.
export function NudgePad({
  can,
  onNudge,
  at,
}: {
  can: (way: Nudge) => boolean;
  onNudge: (way: Nudge) => void;
  // Where it is now, on the grid.
  at: { x: number; y: number };
}) {
  const ways: { way: Nudge; icon: IconName; label: string }[] = [
    { way: "left", icon: "arrowLeft", label: "Move left" },
    { way: "up", icon: "arrowUp", label: "Move up" },
    { way: "down", icon: "arrowDown", label: "Move down" },
    { way: "right", icon: "arrowRight", label: "Move right" },
  ];
  return (
    <View style={{ gap: 8 }}>
      <View style={[ui.row, { justifyContent: "space-between" }]}>
        <Text style={ui.label}>Move it</Text>
        <Text style={ui.muted} accessibilityLiveRegion="polite">
          Row {Math.round(at.y) + 1}, column {Math.round(at.x) + 1}
        </Text>
      </View>
      <View style={[ui.row, { gap: 10 }]}>
        {ways.map(({ way, icon, label }) => {
          const enabled = can(way);
          return (
            <Tap
              key={way}
              disabled={!enabled}
              onPress={() => {
                tap();
                onNudge(way);
              }}
              pressedScale={0.9}
              style={{
                flex: 1,
                height: 48,
                borderRadius: 14,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.barkSoft,
                opacity: enabled ? 1 : 0.35,
              }}
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityState={{ disabled: !enabled }}
            >
              <Icon name={icon} size={20} />
            </Tap>
          );
        })}
      </View>
      <Text style={ui.muted}>Moves it one step at a time — anything in the way shifts down to make room.</Text>
    </View>
  );
}
