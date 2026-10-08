import { useEffect, useState, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, LinearTransition } from "react-native-reanimated";

import { useAuth } from "../../lib/auth-context";
import { tap } from "../../lib/feedback";
import { guardTouches } from "../../lib/touch-guard";
import { countdown, displayName, gatheringKindInfo, type TuckStatus } from "../../lib/gift-nook";
import { deepColor, tileBevel, tilePalette } from "../../lib/hearth-layout";
import { supabase } from "../../lib/supabase";
import { describeSchedule, widgetKindInfo, type WidgetConfig, type WidgetOf } from "../../lib/widgets";
import { Icon, type IconName } from "../icon";
import { Tap } from "../motion";

// Renders any Hearth widget (CORE-018) at its size, in its chosen look.
// GIFT-007: widgets only ever show your own tucks (gifts *you're* getting
// others) and Gatherings — never anything about tucks on your own gifts.

type Palette = { text: string; muted: string; accent: string; faint: string };

export function WidgetView({
  widget,
  color,
  width,
  height,
  refreshKey,
  themeText,
  onChange,
}: {
  widget: WidgetConfig;
  color?: string;
  width: number;
  height: number;
  refreshKey: number;
  themeText: string;
  // Lets interactive widgets (reminders) save changes, e.g. ticking an item.
  onChange?: (widget: WidgetConfig) => void;
}) {
  const soft = color ?? tilePalette[0];
  const deep = deepColor(soft);
  const look = widget.look;
  const palette: Palette =
    look === "bold"
      ? { text: "#ffffff", muted: "rgba(255,255,255,0.78)", accent: "#ffffff", faint: "rgba(255,255,255,0.16)" }
      : look === "outline"
        ? { text: themeText, muted: `${themeText}99`, accent: deep, faint: `${deep}14` }
        : { text: "#2a2420", muted: "#6f625a", accent: deep, faint: "rgba(255,255,255,0.55)" };
  const info = widgetKindInfo(widget.kind);
  const compact = height < 120;

  return (
    <View
      style={[
        styles.frame,
        { width, height },
        look === "bold" && { backgroundColor: deep, boxShadow: tileBevel },
        look === "soft" && { backgroundColor: soft, boxShadow: tileBevel },
        look === "outline" && { borderWidth: 2, borderColor: deep, backgroundColor: "transparent" },
      ]}
    >
      {widget.showTitle && !compact ? (
        <View style={[styles.titleRow]}>
          <Icon name={info.icon} size={14} color={palette.accent} />
          <Text style={[styles.title, { color: palette.muted }]} numberOfLines={1}>
            {widget.title || info.label}
          </Text>
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Body widget={widget} palette={palette} height={height} width={width} refreshKey={refreshKey} onChange={onChange} />
      </View>
    </View>
  );
}

function Body(props: {
  widget: WidgetConfig;
  palette: Palette;
  width: number;
  height: number;
  refreshKey: number;
  onChange?: (widget: WidgetConfig) => void;
}) {
  const { widget } = props;
  switch (widget.kind) {
    case "countdown":
      return <Countdown {...props} widget={widget} />;
    case "gatherings":
      return <Gatherings {...props} widget={widget} />;
    case "reminders":
      return <Reminders {...props} widget={widget} />;
    case "tucks":
      return <Tucks {...props} widget={widget} />;
    case "note":
      return <Note {...props} widget={widget} />;
    case "inbox":
      return <Inbox {...props} widget={widget} />;
    case "greeting":
      return <Greeting {...props} widget={widget} />;
  }
}

type BodyProps<K extends WidgetConfig["kind"]> = {
  widget: WidgetOf<K>;
  palette: Palette;
  width: number;
  height: number;
  refreshKey: number;
  onChange?: (widget: WidgetConfig) => void;
};

// How many list rows fit in a widget of this height.
function rowsThatFit(height: number, rowHeight = 26, chrome = 52) {
  return Math.max(1, Math.floor((height - chrome) / rowHeight));
}

function Muted({ children, palette }: { children: ReactNode; palette: Palette }) {
  return <Text style={[styles.small, { color: palette.muted }]}>{children}</Text>;
}

// --- Countdown ------------------------------------------------------------------

function Countdown({ widget, palette, refreshKey, height }: BodyProps<"countdown">) {
  const { source, gatheringId, customTitle, customDate, display } = widget.settings;
  const [target, setTarget] = useState<{ title: string; date: string; icon: IconName } | null | undefined>(undefined);

  useEffect(() => {
    if (source === "custom") {
      setTarget(customDate ? { title: customTitle || "The big day", date: customDate, icon: "calendar" } : null);
      return;
    }
    let query = supabase.from("gatherings").select("title, kind, ends_at");
    query = source === "gathering" && gatheringId ? query.eq("id", gatheringId) : query.gt("ends_at", new Date().toISOString());
    query
      .order("ends_at")
      .limit(1)
      .then(({ data }) => {
        const row = data?.[0];
        setTarget(row ? { title: row.title, date: row.ends_at, icon: gatheringKindInfo(row.kind).icon } : null);
      });
  }, [source, gatheringId, customTitle, customDate, refreshKey]);

  if (target === undefined) return null;
  if (!target) return <Muted palette={palette}>{source === "custom" ? "Pick a date in the editor" : "Nothing coming up"}</Muted>;

  const start = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((start(new Date(target.date)) - start(new Date())) / 86400000);
  const big = height >= 150;

  if (display === "words" || height < 120) {
    return (
      <View style={styles.centerFill}>
        <Text style={[styles.body, { color: palette.text, fontWeight: "700" }]} numberOfLines={2}>
          {target.title} {days === 0 ? "is today!" : days > 0 ? `in ${days} day${days === 1 ? "" : "s"}` : countdown(target.date)}
        </Text>
      </View>
    );
  }
  return (
    <Animated.View entering={FadeIn.duration(250)} style={styles.centerFill}>
      <Text style={{ fontSize: big ? 56 : 40, fontWeight: "800", color: palette.text, letterSpacing: -1 }}>
        {days === 0 ? "Today" : Math.abs(days)}
      </Text>
      <Text style={[styles.small, { color: palette.muted, textAlign: "center" }]} numberOfLines={2}>
        {days === 0 ? target.title : days > 0 ? `day${days === 1 ? "" : "s"} until ${target.title}` : `days since ${target.title}`}
      </Text>
    </Animated.View>
  );
}

// --- Coming up -------------------------------------------------------------------

function Gatherings({ widget, palette, refreshKey, height }: BodyProps<"gatherings">) {
  const { burrowId, kinds, count, showCountdown } = widget.settings;
  const [rows, setRows] = useState<{ id: string; title: string; kind: string; ends_at: string }[] | null>(null);

  useEffect(() => {
    let query = supabase.from("gatherings").select("id, title, kind, ends_at").gt("ends_at", new Date().toISOString());
    if (burrowId) query = query.eq("burrow_id", burrowId);
    if (kinds.length) query = query.in("kind", kinds);
    query
      .order("ends_at")
      .limit(count)
      .then(({ data }) => setRows(data ?? []));
  }, [burrowId, kinds.join(","), count, refreshKey]);

  if (!rows) return null;
  if (!rows.length) return <Muted palette={palette}>Nothing coming up</Muted>;
  const shown = rows.slice(0, rowsThatFit(height));
  return (
    <View style={{ gap: 6 }}>
      {shown.map((row) => {
        const kind = gatheringKindInfo(row.kind);
        return (
          <View key={row.id} style={styles.row}>
            <Icon name={kind.icon} size={15} color={palette.accent} />
            <Text style={[styles.body, { color: palette.text, flex: 1 }]} numberOfLines={1}>
              {row.title}
            </Text>
            {showCountdown ? <Muted palette={palette}>{countdown(row.ends_at)}</Muted> : null}
          </View>
        );
      })}
    </View>
  );
}

// --- Reminders -------------------------------------------------------------------

function Reminders({ widget, palette, height, onChange }: BodyProps<"reminders">) {
  const { items, hideDone } = widget.settings;
  const visible = items.filter((item) => !hideDone || !item.done);
  const fit = rowsThatFit(height, 30);
  const shown = visible.slice(0, fit);

  function toggle(id: string) {
    if (!onChange) return;
    tap();
    onChange({
      ...widget,
      settings: { ...widget.settings, items: items.map((item) => (item.id === id ? { ...item, done: !item.done } : item)) },
    });
  }

  if (!items.length) return <Muted palette={palette}>Tap Edit to add reminders</Muted>;
  return (
    <View style={{ gap: 4 }}>
      {shown.map((item) => (
        <Animated.View key={item.id} layout={LinearTransition.duration(200)}>
          <Tap
            onPressIn={() => guardTouches()}
            onPress={onChange ? () => toggle(item.id) : undefined}
            disabled={!onChange}
            style={styles.row}
            hitSlop={4}
          >
            <View
              style={[
                styles.check,
                { borderColor: palette.accent },
                item.done && { backgroundColor: palette.accent },
              ]}
            >
              {item.done ? <Icon name="check" size={12} color={palette.text === "#ffffff" ? "#2a2420" : "#ffffff"} /> : null}
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={[styles.body, { color: palette.text }, item.done && styles.done]}
                numberOfLines={1}
              >
                {item.text}
              </Text>
              {item.schedule && height >= 150 ? (
                <Text style={[styles.tiny, { color: palette.muted }]} numberOfLines={1}>
                  {describeSchedule(item.schedule)}
                </Text>
              ) : null}
            </View>
            {item.schedule ? <Icon name="bell" size={11} color={palette.muted} /> : null}
          </Tap>
        </Animated.View>
      ))}
      {visible.length > shown.length ? <Muted palette={palette}>+{visible.length - shown.length} more</Muted> : null}
    </View>
  );
}

// --- Gifts to buy (your tucks) ------------------------------------------------

function Tucks({ widget, palette, refreshKey, height }: BodyProps<"tucks">) {
  const { session } = useAuth();
  const { include, count } = widget.settings;
  const [rows, setRows] = useState<{ id: string; status: TuckStatus; title: string; forName: string }[] | null>(null);

  useEffect(() => {
    if (!session) return;
    supabase
      .from("claims")
      .select("id, status, gifts(title, wishbooks(profiles(display_name)))")
      .eq("claimed_by", session.user.id)
      .is("released_at", null)
      .in("status", include === "planning" ? ["planning"] : ["planning", "bought"])
      .order("claimed_at", { ascending: false })
      .then(({ data }) =>
        setRows(
          (data ?? []).map((row) => {
            const gift = row.gifts as unknown as { title: string; wishbooks: { profiles: { display_name: string | null } | null } | null } | null;
            return {
              id: row.id,
              status: row.status as TuckStatus,
              title: gift?.title ?? "A gift",
              forName: displayName(gift?.wishbooks?.profiles),
            };
          })
        )
      );
  }, [session, include, refreshKey]);

  if (!rows) return null;
  if (!rows.length) return <Muted palette={palette}>Nothing to buy right now</Muted>;
  const shown = rows.slice(0, Math.min(count, rowsThatFit(height, 26, 86)));
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontSize: 30, fontWeight: "800", color: palette.text }}>{rows.length}</Text>
      {shown.map((row) => (
        <View key={row.id} style={styles.row}>
          <Icon name={row.status === "bought" ? "bought" : "tucks"} size={13} color={palette.accent} />
          <Text style={[styles.body, { color: palette.text, flex: 1 }]} numberOfLines={1}>
            {row.title}
            <Text style={{ color: palette.muted }}> · {row.forName}</Text>
          </Text>
        </View>
      ))}
    </View>
  );
}

