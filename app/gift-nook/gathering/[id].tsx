import {
  Stack,
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import { useCallback, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { Text } from "../../../components/text";

import { friendlyError, guarded, tap } from "../../../lib/feedback";
import { shoppingCounts, shoppingFor, shoppingLine, type MyTuck, type PersonShopping, type ShoppingState } from "../../../lib/gift-shopping";
import type { Guest } from "../../../lib/gatherings";
import { addPotluck } from "../../../lib/gatherings-data";
import { Avatar } from "../../../components/avatar";
import { Icon, IconBadge } from "../../../components/icon";
import { Appear, LoadingScreen, Tap } from "../../../components/motion";
import { NookScroll } from "../../../components/nook-scroll";
import {
  Button,
  Chip,
  EmptyState,
  NavCard,
  SectionHeader,
} from "../../../components/ui";
import { useAuth } from "../../../lib/auth-context";
import {
  countdown,
  displayName,
  formatDate,
  gatheringKindInfo,
  isArchived,
  PROFILE_FIELDS,
  type Gathering,
  type Profile,
  type TuckStatus,
} from "../../../lib/gift-nook";
import { supabase } from "../../../lib/supabase";
import { colors, themed, ui } from "../../../lib/theme";

// One Gathering's gift lists. Whose Wishbooks it points to is provisional
// pending Q-003: its honorees if it has any, otherwise everyone invited
// whose Wishbook you can see (people you share a Burrow with — GIFT-007's
// rules don't change for Gatherings that invite other Burrows). Each
// person's list is filtered to the gifts they picked for this Gathering
// (GIFT-017). Who's coming, and changing it, live in the Gathering Nook.
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
  const [potlucks, setPotlucks] = useState<{ id: string; title: string }[]>([]);
  // GIFT-038..040: your own tucks and "not getting" marks, never anyone else's.
  const [myTucks, setMyTucks] = useState<MyTuck[]>([]);
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<ShoppingState | "all" | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    () =>
      guarded(
        async () => {
          const { data: row, error: gatheringError } = await supabase
            .from("gatherings")
            .select("id, burrow_id, title, kind, ends_at, starts_at, created_by")
            .eq("id", id)
            .single();
          if (gatheringError || !row) {
            setError(
              gatheringError?.message ?? "Couldn't find that Gathering.",
            );
            setIsLoading(false);
            return;
          }
          setGathering(row as Gathering);

          // GATH-005: hosts change or delete it.
          const [canHost, managed] = await Promise.all([
            supabase.rpc("can_host_gathering", { target_gathering: id }),
            supabase
              .from("profile_managers")
              .select("profile_id")
              .eq("manager_id", userId!),
          ]);
          setCanDelete(Boolean(canHost.data));
          setManagedIds(new Set((managed.data ?? []).map((m) => m.profile_id)));

          // POT-002: a Potluck can be planned for this Gathering.
          const { data: potluckRows } = await supabase
            .from("potlucks")
            .select("id, title")
            .eq("gathering_id", id)
            .order("created_at");
          setPotlucks(potluckRows ?? []);

          const { data: honorees } = await supabase
            .from("gathering_honorees")
            .select(`profiles(${PROFILE_FIELDS})`)
            .eq("gathering_id", id);
          const honoreeProfiles = (honorees ?? [])
            .map((h) => h.profiles as unknown as Profile | null)
            .filter((p): p is Profile => Boolean(p));

          if (honoreeProfiles.length) {
            setHasHonorees(true);
            setPeople(honoreeProfiles);
          } else {
            setHasHonorees(false);
            const { data: guests } = await supabase.rpc("gathering_guest_list", { target_gathering: id });
            setPeople(
              ((guests ?? []) as Guest[])
                .filter((g) => g.can_see_wishbook)
                .map((g) => ({
                  id: g.profile_id,
                  display_name: g.display_name,
                  is_managed: g.is_managed,
                  avatar_icon: g.avatar_icon,
                  avatar_color: g.avatar_color,
                  avatar_path: g.avatar_path,
                })),
            );
          }
          // Your own tucks (any Gathering) and who you're not getting a gift
          // for here. Both are only ever yours to see (GIFT-007).
          const [tucksResult, skipsResult] = await Promise.all([
            supabase
              .from("claims")
              .select("id, gathering_id, status, gifts!inner(title, wishbooks!inner(owner_id)), gatherings(title)")
              .eq("claimed_by", userId!)
              .is("released_at", null),
            supabase.from("gathering_skips").select("profile_id").eq("gathering_id", id),
          ]);
          setMyTucks(
            ((tucksResult.data ?? []) as unknown as {
              id: string;
              gathering_id: string | null;
              status: TuckStatus;
              gifts: { title: string; wishbooks: { owner_id: string } };
              gatherings: { title: string } | null;
            }[]).map((row) => ({
              id: row.id,
              ownerId: row.gifts.wishbooks.owner_id,
              giftTitle: row.gifts.title,
              status: row.status,
              gatheringId: row.gathering_id,
              gatheringTitle: row.gatherings?.title ?? null,
            })),
          );
          setSkipped(new Set((skipsResult.data ?? []).map((row) => row.profile_id as string)));
          setIsLoading(false);
        },
        setError,
        () => setIsLoading(false),
      ),
    [id, userId],
  );

  async function setSkip(profileId: string, skip: boolean) {
    tap();
    const { error: skipError } = skip
      ? await supabase.from("gathering_skips").insert({ gathering_id: id, giver_id: userId, profile_id: profileId })
      : await supabase.from("gathering_skips").delete().eq("gathering_id", id).eq("profile_id", profileId);
    if (skipError) Alert.alert("Couldn't save that", friendlyError(skipError));
    load();
  }

  async function countHere(tuck: MyTuck) {
    const { error: moveError } = await supabase.rpc("set_tuck_gathering", { claim_id: tuck.id, target_gathering: id });
    if (moveError) Alert.alert("Couldn't move it", friendlyError(moveError));
    else tap("success");
    load();
  }

  // Your options for one person: not getting them a gift (or undo), count a
  // gift you tucked for another Gathering for this one, or open their list.
  function personOptions(person: Profile, shopping: PersonShopping) {
    const who = displayName(person);
    const options: { text: string; style?: "cancel" | "destructive"; onPress?: () => void }[] = [];
    for (const tuck of shopping.elsewhere.slice(0, 3)) {
      options.push({ text: `Count "${tuck.giftTitle}" for this`, onPress: () => countHere(tuck) });
    }
    if (shopping.state === "skipped") {
      options.push({ text: "I'll get them something after all", onPress: () => setSkip(person.id, false) });
    } else if (shopping.state === "need") {
      options.push({ text: "Not getting them a gift", onPress: () => setSkip(person.id, true) });
    }
    if (managedIds.has(person.id)) {
      options.push({
        text: "Open their Wishbook to tuck",
        onPress: () => router.push({ pathname: "/gift-nook/member/[id]", params: { id: person.id, gatheringId: id } }),
      });
    }
    options.push({ text: "Cancel", style: "cancel" });
    Alert.alert(
      who,
      shopping.state === "need"
        ? `Only you see this. "Not getting them a gift" just takes ${who} off your Still need list here.`
        : undefined,
      options,
    );
  }

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  function openWishbook(profileId: string) {
    if (profileId === userId) {
      router.push({
        pathname: "/gift-nook/gathering-picks",
        params: { gatheringId: id },
      });
    } else if (managedIds.has(profileId)) {
      router.push({
        pathname: "/gift-nook/gathering-picks",
        params: { gatheringId: id, profileId },
      });
    } else {
      router.push({
        pathname: "/gift-nook/member/[id]",
        params: { id: profileId, gatheringId: id },
      });
    }
  }

  function confirmDelete() {
    Alert.alert(
      "Delete this Gathering?",
      "Wishbooks and tucks aren't affected.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const { error: deleteError } = await supabase
              .from("gatherings")
              .delete()
              .eq("id", id);
            if (deleteError) setError(deleteError.message);
            else router.back();
          },
        },
      ],
    );
  }

  if (isLoading) return <LoadingScreen />;

  if (!gathering) {
    return (
      <EmptyState
        icon="calendar"
        title="Couldn't find that Gathering"
        body={error ?? undefined}
      />
    );
  }

  const kind = gatheringKindInfo(gathering.kind);
  const me = people.find((p) => p.id === userId) ?? null;
  // Everyone it's for except you, with how your shopping for them stands.
  const others = people
    .filter((p) => p.id !== userId)
    .map((person) => ({ person, shopping: shoppingFor(person.id, id, myTucks, skipped) }));
  const counts = shoppingCounts(others.map((o) => o.shopping.state));
  // Start on "Still need" while anyone's left, otherwise everyone.
  const shownFilter = filter ?? (counts.need ? "need" : "all");
  const shown = shownFilter === "all" ? others : others.filter((o) => o.shopping.state === shownFilter);
  const pickFilter = (next: ShoppingState | "all") => {
    tap();
    setFilter(next);
  };
  const archived = isArchived(gathering);

  return (
    <NookScroll>
      <Stack.Screen options={{ title: gathering.title }} />
      {error ? <Text style={ui.error}>{error}</Text> : null}

      <Appear>
        <View
          style={[
            ui.card,
            { alignItems: "center", gap: 8, paddingVertical: 24 },
          ]}
        >
          <IconBadge
            name={kind.icon}
            size={72}
            color={kind.color}
            background={`${kind.color}1f`}
          />
          <Text
            style={{
              fontSize: 22,
              fontWeight: "700",
              color: colors.text,
              textAlign: "center",
            }}
          >
            {gathering.title}
          </Text>
          <Text style={{ fontSize: 17, fontWeight: "600", color: kind.color }}>
            {archived ? "Archived" : countdown(gathering.ends_at)}
          </Text>
          <Text style={ui.muted}>
            {kind.label} · {formatDate(gathering.ends_at)}
          </Text>
          {!archived && canDelete ? (
            <Button
              title="Change"
              icon="edit"
              variant="secondary"
              style={{ marginTop: 6, paddingVertical: 9 }}
              onPress={() =>
                router.push({
                  pathname: "/gatherings/form",
                  params: { gatheringId: id },
                })
              }
            />
          ) : null}
        </View>
      </Appear>

      {potlucks.map((potluck, i) => (
        <NavCard
          key={potluck.id}
          index={i}
          icon="potluck"
          iconColor="#4f6b45"
          iconBackground="#dfe8d6"
          title={potluck.title === gathering.title ? "Potluck" : potluck.title}
          subtitle="Who's bringing what"
          onPress={() => router.push(`/potluck/${potluck.id}`)}
        />
      ))}
      {potlucks.length === 0 && !archived && canDelete ? (
        <NavCard
          icon="potluck"
          iconColor="#4f6b45"
          iconBackground="#dfe8d6"
          title="Plan a Potluck for this"
          subtitle="Sort out who's bringing what"
          onPress={async () => {
            try {
              const potluckId = await addPotluck(id);
              router.push({ pathname: "/potluck/form", params: { potluckId } });
            } catch (potluckError) {
              Alert.alert("Couldn't add a Potluck", friendlyError(potluckError as { message?: string }));
            }
          }}
        />
      ) : null}
      <NavCard
        icon="celebration"
        iconColor="#9a5b1c"
        iconBackground="#f3e3c8"
        title="Who's coming"
        subtitle="Answer, and see everyone invited, in the Gathering Nook"
        onPress={() => router.push(`/gatherings/${id}`)}
      />

      <SectionHeader
        title={hasHonorees ? "Celebrating" : "Everyone's Wishbooks"}
        icon="group"
      />
      {me ? (
        <NavCard
          leading={<Avatar name={me.display_name} icon={me.avatar_icon} color={me.avatar_color} photo={me.avatar_path} />}
          icon="heart"
          title={`${displayName(me)} (you)`}
          subtitle="Pick which of your gifts show here"
          onPress={() => openWishbook(me.id)}
        />
      ) : null}

      {/* GIFT-038: who you've got a gift for, here, and who's still left. */}
      {others.length ? (
        <View style={[ui.card, { gap: 10 }]}>
          <View style={[ui.row, { justifyContent: "space-between" }]}>
            <Text style={ui.cardTitle}>Your shopping</Text>
            <Text style={[ui.muted, { fontWeight: "700", color: counts.need ? colors.bark : "#3f7a4f" }]}>
              {counts.need ? `${counts.need} to go` : "All done"}
            </Text>
          </View>
          <View style={styles.bar}>
            <View style={[styles.barFill, { width: `${Math.round(((counts.got + counts.skipped) / others.length) * 100)}%` }]} />
          </View>
          <Text style={ui.muted}>
            {`Got a gift for ${counts.got} of ${others.length}`}
            {counts.skipped ? ` · not getting ${counts.skipped}` : ""}. Only you see this.
          </Text>
          <View style={ui.chips}>
            <Chip selected={shownFilter === "need"} onPress={() => pickFilter("need")}>{`Still need (${counts.need})`}</Chip>
            <Chip selected={shownFilter === "got"} onPress={() => pickFilter("got")}>{`Got one (${counts.got})`}</Chip>
            {counts.skipped ? (
              <Chip selected={shownFilter === "skipped"} onPress={() => pickFilter("skipped")}>{`Not getting (${counts.skipped})`}</Chip>
            ) : null}
            <Chip selected={shownFilter === "all"} onPress={() => pickFilter("all")}>Everyone</Chip>
          </View>
        </View>
      ) : null}

      {shown.map(({ person, shopping }, i) => {
        const manages = managedIds.has(person.id);
        return (
          <NavCard
            key={person.id}
            index={i}
            leading={<Avatar name={person.display_name} icon={person.avatar_icon} color={person.avatar_color} photo={person.avatar_path} />}
            icon={manages ? "heart" : "wishbook"}
            title={displayName(person)}
            subtitle={`${shoppingLine(shopping)}${manages ? " · tap to pick which of their gifts show here" : ""}`}
            right={
              <View style={[ui.row, { gap: 10 }]}>
                <Icon
                  name={shopping.state === "got" ? "check" : shopping.state === "skipped" ? "minus" : "gift"}
                  size={18}
                  color={shopping.state === "got" ? "#3f7a4f" : colors.muted}
                />
                <Tap
                  onPress={() => personOptions(person, shopping)}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={`More for ${displayName(person)}`}
                >
                  <Icon name="more" size={20} color={colors.bark} />
                </Tap>
              </View>
            }
            onPress={() => openWishbook(person.id)}
          />
        );
      })}
      {others.length && !shown.length ? (
        <Text style={ui.muted}>
          {shownFilter === "need" ? "You've got everyone covered here." : "Nobody here."}
        </Text>
      ) : null}

      {canDelete ? (
        <Button
          title="Delete Gathering"
          icon="trash"
          variant="danger"
          onPress={confirmDelete}
          style={{ marginTop: 12 }}
        />
      ) : null}
    </NookScroll>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    bar: { height: 8, borderRadius: 4, backgroundColor: colors.barkSoft, overflow: "hidden" },
    barFill: { height: 8, borderRadius: 4, backgroundColor: "#3f7a4f" },
  }),
);
