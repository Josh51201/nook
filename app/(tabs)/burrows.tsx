import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Text, TextInput, View } from "react-native";

import { Avatar } from "../../components/avatar";
import { LoadingScreen } from "../../components/motion";
import { NookScroll } from "../../components/nook-scroll";
import { TourTarget, useTourAutoStart, useTourScrollArea } from "../../components/tour";
import { Button, EmptyState, NavCard, SectionHeader } from "../../components/ui";
import { useAuth } from "../../lib/auth-context";
import { friendlyError, guarded } from "../../lib/feedback";
import { PROFILE_FIELDS, type BurrowMember } from "../../lib/gift-nook";
import { supabase } from "../../lib/supabase";
import { colors, ui } from "../../lib/theme";

type BurrowRow = { id: string; name: string; burrow_members: BurrowMember[] };

const AVATARS_SHOWN = 6;

// The Burrows tab (CORE-025): your families, outside any one Nook, so every
// Nook that shares with people uses the same Burrows. Start one, join one
// with a Knock code (GIFT-001/011/018), or open one to manage it. A
// hand-off code for a kid's Wishbook (GIFT-021) works in the same box.
export default function Burrows() {
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user.id;

  const [burrows, setBurrows] = useState<BurrowRow[]>([]);
  const [newBurrowName, setNewBurrowName] = useState("");
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState<"create" | "code" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    () =>
      guarded(
        async () => {
          const { data, error: loadError } = await supabase
            .from("burrows")
            .select(`id, name, burrow_members(profile_id, role, profiles(${PROFILE_FIELDS}))`)
            .order("name");
          if (loadError) setError(loadError.message);
          setBurrows((data ?? []) as unknown as BurrowRow[]);
          setIsLoading(false);
        },
        setError,
        () => setIsLoading(false)
      ),
    []
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useTourAutoStart("burrows", !isLoading);
  const tourScroll = useTourScrollArea();

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
    router.push(`/burrow/${data}`);
  }

  // A Knock joins a Burrow; a hand-off code takes over a kid's Wishbook.
  async function answerCode() {
    if (!code.trim()) {
      setError("Enter the code someone sent you.");
      return;
    }
    setBusy("code");
    setError(null);
    const { data, error: rpcError } = await supabase.rpc("answer_code", {
      any_code: code.trim(),
    });
    setBusy(null);
    if (rpcError) {
      Alert.alert("Couldn't use that code", friendlyError(rpcError));
      return;
    }
    setCode("");
    if (data?.kind === "burrow") {
      router.push(`/burrow/${data.id}`);
    } else {
      Alert.alert("It's yours now!", "Your Wishbook moved onto your account. Welcome to Nook.");
      router.push("/gift-nook/wishbook");
    }
  }

  if (isLoading) return <LoadingScreen cards={3} />;

  return (
    <NookScroll onRefresh={load} tour={tourScroll}>
      <Text style={ui.muted}>
        Your family and groups. Every Nook that shares with people — like the Gift Nook — uses these same
        Burrows.
      </Text>
      {error ? <Text style={ui.error}>{error}</Text> : null}

      <SectionHeader title="Your Burrows" icon="burrow" />
      {burrows.length === 0 ? (
        <EmptyState
          icon="burrow"
          title="No Burrows yet"
          body="Start one for your family below, or join one with a Knock code."
        />
      ) : (
        burrows.map((burrow, i) => {
          const members = burrow.burrow_members ?? [];
          const isAdmin = members.some((m) => m.profile_id === userId && m.role === "admin");
          const count = members.length;
          return (
            <NavCard
              key={burrow.id}
              index={i}
              icon="burrow"
              title={burrow.name}
              subtitle={`${count} ${count === 1 ? "person" : "people"}${isAdmin ? " · You're an admin" : ""}`}
              onPress={() => router.push(`/burrow/${burrow.id}`)}
            >
              <View style={{ flexDirection: "row", marginTop: 10, marginLeft: 52 }}>
                {members.slice(0, AVATARS_SHOWN).map((member, j) => (
                  <View
                    key={member.profile_id}
                    style={{
                      marginLeft: j ? -8 : 0,
                      borderRadius: 999,
                      borderWidth: 2,
                      borderColor: colors.surface,
                    }}
                  >
                    <Avatar
                      name={member.profiles?.display_name}
                      icon={member.profiles?.avatar_icon}
                      color={member.profiles?.avatar_color}
                      size={26}
                    />
                  </View>
                ))}
                {count > AVATARS_SHOWN ? (
                  <Text style={[ui.muted, { marginLeft: 6, alignSelf: "center" }]}>+{count - AVATARS_SHOWN}</Text>
                ) : null}
              </View>
            </NavCard>
          );
        })
      )}

      <TourTarget id="burrows-start" style={{ gap: 14 }}>
        <SectionHeader title="Start a Burrow" icon="add" />
        <TextInput
          style={ui.input}
          value={newBurrowName}
          onChangeText={setNewBurrowName}
          placeholder="e.g. The Collinses"
          placeholderTextColor={colors.muted}
          returnKeyType="done"
          onSubmitEditing={createBurrow}
        />
        <Button
          title="Start Burrow"
          icon="burrow"
          onPress={createBurrow}
          loading={busy === "create"}
          disabled={busy !== null}
        />
      </TourTarget>

      <TourTarget id="burrows-code" style={{ gap: 14 }}>
        <SectionHeader title="Got a code?" icon="door" />
        <Text style={ui.muted}>
          A Knock from family joins their Burrow. A hand-off code gives you the Wishbook a parent made for you.
        </Text>
        <TextInput
          style={[ui.input, { fontSize: 22, letterSpacing: 6, textAlign: "center", fontWeight: "600" }]}
          value={code}
          onChangeText={(text) => setCode(text.toUpperCase().replace(/\s/g, ""))}
          placeholder="ABC123"
          placeholderTextColor={colors.border}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={6}
          returnKeyType="go"
          onSubmitEditing={answerCode}
        />
        <Button
          title="Use code"
          icon="door"
          variant="secondary"
          onPress={answerCode}
          loading={busy === "code"}
          disabled={busy !== null || code.trim().length < 6}
        />
      </TourTarget>
    </NookScroll>
  );
}
