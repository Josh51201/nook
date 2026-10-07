import { ActivityIndicator, Alert, Switch, Text, View } from "react-native";

import { NookScroll } from "../../components/nook-scroll";
import { giftNookSettingDefaults, useNookSettings } from "../../lib/nook-settings";
import { colors, ui } from "../../lib/theme";

// Gift Nook settings (CORE-012). Options here are provisional pending Q-019.
// GIFT-007: no setting may ever reveal claims on your own gifts — that's
// enforced by the database, not by anything on this screen.
export default function GiftNookSettings() {
  const { settings, update, isLoading } = useNookSettings("gift-nook", giftNookSettingDefaults);

  async function change(changes: Partial<typeof giftNookSettingDefaults>) {
    try {
      await update(changes);
    } catch (error) {
      Alert.alert("Couldn't save that setting", (error as Error).message);
    }
  }

  if (isLoading) {
    return (
      <View style={ui.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <NookScroll>
      <Text style={ui.sectionTitle}>Family Wishbooks</Text>
      <SettingRow
        title="Hide gifts that are already taken"
        description="On someone else's Wishbook, hide one-and-done gifts another person already tucked away."
        value={settings.hideTakenGifts}
        onChange={(hideTakenGifts) => change({ hideTakenGifts })}
      />

      <Text style={ui.sectionTitle}>Notifications</Text>
      <Text style={ui.muted}>Pick what shows up in your Gift Nook inbox (🔔).</Text>
      <SettingRow
        title="Gatherings coming up"
        description="A week before, and the day before."
        value={settings.notifyGatheringSoon}
        onChange={(notifyGatheringSoon) => change({ notifyGatheringSoon })}
      />
      <SettingRow
        title="New gifts added"
        description="When someone in your Burrows adds to their Wishbook (bundled, not one per gift)."
        value={settings.notifyNewGifts}
        onChange={(notifyNewGifts) => change({ notifyNewGifts })}
      />
      <SettingRow
        title="A gift you tucked changed"
        description="If its owner edits or removes something you're getting them."
        value={settings.notifyTuckChanged}
        onChange={(notifyTuckChanged) => change({ notifyTuckChanged })}
      />
      <SettingRow
        title="Someone joined your Burrow"
        description="When a Knock is answered."
        value={settings.notifyMemberJoined}
        onChange={(notifyMemberJoined) => change({ notifyMemberJoined })}
      />

      <Text style={[ui.muted, { marginTop: 16 }]}>
        Your name and account live in Hearth settings (the ⚙︎ on the Hearth).
      </Text>
    </NookScroll>
  );
}

function SettingRow({
  title,
  description,
  value,
  onChange,
}: {
  title: string;
  description: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View style={[ui.card, ui.row]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={ui.cardTitle}>{title}</Text>
        <Text style={ui.muted}>{description}</Text>
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.bark }} />
    </View>
  );
}
