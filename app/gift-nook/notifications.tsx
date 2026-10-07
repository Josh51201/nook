import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Icon, type IconName } from "../../components/icon";
import { NookScroll } from "../../components/nook-scroll";
import { EmptyState, NavCard } from "../../components/ui";
import { formatDate } from "../../lib/gift-nook";
import { supabase } from "../../lib/supabase";
import { colors, ui } from "../../lib/theme";
import { LoadingScreen, Tap } from "../../components/motion";

type Notice = {
  id: string;
  kind: "gathering_soon" | "new_gifts" | "tuck_changed" | "member_joined";
  title: string;
  body: string | null;
  data: { owner_id?: string; gift_id?: string; burrow_id?: string; gathering_id?: string };
  created_at: string;
  read_at: string | null;
};

const kindIcon: Record<Notice["kind"], IconName> = {
  gathering_soon: "calendar",
  new_gifts: "gift",
  tuck_changed: "edit",
  member_joined: "invite",
};

// GIFT-029: the Gift Nook inbox. What shows up here is chosen in Gift Nook
// settings. Push notifications to the phone come later.
export default function Notifications() {
  const router = useRouter();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("notifications")
      .select("id, kind, title, body, data, created_at, read_at")
      .eq("nook", "gift-nook")
      .order("created_at", { ascending: false })
      .limit(100);
    setNotices((data ?? []) as Notice[]);
    setIsLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function markAllRead() {
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .is("read_at", null);
    load();
  }

  async function open(notice: Notice) {
    if (!notice.read_at) {
      await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", notice.id);
    }
    if (notice.kind === "new_gifts" && notice.data.owner_id) {
      router.push(`/gift-nook/member/${notice.data.owner_id}`);
    } else if (notice.kind === "tuck_changed") {
      router.push("/gift-nook/my-tucks");
    } else if (notice.kind === "gathering_soon" && notice.data.gathering_id) {
      router.push(`/gift-nook/gathering/${notice.data.gathering_id}`);
    } else if (notice.kind === "member_joined" && notice.data.burrow_id) {
      router.push(`/gift-nook/burrow/${notice.data.burrow_id}`);
    }
  }

  if (isLoading) return <LoadingScreen />;

  const unread = notices.filter((n) => !n.read_at).length;

  return (
    <NookScroll onRefresh={load}>
      {unread > 0 ? (
        <Tap onPress={markAllRead} style={[ui.row, { alignSelf: "flex-end", gap: 6 }]} hitSlop={8}>
          <Icon name="check" size={16} />
          <Text style={ui.link}>Mark all read</Text>
        </Tap>
      ) : null}
      {notices.length === 0 ? (
        <EmptyState
          icon="inbox"
          title="All quiet"
          body="Upcoming Gatherings, new gifts, changes to gifts you tucked, and new Burrow members land here — choose which in Gift Nook settings."
        />
      ) : (
        notices.map((notice, i) => (
          <NavCard
            key={notice.id}
            index={i}
            icon={kindIcon[notice.kind] ?? "bell"}
            iconBackground={notice.read_at ? colors.barkSoft : colors.sun}
            title={
              <Text style={notice.read_at ? { fontWeight: "400" } : null}>{notice.title}</Text>
            }
            subtitle={`${notice.body ? `${notice.body} · ` : ""}${formatDate(notice.created_at)}`}
            onPress={() => open(notice)}
            right={!notice.read_at ? <View style={styles.dot} /> : undefined}
          />
        ))
      )}
    </NookScroll>
  );
}

const styles = StyleSheet.create({
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.heart },
});
