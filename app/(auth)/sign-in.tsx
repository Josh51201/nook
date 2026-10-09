import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet } from "react-native";
import { Text, TextInput } from "../../components/text";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import Animated, { FadeInDown, ZoomIn } from "react-native-reanimated";

import { DevSignIn } from "../../components/dev-sign-in";
import { IconBadge } from "../../components/icon";
import { Button } from "../../components/ui";
import { looksLikeEmail } from "../../lib/sign-in";
import { supabase } from "../../lib/supabase";
import { colors, themed } from "../../lib/theme";

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
    if (!looksLikeEmail(trimmed)) {
      setError("That doesn't look like an email address — it should look like name@example.com.");
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
      behavior="padding"
    >
      <Animated.View entering={ZoomIn.springify().damping(14)} style={{ alignSelf: "center", marginBottom: 8 }}>
        <IconBadge name="hearth" size={76} />
      </Animated.View>
      <Animated.Text entering={FadeInDown.delay(80).springify()} style={styles.title}>Welcome to Nook</Animated.Text>
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

      <Button title="Send code" onPress={sendCode} loading={isSending} style={{ marginTop: 8 }} />

      <DevSignIn />
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
      fontSize: 16,
    },
    error: { color: "#c0392b", textAlign: "center" },
  })
);
