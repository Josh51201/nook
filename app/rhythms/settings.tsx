import { Alert, Switch, View } from "react-native";

import { IconBadge, type IconName } from "../../components/icon";
import { LoadingScreen } from "../../components/motion";
import { NookScroll } from "../../components/nook-scroll";
import { Text } from "../../components/text";
import { SectionHeader } from "../../components/ui";
import { tap } from "../../lib/feedback";
import { rhythmSettingDefaults, useNookSettings } from "../../lib/nook-settings";
import { colors, ui } from "../../lib/theme";

type Key = keyof typeof rhythmSettingDefaults;

const rows: { key: Key; icon: IconName; title: string; body: string }[] = [
  {
    key: "notifyHeadsUp",
    icon: "calendar",
    title: "A heads-up before it's due",
    body: "A week ahead, so there's time to plan. Skipped for monthly ones.",
  },
  {
    key: "notifyDueDay",
    icon: "bell",
    title: "On the day it's due",
    body: "A nudge the morning it comes due.",
  },
  {
    key: "notifyOverdue",
    icon: "warning",
    title: "When it's overdue",
    body: "One reminder if the day passes and nobody has marked it done.",
  },
  {
    key: "notifyDone",
    icon: "check",
    title: "When someone does one",
    body: "“Sam did: Change the furnace filter.” Off unless you want it.",
  },
];

// Rhythms settings (CORE-012, RHY-007): which reminders you get in your
// inbox. Reminders for a rhythm with an owner go only to them.
export default function RhythmSettings() {
  const { settings, update, isLoading } = useNookSettings("rhythms", rhythmSettingDefaults);

  async function change(changes: Partial<typeof rhythmSettingDefaults>) {
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
      <Text style={ui.muted}>
        A rhythm that belongs to someone only reminds them. One that's anyone's reminds everyone in your Home.
      </Text>
    </NookScroll>
  );
}
