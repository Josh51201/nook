import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Text, View } from "react-native";

import { IconBadge } from "../../../components/icon";
import { Appear, LoadingScreen } from "../../../components/motion";
import { NookScroll } from "../../../components/nook-scroll";
import { Button, EmptyState, NavCard, SectionHeader } from "../../../components/ui";
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
import { colors, ui } from "../../../lib/theme";

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

  if (isLoading) return <LoadingScreen />;

  if (!gathering) {
    return <EmptyState icon="calendar" title="Couldn't find that Gathering" body={error ?? undefined} />;
  }

  const kind = gatheringKindInfo(gathering.kind);
  const archived = isArchived(gathering);

  return (
    <NookScroll>
      <Stack.Screen options={{ title: gathering.title }} />
      {error ? <Text style={ui.error}>{error}</Text> : null}

      <Appear>
        <View style={[ui.card, { alignItems: "center", gap: 8, paddingVertical: 24 }]}>
          <IconBadge name={kind.icon} size={72} color={kind.color} background={`${kind.color}1f`} />
          <Text style={{ fontSize: 22, fontWeight: "700", color: colors.text, textAlign: "center" }}>
            {gathering.title}
          </Text>
          <Text style={{ fontSize: 17, fontWeight: "600", color: kind.color }}>
            {archived ? "Archived" : countdown(gathering.ends_at)}
          </Text>
          <Text style={ui.muted}>
            {kind.label} · {formatDate(gathering.ends_at)}
          </Text>
          {!archived ? (
            <Button
              title="Edit"
              icon="edit"
              variant="secondary"
              style={{ marginTop: 6, paddingVertical: 9 }}
              onPress={() =>
                router.push({ pathname: "/gift-nook/gathering-form", params: { gatheringId: id } })
              }
            />
          ) : null}
        </View>
      </Appear>

      <SectionHeader title={hasHonorees ? "Celebrating" : "Everyone's Wishbooks"} icon="group" />
      {people.map((person, i) => {
        const isMe = person.id === userId;
        const manages = managedIds.has(person.id);
        return (
          <NavCard
            key={person.id}
            index={i}
            icon={isMe || manages ? "heart" : "wishbook"}
            title={`${displayName(person)}${isMe ? " (you)" : ""}`}
            subtitle={
              isMe
                ? "Pick which of your gifts show here"
                : manages
                  ? "Pick which of their gifts show here"
                  : "View their gifts"
            }
            onPress={() => openWishbook(person.id)}
          />
        );
      })}

      {canDelete ? (
        <Button title="Delete Gathering" icon="trash" variant="danger" onPress={confirmDelete} style={{ marginTop: 12 }} />
      ) : null}
    </NookScroll>
  );
}
