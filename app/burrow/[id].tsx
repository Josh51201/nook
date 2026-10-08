import * as Clipboard from "expo-clipboard";
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Share, View } from "react-native";
import { Text, TextInput } from "../../components/text";

import { Avatar } from "../../components/avatar";
import { Icon } from "../../components/icon";
import { Appear, LoadingScreen, Tap } from "../../components/motion";
import { NookScroll } from "../../components/nook-scroll";
import { Button, NavCard, SectionHeader } from "../../components/ui";
import { useAuth } from "../../lib/auth-context";
import { guarded, tap } from "../../lib/feedback";
import { displayName, PROFILE_FIELDS, type BurrowMember } from "../../lib/gift-nook";
import { nookCatalog } from "../../lib/nooks";
import { supabase } from "../../lib/supabase";
import { colors, ui } from "../../lib/theme";

// One Burrow, outside any Nook (CORE-025): who's in it, inviting more people
// with a Knock (GIFT-001/018), and a door into each Nook's side of it (the
// Gift Nook's Gatherings and Wishbooks). Admins can rename or delete it,
// remove people, and make others admins (GIFT-028).
export default function BurrowScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const userId = session?.user.id;

  const [name, setName] = useState("");
  const [members, setMembers] = useState<BurrowMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isKnocking, setIsKnocking] = useState(false);
  const [renameTo, setRenameTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    () =>
      guarded(
        async () => {
          const [burrowResult, membersResult] = await Promise.all([
            supabase.from("burrows").select("name").eq("id", id).single(),
            supabase.from("burrow_members").select(`profile_id, role, profiles(${PROFILE_FIELDS})`).eq("burrow_id", id),
          ]);
          const firstError = burrowResult.error ?? membersResult.error;
          if (firstError) setError(firstError.message);
          setName(burrowResult.data?.name ?? "");
          setMembers((membersResult.data ?? []) as unknown as BurrowMember[]);
          setIsLoading(false);
        },
        setError,
        () => setIsLoading(false)
      ),
    [id]
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const isAdmin = members.some((m) => m.profile_id === userId && m.role === "admin");
  const burrowNooks = nookCatalog.filter((nook) => nook.available && nook.burrow);

  function openWishbook(profileId: string) {
    if (profileId === userId) router.push("/gift-nook/wishbook");
    else router.push(`/gift-nook/member/${profileId}`);
  }

  async function sendKnock() {
    setIsKnocking(true);
    const { data: code, error: rpcError } = await supabase.rpc("create_knock", {
      target_burrow: id,
    });
    setIsKnocking(false);
    if (rpcError || !code) {
      Alert.alert("Couldn't make a Knock", rpcError?.message ?? "Try again.");
      return;
    }
    const message =
      `Come join our Burrow "${name}" on Nook! 🏡\n\n` +
      `Open Nook → Burrows → "Got a code?", and enter:\n\n${code}\n\n` +
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
      "You'll stop seeing this Burrow's people and everything it shares in your Nooks. You can rejoin with a new Knock.",
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
            else router.dismissTo("/burrows");
          },
        },
      ]
    );
  }

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
      "It's deleted for everyone, along with what it holds in each Nook (like its Gatherings). Wishbooks and tucks aren't affected — they belong to people, not Burrows.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const { error: deleteError } = await supabase.from("burrows").delete().eq("id", id);
            if (deleteError) Alert.alert("Couldn't delete it", deleteError.message);
            else router.dismissTo("/burrows");
          },
        },
      ]
    );
  }

  if (isLoading) return <LoadingScreen />;

  return (
    <NookScroll onRefresh={load}>
      <Stack.Screen options={{ title: name || "Burrow" }} />
      {error ? <Text style={ui.error}>{error}</Text> : null}

      <SectionHeader title="Who's in the Burrow" icon="group" />
      {members.map((member, i) => {
        const isMe = member.profile_id === userId;
        const canManage = isAdmin && !isMe;
        return (
          <NavCard
            key={member.profile_id}
            index={i}
            leading={
              <Avatar
                name={member.profiles?.display_name}
                icon={member.profiles?.avatar_icon}
                color={member.profiles?.avatar_color}
              />
            }
            icon={member.profiles?.is_managed ? "kid" : "person"}
            title={`${displayName(member.profiles)}${isMe ? " (you)" : ""}`}
            subtitle={[
              member.role === "admin" ? "Admin" : "Member",
              member.profiles?.is_managed ? "Managed by a parent" : null,
            ]
              .filter(Boolean)
              .join(" · ")}
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

      {burrowNooks.length > 0 ? (
        <>
          <SectionHeader title="In your Nooks" icon="widgets" />
          {burrowNooks.map((nook, i) => (
            <NavCard
              key={nook.id}
              index={i}
              icon={nook.icon}
              iconColor={nook.iconColor}
              iconBackground={nook.color}
              title={nook.title}
              subtitle={nook.burrow!.blurb}
              onPress={() => router.push(nook.burrow!.route(id))}
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
