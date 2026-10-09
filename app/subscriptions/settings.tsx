import { Alert, Switch, View } from "react-native";

import { IconBadge, type IconName } from "../../components/icon";
import { LoadingScreen } from "../../components/motion";
import { NookScroll } from "../../components/nook-scroll";
import { Text } from "../../components/text";
import { SectionHeader } from "../../components/ui";
import { tap } from "../../lib/feedback";
import { subscriptionSettingDefaults, useNookSettings } from "../../lib/nook-settings";
import { colors, ui } from "../../lib/theme";

type Key = keyof typeof subscriptionSettingDefaults;

const rows: { key: Key; icon: IconName; title: string; body: string }[] = [
  {
    key: "notifyTrials",
    icon: "warning",
    title: "Before a free trial ends",
    body: "So there's time to cancel before the first charge.",
  },
  {
    key: "notifyYearly",
    icon: "calendar",
    title: "Before a yearly one renews",
    body: "Also ones billed every 3 or 6 months, the big charges that sneak up on you.",
  },
  {
    key: "notifyMonthly",
    icon: "card",
    title: "Before a monthly one renews",
    body: "And weekly ones. Off unless you want it, since they'd come every few weeks.",
  },
];

// Subscriptions settings (CORE-012, SUB-003): which reminders you get in
// your inbox. Each subscription says how many days ahead.
export default function SubscriptionSettings() {
  const { settings, update, isLoading } = useNookSettings("subscriptions", subscriptionSettingDefaults);

  async function change(changes: Partial<typeof subscriptionSettingDefaults>) {
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
      <SectionHeader title="Reminders" icon="bell" />
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
        How many days ahead is set on each subscription. A shared one reminds whoever pays for it, or everyone in your Home if nobody's
        picked. A “Just me” one only ever reminds you.
      </Text>
    </NookScroll>
  );
}
