import * as Clipboard from "expo-clipboard";
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Share, Text, TextInput, View } from "react-native";

import { Icon } from "../../../components/icon";
import { Appear, LoadingScreen, Tap } from "../../../components/motion";
import { NookScroll } from "../../../components/nook-scroll";
import { Button, EmptyState, NavCard, SectionHeader } from "../../../components/ui";
import { useAuth } from "../../../lib/auth-context";
import { tap } from "../../../lib/feedback";
import {
  countdown,
  displayName,
  formatDate,
  gatheringKindInfo,
  isArchived,
  type BurrowMember,
  type Gathering,
} from "../../../lib/gift-nook";
import { supabase } from "../../../lib/supabase";
import { colors, ui } from "../../../lib/theme";

// One Burrow (GIFT-001/005): who's in it, inviting more people (Knocks),
// and its Gatherings (GIFT-014/015/016). Admins can rename or delete it,
// remove people, and make others admins (GIFT-028).
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
  const [renameTo, setRenameTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [burrowResult, membersResult, gatheringsResult] = await Promise.all([
      supabase.from("burrows").select("name").eq("id", id).single(),
      supabase
        .from("burrow_members")
        .select("profile_id, role, profiles(id, display_name, is_managed)")
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
    const message =
      `Come join our Burrow "${name}" on Nook! 🏡\n\n` +
      `Open Nook → Gift Nook → "Got a code?", and enter:\n\n${code}\n\n` +
      `(It works for 7 days.)`;
    Alert.alert(`Knock code: ${code}`, "Send it to whoever you're inviting. It works for 7 days.", [
      {
        text: "Copy code",
        onPress: async () => {
          await Clipboard.setStringAsync(code);
          tap();
        },
      },
      { text: "Share…", onPress: () => Share.share({ message }) },
      { text: "Done", style: "cancel" },
    ]);
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

  const isAdmin = members.some((m) => m.profile_id === userId && m.role === "admin");

  async function rename() {
    const next = renameTo?.trim();
    if (!next || next === name) return setRenameTo(null);
    const { error: renameError } = await supabase.from("burrows").update({ name: next }).eq("id", id);
    if (renameError) Alert.alert("Couldn't rename", renameError.message);
    setRenameTo(null);
    load();
  }

  function memberActions(member: BurrowMember) {
    const who = displayName(member.profiles);
    const options: { text: string; style?: "destructive" | "cancel"; onPress?: () => void }[] = [
      { text: "View Wishbook", onPress: () => openWishbook(member.profile_id) },
    ];
    if (!member.profiles?.is_managed) {
      const nextRole = member.role === "admin" ? "member" : "admin";
      options.push({
        text: member.role === "admin" ? "Make a regular member" : "Make an admin",
        onPress: async () => {
          const { error: roleError } = await supabase
            .from("burrow_members")
            .update({ role: nextRole })
            .eq("burrow_id", id)
            .eq("profile_id", member.profile_id);
          if (roleError) Alert.alert("Couldn't change that", roleError.message);
          load();
        },
      });
    }
    options.push({
      text: `Remove ${who}`,
      style: "destructive",
      onPress: async () => {
        const { error: removeError } = await supabase
          .from("burrow_members")
          .delete()
          .eq("burrow_id", id)
          .eq("profile_id", member.profile_id);
        if (removeError) Alert.alert("Couldn't remove them", removeError.message);
        load();
      },
    });
    options.push({ text: "Cancel", style: "cancel" });
    Alert.alert(who, undefined, options);
  }

  function confirmDeleteBurrow() {
    Alert.alert(
      `Delete ${name}?`,
      "Its Gatherings are deleted for everyone. Wishbooks and tucks aren't affected — they belong to people, not Burrows.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const { error: deleteError } = await supabase.from("burrows").delete().eq("id", id);
            if (deleteError) Alert.alert("Couldn't delete it", deleteError.message);
            else router.navigate("/gift-nook");
          },
        },
      ]
    );
  }

  if (isLoading) return <LoadingScreen />;

  const upcoming = gatherings.filter((g) => !isArchived(g));
  const archived = gatherings.filter(isArchived).reverse();

  return (
    <NookScroll onRefresh={load}>
      <Stack.Screen options={{ title: name || "Burrow" }} />
      {error ? <Text style={ui.error}>{error}</Text> : null}

      <SectionHeader title="Gatherings" icon="calendar" />
      {upcoming.length === 0 ? (
        <EmptyState
          icon="celebration"
          title="Nothing coming up"
          body="Plan a birthday, Christmas, or anything else worth celebrating."
        />
      ) : (
        upcoming.map((gathering, i) => (
          <GatheringRow
            key={gathering.id}
            index={i}
            gathering={gathering}
            onPress={() => router.push(`/gift-nook/gathering/${gathering.id}`)}
          />
        ))
      )}
      <Button
        title="New Gathering"
        icon="add"
        variant="secondary"
        onPress={() => router.push({ pathname: "/gift-nook/gathering-form", params: { burrowId: id } })}
      />

      <SectionHeader title="Who's in the Burrow" icon="group" />
      {members.map((member, i) => {
        const isMe = member.profile_id === userId;
        const canManage = isAdmin && !isMe;
        return (
          <NavCard
            key={member.profile_id}
            index={i}
            icon={member.profiles?.is_managed ? "kid" : "person"}
            iconColor={member.profiles?.is_managed ? "#4f7fb0" : colors.bark}
            iconBackground={member.profiles?.is_managed ? colors.sky : colors.barkSoft}
            title={`${displayName(member.profiles)}${isMe ? " (you)" : ""}`}
            subtitle={`${member.role === "admin" ? "Admin · " : ""}View Wishbook`}
            onPress={() => openWishbook(member.profile_id)}
            onLongPress={canManage ? () => memberActions(member) : undefined}
            right={
              canManage ? (
                <Tap
                  onPress={() => memberActions(member)}
                  hitSlop={12}
                  pressedScale={0.85}
                  accessibilityLabel={`Options for ${displayName(member.profiles)}`}
                >
                  <Icon name="more" size={20} color={colors.muted} />
                </Tap>
              ) : undefined
            }
          />
        );
      })}
      <Button title="Send a Knock (invite)" icon="invite" onPress={sendKnock} loading={isKnocking} />

      {archived.length > 0 ? (
        <>
          <SectionHeader title="Archived Gatherings" icon="given" />
          {archived.map((gathering, i) => (
            <GatheringRow
              key={gathering.id}
              index={i}
              gathering={gathering}
              onPress={() => router.push(`/gift-nook/gathering/${gathering.id}`)}
            />
          ))}
        </>
      ) : null}

      {isAdmin ? (
        <>
          <SectionHeader title="Admin" icon="settings" />
          {renameTo === null ? (
            <Button title="Rename Burrow" icon="edit" variant="secondary" onPress={() => setRenameTo(name)} />
          ) : (
            <Appear>
              <View style={ui.row}>
                <TextInput
                  style={[ui.input, { flex: 1 }]}
                  value={renameTo}
                  onChangeText={setRenameTo}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={rename}
                />
                <Button title="Save" onPress={rename} />
              </View>
            </Appear>
          )}
          <Text style={ui.muted}>Tap ••• on someone to make them an admin or remove them.</Text>
        </>
      ) : null}

      <Button title="Leave this Burrow" icon="door" variant="danger" onPress={confirmLeave} style={{ marginTop: 12 }} />
      {isAdmin ? (
        <Button title="Delete this Burrow" icon="trash" variant="danger" onPress={confirmDeleteBurrow} />
      ) : null}
    </NookScroll>
  );
}

function GatheringRow({
  gathering,
  onPress,
  index,
}: {
  gathering: Gathering;
  onPress: () => void;
  index: number;
}) {
  const kind = gatheringKindInfo(gathering.kind);
  return (
    <NavCard
      index={index}
      icon={kind.icon}
      iconColor={kind.color}
      title={gathering.title}
      subtitle={`${kind.label} · ${formatDate(gathering.ends_at)} · ${countdown(gathering.ends_at)}`}
      onPress={onPress}
    />
  );
}
