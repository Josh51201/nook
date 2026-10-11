import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import { friendlyError } from "../lib/feedback";
import { supabase } from "../lib/supabase";
import { colors, themed, ui } from "../lib/theme";
import { Text, TextInput } from "./text";
import { Button } from "./ui";

// App Review sign-in (AUTH-004): a hidden email + password sign-in so the
// person at Apple who reviews the app can get in, since they can't open an
// emailed code. It stays out of sight until the "Welcome to Nook" title on
// the sign-in screen is tapped five times, and only works for an account
// that was given a password in the Supabase dashboard (the demo account).
// Everyone else signs in with the emailed code (AUTH-001).
export function ReviewSignIn({ open }: { open: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function signIn() {
    if (!email.trim() || !password) {
      setError("Enter the review account's email and password.");
      return;
    }
    setIsSigningIn(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setIsSigningIn(false);
    if (signInError) setError(friendlyError(signInError));
    else router.replace("/hearth");
  }

  return (
    <Animated.View entering={FadeIn.duration(200)} style={styles.panel}>
      <Text style={ui.cardTitle}>App Review sign-in</Text>
      <TextInput
        style={ui.input}
        placeholder="Email"
        placeholderTextColor={colors.muted}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        editable={!isSigningIn}
      />
      <TextInput
        style={ui.input}
        placeholder="Password"
        placeholderTextColor={colors.muted}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        editable={!isSigningIn}
        returnKeyType="go"
        onSubmitEditing={signIn}
      />
      {error ? <Text style={ui.error}>{error}</Text> : null}
      <Button title="Sign in" variant="secondary" onPress={signIn} loading={isSigningIn} />
    </Animated.View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    panel: {
      gap: 10,
      marginTop: 12,
      padding: 14,
      borderRadius: 16,
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: colors.border,
    },
  })
);
