import { StyleSheet, Text, View } from "react-native";

// Shown instead of crashing when .env hasn't been filled in yet (see .env.example).
export default function SetupNeeded() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Almost there</Text>
      <Text style={styles.body}>
        Nook needs your Supabase project URL and anon key before it can sign anyone in.
      </Text>
      <Text style={styles.body}>
        Copy .env.example to .env, fill in EXPO_PUBLIC_SUPABASE_URL and
        EXPO_PUBLIC_SUPABASE_ANON_KEY from your Supabase project's Settings → API page, then
        restart the dev server.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, gap: 12 },
  title: { fontSize: 22, fontWeight: "700", textAlign: "center" },
  body: { fontSize: 15, textAlign: "center", color: "#555" },
});
