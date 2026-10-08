import { useRouter } from "expo-router";
import { Alert, View } from "react-native";
import { Text } from "../components/text";
import Animated, { ZoomIn } from "react-native-reanimated";

import { Icon, IconBadge } from "../components/icon";
import { Appear, LoadingScreen } from "../components/motion";
import { NookScroll } from "../components/nook-scroll";
import { Button } from "../components/ui";
import { tap } from "../lib/feedback";
import { addNook, hasNook, removeNook, useHearthLayout } from "../lib/hearth";
import { nookCatalog, type NookDefinition } from "../lib/nooks";
import { colors, ui } from "../lib/theme";

// The Market (proposed name): browse Nooks and add them to your Hearth
// (CORE-002). Removing a Nook only takes it off the Hearth — its data stays.
export default function Market() {
  const router = useRouter();
  const { layout, save, isLoading, error, reload } = useHearthLayout();

  async function add(nook: NookDefinition) {
    try {
      await save({ items: addNook(layout, nook.id) });
    } catch (saveError) {
      Alert.alert("Couldn't add it", (saveError as Error).message);
    }
  }

  function confirmRemove(nook: NookDefinition) {
    Alert.alert(
      `Take ${nook.title} off your Hearth?`,
      "Nothing inside it is deleted — add it back any time and it'll be just as you left it.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => save({ items: removeNook(layout, nook.id) }).catch(() => {}),
        },
      ]
    );
  }

  if (error) {
    return (
      <View style={ui.center}>
        <Text style={ui.error}>{error}</Text>
        <Button title="Try again" icon="undo" variant="secondary" onPress={reload} />
      </View>
    );
  }

  if (isLoading) return <LoadingScreen />;

  return (
    <NookScroll>
      <Text style={ui.muted}>Pick the Nooks you want on your Hearth.</Text>
      {nookCatalog.map((nook, i) => {
        const added = hasNook(layout, nook.id);
        return (
          <Appear key={nook.id} index={i}>
            <View style={[ui.card, { gap: 12, opacity: nook.available ? 1 : 0.75 }]}>
              <View style={[ui.row, { gap: 14 }]}>
                <IconBadge name={nook.icon} size={56} color={nook.iconColor} background={nook.color} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[ui.cardTitle, { fontSize: 18 }]}>{nook.title}</Text>
                  <Text style={ui.muted}>{nook.tagline}</Text>
                </View>
                {added ? (
                  <Animated.View entering={ZoomIn.springify().damping(12)}>
                    <Icon name="check" size={24} color="#3f7a4f" />
                  </Animated.View>
                ) : null}
              </View>
              <Text style={{ fontSize: 14, color: colors.text, lineHeight: 20 }}>{nook.description}</Text>

              {!nook.available ? (
                <View style={[ui.secondaryButton, { opacity: 0.8 }]}>
                  <Text style={ui.secondaryButtonText}>Coming soon</Text>
                </View>
              ) : added ? (
                <View style={[ui.row, { gap: 10 }]}>
                  <Button title="Open" icon="chevron" variant="secondary" style={{ flex: 1 }} onPress={() => router.push(nook.route!)} />
                  <Button title="Remove" icon="trash" variant="danger" onPress={() => confirmRemove(nook)} />
                </View>
              ) : (
                <Button
                  title="Add to Hearth"
                  icon="add"
                  onPress={() => {
                    tap("success");
                    add(nook);
                  }}
                />
              )}
            </View>
          </Appear>
        );
      })}
    </NookScroll>
  );
}
