import { useEffect, useState, type ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Text } from "../text";
import Animated, { FadeIn, FadeInRight, LinearTransition, ZoomIn } from "react-native-reanimated";

import { useAuth } from "../../lib/auth-context";
import { tap } from "../../lib/feedback";
import { countdown, displayName, formatDate, gatheringKindInfo, type TuckStatus } from "../../lib/gift-nook";
import { deepColor, tileBevel, tilePalette } from "../../lib/hearth-layout";
import { noticeIcon } from "../../lib/inbox";
import { supabase } from "../../lib/supabase";
import { usePetsSummary } from "../../lib/pets-data";
import { useLetterboxSummary } from "../../lib/use-letterbox";
import { guardTouches } from "../../lib/touch-guard";
import {
  describeSchedule,
  widgetKindInfo,
  widgetShape,
  type WidgetConfig,
  type WidgetOf,
  type WidgetShape,
} from "../../lib/widgets";
import { Icon, IconBadge, type IconName } from "../icon";
import { Tap } from "../motion";

// Renders any Hearth widget (CORE-018) in its chosen look, laid out for the
// shape it's been given (CORE-030): a single icon with a count, a one-line
// strip, or cards that fill their space — a calendar page for a countdown,
// a progress bar for reminders, soft inner panels for lists.
// GIFT-007: widgets only ever show your own tucks (gifts *you're* getting
// others) and Gatherings — never anything about tucks on your own gifts.

export type Palette = {
  text: string;
  muted: string;
  accent: string;
  faint: string;
  // Inner panels that hold lists, like the Gift Nook's big tile.
  panel: string;
  // The deep partner of the widget's color (calendar pages, pills).
  deep: string;
};

// A widget's colors for its look; also used by its open page (app/widget/view).
export function widgetPalette(look: WidgetConfig["look"], color: string | undefined, themeText: string): Palette {
  const deep = deepColor(color ?? tilePalette[0]);
  if (look === "bold") {
    return {
      text: "#ffffff",
      muted: "rgba(255,255,255,0.78)",
      accent: "#ffffff",
      faint: "rgba(255,255,255,0.16)",
      panel: "rgba(255,255,255,0.15)",
      deep,
    };
  }
  if (look === "outline") {
    return { text: themeText, muted: `${themeText}99`, accent: deep, faint: `${deep}14`, panel: `${deep}12`, deep };
  }
  return {
    text: "#2a2420",
    muted: "#6f625a",
    accent: deep,
    faint: "rgba(255,255,255,0.55)",
    panel: "rgba(255,255,255,0.62)",
    deep,
  };
}

