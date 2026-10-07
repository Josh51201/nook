import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";

import { NookScroll } from "../../components/nook-scroll";
import { formatDate } from "../../lib/gift-nook";
import { supabase } from "../../lib/supabase";
import { colors, ui } from "../../lib/theme";

type Notice = {
  id: string;
  kind: "gathering_soon" | "new_gifts" | "tuck_changed" | "member_joined";
  title: string;
  body: string | null;
  data: { owner_id?: string; gift_id?: string; burrow_id?: string; gathering_id?: string };
  created_at: string;
  read_at: string | null;
};

const kindEmoji: Record<Notice["kind"], string> = {
  gathering_soon: "📅",
  new_gifts: "🎁",
  tuck_changed: "✏️",
  member_joined: "🚪",
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

  if (isLoading) {
    return (
      <View style={ui.center}>
        <ActivityIndicator />
      </View>
    );
  }

  const unread = notices.filter((n) => !n.read_at).length;

  return (
    <NookScroll onRefresh={load}>
      {unread > 0 ? (
        <TouchableOpacity onPress={markAllRead} style={{ alignSelf: "flex-end" }}>
          <Text style={ui.link}>Mark all read</Text>
        </TouchableOpacity>
      ) : null}
      {notices.length === 0 ? (
        <Text style={ui.muted}>
          Nothing yet. You'll see upcoming Gatherings, new gifts, changes to gifts you tucked, and new
          Burrow members here — choose which in Gift Nook settings.
        </Text>
      ) : (
        notices.map((notice) => (
          <TouchableOpacity
            key={notice.id}
            style={[ui.card, ui.row, !notice.read_at && { borderLeftWidth: 4, borderLeftColor: colors.bark }]}
            onPress={() => open(notice)}
          >
            <Text style={{ fontSize: 24 }}>{kindEmoji[notice.kind] ?? "🔔"}</Text>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[ui.cardTitle, notice.read_at ? { fontWeight: "400" } : null]}>{notice.title}</Text>
              {notice.body ? <Text style={ui.muted}>{notice.body}</Text> : null}
              <Text style={[ui.muted, { fontSize: 12 }]}>{formatDate(notice.created_at)}</Text>
            </View>
          </TouchableOpacity>
        ))
      )}
    </NookScroll>
  );
}
