import { Alert, Switch, Text, View } from "react-native";

import { IconBadge, type IconName } from "../../components/icon";
import { Appear, LoadingScreen } from "../../components/motion";
import { NookScroll } from "../../components/nook-scroll";
import { SectionHeader } from "../../components/ui";
import { tap } from "../../lib/feedback";
import { giftNookSettingDefaults, useNookSettings } from "../../lib/nook-settings";
import { colors, ui } from "../../lib/theme";

// Gift Nook settings (CORE-012). Options here are provisional pending Q-019.
// GIFT-007: no setting may ever reveal claims on your own gifts — that's
// enforced by the database, not by anything on this screen.
export default function GiftNookSettings() {
  const { settings, update, isLoading } = useNookSettings("gift-nook", giftNookSettingDefaults);

  async function change(changes: Partial<typeof giftNookSettingDefaults>) {
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
      <SectionHeader title="Family Wishbooks" icon="wishbook" />
      <SettingRow
        index={0}
        icon="hidden"
        title="Hide gifts that are already taken"
        description="On someone else's Wishbook, hide one-and-done gifts another person already tucked away."
        value={settings.hideTakenGifts}
        onChange={(hideTakenGifts) => change({ hideTakenGifts })}
      />

      <SectionHeader title="Notifications" icon="bell" />
      <Text style={ui.muted}>Pick what shows up in your Gift Nook inbox.</Text>
      <SettingRow
        index={1}
        icon="calendar"
        title="Gatherings coming up"
        description="A week before, and the day before."
        value={settings.notifyGatheringSoon}
        onChange={(notifyGatheringSoon) => change({ notifyGatheringSoon })}
      />
      <SettingRow
        index={2}
        icon="gift"
        title="New gifts added"
        description="When someone in your Burrows adds to their Wishbook (bundled, not one per gift)."
        value={settings.notifyNewGifts}
        onChange={(notifyNewGifts) => change({ notifyNewGifts })}
      />
      <SettingRow
        index={3}
        icon="edit"
        title="A gift you tucked changed"
        description="If its owner edits or removes something you're getting them."
        value={settings.notifyTuckChanged}
        onChange={(notifyTuckChanged) => change({ notifyTuckChanged })}
      />
      <SettingRow
        index={4}
        icon="invite"
        title="Someone joined your Burrow"
        description="When a Knock is answered."
        value={settings.notifyMemberJoined}
        onChange={(notifyMemberJoined) => change({ notifyMemberJoined })}
      />

      <Text style={[ui.muted, { marginTop: 16, textAlign: "center" }]}>
        Your name and account live in Hearth settings.
      </Text>
    </NookScroll>
  );
}

function SettingRow({
  icon,
  title,
  description,
  value,
  onChange,
  index,
}: {
  icon: IconName;
  title: string;
  description: string;
  value: boolean;
  onChange: (value: boolean) => void;
  index: number;
}) {
  return (
    <Appear index={index}>
      <View style={[ui.card, ui.row, { gap: 12 }]}>
        <IconBadge name={icon} size={38} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={ui.cardTitle}>{title}</Text>
          <Text style={ui.muted}>{description}</Text>
        </View>
        <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.bark }} />
      </View>
    </Appear>
  );
}
