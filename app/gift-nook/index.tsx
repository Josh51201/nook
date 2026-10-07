import { Stack, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Text, TextInput, View } from "react-native";

import { Avatar } from "../../components/avatar";
import { IconBadge, type IconName } from "../../components/icon";
import { Appear, LoadingScreen, Tap } from "../../components/motion";
import { NookScroll } from "../../components/nook-scroll";
import {
  Banner,
  Button,
  EmptyState,
  HeaderIcon,
  NavCard,
  SectionHeader,
} from "../../components/ui";
import { useAuth } from "../../lib/auth-context";
import { friendlyError, guarded } from "../../lib/feedback";
import {
  countdown,
  displayName,
  formatDate,
  gatheringKindInfo,
} from "../../lib/gift-nook";
import { supabase } from "../../lib/supabase";
import { colors, ui } from "../../lib/theme";

type BurrowRow = { id: string; name: string };
type Kid = {
  id: string;
  name: string;
  avatarIcon: string | null;
  avatarColor: string | null;
  burrowIds: Set<string>;
};
type ReceivedPrompt = {
  gatheringId: string;
  title: string;
  profileId: string;
  who: string;
};
type Upcoming = {
  id: string;
  title: string;
  kind: string;
  ends_at: string;
  burrows: { name: string } | null;
};

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
  const [newBurrowName, setNewBurrowName] = useState("");
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState<"create" | "code" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    () =>
      guarded(
        async () => {
          if (!userId) return;
          const thirtyDaysAgo = new Date(
            Date.now() - 30 * 86400000,
          ).toISOString();
          const [
            burrowsResult,
            kidsResult,
            tucksResult,
            unreadResult,
            endedResult,
            receiptsResult,
            upcomingResult,
          ] = await Promise.all([
            supabase.from("burrows").select("id, name").order("name"),
            supabase
              .from("profile_managers")
              .select(
                "profile_id, profiles!profile_managers_profile_id_fkey(display_name, avatar_icon, avatar_color, burrow_members(burrow_id))",
              )
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
            supabase
              .from("gathering_receipts")
              .select("gathering_id, profile_id"),
            supabase
              .from("gatherings")
              .select("id, title, kind, ends_at, burrows(name)")
              .gt("ends_at", new Date().toISOString())
              .order("ends_at")
              .limit(3),
          ]);

          if (burrowsResult.error) setError(burrowsResult.error.message);
          setBurrows(burrowsResult.data ?? []);
          setOpenTucks(tucksResult.count ?? 0);
          setUnread(unreadResult.count ?? 0);
          setUpcoming((upcomingResult.data ?? []) as unknown as Upcoming[]);

          const kidList: Kid[] = (kidsResult.data ?? []).map((row) => {
            const profile = row.profiles as unknown as {
              display_name: string | null;
              avatar_icon: string | null;
              avatar_color: string | null;
              burrow_members: { burrow_id: string }[];
            } | null;
            return {
              id: row.profile_id,
              name: displayName(profile),
              avatarIcon: profile?.avatar_icon ?? null,
              avatarColor: profile?.avatar_color ?? null,
              burrowIds: new Set(
                (profile?.burrow_members ?? []).map((m) => m.burrow_id),
              ),
            };
          });
          setKids(kidList);

          // GIFT-026: honorees (or, with none, everyone) of a recently ended
          // Gathering get asked what they received — for you and kids you manage.
          const responded = new Set(
            (receiptsResult.data ?? []).map(
              (r) => `${r.gathering_id}:${r.profile_id}`,
            ),
          );
          const nextPrompts: ReceivedPrompt[] = [];
          for (const gathering of endedResult.data ?? []) {
            const honorees = new Set(
              (
                (gathering.gathering_honorees ?? []) as { profile_id: string }[]
              ).map((h) => h.profile_id),
            );
            const people = [
              { id: userId, who: "you", inBurrow: true },
              ...kidList.map((kid) => ({
                id: kid.id,
                who: kid.name,
                inBurrow: kid.burrowIds.has(gathering.burrow_id),
              })),
            ];
            for (const person of people) {
              const applies = honorees.size
                ? honorees.has(person.id)
                : person.inBurrow;
              if (applies && !responded.has(`${gathering.id}:${person.id}`)) {
                nextPrompts.push({
                  gatheringId: gathering.id,
                  title: gathering.title,
                  profileId: person.id,
                  who: person.who,
                });
              }
            }
          }
          setPrompts(nextPrompts);
          setIsLoading(false);
        },
        setError,
        () => setIsLoading(false),
      ),
    [userId],
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
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
      router.push(`/gift-nook/burrow/${data.id}`);
    } else {
      Alert.alert(
        "It's yours now!",
        "Your Wishbook moved onto your account. Welcome to Nook.",
      );
      router.push("/gift-nook/wishbook");
    }
  }

  if (isLoading) return <LoadingScreen cards={4} />;

  return (
    <NookScroll onRefresh={load}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <View style={[ui.row, { gap: 22 }]}>
              <HeaderIcon
                icon="bell"
                label={unread ? `Inbox, ${unread} unread` : "Inbox"}
                badge={unread}
                onPress={() => router.push("/gift-nook/notifications")}
              />
              <HeaderIcon
                icon="settings"
                label="Gift Nook settings"
                onPress={() => router.push("/gift-nook/settings")}
              />
            </View>
          ),
        }}
      />
      {error ? <Text style={ui.error}>{error}</Text> : null}


      {prompts.map((prompt, i) => (
        <Banner
          key={`${prompt.gatheringId}:${prompt.profileId}`}
          index={i}
          icon="given"
          title={`${prompt.title} is over`}
          body={`Did ${prompt.who === "you" ? "you" : prompt.who} get anything off the list? Tap to check things off.`}
          onPress={() =>
            router.push({
              pathname: "/gift-nook/received",
              params: {
                gatheringId: prompt.gatheringId,
                profileId: prompt.profileId,
              },
            })
          }
        />
      ))}

      <View style={[ui.row, { gap: 12, alignItems: "stretch" }]}>
        <QuickTile
          icon="wishbook"
          title="My Wishbook"
          subtitle="What you'd love"
          onPress={() => router.push("/gift-nook/wishbook")}
          index={0}
        />
        <QuickTile
          icon="tucks"
          title="Your tucks"
          subtitle={openTucks ? `${openTucks} to get` : "Nothing yet"}
          onPress={() => router.push("/gift-nook/my-tucks")}
          index={1}
        />
      </View>

      {upcoming.length > 0 ? (
        <>
          <SectionHeader title="Coming up" icon="calendar" />
          {upcoming.map((gathering, i) => {
            const kind = gatheringKindInfo(gathering.kind);
            return (
              <NavCard
                key={gathering.id}
                index={i}
                icon={kind.icon}
                iconColor={kind.color}
                title={gathering.title}
                subtitle={`${formatDate(gathering.ends_at)} · ${countdown(gathering.ends_at)}${
                  gathering.burrows?.name ? ` · ${gathering.burrows.name}` : ""
                }`}
                onPress={() =>
                  router.push(`/gift-nook/gathering/${gathering.id}`)
                }
              />
            );
          })}
        </>
      ) : null}

      <SectionHeader title="Your Burrows" icon="burrow" />
      {burrows.length === 0 ? (
        <EmptyState
          icon="burrow"
          title="No Burrows yet"
          body="Start one for your family below, or join one with a Knock code."
        />
      ) : (
        burrows.map((burrow, i) => (
          <NavCard
            key={burrow.id}
            index={i}
            icon="burrow"
            title={burrow.name}
            onPress={() => router.push(`/gift-nook/burrow/${burrow.id}`)}
          />
        ))
      )}

      <SectionHeader title="Little ones you manage" icon="kid" />
      {kids.map((kid, i) => (
        <NavCard
          key={kid.id}
          index={i}
          icon="kid"
          iconColor="#4f7fb0"
          iconBackground={colors.sky}
          leading={<Avatar name={kid.name} icon={kid.avatarIcon} color={kid.avatarColor} />}
          title={`${kid.name}'s Wishbook`}
          onPress={() => router.push(`/gift-nook/member/${kid.id}`)}
        />
      ))}
      <Button
        title="Make a Wishbook for a kid"
        icon="add"
        variant="secondary"
        onPress={() => router.push("/gift-nook/managed-form")}
      />

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

      <SectionHeader title="Got a code?" icon="door" />
      <Text style={ui.muted}>
        A Knock from family joins their Burrow. A hand-off code gives you the
        Wishbook a parent made for you.
      </Text>
      <TextInput
        style={[
          ui.input,
          {
            fontSize: 22,
            letterSpacing: 6,
            textAlign: "center",
            fontWeight: "600",
          },
        ]}
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
    </NookScroll>
  );
}

// One of the two big shortcuts at the top of the Gift Nook.
function QuickTile({
  icon,
  title,
  subtitle,
  onPress,
  index,
}: {
  icon: IconName;
  title: string;
  subtitle: string;
  onPress: () => void;
  index: number;
}) {
  return (
    <Appear index={index} style={{ flex: 1 }}>
      <Tap
        onPress={onPress}
        style={[ui.card, { gap: 10, flex: 1 }]}
        accessibilityRole="button"
      >
        <IconBadge name={icon} size={44} />
        <View style={{ gap: 2 }}>
          <Text style={ui.cardTitle}>{title}</Text>
          <Text style={ui.muted}>{subtitle}</Text>
        </View>
      </Tap>
    </Appear>
  );
}
