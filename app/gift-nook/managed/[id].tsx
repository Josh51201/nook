import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Share, Text, TextInput, View } from "react-native";

import { Button } from "../../../components/ui";
import { NookScroll } from "../../../components/nook-scroll";
import * as Clipboard from "expo-clipboard";

import { useAuth } from "../../../lib/auth-context";
import { tap } from "../../../lib/feedback";
import { displayName, type Profile } from "../../../lib/gift-nook";
import { supabase } from "../../../lib/supabase";
import { colors, ui } from "../../../lib/theme";
import { LoadingScreen, Tap } from "../../../components/motion";

type Burrow = { id: string; name: string };

// Manage a kid's profile (GIFT-019/020/021): name, which Burrows they're in,
// who else manages them, handing it over, or deleting it.
export default function ManageProfile() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const userId = session?.user.id;

  const [name, setName] = useState("");
  const [savedName, setSavedName] = useState("");
  const [myBurrows, setMyBurrows] = useState<Burrow[]>([]);
  const [theirBurrows, setTheirBurrows] = useState<Set<string>>(new Set());
  const [managers, setManagers] = useState<Profile[]>([]);
  const [candidates, setCandidates] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) return;
    const [profileResult, burrowsResult, theirResult, managersResult, myMatesResult] = await Promise.all([
      supabase.from("profiles").select("display_name").eq("id", id).single(),
      supabase.from("burrows").select("id, name").order("name"),
      supabase.from("burrow_members").select("burrow_id").eq("profile_id", id),
      supabase.from("profile_managers").select("manager_id, profiles!profile_managers_manager_id_fkey(id, display_name)").eq("profile_id", id),
      supabase.from("burrow_members").select("profile_id, profiles(id, display_name, is_managed)"),
    ]);
    const currentName = profileResult.data?.display_name ?? "";
    setName(currentName);
    setSavedName(currentName);
    setMyBurrows(burrowsResult.data ?? []);
    setTheirBurrows(new Set((theirResult.data ?? []).map((row) => row.burrow_id)));

    const managerProfiles = (managersResult.data ?? [])
      .map((row) => row.profiles as unknown as Profile | null)
      .filter((p): p is Profile => Boolean(p));
    setManagers(managerProfiles);

    // Grown-ups in any of your Burrows who aren't managers yet.
    const managerIds = new Set(managerProfiles.map((p) => p.id));
    const seen = new Set<string>();
    const mates: Profile[] = [];
    for (const row of myMatesResult.data ?? []) {
      const profile = row.profiles as unknown as Profile | null;
      if (!profile || profile.is_managed || managerIds.has(profile.id) || seen.has(profile.id)) continue;
      seen.add(profile.id);
      mates.push(profile);
    }
    setCandidates(mates);
    setIsLoading(false);
  }, [id, userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function call(fn: string, args: Record<string, unknown>) {
    const { data, error } = await supabase.rpc(fn, args);
    if (error) Alert.alert("Something went wrong", error.message);
    load();
    return error ? null : data ?? true;
  }

  async function saveName() {
    const { error } = await supabase.from("profiles").update({ display_name: name.trim() }).eq("id", id);
    if (error) Alert.alert("Couldn't rename", error.message);
    else setSavedName(name.trim());
  }

  async function sendHandoff() {
    const code = await call("create_handoff", { target_profile: id });
    if (!code) return;
    const message =
      `${savedName}, your Nook Wishbook is ready for you! 🎁\n\n` +
      `Sign up for Nook with your own email, open Gift Nook → "Got a code?", and enter:\n\n${code}\n\n` +
      `Everything on your list comes with you. (Works for 7 days.)`;
    Alert.alert(`Hand-off code: ${code}`, `${savedName} enters this on their own account. Works for 7 days.`, [
      {
        text: "Copy code",
        onPress: async () => {
          await Clipboard.setStringAsync(String(code));
          tap();
        },
      },
      { text: "Share…", onPress: () => Share.share({ message }) },
      { text: "Done", style: "cancel" },
    ]);
  }

  function confirmDelete() {
    Alert.alert(
      `Delete ${savedName}'s profile?`,
      "Their Wishbook and everything on it will be deleted for everyone. This can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            if (await call("delete_managed_profile", { target_profile: id })) {
              router.navigate("/gift-nook");
            }
          },
        },
      ]
    );
  }

  if (isLoading) return <LoadingScreen />;

  return (
    <NookScroll>
      <Stack.Screen options={{ title: `Manage ${savedName}` }} />

      <Text style={ui.label}>Name</Text>
      <View style={ui.row}>
        <TextInput style={[ui.input, { flex: 1 }]} value={name} onChangeText={setName} />
        {name.trim() && name.trim() !== savedName ? (
          <Button title="Save" onPress={saveName} />
        ) : null}
      </View>

      <Text style={ui.sectionTitle}>Burrows</Text>
      <Text style={ui.muted}>Their list shows in the Burrows you pick (only ones you're in).</Text>
      <View style={ui.chips}>
        {myBurrows.map((burrow) => {
          const selected = theirBurrows.has(burrow.id);
          return (
            <Tap
              key={burrow.id}
              style={[ui.chip, selected && ui.chipSelected]}
              onPress={() =>
                call("set_managed_burrow", { target_profile: id, target_burrow: burrow.id, is_in: !selected })
              }
            >
              <Text style={[ui.chipText, selected && ui.chipTextSelected]}>{burrow.name}</Text>
            </Tap>
          );
        })}
      </View>

      <Text style={ui.sectionTitle}>Managers</Text>
      {managers.map((manager) => (
        <View key={manager.id} style={[ui.card, ui.row]}>
          <Text style={[ui.cardTitle, { flex: 1 }]}>
            {displayName(manager)}
            {manager.id === userId ? " (you)" : ""}
          </Text>
          {managers.length > 1 ? (
            <Tap
              onPress={() => call("remove_profile_manager", { target_profile: id, old_manager: manager.id })}
            >
              <Text style={ui.error}>Remove</Text>
            </Tap>
          ) : null}
        </View>
      ))}
      {candidates.length > 0 ? (
        <>
          <Text style={ui.muted}>Add a manager (e.g. the other parent):</Text>
          <View style={ui.chips}>
            {candidates.map((person) => (
              <Tap
                key={person.id}
                style={ui.chip}
                onPress={() => call("add_profile_manager", { target_profile: id, new_manager: person.id })}
              >
                <Text style={ui.chipText}>+ {displayName(person)}</Text>
              </Tap>
            ))}
          </View>
        </>
      ) : null}

      <Text style={ui.sectionTitle}>Hand it over</Text>
      <Text style={ui.muted}>
        When {savedName} gets their own phone, send them a code. Once they enter it, the list is
        theirs — and like everyone else, they won't see what's been tucked. You'll stop managing it.
      </Text>
      <Button title={`Send ${savedName} a hand-off code`} icon="share" variant="secondary" onPress={sendHandoff} />

      <Tap onPress={confirmDelete} style={{ alignItems: "center", marginTop: 24 }}>
        <Text style={{ color: colors.error }}>Delete {savedName}'s profile</Text>
      </Tap>
    </NookScroll>
  );
}