export function WidgetView({
  widget,
  color,
  icon,
  width,
  height,
  refreshKey,
  themeText,
  onChange,
}: {
  widget: WidgetConfig;
  color?: string;
  // A person's own pick of icon (CORE-030); otherwise the widget's usual one.
  icon?: IconName;
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
  const palette = widgetPalette(look, soft, themeText);
  const info = widgetKindInfo(widget.kind);
  const shape = widgetShape(width, height);
  const showTitle = widget.showTitle && shape !== "icon" && shape !== "strip";

  return (
    <View
      style={[
        styles.frame,
        { width, height },
        shape === "icon" && { padding: 8 },
        shape === "strip" && { paddingVertical: 10, paddingHorizontal: 14 },
        look === "bold" && { backgroundColor: deep, boxShadow: tileBevel },
        look === "soft" && { backgroundColor: soft, boxShadow: tileBevel },
        look === "outline" && { borderWidth: 2, borderColor: deep, backgroundColor: "transparent" },
      ]}
    >
      {showTitle ? (
        <View style={styles.titleRow}>
          <Icon name={icon ?? info.icon} size={14} color={palette.accent} />
          <Text style={[styles.title, { color: palette.muted }]} numberOfLines={1}>
            {widget.title || info.label}
          </Text>
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Body
          widget={widget}
          palette={palette}
          height={height - (showTitle ? 26 : 0)}
          width={width}
          shape={shape}
          icon={icon ?? info.icon}
          refreshKey={refreshKey}
          onChange={onChange}
        />
      </View>
    </View>
  );
}

type CommonProps = {
  palette: Palette;
  width: number;
  height: number;
  shape: WidgetShape;
  icon: IconName;
  refreshKey: number;
  onChange?: (widget: WidgetConfig) => void;
};

function Body(props: CommonProps & { widget: WidgetConfig }) {
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
    case "cards":
      return <Cards {...props} widget={widget} />;
    case "pets":
      return <PetCare {...props} widget={widget} />;
  }
}

type BodyProps<K extends WidgetConfig["kind"]> = CommonProps & { widget: WidgetOf<K> };

// How many list rows fit in a widget of this height.
function rowsThatFit(height: number, rowHeight = 26, chrome = 52) {
  return Math.max(1, Math.floor((height - chrome) / rowHeight));
}

const isBig = (shape: WidgetShape) => shape === "wide" || shape === "tall" || shape === "large";

// --- Shared building blocks -------------------------------------------------

function Muted({ children, palette }: { children: ReactNode; palette: Palette }) {
  return (
    <Text style={[styles.small, { color: palette.muted }]} numberOfLines={1}>
      {children}
    </Text>
  );
}

function Panel({ palette, children, style }: { palette: Palette; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.panel, { backgroundColor: palette.panel }, style]}>{children}</View>;
}

// One cell: an icon with a little count, or a short value ("12") in its place.
function IconFace({
  icon,
  palette,
  badge,
  value,
  caption,
}: {
  icon: IconName;
  palette: Palette;
  badge?: number;
  value?: string;
  caption?: string;
}) {
  if (value !== undefined) {
    return (
      <View style={styles.centerFill}>
        <Icon name={icon} size={13} color={palette.accent} />
        <Text style={{ fontSize: value.length > 3 ? 15 : 24, fontWeight: "800", color: palette.text, letterSpacing: -0.5 }}>
          {value}
        </Text>
        {caption ? <Text style={[styles.tiny, { color: palette.muted, marginTop: -2 }]}>{caption}</Text> : null}
      </View>
    );
  }
  return (
    <View style={styles.centerFill}>
      <Icon name={icon} size={32} color={palette.accent} />
      {badge ? (
        <Animated.View
          key={badge}
          entering={ZoomIn.springify().damping(12)}
          style={[styles.badge, { backgroundColor: palette.text === "#ffffff" ? "#ffffff" : palette.deep }]}
        >
          <Text style={[styles.badgeText, { color: palette.text === "#ffffff" ? palette.deep : "#ffffff" }]}>
            {badge > 99 ? "99+" : badge}
          </Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

// One row tall: an icon and a single line.
function Strip({ icon, palette, text, sub }: { icon: IconName; palette: Palette; text: string; sub?: string | null }) {
  return (
    <View style={[styles.row, { flex: 1, gap: 10 }]}>
      <IconBadge name={icon} size={34} color={palette.accent} background={palette.panel} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.body, { color: palette.text, fontWeight: "700" }]} numberOfLines={1}>
          {text}
        </Text>
        {sub ? (
          <Text style={[styles.small, { color: palette.muted }]} numberOfLines={1}>
            {sub}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function Empty({ icon, palette, text }: { icon: IconName; palette: Palette; text: string }) {
  return (
    <View style={[styles.centerFill, { gap: 6 }]}>
      <Icon name={icon} size={22} color={palette.muted} />
      <Text style={[styles.small, { color: palette.muted, textAlign: "center" }]} numberOfLines={3}>
        {text}
      </Text>
    </View>
  );
}

// A tear-off calendar page: the month on a colored band, the day big below.
export function CalendarPage({ date, palette, size }: { date: Date; palette: Palette; size: number }) {
  return (
    <View style={[styles.calendar, { width: size * 0.86, height: size }]}>
      <View style={[styles.calendarBand, { height: size * 0.26, backgroundColor: palette.deep }]}>
        <Text style={{ color: "#ffffff", fontWeight: "800", fontSize: size * 0.13, letterSpacing: 1 }}>
          {date.toLocaleDateString(undefined, { month: "short" }).toUpperCase()}
        </Text>
      </View>
      <View style={styles.centerFill}>
        <Text style={{ fontSize: size * 0.4, fontWeight: "800", color: "#2a2420", letterSpacing: -1, marginTop: -2 }}>
          {date.getDate()}
        </Text>
        <Text style={{ fontSize: size * 0.11, color: "#857a72", fontWeight: "600", marginTop: -2 }}>
          {date.toLocaleDateString(undefined, { weekday: "short" })}
        </Text>
      </View>
    </View>
  );
}

export function Pill({ palette, text }: { palette: Palette; text: string }) {
  const onBold = palette.text === "#ffffff";
  return (
    <Text
      style={[
        styles.pill,
        { color: onBold ? palette.deep : "#ffffff", backgroundColor: onBold ? "#ffffff" : palette.deep },
      ]}
      numberOfLines={1}
    >
      {text}
    </Text>
  );
}

export function ProgressBar({ palette, done, total }: { palette: Palette; done: number; total: number }) {
  const fraction = total ? done / total : 0;
  return (
    <View style={[styles.track, { backgroundColor: palette.panel }]}>
      <Animated.View
        layout={LinearTransition.duration(300)}
        style={[styles.fill, { width: `${Math.round(fraction * 100)}%`, backgroundColor: palette.accent }]}
      />
    </View>
  );
}

// --- Countdown ------------------------------------------------------------------

export type CountdownTarget = { title: string; date: string; icon: IconName; gatheringId?: string };

// What a countdown is counting to: your own date, a chosen Gathering, or
// the next one coming up. undefined while loading, null if there's nothing.
export function useCountdownTarget(settings: WidgetOf<"countdown">["settings"], refreshKey: number) {
  const { source, gatheringId, customTitle, customDate } = settings;
  const [target, setTarget] = useState<CountdownTarget | null | undefined>(undefined);

  useEffect(() => {
    if (source === "custom") {
      setTarget(customDate ? { title: customTitle || "The big day", date: customDate, icon: "calendar" } : null);
      return;
    }
    let query = supabase.from("gatherings").select("id, title, kind, ends_at");
    query = source === "gathering" && gatheringId ? query.eq("id", gatheringId) : query.gt("ends_at", new Date().toISOString());
    query
      .order("ends_at")
      .limit(1)
      .then(({ data }) => {
        const row = data?.[0];
        setTarget(
          row ? { title: row.title, date: row.ends_at, icon: gatheringKindInfo(row.kind).icon, gatheringId: row.id } : null
        );
      });
  }, [source, gatheringId, customTitle, customDate, refreshKey]);

  return target;
}

function Countdown({ widget, palette, refreshKey, height, shape, icon }: BodyProps<"countdown">) {
  const { source, display } = widget.settings;
  const target = useCountdownTarget(widget.settings, refreshKey);

  if (target === undefined) return null;
  if (!target) {
    if (shape === "icon") return <IconFace icon={icon} palette={palette} />;
    return <Empty icon="calendar" palette={palette} text={source === "custom" ? "Pick a date in the editor" : "Nothing coming up"} />;
  }

  const start = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const when = new Date(target.date);
  const days = Math.round((start(when) - start(new Date())) / 86400000);
  const number = days === 0 ? "Today" : String(Math.abs(days));
  const words =
    days === 0 ? target.title : days > 0 ? `day${days === 1 ? "" : "s"} until ${target.title}` : `days since ${target.title}`;
  const sentence = `${target.title} ${days === 0 ? "is today!" : days > 0 ? `in ${days} day${days === 1 ? "" : "s"}` : countdown(target.date)}`;
  const fullDate = when.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  if (shape === "icon") {
    return <IconFace icon={target.icon} palette={palette} value={number} caption={days === 0 ? undefined : "days"} />;
  }
  if (shape === "strip") return <Strip icon={target.icon} palette={palette} text={sentence} sub={fullDate} />;

  if (display === "words" && shape === "small") {
    return (
      <View style={styles.centerFill}>
        <Text style={[styles.body, { color: palette.text, fontWeight: "700", textAlign: "center" }]} numberOfLines={3}>
          {sentence}
        </Text>
      </View>
    );
  }

  const Number = ({ size }: { size: number }) => (
    <Text
      style={{ fontSize: size, fontWeight: "800", color: palette.text, letterSpacing: -1.5 }}
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.5}
    >
      {number}
    </Text>
  );

  if (shape === "wide") {
    const page = Math.min(height - 6, 110);
    const number = Math.min(46, Math.max(26, height * 0.42));
    return (
      <Animated.View entering={FadeIn.duration(250)} style={[styles.row, { flex: 1, gap: 16 }]}>
        <CalendarPage date={when} palette={palette} size={page} />
        <View style={{ flex: 1, gap: 2 }}>
          <Number size={number} />
          <Text style={[styles.body, { color: palette.text }]} numberOfLines={height > 110 ? 2 : 1}>
            {words}
          </Text>
          {height > 100 ? (
            <Text style={[styles.small, { color: palette.muted }]} numberOfLines={1}>
              {fullDate}
            </Text>
          ) : null}
        </View>
      </Animated.View>
    );
  }
  if (shape === "tall" || shape === "large") {
    // Shrink the calendar page and number to the room there is, so the words
    // under them always fit.
    const big = shape === "large";
    const showDate = big && height > 260;
    const textRoom = 40 + (showDate ? 18 : 0);
    const page = Math.max(60, Math.min(big ? 120 : 96, (height - textRoom) * 0.55));
    const number = Math.max(28, Math.min(big ? 64 : 48, (height - textRoom) * 0.33));
    return (
      <Animated.View entering={FadeIn.duration(250)} style={[styles.centerFill, { gap: 8 }]}>
        <CalendarPage date={when} palette={palette} size={page} />
        <View style={{ alignItems: "center", alignSelf: "stretch" }}>
          <Number size={number} />
          <Text style={[styles.body, { color: palette.text, textAlign: "center" }]} numberOfLines={2}>
            {words}
          </Text>
          {showDate ? (
            <Text style={[styles.small, { color: palette.muted }]} numberOfLines={1}>
              {fullDate}
            </Text>
          ) : null}
        </View>
      </Animated.View>
    );
  }
  return (
    <Animated.View entering={FadeIn.duration(250)} style={styles.centerFill}>
      <Number size={44} />
      <Text style={[styles.small, { color: palette.muted, textAlign: "center" }]} numberOfLines={2}>
        {words}
      </Text>
    </Animated.View>
  );
}

// --- Coming up -------------------------------------------------------------------

type GatheringRow = { id: string; title: string; kind: string; ends_at: string };

function Gatherings({ widget, palette, refreshKey, height, shape, icon }: BodyProps<"gatherings">) {
  const { burrowId, kinds, count, showCountdown } = widget.settings;
  const [rows, setRows] = useState<GatheringRow[] | null>(null);

  useEffect(() => {
    let query = supabase.from("gatherings").select("id, title, kind, ends_at").gt("ends_at", new Date().toISOString());
    if (burrowId) query = query.eq("burrow_id", burrowId);
    if (kinds.length) query = query.in("kind", kinds);
    query
      .order("ends_at")
      .limit(Math.max(count, 6))
      .then(({ data }) => setRows(data ?? []));
  }, [burrowId, kinds.join(","), count, refreshKey]);

  if (!rows) return null;
  if (shape === "icon") return <IconFace icon={icon} palette={palette} badge={rows.length} />;
  if (!rows.length) return <Empty icon="celebration" palette={palette} text="Nothing coming up" />;
  const [next, ...rest] = rows;
  const nextKind = gatheringKindInfo(next.kind);
  if (shape === "strip") {
    return <Strip icon={nextKind.icon} palette={palette} text={next.title} sub={`${formatDate(next.ends_at)} · ${countdown(next.ends_at)}`} />;
  }

  const listRow = (row: GatheringRow, i: number) => {
    const kind = gatheringKindInfo(row.kind);
    return (
      <Animated.View key={row.id} entering={FadeInRight.delay(i * 50).springify().damping(18)} style={styles.row}>
        <Icon name={kind.icon} size={15} color={palette.accent} />
        <Text style={[styles.body, { color: palette.text, flex: 1 }]} numberOfLines={1}>
          {row.title}
        </Text>
        {showCountdown ? <Muted palette={palette}>{countdown(row.ends_at)}</Muted> : null}
      </Animated.View>
    );
  };

  if (shape === "small") {
    return <View style={{ gap: 6 }}>{rows.slice(0, Math.min(count, rowsThatFit(height))).map(listRow)}</View>;
  }

  // Bigger: the next one gets a spotlight, the rest list underneath.
  const restFit = Math.max(0, Math.min(count - 1, rowsThatFit(height, 26, shape === "wide" ? 999 : 110)));
  return (
    <View style={{ gap: 10, flex: 1 }}>
      <Panel palette={palette} style={[styles.row, { gap: 12 }]}>
        <IconBadge name={nextKind.icon} size={shape === "wide" ? 40 : 46} color={palette.deep} background="rgba(255,255,255,0.7)" />
        <View style={{ flex: 1 }}>
          <Text style={[styles.tiny, { color: palette.muted, fontWeight: "800", letterSpacing: 0.6 }]}>NEXT UP</Text>
          <Text style={[styles.body, { color: palette.text, fontWeight: "800", fontSize: 16 }]} numberOfLines={1}>
            {next.title}
          </Text>
          <Muted palette={palette}>{formatDate(next.ends_at)}</Muted>
        </View>
        <Pill palette={palette} text={countdown(next.ends_at)} />
      </Panel>
      {shape === "wide" ? (
        rest.length ? <Muted palette={palette}>{`Then ${rest[0].title} · ${countdown(rest[0].ends_at)}`}</Muted> : null
      ) : (
        <View style={{ gap: 8, paddingHorizontal: 4 }}>{rest.slice(0, restFit).map(listRow)}</View>
      )}
    </View>
  );
}

// --- Reminders -------------------------------------------------------------------

function Reminders({ widget, palette, height, shape, icon, onChange }: BodyProps<"reminders">) {
  const { items, hideDone } = widget.settings;
  const visible = items.filter((item) => !hideDone || !item.done);
  const remaining = items.filter((item) => !item.done);
  const done = items.length - remaining.length;

  function toggle(id: string) {
    if (!onChange) return;
    tap();
    onChange({
      ...widget,
      settings: { ...widget.settings, items: items.map((item) => (item.id === id ? { ...item, done: !item.done } : item)) },
    });
  }

  if (shape === "icon") {
    return items.length && !remaining.length ? (
      <IconFace icon="check" palette={palette} />
    ) : (
      <IconFace icon={icon} palette={palette} badge={remaining.length} />
    );
  }
  if (!items.length) return <Empty icon="todo" palette={palette} text="Tap to add some" />;
  if (shape === "strip") {
    return (
      <Strip
        icon={remaining.length ? icon : "check"}
        palette={palette}
        text={remaining[0]?.text ?? "All done!"}
        sub={remaining.length ? `${remaining.length} to do` : `${done} done`}
      />
    );
  }

  const big = isBig(shape);
  const fit = rowsThatFit(height, big ? 34 : 30, big ? 74 : 52);
  // Leave a row for "+N more" when not everything fits.
  const shown = visible.slice(0, visible.length > fit ? Math.max(1, fit - 1) : fit);
  const list = (
    <View style={{ gap: big ? 6 : 4 }}>
      {shown.map((item) => (
        <Animated.View key={item.id} layout={LinearTransition.duration(200)}>
          <Tap
            onPressIn={() => guardTouches()}
            onPress={onChange ? () => toggle(item.id) : undefined}
            disabled={!onChange}
            style={styles.row}
            hitSlop={4}
          >
            <View style={[styles.check, { borderColor: palette.accent }, item.done && { backgroundColor: palette.accent }]}>
              {item.done ? <Icon name="check" size={12} color={palette.text === "#ffffff" ? "#2a2420" : "#ffffff"} /> : null}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.body, { color: palette.text }, item.done && styles.done]} numberOfLines={1}>
                {item.text}
              </Text>
              {item.schedule && big ? (
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

  if (!big) return list;
  return (
    <View style={{ gap: 10, flex: 1 }}>
      <View style={{ gap: 6 }}>
        <View style={[styles.row, { justifyContent: "space-between" }]}>
          <Text style={[styles.body, { color: palette.text, fontWeight: "700" }]}>
            {remaining.length ? `${remaining.length} to go` : "All done!"}
          </Text>
          <Muted palette={palette}>{`${done} of ${items.length}`}</Muted>
        </View>
        <ProgressBar palette={palette} done={done} total={items.length} />
      </View>
      <Panel palette={palette} style={{ flex: 1 }}>
        {list}
      </Panel>
    </View>
  );
}

// --- Gifts to buy (your tucks) ------------------------------------------------

type TuckRow = { id: string; status: TuckStatus; title: string; forName: string };

function Tucks({ widget, palette, refreshKey, height, shape, icon }: BodyProps<"tucks">) {
  const { session } = useAuth();
  const { include, count } = widget.settings;
  const [rows, setRows] = useState<TuckRow[] | null>(null);

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
  if (shape === "icon") return <IconFace icon={icon} palette={palette} badge={rows.length} />;
  if (!rows.length) return <Empty icon="check" palette={palette} text="Nothing to buy right now" />;
  if (shape === "strip") {
    return (
      <Strip
        icon={icon}
        palette={palette}
        text={`${rows.length} gift${rows.length === 1 ? "" : "s"} to buy`}
        sub={`${rows[0].title} · for ${rows[0].forName}`}
      />
    );
  }

  const row = (item: TuckRow, rich: boolean) => (
    <View key={item.id} style={styles.row}>
      <Icon name={item.status === "bought" ? "bought" : "tucks"} size={14} color={palette.accent} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.body, { color: palette.text }]} numberOfLines={1}>
          {item.title}
          {rich ? null : <Text style={{ color: palette.muted }}> · {item.forName}</Text>}
        </Text>
        {rich ? <Text style={[styles.tiny, { color: palette.muted }]}>for {item.forName}</Text> : null}
      </View>
      {rich ? <Pill palette={palette} text={item.status === "bought" ? "Bought" : "To get"} /> : null}
    </View>
  );

  const Count = () => (
    <View style={{ alignItems: shape === "wide" ? "center" : "flex-start" }}>
      <Text style={{ fontSize: shape === "wide" ? 44 : 32, fontWeight: "800", color: palette.text, letterSpacing: -1 }}>
        {rows.length}
      </Text>
      <Muted palette={palette}>to buy</Muted>
    </View>
  );

  if (shape === "small") {
    return (
      <View style={{ gap: 6 }}>
        <Count />
        {rows.slice(0, Math.min(count, rowsThatFit(height, 26, 86))).map((item) => row(item, false))}
      </View>
    );
  }
  if (shape === "wide") {
    return (
      <View style={[styles.row, { flex: 1, gap: 14, alignItems: "stretch" }]}>
        <View style={{ justifyContent: "center", paddingHorizontal: 6 }}>
          <Count />
        </View>
        <Panel palette={palette} style={{ flex: 1, gap: 8, justifyContent: "center" }}>
          {rows.slice(0, Math.min(count, rowsThatFit(height, 26, 40))).map((item) => row(item, false))}
        </Panel>
      </View>
    );
  }
  return (
    <View style={{ gap: 10, flex: 1 }}>
      <Count />
      <Panel palette={palette} style={{ gap: 10, flex: 1 }}>
        {rows.slice(0, Math.min(Math.max(count, 3), rowsThatFit(height, 42, 120))).map((item) => row(item, true))}
      </Panel>
    </View>
  );
}

// --- Sticky note ---------------------------------------------------------------------

function Note({ widget, palette, height, shape, icon }: BodyProps<"note">) {
  const { text, textSize, align } = widget.settings;
  if (shape === "icon") return <IconFace icon={icon} palette={palette} />;
  if (shape === "strip") {
    return (
      <View style={[styles.row, { flex: 1 }]}>
        <Icon name={icon} size={16} color={palette.accent} />
        <Text style={[styles.body, { color: text ? palette.text : palette.muted, flex: 1, fontWeight: "600" }]} numberOfLines={2}>
          {text || "Tap Edit to write something"}
        </Text>
      </View>
    );
  }
  const scale = shape === "large" ? 1.2 : isBig(shape) ? 1.08 : 1;
  const fontSize = { small: 14, medium: 17, large: 22 }[textSize] * scale;
  const lineHeight = fontSize * 1.4;
  const ruled = height >= 200 && widget.look !== "bold";
  return (
    <View style={{ flex: 1 }}>
      {/* A strip of tape holding the note up. */}
      {widget.look === "soft" ? <View style={styles.tape} /> : null}
      {ruled ? (
        <View style={[StyleSheet.absoluteFill, { top: 4 }]} pointerEvents="none">
          {Array.from({ length: Math.floor(height / lineHeight) }, (_, i) => (
            <View key={i} style={[styles.rule, { top: (i + 1) * lineHeight, borderColor: `${palette.deep}22` }]} />
          ))}
        </View>
      ) : null}
      <Text
        numberOfLines={Math.max(1, Math.floor((height - 4) / lineHeight))}
        ellipsizeMode="tail"
        style={{
          color: text ? palette.text : palette.muted,
          fontSize,
          lineHeight,
          textAlign: align,
          fontWeight: textSize === "large" ? "700" : "500",
          paddingTop: widget.look === "soft" && !widget.showTitle ? 6 : 0,
        }}
      >
        {text || "Tap Edit to write something"}
      </Text>
    </View>
  );
}

// --- Inbox --------------------------------------------------------------------------

function Inbox({ widget, palette, refreshKey, height, shape, icon }: BodyProps<"inbox">) {
  const [state, setState] = useState<{ unread: number; notices: { title: string; nook: string; kind: string }[] } | null>(null);
  useEffect(() => {
    Promise.all([
      supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null),
      supabase
        .from("notifications")
        .select("title, nook, kind")
        .is("read_at", null)
        .order("created_at", { ascending: false })
        .limit(Math.max(widget.settings.count, 6)),
    ]).then(([countResult, listResult]) => setState({ unread: countResult.count ?? 0, notices: listResult.data ?? [] }));
  }, [widget.settings.count, refreshKey]);

  if (!state) return null;
  if (shape === "icon") return <IconFace icon={icon} palette={palette} badge={state.unread} />;
  if (shape === "strip") {
    return (
      <Strip
        icon={state.unread ? icon : "check"}
        palette={palette}
        text={state.unread ? `${state.unread} unread` : "All caught up"}
        sub={state.notices[0]?.title}
      />
    );
  }
  const big = isBig(shape);
  const fit = Math.min(big ? Math.max(widget.settings.count, 3) : widget.settings.count, rowsThatFit(height, big ? 30 : 26, big ? 100 : 90));
  const rows = state.notices.slice(0, fit).map((notice, i) => (
    <View key={i} style={styles.row}>
      <Icon name={noticeIcon(notice)} size={14} color={palette.accent} />
      <Text style={[styles.body, { color: palette.text, flex: 1 }]} numberOfLines={1}>
        {notice.title}
      </Text>
    </View>
  ));
  return (
    <View style={{ gap: 8, flex: 1 }}>
      <View style={styles.row}>
        <Text style={{ fontSize: big ? 36 : 30, fontWeight: "800", color: palette.text, letterSpacing: -1 }}>{state.unread}</Text>
        <Muted palette={palette}>unread</Muted>
      </View>
      {state.unread === 0 ? (
        <View style={[styles.row, { gap: 6 }]}>
          <Icon name="check" size={15} color={palette.accent} />
          <Muted palette={palette}>All caught up</Muted>
        </View>
      ) : big ? (
        <Panel palette={palette} style={{ gap: 8 }}>
          {rows}
        </Panel>
      ) : (
        rows
      )}
    </View>
  );
}

// --- Card season (LET-009) --------------------------------------------------------

function Cards({ widget, palette, refreshKey, height, shape, icon }: BodyProps<"cards">) {
  const summary = useLetterboxSummary(refreshKey);
  if (!summary) return null;
  const left = summary.toSend.length;
  const allSent = summary.total > 0 && left === 0;

  if (shape === "icon") {
    return allSent ? <IconFace icon="check" palette={palette} /> : <IconFace icon={icon} palette={palette} badge={left} />;
  }
  if (!summary.total) return <Empty icon="mail" palette={palette} text="Add family to your Letterbox" />;
  if (shape === "strip") {
    return (
      <Strip
        icon={allSent ? "check" : icon}
        palette={palette}
        text={allSent ? "All your cards are out!" : `${left} holiday card${left === 1 ? "" : "s"} to send`}
        sub={`${summary.sent} of ${summary.total} sent`}
      />
    );
  }

  const names = summary.toSend.slice(0, Math.min(widget.settings.count, rowsThatFit(height, 24, shape === "small" ? 110 : 120)));
  const Count = () => (
    <View>
      <Text style={{ fontSize: isBig(shape) ? 44 : 34, fontWeight: "800", color: palette.text, letterSpacing: -1 }}>
        {allSent ? "Done!" : left}
      </Text>
      <Muted palette={palette}>{allSent ? `all ${summary.total} sent` : `to send · ${summary.sent} of ${summary.total} sent`}</Muted>
    </View>
  );
  const list = names.length ? (
    <View style={{ gap: 6 }}>
      {names.map((h) => (
        <View key={h.id} style={styles.row}>
          <Icon name="mail" size={13} color={palette.accent} />
          <Text style={[styles.body, { color: palette.text, flex: 1 }]} numberOfLines={1}>
            {h.name}
          </Text>
        </View>
      ))}
    </View>
  ) : null;

  if (shape === "small") {
    return (
      <View style={{ gap: 8, flex: 1 }}>
        <Count />
        <ProgressBar palette={palette} done={summary.sent} total={summary.total} />
        {list}
      </View>
    );
  }
  if (shape === "wide") {
    return (
      <View style={[styles.row, { flex: 1, gap: 14, alignItems: "stretch" }]}>
        <View style={{ justifyContent: "center", gap: 8, minWidth: 110 }}>
          <Count />
          <ProgressBar palette={palette} done={summary.sent} total={summary.total} />
        </View>
        {list ? (
          <Panel palette={palette} style={{ flex: 1, justifyContent: "center" }}>
            {list}
          </Panel>
        ) : null}
      </View>
    );
  }
  return (
    <View style={{ gap: 10, flex: 1 }}>
      <Count />
      <ProgressBar palette={palette} done={summary.sent} total={summary.total} />
      {list ? <Panel palette={palette} style={{ flex: 1 }}>{list}</Panel> : null}
    </View>
  );
}

// --- Pet care (PET-001) -------------------------------------------------------------

function PetCare({ widget, palette, refreshKey, height, shape, icon }: BodyProps<"pets">) {
  const { session } = useAuth();
  const summary = usePetsSummary(session?.user.id, refreshKey);
  if (!summary) return null;

  const left = summary.toFeed;
  const allFed = summary.mealsTotal > 0 && left.length === 0;
  const attention = left.length + summary.due.length;

  if (shape === "icon") {
    return allFed && !summary.due.length ? (
      <IconFace icon="check" palette={palette} />
    ) : (
      <IconFace icon={icon} palette={palette} badge={attention} />
    );
  }
  if (!summary.pets) return <Empty icon="paw" palette={palette} text="Add a pet in Pet Care" />;
  if (shape === "strip") {
    return (
      <Strip
        icon={allFed ? "check" : icon}
        palette={palette}
        text={
          !summary.mealsTotal
            ? `${summary.pets} pet${summary.pets === 1 ? "" : "s"}`
            : allFed
              ? "Everyone's fed"
              : `${left[0].pet} needs ${left[0].meal.toLowerCase()}`
        }
        sub={summary.due[0] ? `${summary.due[0].pet}: ${summary.due[0].title}` : left.length > 1 ? `${left.length} meals to feed` : null}
      />
    );
  }

  const names = left.slice(0, Math.min(widget.settings.count, rowsThatFit(height, 24, shape === "small" ? 110 : 120)));
  const Count = () => (
    <View>
      <Text style={{ fontSize: isBig(shape) ? 44 : 34, fontWeight: "800", color: palette.text, letterSpacing: -1 }}>
        {!summary.mealsTotal ? summary.pets : allFed ? "Fed!" : left.length}
      </Text>
      <Muted palette={palette}>
        {!summary.mealsTotal ? (summary.pets === 1 ? "pet" : "pets") : allFed ? "everyone's had their meals" : left.length === 1 ? "meal to feed" : "meals to feed"}
      </Muted>
    </View>
  );
  const list = (
    <View style={{ gap: 6 }}>
      {names.map((m, i) => (
        <View key={i} style={styles.row}>
          <Icon name="paw" size={13} color={palette.accent} />
          <Text style={[styles.body, { color: palette.text, flex: 1 }]} numberOfLines={1}>
            {m.pet}: {m.meal}
          </Text>
        </View>
      ))}
      {summary.due.slice(0, 1).map((d, i) => (
        <View key={`d${i}`} style={styles.row}>
          <Icon name="pill" size={13} color={palette.accent} />
          <Text style={[styles.body, { color: palette.text, flex: 1, fontWeight: d.overdue ? "700" : "500" }]} numberOfLines={1}>
            {d.pet}: {d.title}
          </Text>
        </View>
      ))}
    </View>
  );
  const bar = summary.mealsTotal ? (
    <ProgressBar palette={palette} done={summary.mealsTotal - left.length} total={summary.mealsTotal} />
  ) : null;

  if (shape === "small") {
    return (
      <View style={{ gap: 8, flex: 1 }}>
        <Count />
        {bar}
        {list}
      </View>
    );
  }
  if (shape === "wide") {
    return (
      <View style={[styles.row, { flex: 1, gap: 14, alignItems: "stretch" }]}>
        <View style={{ justifyContent: "center", gap: 8, minWidth: 110 }}>
          <Count />
          {bar}
        </View>
        <Panel palette={palette} style={{ flex: 1, justifyContent: "center" }}>
          {list}
        </Panel>
      </View>
    );
  }
  return (
    <View style={{ gap: 10, flex: 1 }}>
      <Count />
      {bar}
      <Panel palette={palette} style={{ flex: 1 }}>
        {list}
      </Panel>
    </View>
  );
}

// --- Greeting -------------------------------------------------------------------

function timeOfDay() {
  const hour = new Date().getHours();
  if (hour < 5) return { hello: "Good evening", icon: "moon" as IconName };
  if (hour < 11) return { hello: "Good morning", icon: "coffee" as IconName };
  if (hour < 12) return { hello: "Good morning", icon: "sun" as IconName };
  if (hour < 18) return { hello: "Good afternoon", icon: "sun" as IconName };
  return { hello: "Good evening", icon: "moon" as IconName };
}

function Greeting({ widget, palette, refreshKey, shape, height, width }: BodyProps<"greeting">) {
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

  const { hello, icon } = timeOfDay();
  const date = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  const line = `${hello}${showName && name ? `, ${name}` : ""}`;

  if (shape === "icon") return <IconFace icon={icon} palette={palette} />;
  if (shape === "strip") {
    return (
      <View style={[styles.row, { flex: 1, gap: 12 }]}>
        <Icon name={icon} size={22} color={palette.accent} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 19, fontWeight: "800", color: palette.text }} numberOfLines={1}>
            {line}
          </Text>
          {showDate || message ? (
            <Text style={[styles.small, { color: palette.muted }]} numberOfLines={1}>
              {[showDate ? date : null, message || null].filter(Boolean).join(" · ")}
            </Text>
          ) : null}
        </View>
      </View>
    );
  }
  const row = shape === "wide" || shape === "large";
  const badge = shape === "large" ? 64 : row ? 48 : Math.min(48, Math.max(30, height * 0.22));
  const fontSize = shape === "small" || width < 200 ? 19 : 26;
  // What the greeting itself takes; the message gets whatever's left.
  const used = (row ? Math.max(badge, fontSize * 2.6) : badge + 10 + fontSize * 2.6) + (showDate ? 18 : 0);
  const messageLines = Math.floor((height - used - 12 - 24) / 19);
  return (
    <View style={{ flex: 1, gap: 12, justifyContent: "center" }}>
      <View style={row ? [styles.row, { gap: 14 }] : { gap: 10 }}>
        <IconBadge name={icon} size={badge} color={palette.deep} background="rgba(255,255,255,0.7)" />
        <View style={{ flex: row ? 1 : undefined }}>
          <Text
            style={{ fontSize, fontWeight: "800", color: palette.text, letterSpacing: -0.4 }}
            numberOfLines={2}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {line}
          </Text>
          {showDate ? (
            <Text style={[styles.small, { color: palette.muted }]} numberOfLines={1}>
              {date}
            </Text>
          ) : null}
        </View>
      </View>
      {message && messageLines > 0 ? (
        <Panel palette={palette}>
          <Text style={[styles.body, { color: palette.text, lineHeight: 19 }]} numberOfLines={Math.min(4, messageLines)}>
            {message}
          </Text>
        </Panel>
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
  panel: { borderRadius: 16, padding: 12, gap: 6 },
  badge: {
    position: "absolute",
    top: 2,
    right: 2,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { fontSize: 12, fontWeight: "800" },
  calendar: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    overflow: "hidden",
    boxShadow: "0px 4px 10px -4px rgba(74, 44, 22, 0.25)",
  },
  calendarBand: { alignItems: "center", justifyContent: "center" },
  pill: {
    fontSize: 12,
    fontWeight: "800",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: "hidden",
  },
  track: { height: 8, borderRadius: 4, overflow: "hidden" },
  fill: { height: 8, borderRadius: 4 },
  tape: {
    position: "absolute",
    top: -20,
    alignSelf: "center",
    width: 54,
    height: 18,
    backgroundColor: "rgba(255,255,255,0.55)",
    transform: [{ rotate: "-4deg" }],
    borderRadius: 3,
  },
  rule: { position: "absolute", left: 0, right: 0, borderBottomWidth: 1 },
  check: {
    width: 20,
    height: 20,
    borderRadius: 7,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
});
