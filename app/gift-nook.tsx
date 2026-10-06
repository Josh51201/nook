import { useRouter } from "expo-router";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

// Placeholder only — the real Gift Nook UI (Wishbooks, Burrows, claiming) comes in a
// later session. This session builds its database schema (see docs/NOOK_REQUIREMENTS.md
// GIFT-001..016), not this screen.
export default function GiftNook() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>🎁</Text>
      <Text style={styles.title}>Gift Nook</Text>
      <Text style={styles.subtitle}>Coming soon — this is a placeholder tile for now.</Text>
      <TouchableOpacity style={styles.button} onPress={() => router.back()}>
        <Text style={styles.buttonText}>Back to the Hearth</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, gap: 10 },
  emoji: { fontSize: 48 },
  title: { fontSize: 24, fontWeight: "700" },
  subtitle: { fontSize: 15, color: "#555", textAlign: "center" },
  button: { marginTop: 16 },
  buttonText: { color: "#8a5a3b", fontSize: 15 },
});
