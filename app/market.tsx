import { useRouter } from "expo-router";
import { Alert, View } from "react-native";
import { Text } from "../components/text";
import Animated, { ZoomIn } from "react-native-reanimated";

import { Icon, IconBadge } from "../components/icon";
import { Appear, LoadingScreen } from "../components/motion";
import { NookScroll } from "../components/nook-scroll";
import { Button } from "../components/ui";
import { tap } from "../lib/feedback";
import { addNook, nookCount, removeNook, useHearthLayout } from "../lib/hearth";
import { nookCatalog, type NookDefinition } from "../lib/nooks";
import { colors, ui } from "../lib/theme";

// The Market (proposed name): browse Nooks and add them to your Hearth
// (CORE-002) — more than once if you like, e.g. one on the Hearth and one in
// a Hollow; every tile opens the same Nook (CORE-039). Removing a Nook only
// takes its tiles off the Hearth — its data stays.
export default function Market() {
  const router = useRouter();
  const { layout, save, isLoading, error, reload } = useHearthLayout();

  async function add(nook: NookDefinition, another = false) {
    try {
      await save({ items: addNook(layout, nook.id, another) });
      if (another) Alert.alert("Added another", `It's on your Hearth. Move it into a Hollow from Edit if you like.`);
    } catch (saveError) {
      Alert.alert("Couldn't add it", (saveError as Error).message);
    }
  }

  function confirmRemove(nook: NookDefinition, count: number) {
    Alert.alert(
      count > 1 ? `Take all ${count} ${nook.title} tiles off your Hearth?` : `Take ${nook.title} off your Hearth?`,
      (count > 1 ? "To remove just one, use Edit on the Hearth. " : "") +
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
        const count = nookCount(layout, nook.id);
        const added = count > 0;
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
                  <Animated.View entering={ZoomIn.springify().damping(12)} style={[ui.row, { gap: 2 }]}>
                    <Icon name="check" size={24} color="#3f7a4f" />
                    {count > 1 ? <Text style={{ color: "#3f7a4f", fontWeight: "800" }}>×{count}</Text> : null}
                  </Animated.View>
                ) : null}
              </View>
              <Text style={{ fontSize: 14, color: colors.text, lineHeight: 20 }}>{nook.description}</Text>

              {!nook.available ? (
                <View style={[ui.secondaryButton, { opacity: 0.8 }]}>
                  <Text style={ui.secondaryButtonText}>Coming soon</Text>
                </View>
              ) : added ? (
                <View style={{ gap: 10 }}>
                  <View style={[ui.row, { gap: 10 }]}>
                    <Button title="Open" icon="chevron" variant="secondary" style={{ flex: 1 }} onPress={() => router.push(nook.route!)} />
                    <Button title="Remove" icon="trash" variant="danger" onPress={() => confirmRemove(nook, count)} />
                  </View>
                  <Button
                    title="Add another"
                    icon="copy"
                    variant="secondary"
                    onPress={() => {
                      tap("success");
                      add(nook, true);
                    }}
                  />
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
