import { Alert, Switch, View } from "react-native";

import { IconBadge, type IconName } from "../../components/icon";
import { LoadingScreen } from "../../components/motion";
import { NookScroll } from "../../components/nook-scroll";
import { Text } from "../../components/text";
import { SectionHeader } from "../../components/ui";
import { tap } from "../../lib/feedback";
import { petSettingDefaults, useNookSettings } from "../../lib/nook-settings";
import { colors, ui } from "../../lib/theme";

type Key = keyof typeof petSettingDefaults;

const rows: { key: Key; icon: IconName; title: string; body: string }[] = [
  {
    key: "notifyMissed",
    icon: "bell",
    title: "Meal not fed yet",
    body: "If a meal with a nudge time hasn't been checked off by then, your Home hears about it.",
  },
  {
    key: "notifyDue",
    icon: "pill",
    title: "Vet, vaccine and refill dates",
    body: "A heads-up a week before something comes due, and again if it's passed.",
  },
  {
    key: "notifyFed",
    icon: "paw",
    title: "When someone feeds a pet",
    body: "“Biscuit was fed — Sam did breakfast.” Can get busy in a big Home, so it's off unless you want it.",
  },
];

// Pet Care settings (CORE-012, PET-007): which notices you get in your inbox.
export default function PetSettings() {
  const { settings, update, isLoading } = useNookSettings("pets", petSettingDefaults);

  async function change(changes: Partial<typeof petSettingDefaults>) {
    tap();
    try {
      await update(changes);
    } catch (error) {
      Alert.alert("Couldn't save that setting", (error as Error).message);
    }
  }

  if (isLoading) return <LoadingScreen />;

  return (
    <NookScroll>
      <SectionHeader title="Notifications" icon="bell" />
      {rows.map((row) => (
        <View key={row.key} style={[ui.card, ui.row, { gap: 12 }]}>
          <IconBadge name={row.icon} size={38} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={ui.cardTitle}>{row.title}</Text>
            <Text style={ui.muted}>{row.body}</Text>
          </View>
          <Switch
            value={settings[row.key]}
            onValueChange={(value) => change({ [row.key]: value })}
            trackColor={{ true: colors.bark }}
          />
        </View>
      ))}
    </NookScroll>
  );
}
