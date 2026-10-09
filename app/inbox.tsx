import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import ReanimatedSwipeable, { type SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";
import { Text } from "../components/text";

import { Icon } from "../components/icon";
import { LoadingScreen, Tap } from "../components/motion";
import { NookScroll } from "../components/nook-scroll";
import { EmptyState, NavCard } from "../components/ui";
import { guarded, tap } from "../lib/feedback";
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

  // Swipe right to mark read / unread, swipe left to delete.
  const rows = useRef(new Map<string, SwipeableMethods>());

  async function toggleRead(notice: Notice) {
    rows.current.get(notice.id)?.close();
    const read_at = notice.read_at ? null : new Date().toISOString();
    setNotices((list) => list.map((n) => (n.id === notice.id ? { ...n, read_at } : n)));
    tap();
    const { error } = await supabase.from("notifications").update({ read_at }).eq("id", notice.id);
    if (error) {
      Alert.alert("Couldn't change that", error.message);
      load();
    }
  }

  async function remove(notice: Notice) {
    tap();
    setNotices((list) => list.filter((n) => n.id !== notice.id));
    const { error } = await supabase.from("notifications").delete().eq("id", notice.id);
    if (error) {
      Alert.alert("Couldn't delete that", error.message);
      load();
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
          body="News from your Nooks lands here — upcoming Gatherings, new gifts, changes to gifts you tucked, new Burrow members. Choose what you get in each Nook's settings."
        />
      ) : (
        notices.map((notice, i) => (
          <ReanimatedSwipeable
            key={notice.id}
            ref={(ref) => {
              if (ref) rows.current.set(notice.id, ref);
              else rows.current.delete(notice.id);
            }}
            overshootLeft={false}
            overshootRight={false}
            friction={2}
            leftThreshold={70}
            rightThreshold={70}
            containerStyle={{ borderRadius: 18 }}
            renderLeftActions={() => (
              <View style={[styles.action, { backgroundColor: colors.bark, alignItems: "flex-start" }]}>
                <Icon name={notice.read_at ? "bell" : "check"} size={20} color={colors.onAccent} />
                <Text style={styles.actionText}>{notice.read_at ? "Unread" : "Read"}</Text>
              </View>
            )}
            renderRightActions={() => (
              <View style={[styles.action, { backgroundColor: colors.error, alignItems: "flex-end" }]}>
                <Icon name="trash" size={20} color="#ffffff" />
                <Text style={styles.actionText}>Delete</Text>
              </View>
            )}
            // The direction is the way you swiped: right opens the Read panel on the
            // left, left opens Delete on the right.
            onSwipeableOpen={(direction) => (direction === "right" ? toggleRead(notice) : remove(notice))}
          >
          <NavCard
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
          </ReanimatedSwipeable>
        ))
      )}
    </NookScroll>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.heart },
    action: { flex: 1, justifyContent: "center", paddingHorizontal: 22, minWidth: 110, gap: 2, borderRadius: 18 },
    actionText: { color: "#ffffff", fontSize: 12, fontWeight: "700" },
  })
);
