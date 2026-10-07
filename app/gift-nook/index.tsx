import { Stack, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Text, TextInput, TouchableOpacity, View } from "react-native";

import { NookScroll } from "../../components/nook-scroll";
import { useAuth } from "../../lib/auth-context";
import { friendlyError } from "../../lib/feedback";
import { countdown, displayName, formatDate, gatheringKindInfo } from "../../lib/gift-nook";
import { supabase } from "../../lib/supabase";
import { colors, ui } from "../../lib/theme";

type BurrowRow = { id: string; name: string };
type Kid = { id: string; name: string; burrowIds: Set<string> };
type ReceivedPrompt = { gatheringId: string; title: string; profileId: string; who: string };
type Upcoming = { id: string; title: string; kind: string; ends_at: string; burrows: { name: string } | null };

// Gift Nook home: your Wishbook and tucks, kids you manage, "did you get
// these?" prompts after Gatherings, your Burrows, and one box for any code
// (a Knock or a hand-off). GIFT-001/011/019/023/026/029.
export default function GiftNookHome() {
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user.id;

  const [burrows, setBurrows] = useState<BurrowRow[]>([]);
  const [kids, setKids] = useState<Kid[]>([]);
  const [prompts, setPrompts] = useState<ReceivedPrompt[]>([]);
  const [openTucks, setOpenTucks] = useState(0);
  const [unread, setUnread] = useState(0);
  const [upcoming, setUpcoming] = useState<Upcoming[]>([]);
  const [needsName, setNeedsName] = useState(false);
  const [newBurrowName, setNewBurrowName] = useState("");
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState<"create" | "code" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    const [
      burrowsResult,
      kidsResult,
      tucksResult,
      unreadResult,
      endedResult,
      receiptsResult,
      upcomingResult,
      profileResult,
    ] = await Promise.all([
        supabase.from("burrows").select("id, name").order("name"),
        supabase
          .from("profile_managers")
          .select("profile_id, profiles!profile_managers_profile_id_fkey(display_name, burrow_members(burrow_id))")
          .eq("manager_id", userId),
        supabase
          .from("claims")
          .select("id", { count: "exact", head: true })
          .eq("claimed_by", userId)
          .is("released_at", null)
          .neq("status", "given"),
        supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .is("read_at", null),
        supabase
          .from("gatherings")
          .select("id, title, burrow_id, gathering_honorees(profile_id)")
          .lt("ends_at", new Date().toISOString())
          .gt("ends_at", thirtyDaysAgo),
        supabase.from("gathering_receipts").select("gathering_id, profile_id"),
        supabase
          .from("gatherings")
          .select("id, title, kind, ends_at, burrows(name)")
          .gt("ends_at", new Date().toISOString())
          .order("ends_at")
          .limit(3),
        supabase.from("profiles").select("display_name").eq("id", userId).single(),
      ]);

    if (burrowsResult.error) setError(burrowsResult.error.message);
    setBurrows(burrowsResult.data ?? []);
    setOpenTucks(tucksResult.count ?? 0);
    setUnread(unreadResult.count ?? 0);
    setUpcoming((upcomingResult.data ?? []) as unknown as Upcoming[]);
    // New accounts start with their email as their name.
    const currentName = profileResult.data?.display_name ?? "";
    setNeedsName(!currentName.trim() || currentName.includes("@"));

    const kidList: Kid[] = (kidsResult.data ?? []).map((row) => {
      const profile = row.profiles as unknown as {
        display_name: string | null;
        burrow_members: { burrow_id: string }[];
      } | null;
      return {
        id: row.profile_id,
        name: displayName(profile),
        burrowIds: new Set((profile?.burrow_members ?? []).map((m) => m.burrow_id)),
      };
    });
    setKids(kidList);

    // GIFT-026: honorees (or, with none, everyone) of a recently ended
    // Gathering get asked what they received — for you and kids you manage.
    const responded = new Set(
      (receiptsResult.data ?? []).map((r) => `${r.gathering_id}:${r.profile_id}`)
    );
    const nextPrompts: ReceivedPrompt[] = [];
    for (const gathering of endedResult.data ?? []) {
      const honorees = new Set(
        ((gathering.gathering_honorees ?? []) as { profile_id: string }[]).map((h) => h.profile_id)
      );
      const people = [
        { id: userId, who: "you", inBurrow: true },
        ...kidList.map((kid) => ({ id: kid.id, who: kid.name, inBurrow: kid.burrowIds.has(gathering.burrow_id) })),
      ];
      for (const person of people) {
        const applies = honorees.size ? honorees.has(person.id) : person.inBurrow;
        if (applies && !responded.has(`${gathering.id}:${person.id}`)) {
          nextPrompts.push({ gatheringId: gathering.id, title: gathering.title, profileId: person.id, who: person.who });
        }
      }
    }
    setPrompts(nextPrompts);
    setIsLoading(false);
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

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

  // A Knock joins a Burrow; a hand-off code takes over a kid's Wishbook.
  async function answerCode() {
    if (!code.trim()) {
      setError("Enter the code someone sent you.");
      return;
    }
    setBusy("code");
    setError(null);
    const { data, error: rpcError } = await supabase.rpc("answer_code", { any_code: code.trim() });
    setBusy(null);
    if (rpcError) {
      Alert.alert("Couldn't use that code", friendlyError(rpcError));
      return;
    }
    setCode("");
    if (data?.kind === "burrow") {
      router.push(`/gift-nook/burrow/${data.id}`);
    } else {
      Alert.alert("It's yours now! 🎉", "Your Wishbook moved onto your account. Welcome to Nook.");
      router.push("/gift-nook/wishbook");
    }
  }

  if (isLoading) {
    return (
      <View style={ui.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <NookScroll onRefresh={load}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <View style={[ui.row, { gap: 18 }]}>
              <TouchableOpacity
                onPress={() => router.push("/gift-nook/notifications")}
                hitSlop={10}
                accessibilityLabel={unread ? `Inbox, ${unread} unread` : "Inbox"}
              >
                <Text style={{ color: colors.bark, fontSize: 18 }}>
                  🔔{unread > 0 ? <Text style={{ fontSize: 14, fontWeight: "700" }}> {unread}</Text> : null}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.push("/gift-nook/settings")}
                hitSlop={10}
                accessibilityLabel="Gift Nook settings"
              >
                <Text style={{ color: colors.bark, fontSize: 20 }}>⚙︎</Text>
              </TouchableOpacity>
            </View>
          ),
        }}
      />
      {error ? <Text style={ui.error}>{error}</Text> : null}

      {needsName ? (
        <TouchableOpacity
          style={[ui.card, { backgroundColor: "#e9f1fb" }]}
          onPress={() => router.push("/settings")}
        >
          <Text style={ui.cardTitle}>👋 Tell your family who you are</Text>
          <Text style={ui.muted}>Right now they see your email. Tap to set your name.</Text>
        </TouchableOpacity>
      ) : null}

      {prompts.map((prompt) => (
        <TouchableOpacity
          key={`${prompt.gatheringId}:${prompt.profileId}`}
          style={[ui.card, { backgroundColor: "#fff4d6" }]}
          onPress={() =>
            router.push({
              pathname: "/gift-nook/received",
              params: { gatheringId: prompt.gatheringId, profileId: prompt.profileId },
            })
          }
        >
          <Text style={ui.cardTitle}>🎉 {prompt.title} is over</Text>
          <Text style={ui.muted}>
            Did {prompt.who === "you" ? "you" : prompt.who} get anything off the list? Tap to check things off.
          </Text>
        </TouchableOpacity>
      ))}

      <TouchableOpacity style={ui.card} onPress={() => router.push("/gift-nook/wishbook")}>
        <Text style={ui.cardTitle}>📖 My Wishbook</Text>
        <Text style={ui.muted}>The gifts you'd love. Every Burrow you're in can see it.</Text>
      </TouchableOpacity>

      <TouchableOpacity style={ui.card} onPress={() => router.push("/gift-nook/my-tucks")}>
        <Text style={ui.cardTitle}>🛍️ Your tucks</Text>
        <Text style={ui.muted}>
          {openTucks
            ? `${openTucks} gift${openTucks === 1 ? "" : "s"} you're getting for others`
            : "Gifts you've promised to get show up here"}
        </Text>
      </TouchableOpacity>

      {upcoming.length > 0 ? (
        <>
          <Text style={ui.sectionTitle}>Coming up</Text>
          {upcoming.map((gathering) => (
            <TouchableOpacity
              key={gathering.id}
              style={ui.card}
              onPress={() => router.push(`/gift-nook/gathering/${gathering.id}`)}
            >
              <Text style={ui.cardTitle}>
                {gatheringKindInfo(gathering.kind).emoji} {gathering.title}
              </Text>
              <Text style={ui.muted}>
                {formatDate(gathering.ends_at)} · {countdown(gathering.ends_at)}
                {gathering.burrows?.name ? ` · ${gathering.burrows.name}` : ""}
              </Text>
            </TouchableOpacity>
          ))}
        </>
      ) : null}

      <Text style={ui.sectionTitle}>Little ones you manage</Text>
      {kids.map((kid) => (
        <TouchableOpacity key={kid.id} style={ui.card} onPress={() => router.push(`/gift-nook/member/${kid.id}`)}>
          <Text style={ui.cardTitle}>👶 {kid.name}'s Wishbook</Text>
        </TouchableOpacity>
      ))}
      <TouchableOpacity style={ui.secondaryButton} onPress={() => router.push("/gift-nook/managed-form")}>
        <Text style={ui.secondaryButtonText}>+ Make a Wishbook for a kid</Text>
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

      <Text style={ui.sectionTitle}>Got a code?</Text>
      <Text style={ui.muted}>
        A Knock from family joins their Burrow. A hand-off code gives you the Wishbook a parent made
        for you.
      </Text>
      <TextInput
        style={ui.input}
        value={code}
        onChangeText={(text) => setCode(text.toUpperCase())}
        placeholder="ABC123"
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={6}
      />
      <TouchableOpacity style={ui.secondaryButton} onPress={answerCode} disabled={busy !== null}>
        <Text style={ui.secondaryButtonText}>{busy === "code" ? "Checking…" : "Use code"}</Text>
      </TouchableOpacity>
    </NookScroll>
  );
}
