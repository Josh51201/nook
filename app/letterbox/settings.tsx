import { useRouter } from "expo-router";
import { Alert, Switch, View } from "react-native";

import { IconBadge } from "../../components/icon";
import { LoadingScreen } from "../../components/motion";
import { NookScroll } from "../../components/nook-scroll";
import { Text } from "../../components/text";
import { Button, NavCard, SectionHeader } from "../../components/ui";
import { tap } from "../../lib/feedback";
import { displayName } from "../../lib/gift-nook";
import { letterboxSettingDefaults, useNookSettings } from "../../lib/nook-settings";
import { colors, ui } from "../../lib/theme";
import { useLetterbox } from "../../lib/use-letterbox";

// Letterbox settings (CORE-012): birthday-card reminders (LET-010) and your
// mailing address. Who shares the card list is your Home (HOME-001), which
// lives in the Burrows tab.
export default function LetterboxSettings() {
  const router = useRouter();
  const { data } = useLetterbox();
  const { settings, update, isLoading } = useNookSettings("letterbox", letterboxSettingDefaults);

  if (!data || isLoading) return <LoadingScreen cards={3} />;

  async function change(changes: Partial<typeof letterboxSettingDefaults>) {
    tap();
    try {
      await update(changes);
    } catch (error) {
      Alert.alert("Couldn't save that setting", (error as Error).message);
    }
  }

  const shared = data.members.length > 1;
  return (
    <NookScroll>
      <SectionHeader title="Shared with" icon="hearth" />
      <NavCard
        icon="hearth"
        title="Your Home"
        subtitle={
          shared
            ? `This card list is shared with ${data.members.map((m) => displayName(m.profiles).split(" ")[0]).join(" & ")}`
            : "Just you. Invite the people you live with so you share one card list."
        }
        onPress={() => router.push("/home")}
      />
      {shared ? <Text style={ui.muted}>Anyone in your Home can add and change cards and addresses.</Text> : null}

      <SectionHeader title="Notifications" icon="bell" />
      <View style={[ui.card, ui.row, { gap: 12 }]}>
        <IconBadge name="birthday" size={38} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={ui.cardTitle}>Birthday card reminders</Text>
          <Text style={ui.muted}>A week before a birthday in your Letterbox, so the card arrives on time.</Text>
        </View>
        <Switch
          value={settings.notifyBirthdays}
          onValueChange={(notifyBirthdays) => change({ notifyBirthdays })}
          trackColor={{ true: colors.bark }}
        />
      </View>

      <SectionHeader title="Your address" icon="place" />
      <Button title="Edit my mailing address" icon="place" variant="secondary" onPress={() => router.push("/profile")} />
    </NookScroll>
  );
}
