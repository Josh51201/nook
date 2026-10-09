import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet } from "react-native";
import { Text, TextInput } from "../../components/text";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import Animated, { FadeInDown, ZoomIn } from "react-native-reanimated";

import { IconBadge } from "../../components/icon";
import { Tap } from "../../components/motion";
import { Button } from "../../components/ui";
import { RESEND_SECONDS, cleanCode, friendlyCodeError } from "../../lib/sign-in";
import { supabase } from "../../lib/supabase";
import { colors, themed } from "../../lib/theme";

export default function Verify() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email: string }>();
  const [code, setCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [waitLeft, setWaitLeft] = useState(RESEND_SECONDS);
  const [isResending, setIsResending] = useState(false);

  // Count down until a new code can be asked for.
  useEffect(() => {
    if (waitLeft <= 0) return;
    const timer = setTimeout(() => setWaitLeft((left) => left - 1), 1000);
    return () => clearTimeout(timer);
  }, [waitLeft]);

  async function resend() {
    if (!email) return;
    setIsResending(true);
    setError(null);
    setNotice(null);
    const { error: sendError } = await supabase.auth.signInWithOtp({ email });
    setIsResending(false);
    if (sendError) {
      setError(friendlyCodeError(sendError.message));
      return;
    }
    setCode("");
    setWaitLeft(RESEND_SECONDS);
    setNotice("A new code is on its way. Use the newest email.");
  }

  async function verifyCode() {
    if (!email) {
      setError("Missing email — go back and try again.");
      return;
    }

    setIsVerifying(true);
    setError(null);
    setNotice(null);

    const { error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: code.trim(),
      type: "email",
    });

    setIsVerifying(false);

    if (verifyError) {
      setError(friendlyCodeError(verifyError.message));
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
      <Text style={styles.subtitle}>
        Type the code we emailed to {email}. It can take a minute to arrive — check your spam or junk folder too.
      </Text>

      <TextInput
        style={styles.input}
        placeholder="123456"
        value={code}
        onChangeText={(text) => setCode(cleanCode(text))}
        keyboardType="number-pad"
        // Lets the phone offer the code from the email above the keyboard.
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        autoFocus
        editable={!isVerifying}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}

      <Button title="Verify" onPress={verifyCode} loading={isVerifying} disabled={code.length < 6} style={{ marginTop: 8 }} />
      <Button
        title={waitLeft > 0 ? `Send a new code in ${waitLeft}s` : "Send a new code"}
        variant="secondary"
        onPress={resend}
        loading={isResending}
        disabled={waitLeft > 0 || isVerifying}
      />
      <Tap onPress={() => router.back()} hitSlop={10} accessibilityRole="button" style={{ alignSelf: "center", padding: 8 }}>
        <Text style={styles.link}>Wrong email? Go back</Text>
      </Tap>
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
    error: { color: "#c0392b", textAlign: "center", lineHeight: 21 },
    notice: { color: colors.bark, textAlign: "center", lineHeight: 21 },
    link: { color: colors.bark, fontSize: 15, fontWeight: "600" },
  })
);
