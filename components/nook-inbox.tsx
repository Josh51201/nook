import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Modal, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, { FadeInDown, FadeOut, LinearTransition } from "react-native-reanimated";

import { tap } from "../lib/feedback";
import { formatDate } from "../lib/gift-nook";
import { noticeIcon, noticeRoute, placeNoticeBubble, takePeek, type Notice } from "../lib/inbox";
import { findNook } from "../lib/nooks";
import { supabase } from "../lib/supabase";
import { colors, shadow, themed } from "../lib/theme";
import { Icon, IconBadge } from "./icon";
import { Tap } from "./motion";
import { Text } from "./text";
import { HeaderIcon } from "./ui";

// A Nook's own bell (CORE-027, CORE-099 proposed), top right of its home
// screen. The badge counts that Nook's unread notices. Tapping it opens a
// bubble pointing at the bell with what's waiting: tap one to go to it, ×
// to dismiss it, "Dismiss all", or "Open inbox" for that Nook's full inbox.
// With nothing unread, the bell just opens the inbox. Opening the Nook from
// "Waiting for you" on the Nooks tab pops the bubble open on arrival.

const shown = 4;

export function NookInboxBell({ nook }: { nook: string }) {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const bell = useRef<View>(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [count, setCount] = useState(0);
  const [bubble, setBubble] = useState<ReturnType<typeof placeNoticeBubble> | null>(null);
  const peekTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openBubble = useCallback(() => {
    bell.current?.measureInWindow((x, y, width, height) => {
      if (!width) return;
      setBubble(placeNoticeBubble({ x, y, width, height }, screenWidth));
    });
  }, [screenWidth]);

  const load = useCallback(async () => {
    const { data, count: total } = await supabase
      .from("notifications")
      .select("id, nook, kind, title, body, data, created_at, read_at", { count: "exact" })
      .eq("nook", nook)
      .is("read_at", null)
      .order("created_at", { ascending: false })
      .limit(shown);
    const rows = (data ?? []) as Notice[];
    setNotices(rows);
    setCount(total ?? rows.length);
    // Wait for the screen to finish sliding in, so the bell is where it'll stay.
    if (rows.length && takePeek(nook)) peekTimer.current = setTimeout(openBubble, 450);
  }, [nook, openBubble]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );
  useEffect(() => () => {
    if (peekTimer.current) clearTimeout(peekTimer.current);
  }, []);

  function close() {
    setBubble(null);
  }

  function pressBell() {
    tap();
    if (count) openBubble();
    else router.push({ pathname: "/inbox", params: { nook } });
  }

  async function markRead(ids: string[] | "all") {
    const read_at = new Date().toISOString();
    let query = supabase.from("notifications").update({ read_at }).eq("nook", nook).is("read_at", null);
    if (ids !== "all") query = query.in("id", ids);
    const { error } = await query;
    if (error) Alert.alert("Couldn't change that", error.message);
    load();
  }

  function dismiss(notice: Notice) {
    tap();
    const left = notices.filter((n) => n.id !== notice.id);
    setNotices(left);
    setCount((c) => Math.max(0, c - 1));
    if (!left.length) close();
    markRead([notice.id]);
  }

  function dismissAll() {
    tap("success");
    setNotices([]);
    setCount(0);
    close();
    markRead("all");
  }

  function openNotice(notice: Notice) {
    tap();
    close();
    const route = noticeRoute(notice);
    markRead([notice.id]);
    if (route) router.push(route as never);
  }

  function openInbox() {
    tap();
    close();
    router.push({ pathname: "/inbox", params: { nook } });
  }

  const title = findNook(nook)?.title;
  const more = count - notices.length;

  return (
    <View ref={bell} collapsable={false}>
      <HeaderIcon
        icon="bell"
        label={count ? `Inbox, ${count} unread` : "Inbox"}
        badge={count}
        onPress={pressBell}
      />
      <Modal visible={bubble !== null} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close} accessibilityLabel="Close" accessibilityRole="button" />
        {bubble ? (
          <Animated.View
            entering={FadeInDown.springify().damping(18).stiffness(220)}
            style={[styles.bubble, { top: bubble.top, left: bubble.left, width: bubble.width }]}
            accessibilityViewIsModal
          >
            <View style={[styles.arrow, { left: bubble.arrowX - 9 }]} />
            <View style={styles.header}>
              <Text style={styles.title} accessibilityRole="header">
                Waiting for you
              </Text>
              <Text style={styles.count}>
                {count} new{title ? ` in ${title}` : ""}
              </Text>
            </View>

            {notices.map((notice) => (
              <Animated.View key={notice.id} exiting={FadeOut.duration(150)} layout={LinearTransition.duration(200)} style={styles.row}>
                <Tap
                  onPress={() => openNotice(notice)}
                  style={styles.rowMain}
                  accessibilityRole="button"
                  accessibilityHint={noticeRoute(notice) ? "Opens it" : "Marks it read"}
                >
                  <IconBadge name={noticeIcon(notice)} size={34} background={colors.sun} />
                  <View style={{ flex: 1, gap: 1 }}>
                    <Text style={styles.noticeTitle} numberOfLines={2}>
                      {notice.title}
                    </Text>
                    <Text style={styles.noticeBody} numberOfLines={2}>
                      {[notice.body, formatDate(notice.created_at)].filter(Boolean).join(" · ")}
                    </Text>
                  </View>
                </Tap>
                <Tap
                  onPress={() => dismiss(notice)}
                  hitSlop={8}
                  pressedScale={0.85}
                  style={styles.dismiss}
                  accessibilityRole="button"
                  accessibilityLabel={`Dismiss ${notice.title}`}
                >
                  <Icon name="close" size={14} color={colors.muted} />
                </Tap>
              </Animated.View>
            ))}

            {more > 0 ? <Text style={styles.more}>+{more} more in the inbox</Text> : null}

            <View style={styles.footer}>
              <Tap onPress={dismissAll} hitSlop={10} accessibilityRole="button">
                <Text style={styles.dismissAll}>Dismiss all</Text>
              </Tap>
              <Tap onPress={openInbox} style={styles.openInbox} accessibilityRole="button">
                <Icon name="inbox" size={14} color={colors.onAccent} />
                <Text style={styles.openInboxText}>Open inbox</Text>
              </Tap>
            </View>
          </Animated.View>
        ) : null}
      </Modal>
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    backdrop: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(34, 22, 14, 0.18)" },
    bubble: {
      position: "absolute",
      backgroundColor: colors.background,
      borderRadius: 22,
      padding: 14,
      gap: 8,
      ...shadow,
    },
    arrow: {
      position: "absolute",
      top: -7,
      width: 18,
      height: 18,
      backgroundColor: colors.background,
      transform: [{ rotate: "45deg" }],
      borderRadius: 3,
    },
    header: { paddingHorizontal: 4, marginBottom: 2 },
    title: { fontSize: 17, fontWeight: "800", color: colors.text, letterSpacing: -0.2 },
    count: { fontSize: 13, color: colors.muted },
    row: { flexDirection: "row", alignItems: "center", gap: 6 },
    rowMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4, paddingHorizontal: 4 },
    noticeTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
    noticeBody: { fontSize: 13, color: colors.muted },
    dismiss: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.barkSoft,
    },
    more: { fontSize: 13, color: colors.muted, paddingHorizontal: 4 },
    footer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 4,
      paddingLeft: 4,
    },
    dismissAll: { color: colors.bark, fontSize: 15, fontWeight: "600" },
    openInbox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: colors.bark,
      borderRadius: 999,
      paddingVertical: 9,
      paddingHorizontal: 16,
    },
    openInboxText: { color: colors.onAccent, fontSize: 15, fontWeight: "700" },
  })
);
