import { useState } from "react";
import { Alert, Switch, View } from "react-native";

import { IconBadge, type IconName } from "../../components/icon";
import { LoadingScreen, Tap } from "../../components/motion";
import { NookScroll } from "../../components/nook-scroll";
import { Text } from "../../components/text";
import { SectionHeader } from "../../components/ui";
import { useAuth } from "../../lib/auth-context";
import { friendlyError, tap } from "../../lib/feedback";
import { deletePackList, usePackLists } from "../../lib/getaways-data";
import { getawaySettingDefaults, useNookSettings } from "../../lib/nook-settings";
import { colors, ui } from "../../lib/theme";

type Key = keyof typeof getawaySettingDefaults;

const rows: { key: Key; icon: IconName; title: string; body: string }[] = [
  { key: "notifyAdded", icon: "plane", title: "When someone adds you to a Getaway", body: "So you know to start packing." },
  { key: "notifyTodos", icon: "todo", title: "When a before-you-go task is due", body: "The morning of its do-by day, to whoever's doing it (or everyone going)." },
  { key: "notifyLeaving", icon: "calendar", title: "The day before you leave", body: "With how much is left on your packing list." },
];

// Getaway settings (CORE-012, TRIP-008, TRIP-011): which notices you get,
// and your saved packing lists.
export default function GetawaySettings() {
  const { session } = useAuth();
  const { settings, update, isLoading } = useNookSettings("getaways", getawaySettingDefaults);
  const [listsKey, setListsKey] = useState(0);
  const lists = usePackLists(!!session, listsKey);

  async function change(changes: Partial<typeof getawaySettingDefaults>) {
    tap();
    try {
      await update(changes);
    } catch (error) {
      Alert.alert("Couldn't save that setting", (error as Error).message);
    }
  }

  function confirmDelete(id: string, name: string) {
    Alert.alert(`Delete your “${name}” list?`, "Getaways already packed from it keep their lines.", [
      { text: "Keep", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const { error } = await deletePackList(id);
          if (error) return Alert.alert("Couldn't delete it", friendlyError(error));
          setListsKey((k) => k + 1);
        },
      },
    ]);
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
          <Switch value={settings[row.key]} onValueChange={(value) => change({ [row.key]: value })} trackColor={{ true: colors.bark }} />
        </View>
      ))}

      <SectionHeader title="Your packing lists" icon="star" />
      {lists === null ? null : lists.length ? (
        <View style={[ui.card, { gap: 12 }]}>
          {lists.map((l) => (
            <View key={l.id} style={[ui.row, { gap: 10, alignItems: "flex-start" }]}>
              <View style={{ flex: 1 }}>
                <Text style={ui.cardTitle}>{l.name}</Text>
                <Text style={[ui.muted, { fontSize: 13 }]} numberOfLines={2}>
                  {l.items.length} things: {l.items.join(", ")}
                </Text>
              </View>
              <Tap onPress={() => confirmDelete(l.id, l.name)} hitSlop={8}>
                <Text style={ui.error}>Delete</Text>
              </Tap>
            </View>
          ))}
        </View>
      ) : (
        <Text style={ui.muted}>On any Getaway's packing list, tap “Save this list for next time” and it shows up here, ready for your next trip. Only you see your saved lists.</Text>
      )}
    </NookScroll>
  );
}
