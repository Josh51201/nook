import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Text, TextInput, TouchableOpacity, View } from "react-native";

import { NookScroll } from "../components/nook-scroll";
import { useAuth } from "../lib/auth-context";
import { hearthThemes, useHearthLayout, type HearthThemeKey } from "../lib/hearth";
import { formatDate } from "../lib/gift-nook";
import { supabase } from "../lib/supabase";
import { colors, ui } from "../lib/theme";

// Hearth settings (CORE-013): account-wide things — who you are, your name,
// how your Hearth looks (CORE-008), signing out. Each Nook has its own
// settings page for Nook-specific options.
export default function HearthSettings() {
  const router = useRouter();
  const { session } = useAuth();
  const user = session?.user;

  const [name, setName] = useState("");
  const [savedName, setSavedName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { layout, save: saveHearth, isLoading: hearthLoading } = useHearthLayout();
  const [hearthTitle, setHearthTitle] = useState<string | null>(null);

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

  function saveHearthChanges(changes: Parameters<typeof saveHearth>[0]) {
    saveHearth(changes).catch((saveError: Error) =>
      Alert.alert("Couldn't save that", saveError.message)
    );
  }

  function commitHearthTitle() {
    if (hearthTitle === null) return;
    const next = hearthTitle.trim() || "The Hearth";
    if (next !== layout.title) saveHearthChanges({ title: next });
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
    <NookScroll>
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

      <Text style={ui.sectionTitle}>Your Hearth</Text>
      {hearthLoading ? (
        <ActivityIndicator />
      ) : (
        <>
          <Text style={ui.label}>Name</Text>
          <TextInput
            style={ui.input}
            value={hearthTitle ?? layout.title}
            onChangeText={setHearthTitle}
            onEndEditing={commitHearthTitle}
            placeholder="The Hearth"
            returnKeyType="done"
          />
          <Text style={ui.label}>Theme</Text>
          <View style={ui.chips}>
            {(Object.keys(hearthThemes) as HearthThemeKey[]).map((key) => {
              const theme = hearthThemes[key];
              const selected = layout.theme === key;
              return (
                <TouchableOpacity
                  key={key}
                  onPress={() => saveHearthChanges({ theme: key })}
                  style={[
                    ui.chip,
                    { backgroundColor: theme.background, borderColor: theme.accent },
                    selected && { borderWidth: 3 },
                  ]}
                >
                  <Text style={{ color: theme.text, fontWeight: selected ? "700" : "400" }}>
                    {theme.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={ui.muted}>
            To arrange, resize, or recolor your Nooks, tap Edit on the Hearth.
          </Text>
        </>
      )}

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
    </NookScroll>
  );
}
