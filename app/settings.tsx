import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";

import { useAuth } from "../lib/auth-context";
import { formatDate } from "../lib/gift-nook";
import { supabase } from "../lib/supabase";
import { colors, ui } from "../lib/theme";

// Hearth settings (CORE-013): account-wide things — who you are, your name,
// signing out. Each Nook has its own settings page for Nook-specific options.
export default function HearthSettings() {
  const router = useRouter();
  const { session } = useAuth();
  const user = session?.user;

  const [name, setName] = useState("");
  const [savedName, setSavedName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        setName(data?.display_name ?? "");
        setSavedName(data?.display_name ?? "");
      });
  }, [user]);

  async function saveName() {
    if (!user) return;
    if (!name.trim()) {
      setError("Your name can't be blank.");
      return;
    }
    setIsSaving(true);
    setError(null);
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ display_name: name.trim() })
      .eq("id", user.id);
    setIsSaving(false);
    if (updateError) setError(updateError.message);
    else setSavedName(name.trim());
  }

  function confirmSignOut() {
    Alert.alert("Sign out?", "You can sign back in any time with a code sent to your email.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => {
          await supabase.auth.signOut();
          router.replace("/sign-in");
        },
      },
    ]);
  }

  return (
    <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
      <Text style={ui.sectionTitle}>Your name</Text>
      <Text style={ui.muted}>This is what your family sees in every Nook.</Text>
      <View style={ui.row}>
        <TextInput
          style={[ui.input, { flex: 1 }]}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Josh"
        />
        {name.trim() !== savedName ? (
          <TouchableOpacity style={ui.button} onPress={saveName} disabled={isSaving}>
            {isSaving ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={ui.buttonText}>Save</Text>
            )}
          </TouchableOpacity>
        ) : null}
      </View>
      {error ? <Text style={ui.error}>{error}</Text> : null}

      <Text style={ui.sectionTitle}>Account</Text>
      <View style={ui.card}>
        <Text style={ui.muted}>Email</Text>
        <Text style={ui.cardTitle}>{user?.email}</Text>
        {user?.created_at ? (
          <>
            <Text style={[ui.muted, { marginTop: 8 }]}>Member since</Text>
            <Text style={ui.cardTitle}>{formatDate(user.created_at)}</Text>
          </>
        ) : null}
      </View>

      <TouchableOpacity style={ui.secondaryButton} onPress={confirmSignOut}>
        <Text style={ui.secondaryButtonText}>Sign out</Text>
      </TouchableOpacity>

      <Text style={[ui.muted, { textAlign: "center", marginTop: 24 }]}>
        Nook v{Constants.expoConfig?.version ?? "?"}
      </Text>
    </ScrollView>
  );
}
