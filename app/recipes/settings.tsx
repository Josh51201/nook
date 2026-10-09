import { Alert, Switch, View } from "react-native";
import { Text } from "../../components/text";

import { DietaryNeeds } from "../../components/dietary-needs";
import { IconBadge } from "../../components/icon";
import { LoadingScreen } from "../../components/motion";
import { NookScroll } from "../../components/nook-scroll";
import { SectionHeader } from "../../components/ui";
import { useAuth } from "../../lib/auth-context";
import { tap } from "../../lib/feedback";
import { recipeSettingDefaults, useNookSettings } from "../../lib/nook-settings";
import { colors, ui } from "../../lib/theme";

// Recipe Box settings (CORE-012): who sees new recipes (REC-002), and your
// own allergies and diets (PROF-004) that warnings use (REC-010).
export default function RecipeSettings() {
  const { session } = useAuth();
  const { settings, update, isLoading } = useNookSettings("recipes", recipeSettingDefaults);

  async function change(changes: Partial<typeof recipeSettingDefaults>) {
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
      <SectionHeader title="Sharing" icon="group" />
      <Text style={ui.muted}>
        Family in your Burrows can see your recipes and save a copy into their own box. Nobody is told when someone saves one.
      </Text>
      <View style={[ui.card, ui.row, { gap: 12 }]}>
        <IconBadge name="lock" size={38} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={ui.cardTitle}>New recipes start as "Just me"</Text>
          <Text style={ui.muted}>You can still share each one from its page. Recipes already in your box don't change.</Text>
        </View>
        <Switch value={settings.newPrivate} onValueChange={(value) => change({ newPrivate: value })} trackColor={{ true: colors.bark }} />
      </View>

      {session ? <DietaryNeeds profileId={session.user.id} who="you" /> : null}
    </NookScroll>
  );
}
