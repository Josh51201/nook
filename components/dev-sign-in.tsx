import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import { friendlyError } from "../lib/feedback";
import { supabase } from "../lib/supabase";
import { colors, ui } from "../lib/theme";
import { Icon } from "./icon";
import { Tap } from "./motion";
import { Button } from "./ui";

// Developer sign-in (AUTH-002): email + password for test accounts made in
// the Supabase dashboard, so you can try Nook as a second person without
// waiting on an email code. Only exists while developing — `__DEV__` is
// false in a real release, so this renders nothing there. Real sign-in stays
// the emailed one-time code (AUTH-001).
export function DevSignIn() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!__DEV__) return null;

  async function signIn() {
    if (!email.trim() || !password) {
      setError("Enter the test account's email and password.");
      return;
    }
    setIsSigningIn(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setIsSigningIn(false);
    if (signInError) setError(friendlyError(signInError));
    else router.replace("/hearth");
  }

  return (
    <View style={styles.wrap}>
      <Tap onPress={() => setOpen((o) => !o)} style={[ui.row, { alignSelf: "center", gap: 6 }]} hitSlop={10}>
        <Icon name="settings" size={14} color={colors.muted} />
        <Text style={styles.toggle}>{open ? "Hide developer sign-in" : "Developer sign-in"}</Text>
      </Tap>

      {open ? (
        <Animated.View entering={FadeIn.duration(200)} style={styles.panel}>
          <Text style={ui.muted}>
            For test accounts made in the Supabase dashboard. This box only appears while you're developing — never in
            the real app.
          </Text>
          <TextInput
            style={ui.input}
            placeholder="test@example.com"
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
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 24, gap: 12 },
  toggle: { color: colors.muted, fontSize: 13 },
  panel: {
    gap: 10,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.border,
  },
});
