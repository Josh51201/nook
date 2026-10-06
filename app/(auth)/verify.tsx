import { useLocalSearchParams, useRouter } from "expo-router";
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

export default function Verify() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email: string }>();
  const [code, setCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function verifyCode() {
    if (!email) {
      setError("Missing email — go back and try again.");
      return;
    }

    setIsVerifying(true);
    setError(null);

    const { error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: code.trim(),
      type: "email",
    });

    setIsVerifying(false);

    if (verifyError) {
      setError(verifyError.message);
      return;
    }

    router.replace("/hearth");
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Text style={styles.title}>Check your email</Text>
      <Text style={styles.subtitle}>Enter the code we sent to {email}.</Text>

      <TextInput
        style={styles.input}
        placeholder="123456"
        value={code}
        onChangeText={setCode}
        keyboardType="number-pad"
        autoFocus
        editable={!isVerifying}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity style={styles.button} onPress={verifyCode} disabled={isVerifying}>
        {isVerifying ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Verify</Text>
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
    fontSize: 20,
    textAlign: "center",
    letterSpacing: 4,
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
