import { Alert, Switch, View } from "react-native";

import { IconBadge } from "../../components/icon";
import { LoadingScreen } from "../../components/motion";
import { NookScroll } from "../../components/nook-scroll";
import { Text } from "../../components/text";
import { Chip, SectionHeader } from "../../components/ui";
import { tap } from "../../lib/feedback";
import { mealTimes, type MealKey } from "../../lib/menu-board";
import { menuBoardSettingDefaults, useNookSettings } from "../../lib/nook-settings";
import { colors, ui } from "../../lib/theme";

// Menu Board settings (CORE-012): which day your week starts on (MENU-001)
// and which meals you plan (MENU-007). Just for you; the menu itself is
// the Home's.
export default function MenuBoardSettings() {
  const { settings, update, isLoading } = useNookSettings("menu-board", menuBoardSettingDefaults);

  async function change(changes: Partial<typeof menuBoardSettingDefaults>) {
    tap();
    try {
      await update(changes);
    } catch (error) {
      Alert.alert("Couldn't save that setting", (error as Error).message);
    }
  }

  function toggle(meal: MealKey, on: boolean) {
    const next = mealTimes.map((m) => m.key).filter((k) => (k === meal ? on : settings.meals.includes(k)));
    if (!next.length) return Alert.alert("Keep at least one", "The board needs at least one meal to show.");
    change({ meals: next });
  }

  if (isLoading) return <LoadingScreen />;

  return (
    <NookScroll>
      <SectionHeader title="The week starts on" icon="calendar" />
      <View style={ui.chips}>
        <Chip selected={settings.weekStart !== 1} onPress={() => change({ weekStart: 0 })}>
          Sunday
        </Chip>
        <Chip selected={settings.weekStart === 1} onPress={() => change({ weekStart: 1 })}>
          Monday
        </Chip>
      </View>

      <SectionHeader title="Meals you plan" icon="potluck" />
      <Text style={ui.muted}>Hide the ones your Home doesn't plan ahead. This only changes what you see; nothing planned is lost.</Text>
      {mealTimes.map((m) => (
        <View key={m.key} style={[ui.card, ui.row, { gap: 12 }]}>
          <IconBadge name={m.icon} size={36} />
          <Text style={[ui.cardTitle, { flex: 1 }]}>{m.label}</Text>
          <Switch value={settings.meals.includes(m.key)} onValueChange={(on) => toggle(m.key, on)} trackColor={{ true: colors.bark }} />
        </View>
      ))}
    </NookScroll>
  );
}
