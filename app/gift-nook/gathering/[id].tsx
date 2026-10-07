import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Text, TouchableOpacity, View } from "react-native";

import { NookScroll } from "../../../components/nook-scroll";
import { useAuth } from "../../../lib/auth-context";
import {
  countdown,
  displayName,
  formatDate,
  gatheringKindInfo,
  isArchived,
  type Gathering,
  type Profile,
} from "../../../lib/gift-nook";
import { supabase } from "../../../lib/supabase";
import { ui } from "../../../lib/theme";

// One Gathering. Whose Wishbooks it points to is provisional pending Q-003:
// its honorees if it has any, otherwise everyone in the Burrow. Each person's
// list is filtered to the gifts they picked for this Gathering (GIFT-017).
export default function GatheringScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const userId = session?.user.id;

  const [gathering, setGathering] = useState<Gathering | null>(null);
  const [people, setPeople] = useState<Profile[]>([]);
  const [hasHonorees, setHasHonorees] = useState(false);
  const [canDelete, setCanDelete] = useState(false);
  const [managedIds, setManagedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: row, error: gatheringError } = await supabase
      .from("gatherings")
      .select("id, burrow_id, title, kind, ends_at, created_by")
      .eq("id", id)
      .single();
    if (gatheringError || !row) {
      setError(gatheringError?.message ?? "Couldn't find that Gathering.");
      setIsLoading(false);
      return;
    }
    setGathering(row as Gathering);

    // GIFT-028: only Burrow admins or whoever made it can delete it.
    const [myRole, managed] = await Promise.all([
      supabase
        .from("burrow_members")
        .select("role")
        .eq("burrow_id", row.burrow_id)
        .eq("profile_id", userId!)
        .maybeSingle(),
      supabase.from("profile_managers").select("profile_id").eq("manager_id", userId!),
    ]);
    setCanDelete(myRole.data?.role === "admin" || row.created_by === userId);
    setManagedIds(new Set((managed.data ?? []).map((m) => m.profile_id)));

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
  }, [id, userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  function openWishbook(profileId: string) {
    if (profileId === userId) {
      router.push({ pathname: "/gift-nook/gathering-picks", params: { gatheringId: id } });
    } else if (managedIds.has(profileId)) {
      router.push({ pathname: "/gift-nook/gathering-picks", params: { gatheringId: id, profileId } });
    } else {
      router.push({ pathname: "/gift-nook/member/[id]", params: { id: profileId, gatheringId: id } });
    }
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
    <NookScroll>
      <Stack.Screen options={{ title: gathering.title }} />
      {error ? <Text style={ui.error}>{error}</Text> : null}

      <View style={ui.card}>
        <Text style={{ fontSize: 40 }}>{kind.emoji}</Text>
        <Text style={[ui.cardTitle, { fontSize: 20 }]}>{gathering.title}</Text>
        <Text style={ui.muted}>
          {kind.label} · {formatDate(gathering.ends_at)} · {countdown(gathering.ends_at)}
          {archived ? " · Archived" : ""}
        </Text>
        {!archived ? (
          <Text
            style={[ui.link, { marginTop: 6 }]}
            onPress={() =>
              router.push({ pathname: "/gift-nook/gathering-form", params: { gatheringId: id } })
            }
          >
            Edit date, name, or who it's for
          </Text>
        ) : null}
      </View>

      <Text style={ui.sectionTitle}>{hasHonorees ? "Celebrating" : "Everyone's Wishbooks"}</Text>
      {people.map((person) => (
        <TouchableOpacity key={person.id} style={ui.card} onPress={() => openWishbook(person.id)}>
          <Text style={ui.cardTitle}>
            {displayName(person)}
            {person.id === userId ? " (you)" : ""}
          </Text>
          <Text style={ui.muted}>
            {person.id === userId
              ? "Pick which of your gifts show here →"
              : managedIds.has(person.id)
                ? "Pick which of their gifts show here →"
                : "View their gifts →"}
          </Text>
        </TouchableOpacity>
      ))}

      {canDelete ? (
        <TouchableOpacity onPress={confirmDelete} style={{ alignItems: "center", marginTop: 16 }}>
          <Text style={ui.error}>Delete Gathering</Text>
        </TouchableOpacity>
      ) : null}
    </NookScroll>
  );
}
