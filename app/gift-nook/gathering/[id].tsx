import {
  Stack,
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import { useCallback, useState } from "react";
import { Alert, View } from "react-native";
import { Text } from "../../../components/text";

import { friendlyError, guarded } from "../../../lib/feedback";
import type { Guest } from "../../../lib/gatherings";
import { addPotluck } from "../../../lib/gatherings-data";
import { Avatar } from "../../../components/avatar";
import { IconBadge } from "../../../components/icon";
import { Appear, LoadingScreen } from "../../../components/motion";
import { NookScroll } from "../../../components/nook-scroll";
import {
  Button,
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
} from "../../../lib/gift-nook";
import { supabase } from "../../../lib/supabase";
import { colors, ui } from "../../../lib/theme";

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
          setIsLoading(false);
        },
        setError,
        () => setIsLoading(false),
      ),
    [id, userId],
  );

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
      {people.map((person, i) => {
        const isMe = person.id === userId;
        const manages = managedIds.has(person.id);
        return (
          <NavCard
            key={person.id}
            index={i}
            leading={<Avatar name={person.display_name} icon={person.avatar_icon} color={person.avatar_color} photo={person.avatar_path} />}
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
