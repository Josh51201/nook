import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
} from "react-native";

import { supabase } from "../../lib/supabase";

export default function SignIn() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode() {
    const trimmed = email.trim();
    if (!trimmed) {
      setError("Enter your email first.");
      return;
    }

    setIsSending(true);
    setError(null);

    const { error: signInError } = await supabase.auth.signInWithOtp({ email: trimmed });

    setIsSending(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    router.push({ pathname: "/(auth)/verify", params: { email: trimmed } });
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Text style={styles.title}>Welcome to Nook</Text>
      <Text style={styles.subtitle}>Enter your email and we'll send you a one-time code.</Text>

      <TextInput
        style={styles.input}
        placeholder="you@example.com"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        editable={!isSending}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity style={styles.button} onPress={sendCode} disabled={isSending}>
        {isSending ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Send code</Text>
        )}
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, gap: 12 },
  title: { fontSize: 26, fontWeight: "700", textAlign: "center" },
  subtitle: { fontSize: 15, color: "#555", textAlign: "center", marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
  },
  button: {
    backgroundColor: "#8a5a3b",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
    marginTop: 8,
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  error: { color: "#c0392b", textAlign: "center" },
});
