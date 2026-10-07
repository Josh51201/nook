import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Text, View } from "react-native";

import { guarded } from "../../lib/feedback";
import { Icon, type IconName } from "../../components/icon";
import { NookScroll } from "../../components/nook-scroll";
import { EmptyState, NavCard, SectionHeader } from "../../components/ui";
import { useAuth } from "../../lib/auth-context";
import {
  displayName,
  giftChangedSince,
  tuckStatusIcon,
  tuckStatusLabel,
  type Tuck,
} from "../../lib/gift-nook";
import { supabase } from "../../lib/supabase";
import { colors, ui } from "../../lib/theme";
import { LoadingScreen, Tap } from "../../components/motion";

type MyTuck = Tuck & {
  gifts: {
    id: string;
    title: string;
    created_at: string;
    updated_at: string;
    removed_at: string | null;
    wishbooks: {
      owner_id: string;
      profiles: { display_name: string | null } | null;
    } | null;
  } | null;
};

// Your shopping list: everything you've tucked away, across every Wishbook,
// with heads-ups when a gift changed or was removed (GIFT-023/025).
export default function MyTucks() {
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user.id;

  const [tucks, setTucks] = useState<MyTuck[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(
    () =>
      guarded(
        async () => {
          if (!userId) return;
          const { data } = await supabase
            .from("claims")
            .select(
              "id, claimed_by, released_at, status, note, claimed_at, acknowledged_at, profiles(display_name), " +
                "gifts(id, title, created_at, updated_at, removed_at, wishbooks(owner_id, profiles(display_name)))",
            )
            .eq("claimed_by", userId)
            .is("released_at", null)
            .order("claimed_at", { ascending: false });
          setTucks(
            ((data ?? []) as unknown as MyTuck[]).filter((t) => t.gifts),
          );
          setIsLoading(false);
        },
        (message) => console.warn(message),
        () => setIsLoading(false),
      ),
    [userId],
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (isLoading) return <LoadingScreen />;

  const open = tucks.filter((t) => t.status !== "given");
  const given = tucks.filter((t) => t.status === "given");

  function row(tuck: MyTuck, index: number) {
    const gift = tuck.gifts!;
    const owner = gift.wishbooks;
    const changed = tuck.status !== "given" && giftChangedSince(gift, tuck);
    return (
      <NavCard
        key={tuck.id}
        index={index}
        icon={tuckStatusIcon[tuck.status]}
        iconColor={gift.removed_at ? colors.error : colors.bark}
        iconBackground={
          gift.removed_at ? colors.rose : changed ? colors.sun : colors.barkSoft
        }
        title={gift.title}
        subtitle={`For ${displayName(owner?.profiles)} · ${tuckStatusLabel[tuck.status]}`}
        onPress={() =>
          owner && router.push(`/gift-nook/member/${owner.owner_id}`)
        }
      >
        {tuck.note ? (
          <Text style={[ui.muted, { fontStyle: "italic", marginTop: 6 }]}>
            “{tuck.note}”
          </Text>
        ) : null}
        {gift.removed_at ? (
          <Text style={{ color: colors.error, marginTop: 6 }}>
            Removed from their list — open to release it
          </Text>
        ) : changed ? (
          <Text style={{ color: colors.bark, marginTop: 6 }}>
            Changed since you tucked it
          </Text>
        ) : null}
      </NavCard>
    );
  }

  const planning = open.filter((t) => t.status === "planning").length;
  const bought = open.filter((t) => t.status === "bought").length;

  return (
    <NookScroll onRefresh={load}>
      {open.length === 0 ? (
        <EmptyState
          icon="tucks"
          title="Nothing tucked away yet"
          body="Open someone's Wishbook and tap “Tuck it away” on a gift you'll get. It'll land here as your shopping list."
        />
      ) : (
        <>
          <View style={[ui.row, { gap: 10 }]}>
            <Stat label="To get" value={planning} icon="tucks" />
            <Stat label="Bought" value={bought} icon="bought" />
          </View>
          {open.map(row)}
        </>
      )}
      {given.length > 0 ? (
        <>
          <SectionHeader title="Given" icon="given" />
          {given.map(row)}
        </>
      ) : null}
    </NookScroll>
  );
}

function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: IconName;
}) {
  return (
    <View
      style={[
        ui.card,
        { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
      ]}
    >
      <Icon name={icon} size={20} />
      <View>
        <Text style={{ fontSize: 22, fontWeight: "700", color: colors.text }}>
          {value}
        </Text>
        <Text style={ui.muted}>{label}</Text>
      </View>
    </View>
  );
}
