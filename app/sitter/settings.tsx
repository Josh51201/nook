import { Alert, Switch, View } from "react-native";

import { IconBadge, type IconName } from "../../components/icon";
import { LoadingScreen } from "../../components/motion";
import { NookScroll } from "../../components/nook-scroll";
import { Text } from "../../components/text";
import { SectionHeader } from "../../components/ui";
import { tap } from "../../lib/feedback";
import { sitterSettingDefaults, useNookSettings } from "../../lib/nook-settings";
import { colors, ui } from "../../lib/theme";

type Key = keyof typeof sitterSettingDefaults;

const rows: { key: Key; icon: IconName; title: string; body: string }[] = [
  {
    key: "notifyOpened",
    icon: "check",
    title: "When a sitter opens it",
    body: "The first time they open a link you made, so you know it reached them.",
  },
  {
    key: "notifyEnding",
    icon: "sitter",
    title: "The morning a link ends",
    body: "A heads-up on the last day, in case the stay runs longer and you want a new link.",
  },
];

// Sitter Sheet settings (CORE-012, SIT-011): which notices you get in your
// inbox about links you made.
export default function SitterSettings() {
  const { settings, update, isLoading } = useNookSettings("sitter", sitterSettingDefaults);

  async function change(changes: Partial<typeof sitterSettingDefaults>) {
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
      <Text style={ui.muted}>These only cover links you made. Anyone else in your Home gets their own for theirs.</Text>
    </NookScroll>
  );
}
