import {
  Stack,
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import { useCallback, useState } from "react";
import { Text } from "react-native";

import { Avatar } from "../../../components/avatar";
import { LoadingScreen } from "../../../components/motion";
import { NookScroll } from "../../../components/nook-scroll";
import {
  Button,
  EmptyState,
  NavCard,
  SectionHeader,
} from "../../../components/ui";
import { useAuth } from "../../../lib/auth-context";
import { guarded } from "../../../lib/feedback";
import {
  countdown,
  displayName,
  formatDate,
  gatheringKindInfo,
  isArchived,
  PROFILE_FIELDS,
  type BurrowMember,
  type Gathering,
} from "../../../lib/gift-nook";
import { supabase } from "../../../lib/supabase";
import { colors, ui } from "../../../lib/theme";

// The Gift Nook's side of one Burrow (GIFT-005): its Gatherings
// (GIFT-014/015/016) and everyone's Wishbooks. Inviting people, admins,
// leaving and deleting live on the Burrow's own page in the Burrows tab
// (CORE-025), shared by every Nook.
export default function BurrowScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const userId = session?.user.id;

  const [name, setName] = useState("");
  const [members, setMembers] = useState<BurrowMember[]>([]);
  const [gatherings, setGatherings] = useState<Gathering[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    () =>
      guarded(
        async () => {
          const [burrowResult, membersResult, gatheringsResult] =
            await Promise.all([
              supabase.from("burrows").select("name").eq("id", id).single(),
              supabase
                .from("burrow_members")
                .select(
                  `profile_id, role, profiles(${PROFILE_FIELDS})`,
                )
                .eq("burrow_id", id),
              supabase
                .from("gatherings")
                .select("id, burrow_id, title, kind, ends_at")
                .eq("burrow_id", id)
                .order("ends_at"),
            ]);
          const firstError =
            burrowResult.error ?? membersResult.error ?? gatheringsResult.error;
          if (firstError) setError(firstError.message);
          setName(burrowResult.data?.name ?? "");
          setMembers((membersResult.data ?? []) as unknown as BurrowMember[]);
          setGatherings((gatheringsResult.data ?? []) as Gathering[]);
          setIsLoading(false);
        },
        setError,
        () => setIsLoading(false),
      ),
    [id],
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  function openWishbook(profileId: string) {
    if (profileId === userId) router.push("/gift-nook/wishbook");
    else router.push(`/gift-nook/member/${profileId}`);
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
        onPress={() =>
          router.push({
            pathname: "/gift-nook/gathering-form",
            params: { burrowId: id },
          })
        }
      />

      <SectionHeader title="Who's in the Burrow" icon="group" />
      {members.map((member, i) => {
        const isMe = member.profile_id === userId;
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
            iconColor={member.profiles?.is_managed ? "#4f7fb0" : colors.bark}
            iconBackground={
              member.profiles?.is_managed ? colors.sky : colors.barkSoft
            }
            title={`${displayName(member.profiles)}${isMe ? " (you)" : ""}`}
            subtitle="View Wishbook"
            onPress={() => openWishbook(member.profile_id)}
          />
        );
      })}
      <NavCard
        index={members.length}
        icon="burrow"
        title="Invite or manage this Burrow"
        subtitle="Send a Knock, admins, leaving — in Burrows"
        onPress={() => router.push(`/burrow/${id}`)}
      />

      {archived.length > 0 ? (
        <>
          <SectionHeader title="Archived Gatherings" icon="given" />
          {archived.map((gathering, i) => (
            <GatheringRow
              key={gathering.id}
              index={i}
              gathering={gathering}
              onPress={() =>
                router.push(`/gift-nook/gathering/${gathering.id}`)
              }
            />
          ))}
        </>
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
