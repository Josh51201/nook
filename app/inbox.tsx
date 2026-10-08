import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Icon } from "../components/icon";
import { LoadingScreen, Tap } from "../components/motion";
import { NookScroll } from "../components/nook-scroll";
import { EmptyState, NavCard } from "../components/ui";
import { guarded } from "../lib/feedback";
import { formatDate } from "../lib/gift-nook";
import { noticeIcon, noticeRoute, type Notice } from "../lib/inbox";
import { findNook } from "../lib/nooks";
import { supabase } from "../lib/supabase";
import { colors, themed, ui } from "../lib/theme";

// The inbox (CORE-027, GIFT-029): notices from every Nook in one place,
// newest first, each labelled with the Nook it came from. `?nook=` limits it
// to one Nook (a Nook's own bell uses that). What gets sent is chosen in
// each Nook's settings. Push notifications to the phone come later.
export default function Inbox() {
  const router = useRouter();
  const { nook } = useLocalSearchParams<{ nook?: string }>();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(
    () =>
      guarded(
        async () => {
          let query = supabase
            .from("notifications")
            .select("id, nook, kind, title, body, data, created_at, read_at")
            .order("created_at", { ascending: false })
            .limit(100);
          if (nook) query = query.eq("nook", nook);
          const { data } = await query;
          setNotices((data ?? []) as Notice[]);
          setIsLoading(false);
        },
        (message) => console.warn(message),
        () => setIsLoading(false)
      ),
    [nook]
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function markAllRead() {
    let query = supabase.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
    if (nook) query = query.eq("nook", nook);
    await query;
    load();
  }

  async function open(notice: Notice) {
    if (!notice.read_at) {
      await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", notice.id);
    }
    const route = noticeRoute(notice);
    if (route) router.push(route as never);
    else load();
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
          body="News from your Nooks lands here — upcoming Gatherings, new gifts, changes to gifts you tucked, new Burrow members. Choose what you get in each Nook's settings."
        />
      ) : (
        notices.map((notice, i) => (
          <NavCard
            key={notice.id}
            index={i}
            icon={noticeIcon(notice)}
            iconBackground={notice.read_at ? colors.barkSoft : colors.sun}
            title={<Text style={notice.read_at ? { fontWeight: "400" } : null}>{notice.title}</Text>}
            subtitle={[
              notice.body,
              nook ? null : findNook(notice.nook)?.title,
              formatDate(notice.created_at),
            ]
              .filter(Boolean)
              .join(" · ")}
            onPress={() => open(notice)}
            right={!notice.read_at ? <View style={styles.dot} /> : undefined}
          />
        ))
      )}
    </NookScroll>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.heart },
  })
);
