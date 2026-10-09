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
      <Text style={ui.muted}>Pick what shows up in your inbox from Potlucks.</Text>
      {(
        [
          ["notifyNew", "invite", "A new Potluck", "When someone in your Burrow plans one."],
          ["notifyReminder", "potluck", "Remind me the day before", "“Tomorrow: you're bringing mashed potatoes.”"],
          ["notifyChanged", "edit", "The plan changes", "If the time, place or name changes and you're going or bringing something."],
          ["notifyRsvps", "check", "Someone RSVPs", "For Potlucks you host. Off unless you turn it on, since it can get busy."],
          ["notifyDishes", "food", "Someone picks a dish", "For Potlucks you host. Off unless you turn it on."],
        ] as const
      ).map(([key, icon, title, description]) => (
        <View key={key} style={[ui.card, ui.row, { gap: 12 }]}>
          <IconBadge name={icon} size={38} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={ui.cardTitle}>{title}</Text>
            <Text style={ui.muted}>{description}</Text>
          </View>
          <Switch value={settings[key]} onValueChange={(value) => change({ [key]: value })} trackColor={{ true: colors.bark }} />
        </View>
      ))}

      {session ? <DietaryNeeds profileId={session.user.id} who="you" /> : null}
    </NookScroll>
  );
}
