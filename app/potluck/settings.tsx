import { Alert, Switch, View } from "react-native";
import { Text } from "../../components/text";

import { DietaryNeeds } from "../../components/dietary-needs";
import { IconBadge } from "../../components/icon";
import { LoadingScreen } from "../../components/motion";
import { NookScroll } from "../../components/nook-scroll";
import { SectionHeader } from "../../components/ui";
import { useAuth } from "../../lib/auth-context";
import { tap } from "../../lib/feedback";
import { potluckSettingDefaults, useNookSettings } from "../../lib/nook-settings";
import { colors, ui } from "../../lib/theme";

// Potluck settings (CORE-012): the day-before reminder (POT-007), and your
// own allergies and diets (PROF-004) — the same ones as on your profile.
export default function PotluckSettings() {
  const { session } = useAuth();
  const { settings, update, isLoading } = useNookSettings("potluck", potluckSettingDefaults);

  async function change(changes: Partial<typeof potluckSettingDefaults>) {
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
      <View style={[ui.card, ui.row, { gap: 12 }]}>
        <IconBadge name="potluck" size={38} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={ui.cardTitle}>Remind me the day before</Text>
          <Text style={ui.muted}>“Tomorrow: you're bringing mashed potatoes” — in your inbox.</Text>
        </View>
        <Switch
          value={settings.notifyReminder}
          onValueChange={(notifyReminder) => change({ notifyReminder })}
          trackColor={{ true: colors.bark }}
        />
      </View>

      {session ? <DietaryNeeds profileId={session.user.id} who="you" /> : null}
    </NookScroll>
  );
}