// --- Sticky note ---------------------------------------------------------------------

function Note({ widget, palette }: BodyProps<"note">) {
  const { text, textSize, align } = widget.settings;
  const fontSize = { small: 14, medium: 17, large: 22 }[textSize];
  return (
    <Text
      style={{ color: text ? palette.text : palette.muted, fontSize, lineHeight: fontSize * 1.35, textAlign: align, fontWeight: textSize === "large" ? "700" : "500" }}
    >
      {text || "Tap Edit to write something"}
    </Text>
  );
}

// --- Inbox --------------------------------------------------------------------------

function Inbox({ widget, palette, refreshKey, height }: BodyProps<"inbox">) {
  const [state, setState] = useState<{ unread: number; titles: string[] } | null>(null);
  useEffect(() => {
    Promise.all([
      supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null),
      supabase
        .from("notifications")
        .select("title")
        .is("read_at", null)
        .order("created_at", { ascending: false })
        .limit(widget.settings.count),
    ]).then(([countResult, listResult]) =>
      setState({ unread: countResult.count ?? 0, titles: (listResult.data ?? []).map((n) => n.title) })
    );
  }, [widget.settings.count, refreshKey]);

  if (!state) return null;
  return (
    <View style={{ gap: 6 }}>
      <View style={styles.row}>
        <Text style={{ fontSize: 30, fontWeight: "800", color: palette.text }}>{state.unread}</Text>
        <Muted palette={palette}>unread</Muted>
      </View>
      {state.titles.slice(0, rowsThatFit(height, 26, 90)).map((title, i) => (
        <Text key={i} style={[styles.body, { color: palette.text }]} numberOfLines={1}>
          {title}
        </Text>
      ))}
    </View>
  );
}

