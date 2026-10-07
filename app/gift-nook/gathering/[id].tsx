import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, Text, TouchableOpacity, View } from "react-native";

import { useAuth } from "../../../lib/auth-context";
import {
  displayName,
  formatDate,
  gatheringKindInfo,
  isArchived,
  type Gathering,
  type Profile,
} from "../../../lib/gift-nook";
import { supabase } from "../../../lib/supabase";
import { ui } from "../../../lib/theme";

// One Gathering. Whose Wishbooks it points to is provisional pending
// Q-002/Q-003: its honorees if it has any, otherwise everyone in the Burrow;
// each shows their whole Wishbook.
export default function GatheringScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const userId = session?.user.id;

  const [gathering, setGathering] = useState<Gathering | null>(null);
  const [people, setPeople] = useState<Profile[]>([]);
  const [hasHonorees, setHasHonorees] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: row, error: gatheringError } = await supabase
      .from("gatherings")
      .select("id, burrow_id, title, kind, ends_at")
      .eq("id", id)
      .single();
    if (gatheringError || !row) {
      setError(gatheringError?.message ?? "Couldn't find that Gathering.");
      setIsLoading(false);
      return;
    }
    setGathering(row as Gathering);

    const { data: honorees } = await supabase
      .from("gathering_honorees")
      .select("profiles(id, display_name)")
      .eq("gathering_id", id);
    const honoreeProfiles = (honorees ?? [])
      .map((h) => h.profiles as unknown as Profile | null)
      .filter((p): p is Profile => Boolean(p));

    if (honoreeProfiles.length) {
      setHasHonorees(true);
      setPeople(honoreeProfiles);
    } else {
      setHasHonorees(false);
      const { data: members } = await supabase
        .from("burrow_members")
        .select("profiles(id, display_name)")
        .eq("burrow_id", row.burrow_id);
      setPeople(
        (members ?? [])
          .map((m) => m.profiles as unknown as Profile | null)
          .filter((p): p is Profile => Boolean(p))
      );
    }
    setIsLoading(false);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  function openWishbook(profileId: string) {
    if (profileId === userId) router.push("/gift-nook/wishbook");
    else router.push(`/gift-nook/member/${profileId}`);
  }

  function confirmDelete() {
    Alert.alert("Delete this Gathering?", "Wishbooks and tucks aren't affected.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const { error: deleteError } = await supabase.from("gatherings").delete().eq("id", id);
          if (deleteError) setError(deleteError.message);
          else router.back();
        },
      },
    ]);
  }

  if (isLoading) {
    return (
      <View style={ui.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!gathering) {
    return (
      <View style={ui.center}>
        <Text style={ui.error}>{error}</Text>
      </View>
    );
  }

  const kind = gatheringKindInfo(gathering.kind);
  const archived = isArchived(gathering);

  return (
    <ScrollView contentContainerStyle={ui.screen}>
      <Stack.Screen options={{ title: gathering.title }} />
      {error ? <Text style={ui.error}>{error}</Text> : null}

      <View style={ui.card}>
        <Text style={{ fontSize: 40 }}>{kind.emoji}</Text>
        <Text style={[ui.cardTitle, { fontSize: 20 }]}>{gathering.title}</Text>
        <Text style={ui.muted}>
          {kind.label} · {archived ? "Ended" : "Ends"} {formatDate(gathering.ends_at)}
          {archived ? " · Archived" : ""}
        </Text>
      </View>

      <Text style={ui.sectionTitle}>{hasHonorees ? "Celebrating" : "Everyone's Wishbooks"}</Text>
      {people.map((person) => (
        <TouchableOpacity key={person.id} style={ui.card} onPress={() => openWishbook(person.id)}>
          <Text style={ui.cardTitle}>
            {displayName(person)}
            {person.id === userId ? " (you)" : ""}
          </Text>
          <Text style={ui.muted}>View Wishbook →</Text>
        </TouchableOpacity>
      ))}

      <TouchableOpacity onPress={confirmDelete} style={{ alignItems: "center", marginTop: 16 }}>
        <Text style={ui.error}>Delete Gathering</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
