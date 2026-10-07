import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  Share,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { useAuth } from "../../../lib/auth-context";
import {
  displayName,
  formatDate,
  gatheringKindInfo,
  isArchived,
  type BurrowMember,
  type Gathering,
} from "../../../lib/gift-nook";
import { supabase } from "../../../lib/supabase";
import { ui } from "../../../lib/theme";

// One Burrow (GIFT-001/005): who's in it, inviting more people (Knocks),
// and its Gatherings (GIFT-014/015/016).
export default function BurrowScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const userId = session?.user.id;

  const [name, setName] = useState("");
  const [members, setMembers] = useState<BurrowMember[]>([]);
  const [gatherings, setGatherings] = useState<Gathering[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isKnocking, setIsKnocking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [burrowResult, membersResult, gatheringsResult] = await Promise.all([
      supabase.from("burrows").select("name").eq("id", id).single(),
      supabase
        .from("burrow_members")
        .select("profile_id, role, profiles(id, display_name)")
        .eq("burrow_id", id),
      supabase
        .from("gatherings")
        .select("id, burrow_id, title, kind, ends_at")
        .eq("burrow_id", id)
        .order("ends_at"),
    ]);
    const firstError = burrowResult.error ?? membersResult.error ?? gatheringsResult.error;
    if (firstError) setError(firstError.message);
    setName(burrowResult.data?.name ?? "");
    setMembers((membersResult.data ?? []) as unknown as BurrowMember[]);
    setGatherings((gatheringsResult.data ?? []) as Gathering[]);
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

  async function sendKnock() {
    setIsKnocking(true);
    const { data: code, error: rpcError } = await supabase.rpc("create_knock", { target_burrow: id });
    setIsKnocking(false);
    if (rpcError || !code) {
      Alert.alert("Couldn't make a Knock", rpcError?.message ?? "Try again.");
      return;
    }
    await Share.share({
      message:
        `Come join our Burrow "${name}" on Nook! 🏡\n\n` +
        `Open Nook → Gift Nook → Answer a Knock, and enter this code:\n\n${code}\n\n` +
        `(It works for 7 days.)`,
    });
  }

  function confirmLeave() {
    Alert.alert(
      `Leave ${name}?`,
      "You'll stop seeing this Burrow's Wishbooks and Gatherings. You can rejoin with a new Knock.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Leave",
          style: "destructive",
          onPress: async () => {
            const { error: leaveError } = await supabase
              .from("burrow_members")
              .delete()
              .eq("burrow_id", id)
              .eq("profile_id", userId!);
            if (leaveError) setError(leaveError.message);
            else router.back();
          },
        },
      ]
    );
  }

  if (isLoading) {
    return (
      <View style={ui.center}>
        <ActivityIndicator />
      </View>
    );
  }

  const upcoming = gatherings.filter((g) => !isArchived(g));
  const archived = gatherings.filter(isArchived).reverse();

  return (
    <ScrollView
      contentContainerStyle={ui.screen}
      refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
    >
      <Stack.Screen options={{ title: name || "Burrow" }} />
      {error ? <Text style={ui.error}>{error}</Text> : null}

      <Text style={ui.sectionTitle}>Gatherings</Text>
      {upcoming.length === 0 ? (
        <Text style={ui.muted}>Nothing coming up. Plan a birthday, Christmas, or anything else.</Text>
      ) : (
        upcoming.map((gathering) => (
          <GatheringRow
            key={gathering.id}
            gathering={gathering}
            onPress={() => router.push(`/gift-nook/gathering/${gathering.id}`)}
          />
        ))
      )}
      <TouchableOpacity
        style={ui.secondaryButton}
        onPress={() =>
          router.push({ pathname: "/gift-nook/gathering-form", params: { burrowId: id } })
        }
      >
        <Text style={ui.secondaryButtonText}>+ New Gathering</Text>
      </TouchableOpacity>

      <Text style={ui.sectionTitle}>Who's in the Burrow</Text>
      {members.map((member) => (
        <TouchableOpacity
          key={member.profile_id}
          style={ui.card}
          onPress={() => openWishbook(member.profile_id)}
        >
          <Text style={ui.cardTitle}>
            {displayName(member.profiles)}
            {member.profile_id === userId ? " (you)" : ""}
          </Text>
          <Text style={ui.muted}>
            {member.role === "admin" ? "Admin · " : ""}View Wishbook →
          </Text>
        </TouchableOpacity>
      ))}
      <TouchableOpacity style={ui.button} onPress={sendKnock} disabled={isKnocking}>
        <Text style={ui.buttonText}>{isKnocking ? "Making a code…" : "🚪 Send a Knock (invite)"}</Text>
      </TouchableOpacity>

      {archived.length > 0 ? (
        <>
          <Text style={ui.sectionTitle}>Archived Gatherings</Text>
          {archived.map((gathering) => (
            <GatheringRow
              key={gathering.id}
              gathering={gathering}
              onPress={() => router.push(`/gift-nook/gathering/${gathering.id}`)}
            />
          ))}
        </>
      ) : null}

      <TouchableOpacity onPress={confirmLeave} style={{ alignItems: "center", marginTop: 16 }}>
        <Text style={ui.error}>Leave this Burrow</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function GatheringRow({ gathering, onPress }: { gathering: Gathering; onPress: () => void }) {
  const kind = gatheringKindInfo(gathering.kind);
  return (
    <TouchableOpacity style={ui.card} onPress={onPress}>
      <Text style={ui.cardTitle}>
        {kind.emoji} {gathering.title}
      </Text>
      <Text style={ui.muted}>
        {kind.label} · {isArchived(gathering) ? "ended" : "ends"} {formatDate(gathering.ends_at)}
      </Text>
    </TouchableOpacity>
  );
}