// --- Greeting -------------------------------------------------------------------

function Greeting({ widget, palette, refreshKey, height }: BodyProps<"greeting">) {
  const { session } = useAuth();
  const { message, showName, showDate } = widget.settings;
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    if (!session || !showName) return;
    supabase
      .from("profiles")
      .select("display_name")
      .eq("id", session.user.id)
      .single()
      .then(({ data }) => {
        const value = data?.display_name?.trim();
        setName(value && !value.includes("@") ? value.split(" ")[0] : null);
      });
  }, [session, showName, refreshKey]);

  const hour = new Date().getHours();
  const hello = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  return (
    <View style={[styles.centerFill, { alignItems: "flex-start" }]}>
      <Text style={{ fontSize: height >= 150 ? 26 : 20, fontWeight: "800", color: palette.text }} numberOfLines={1}>
        {hello}
        {showName && name ? `, ${name}` : ""}
      </Text>
      {showDate || message ? (
        <Text style={[styles.small, { color: palette.muted }]} numberOfLines={2}>
          {showDate ? new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }) : ""}
          {showDate && message ? " · " : ""}
          {message}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { borderRadius: 24, padding: 14, overflow: "hidden" },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  title: { fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.6, flex: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  body: { fontSize: 14, fontWeight: "500" },
  small: { fontSize: 13 },
  tiny: { fontSize: 11 },
  done: { textDecorationLine: "line-through", opacity: 0.6 },
  centerFill: { flex: 1, justifyContent: "center", alignItems: "center", gap: 2 },
  check: {
    width: 20,
    height: 20,
    borderRadius: 7,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
});
