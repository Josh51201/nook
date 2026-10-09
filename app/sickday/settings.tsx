import { Alert, Switch, View } from "react-native";

import { IconBadge, type IconName } from "../../components/icon";
import { LoadingScreen } from "../../components/motion";
import { NookScroll } from "../../components/nook-scroll";
import { Text } from "../../components/text";
import { Chip, SectionHeader } from "../../components/ui";
import { tap } from "../../lib/feedback";
import { sickdaySettingDefaults, useNookSettings } from "../../lib/nook-settings";
import { colors, ui } from "../../lib/theme";

type Key = "notifyDoseReady" | "notifyDoseGiven" | "notifyHelper";

const rows: { key: Key; icon: IconName; title: string; body: string }[] = [
  {
    key: "notifyDoseReady",
    icon: "timer",
    title: "When the next dose is OK",
    body: "For a dose you gave: an alert on this phone and a note in your inbox once the hours between doses are up.",
  },
  {
    key: "notifyDoseGiven",
    icon: "pill",
    title: "When someone else gives a dose",
    body: "So you know it's been given and don't give it again.",
  },
  {
    key: "notifyHelper",
    icon: "sick",
    title: "When you're asked to help",
    body: "Someone from your Burrows adds you to help with a person who's sick.",
  },
];

// Sick Day settings (CORE-012, SICK-003, SICK-009): °F or °C, and which
// notices you get.
export default function SickDaySettings() {
  const { settings, update, isLoading } = useNookSettings("sickday", sickdaySettingDefaults);

  async function change(changes: Partial<typeof sickdaySettingDefaults>) {
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
      <SectionHeader title="Temperatures" icon="thermo" />
      <View style={ui.chips}>
        <Chip selected={settings.tempUnit === "f"} onPress={() => change({ tempUnit: "f" })}>
          °F Fahrenheit
        </Chip>
        <Chip selected={settings.tempUnit === "c"} onPress={() => change({ tempUnit: "c" })}>
          °C Celsius
        </Chip>
      </View>
      <Text style={ui.muted}>Just how you see them. Someone using the other one sees the same temperature in theirs.</Text>

      <SectionHeader title="Notices" icon="bell" />
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
