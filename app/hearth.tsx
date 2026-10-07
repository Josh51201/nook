import { Redirect, useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "../lib/auth-context";

// CORE-002/003: the Hearth is the homepage — Nooks live here as tiles, opened and
// managed from this screen. Gift Nook is the only real tile so far; more Nooks (see
// Nook Backlog in docs/NOOK_REQUIREMENTS.md) will each get their own tile later.
const nooks = [
  { id: "gift-nook", title: "Gift Nook", subtitle: "Wishbooks & Burrows", emoji: "🎁" },
];

export default function Hearth() {
  const router = useRouter();
  const { session, isLoading } = useAuth();

  if (!isLoading && !session) {
    return <Redirect href="/sign-in" />;
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>The Hearth</Text>
          <TouchableOpacity onPress={() => router.push("/settings")} hitSlop={12}>
            <Text style={styles.settings}>⚙︎ Settings</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.grid}>
          {nooks.map((nook) => (
            <TouchableOpacity
              key={nook.id}
              style={styles.tile}
              onPress={() => router.push("/gift-nook")}
            >
              <Text style={styles.tileEmoji}>{nook.emoji}</Text>
              <Text style={styles.tileTitle}>{nook.title}</Text>
              <Text style={styles.tileSubtitle}>{nook.subtitle}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#fff" },
  container: { padding: 20, gap: 20 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
  },
  title: { fontSize: 28, fontWeight: "700" },
  settings: { color: "#8a5a3b", fontSize: 15 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  tile: {
    width: 150,
    height: 150,
    borderRadius: 16,
    backgroundColor: "#f5ece3",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: 12,
  },
  tileEmoji: { fontSize: 32 },
  tileTitle: { fontSize: 16, fontWeight: "600" },
  tileSubtitle: { fontSize: 12, color: "#777", textAlign: "center" },
});
