import { useRouter } from "expo-router";
import { ActivityIndicator, Alert, ScrollView, Text, TouchableOpacity, View } from "react-native";

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
      await save({ sections: addNook(layout, nook.id) });
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
          onPress: () => save({ sections: removeNook(layout, nook.id) }).catch(() => {}),
        },
      ]
    );
  }

  if (error) {
    return (
      <View style={ui.center}>
        <Text style={ui.error}>{error}</Text>
        <TouchableOpacity onPress={reload}>
          <Text style={ui.link}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={ui.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={ui.screen}>
      <Text style={ui.muted}>Pick the Nooks you want on your Hearth.</Text>
      {nookCatalog.map((nook) => {
        const added = hasNook(layout, nook.id);
        return (
          <View key={nook.id} style={[ui.card, { backgroundColor: nook.color, gap: 8 }]}>
            <View style={ui.row}>
              <Text style={{ fontSize: 36 }}>{nook.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[ui.cardTitle, { fontSize: 18 }]}>{nook.title}</Text>
                <Text style={ui.muted}>{nook.tagline}</Text>
              </View>
            </View>
            <Text style={{ fontSize: 14, color: colors.text }}>{nook.description}</Text>

            {!nook.available ? (
              <Text style={[ui.muted, { fontStyle: "italic" }]}>Coming soon</Text>
            ) : added ? (
              <View style={[ui.row, { justifyContent: "space-between" }]}>
                <TouchableOpacity onPress={() => router.push(nook.route!)}>
                  <Text style={[ui.link, { fontWeight: "600" }]}>✓ On your Hearth · Open</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => confirmRemove(nook)}>
                  <Text style={ui.error}>Remove</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={ui.button} onPress={() => add(nook)}>
                <Text style={ui.buttonText}>Add to Hearth</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}
