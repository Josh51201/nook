import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, TextInput } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import Animated, { FadeInDown, ZoomIn } from "react-native-reanimated";

import { IconBadge } from "../../components/icon";
import { Button } from "../../components/ui";
import { supabase } from "../../lib/supabase";
import { colors, themed } from "../../lib/theme";

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
      behavior="padding"
    >
      <Animated.View entering={ZoomIn.springify().damping(14)} style={{ alignSelf: "center", marginBottom: 8 }}>
        <IconBadge name="wave" size={76} />
      </Animated.View>
      <Animated.Text entering={FadeInDown.delay(80).springify()} style={styles.title}>Check your email</Animated.Text>
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

      <Button title="Verify" onPress={verifyCode} loading={isVerifying} style={{ marginTop: 8 }} />
    </KeyboardAvoidingView>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    container: { flex: 1, justifyContent: "center", padding: 24, gap: 12, backgroundColor: colors.background },
    title: { fontSize: 28, fontWeight: "800", textAlign: "center", color: colors.text, letterSpacing: -0.4 },
    subtitle: { fontSize: 15, color: colors.muted, textAlign: "center", marginBottom: 12, lineHeight: 21 },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      color: colors.text,
      borderRadius: 14,
      padding: 14,
      fontSize: 20,
      textAlign: "center",
      letterSpacing: 4,
    },
    error: { color: "#c0392b", textAlign: "center" },
  })
);
