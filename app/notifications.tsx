import { Alert, Switch, View } from "react-native";

import { Collapsible } from "../components/collapsible";
import { IconBadge } from "../components/icon";
import { Tap } from "../components/motion";
import { NookScroll } from "../components/nook-scroll";
import { Text } from "../components/text";
import { tap } from "../lib/feedback";
import { findNook } from "../lib/nooks";
import { isOn, notificationCatalog, onSummary, type NookNotifications } from "../lib/notification-catalog";
import { useNookSettings } from "../lib/nook-settings";
import { colors, ui } from "../lib/theme";

// Notifications (CORE-090): every Nook's notification switches in one place,
// instead of opening each Nook's settings. These are the very same switches
// as inside each Nook (both save to the same settings), so a change here
// shows there and the other way round.
export default function Notifications() {
  return (
    <NookScroll>
      <Text style={ui.muted}>
        Choose what each Nook tells you about, all in one place. The same switches are in each Nook's own settings, and
        either one changes the other.
      </Text>
      {notificationCatalog.map((entry) => (
        <NookSection key={entry.nook} entry={entry} />
      ))}
    </NookScroll>
  );
}

function NookSection({ entry }: { entry: NookNotifications }) {
  const nook = findNook(entry.nook) ?? entry.label;
  const { settings, update, isLoading } = useNookSettings(entry.nook, entry.defaults);

  async function change(changes: Record<string, boolean>) {
    tap();
    try {
      await update(changes);
    } catch (error) {
      Alert.alert("Couldn't save that setting", (error as Error).message);
    }
  }

  if (isLoading) return null;
  const allOn = entry.switches.every((s) => isOn(entry, settings, s.key));
  const setAll = (on: boolean) => change(Object.fromEntries(entry.switches.map((s) => [s.key, on])));

  return (
    <Collapsible
      id={`notifications-${entry.nook}`}
      icon={nook?.icon ?? "bell"}
      title={nook?.title ?? entry.nook}
      summary={onSummary(entry, settings)}
    >
      <View style={{ gap: 12, padding: 14 }}>
        {entry.switches.length > 1 ? (
          <Tap
            onPress={() => setAll(!allOn)}
            accessibilityRole="button"
            accessibilityLabel={allOn ? `Turn off all ${nook?.title} notifications` : `Turn on all ${nook?.title} notifications`}
          >
            <Text style={{ color: colors.bark, fontWeight: "700" }}>{allOn ? "Turn all off" : "Turn all on"}</Text>
          </Tap>
        ) : null}
        {entry.switches.map((row) => (
          <View key={row.key} style={[ui.row, { gap: 12 }]}>
            <IconBadge name={row.icon} size={38} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={ui.cardTitle}>{row.title}</Text>
              <Text style={ui.muted}>{row.body}</Text>
            </View>
            <Switch
              value={isOn(entry, settings, row.key)}
              onValueChange={(value) => change({ [row.key]: value })}
              trackColor={{ true: colors.bark }}
              accessibilityLabel={row.title}
            />
          </View>
        ))}
      </View>
    </Collapsible>
  );
}
