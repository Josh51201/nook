import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { useAuth } from "../../lib/auth-context";
import { supabase } from "../../lib/supabase";
import { colors, ui } from "../../lib/theme";

type BurrowRow = { id: string; name: string };

// Gift Nook home: your name, your Wishbook, your Burrows, and ways to start
// or join one (GIFT-001, GIFT-011).
export default function GiftNookHome() {
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user.id;

  const [burrows, setBurrows] = useState<BurrowRow[]>([]);
  const [name, setName] = useState("");
  const [savedName, setSavedName] = useState("");
  const [newBurrowName, setNewBurrowName] = useState("");
  const [knockCode, setKnockCode] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState<"create" | "join" | "name" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    const [burrowsResult, profileResult] = await Promise.all([
      supabase.from("burrows").select("id, name").order("name"),
      supabase.from("profiles").select("display_name").eq("id", userId).single(),
    ]);
    if (burrowsResult.error) setError(burrowsResult.error.message);
    else setBurrows(burrowsResult.data ?? []);
    const currentName = profileResult.data?.display_name ?? "";
    setName(currentName);
    setSavedName(currentName);
    setIsLoading(false);
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function saveName() {
    if (!userId || !name.trim()) return;
    setBusy("name");
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ display_name: name.trim() })
      .eq("id", userId);
    setBusy(null);
    if (updateError) setError(updateError.message);
    else setSavedName(name.trim());
  }

  async function createBurrow() {
    if (!newBurrowName.trim()) {
      setError("Give your Burrow a name first.");
      return;
    }
    setBusy("create");
    setError(null);
    const { data, error: rpcError } = await supabase.rpc("create_burrow", {
      burrow_name: newBurrowName.trim(),
    });
    setBusy(null);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    setNewBurrowName("");
    router.push(`/gift-nook/burrow/${data}`);
  }

  async function answerKnock() {
    if (!knockCode.trim()) {
      setError("Enter the Knock code someone sent you.");
      return;
    }
    setBusy("join");
    setError(null);
    const { data, error: rpcError } = await supabase.rpc("answer_knock", {
      knock_code: knockCode.trim(),
    });
    setBusy(null);
    if (rpcError) {
      Alert.alert("Couldn't join", rpcError.message);
      return;
    }
    setKnockCode("");
    router.push(`/gift-nook/burrow/${data}`);
  }

  if (isLoading) {
    return (
      <View style={ui.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={ui.screen}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
    >
      {error ? <Text style={ui.error}>{error}</Text> : null}

      <Text style={ui.label}>Your name (what family sees)</Text>
      <View style={ui.row}>
        <TextInput
          style={[ui.input, { flex: 1 }]}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Josh"
        />
        {name.trim() !== savedName ? (
          <TouchableOpacity style={ui.secondaryButton} onPress={saveName} disabled={busy !== null}>
            <Text style={ui.secondaryButtonText}>{busy === "name" ? "…" : "Save"}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <TouchableOpacity style={ui.card} onPress={() => router.push("/gift-nook/wishbook")}>
        <Text style={ui.cardTitle}>📖 My Wishbook</Text>
        <Text style={ui.muted}>The gifts you'd love. Every Burrow you're in can see it.</Text>
      </TouchableOpacity>

      <Text style={ui.sectionTitle}>Your Burrows</Text>
      {burrows.length === 0 ? (
        <Text style={ui.muted}>
          You're not in any Burrows yet. Start one for your family, or join one with a Knock code.
        </Text>
      ) : (
        burrows.map((burrow) => (
          <TouchableOpacity
            key={burrow.id}
            style={ui.card}
            onPress={() => router.push(`/gift-nook/burrow/${burrow.id}`)}
          >
            <Text style={ui.cardTitle}>🏡 {burrow.name}</Text>
          </TouchableOpacity>
        ))
      )}

      <Text style={ui.sectionTitle}>Start a Burrow</Text>
      <TextInput
        style={ui.input}
        value={newBurrowName}
        onChangeText={setNewBurrowName}
        placeholder="e.g. The Collinses"
      />
      <TouchableOpacity style={ui.button} onPress={createBurrow} disabled={busy !== null}>
        {busy === "create" ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={ui.buttonText}>Start Burrow</Text>
        )}
      </TouchableOpacity>

      <Text style={ui.sectionTitle}>Answer a Knock</Text>
      <Text style={ui.muted}>Got a code from family? Enter it to join their Burrow.</Text>
      <TextInput
        style={ui.input}
        value={knockCode}
        onChangeText={(text) => setKnockCode(text.toUpperCase())}
        placeholder="ABC123"
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={6}
      />
      <TouchableOpacity style={ui.secondaryButton} onPress={answerKnock} disabled={busy !== null}>
        <Text style={ui.secondaryButtonText}>{busy === "join" ? "Joining…" : "Join Burrow"}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
