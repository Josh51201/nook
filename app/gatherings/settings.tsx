import { Alert, Switch, View } from "react-native";

import { IconBadge, type IconName } from "../../components/icon";
import { LoadingScreen } from "../../components/motion";
import { NookScroll } from "../../components/nook-scroll";
import { Text } from "../../components/text";
import { SectionHeader } from "../../components/ui";
import { tap } from "../../lib/feedback";
import { gatheringSettingDefaults, useNookSettings } from "../../lib/nook-settings";
import { colors, ui } from "../../lib/theme";

type Key = keyof typeof gatheringSettingDefaults;

const rows: { key: Key; icon: IconName; title: string; body: string }[] = [
  { key: "notifyInvites", icon: "invite", title: "When you're invited", body: "Including when a Burrow you're in is invited. Automatic birthday ones stay quiet." },
  { key: "notifyChanged", icon: "edit", title: "When plans change", body: "If the day, time or place of one you're invited to moves (not if you said you can't make it)." },
  { key: "notifySoon", icon: "calendar", title: "When one's coming up", body: "A week before, and the day before." },
  { key: "notifyRsvps", icon: "check", title: "When someone answers", body: "For Gatherings you host: who's coming and who can't." },
];

// Gathering Nook settings (CORE-012, GATH-008): which notices you get.
export default function GatheringSettings() {
  const { settings, update, isLoading } = useNookSettings("gatherings", gatheringSettingDefaults);

  async function change(changes: Partial<typeof gatheringSettingDefaults>) {
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
          <Switch value={settings[row.key]} onValueChange={(value) => change({ [row.key]: value })} trackColor={{ true: colors.bark }} />
        </View>
      ))}
    </NookScroll>
  );
}
