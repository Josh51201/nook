import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useContext, useEffect, useState, type ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Circle, Line } from "react-native-svg";
import { FixedTextSize, Text } from "../text";
import Animated, { FadeIn, FadeInRight, LinearTransition, ZoomIn } from "react-native-reanimated";

import { useAuth } from "../../lib/auth-context";
import { cornerRadius, type Corners } from "../../lib/decor";
import { usePhotoUrls } from "../../lib/hearth-photos";
import { tap } from "../../lib/feedback";
import { countdown, displayName, formatDate, gatheringKindInfo, type TuckStatus } from "../../lib/gift-nook";
import { shade } from "../../lib/colors";
import { deepColor, tileBevel, tilePalette } from "../../lib/hearth-layout";
import { noticeIcon } from "../../lib/inbox";
import { supabase } from "../../lib/supabase";
import { daysToDue, localDay } from "../../lib/pets";
import { useHearthPetInfo, usePetsSummary } from "../../lib/pets-data";
import { bedLayout, isNight, petSizeForBox } from "../../lib/hearth-pet";
import { useRhythmsSummary } from "../../lib/rhythms-data";
import { endsWords } from "../../lib/sitter";
import { useSitterSummary } from "../../lib/sitter-data";
import { formatMinutes } from "../../lib/recipes";
import { useRecipesSummary } from "../../lib/recipes-data";
import { useRecipeImage } from "../recipe-thumb";
import { formatMoney } from "../../lib/subscriptions";
import { kindInfo } from "../../lib/getaways";
import { useSubscriptionsSummary } from "../../lib/subscriptions-data";
import { sickdaySettingDefaults, useNookSettings } from "../../lib/nook-settings";
import { formatTemp as sickTemp, isFever, untilWords } from "../../lib/sickday";
import { useNow, useSickSummary } from "../../lib/sickday-data";
import { useLetterboxSummary } from "../../lib/use-letterbox";
import { agoWords, changeWords, formatEntry, formatNumber, inRange, logStats, scaleWord, yesNoDays, yesStreak } from "../../lib/little-log";
import { useLittleLogSummary } from "../../lib/little-log-data";
import { checklistCounts, noteBlocks, notePreview, noteTitle, sortNotes } from "../../lib/notes";
import { useNotesSummary } from "../../lib/notes-data";
import { Sparkline } from "../log-chart";
import { guardTouches } from "../../lib/touch-guard";
import { conditionIcon, conditionLabel, dayName, formatTemp, windowSky } from "../../lib/weather";
import { useWeather } from "../../lib/weather-data";
import { currentStreak, dayKey, lastDays, pickedTargets, quoteOfDay, quotePool, toggleDay } from "../../lib/widget-extras";
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
import { BedArt, BowlArt, CritterArt, PetStageContext, Snooze } from "./pet-art";
import { WindowScene } from "./window-scene";
import { FridgeDoor, FridgeNoteCard, LetterMagnets, Magnet } from "../fridge-door";
import { fridgeGrid, fridgePlace, hashOf, magnets, noteMagnet } from "../../lib/fridge";
import { useFridgeNotes } from "../../lib/fridge-data";
import { useHomeHearth } from "../../lib/home-hearth-data";
import { glanceLines, type GlanceLine } from "../../lib/gathering-glance";
import { useGatheringGlance } from "../../lib/gatherings-data";

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

// A widget's text stays at its designed size whatever the text size setting
// (CORE-068): it's laid out on the Hearth's grid, here and in its previews.
export function WidgetView(props: React.ComponentProps<typeof WidgetBody>) {
  return (
    <FixedTextSize>
      <WidgetBody {...props} />
    </FixedTextSize>
  );
}

function WidgetBody({
  widget,
  color,
  icon,
  width,
  height,
  refreshKey,
  themeText,
  onChange,
  corners,
  border,
  still = false,
  onHomePage = false,
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
  // Shape tweaks (CORE-042): how round the corners are, and a border.
  corners?: Corners;
  border?: boolean;
  // Hold animations still, e.g. while the Hearth is being edited.
  still?: boolean;
  // It's on the page shared with your Home (CORE-054): a Fridge door there
  // is always the Home's.
  onHomePage?: boolean;
}) {
  const radius = cornerRadius(corners, width, height);
  if (widget.kind === "fridge") {
    return (
      <FridgeWidget
        widget={widget}
        color={color}
        width={width}
        height={height}
        radius={radius}
        border={border}
        refreshKey={refreshKey}
        onHomePage={onHomePage}
      />
    );
  }
  if (widget.kind === "frame") {
    return <PhotoFrame settings={widget.settings} width={width} height={height} radius={radius} />;
  }
  if (widget.kind === "companion") {
    return (
      <PetBedWidget
        widget={widget}
        color={color}
        width={width}
        height={height}
        radius={radius}
        border={border}
        refreshKey={refreshKey}
        themeText={themeText}
        still={still}
      />
    );
  }
  if (widget.kind === "window") {
    return <WindowWidget settings={widget.settings} width={width} height={height} radius={radius} still={still} refreshKey={refreshKey} />;
  }
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
        { width, height, borderRadius: radius },
        shape === "icon" && { padding: 8 },
        shape === "strip" && { paddingVertical: 10, paddingHorizontal: 14 },
        look === "bold" && { backgroundColor: deep, boxShadow: tileBevel },
        look === "soft" && { backgroundColor: soft, boxShadow: tileBevel },
        look === "outline" && { borderWidth: 2, borderColor: deep, backgroundColor: "transparent" },
        border && look !== "outline" && { borderWidth: 2.5, borderColor: look === "bold" ? "rgba(255,255,255,0.6)" : deep },
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
    case "gathering":
      return <OneGathering {...props} widget={widget} />;
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
    case "rhythms":
      return <Rhythms {...props} widget={widget} />;
    case "sitter":
      return <Sitter {...props} widget={widget} />;
    case "recipe":
      return <RecipeOfTheDay {...props} widget={widget} />;
    case "subscriptions":
      return <Subscriptions {...props} widget={widget} />;
    case "sickday":
      return <SickDay {...props} widget={widget} />;
    case "littlelog":
      return <LittleLogWidget {...props} widget={widget} />;
    case "notes":
      return <NoteWidget {...props} widget={widget} />;
    case "frame":
      return null; // drawn whole by PhotoFrame, above
    case "clock":
      return <ClockWidget {...props} widget={widget} />;
    case "quote":
      return <QuoteWidget {...props} widget={widget} />;
    case "launch":
      return <Launch {...props} widget={widget} />;
    case "streak":
      return <Streak {...props} widget={widget} />;
    case "weather":
      return <WeatherWidget {...props} widget={widget} />;
    case "window":
      return null; // drawn whole by WindowWidget, above
    case "companion":
      return null; // drawn whole by PetBedWidget, below
    case "fridge":
      return null; // drawn whole by FridgeWidget, below
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
        <Text style={{ fontSize: size * 0.11, color: "#726862", fontWeight: "600", marginTop: -2 }}>
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

export type CountdownTarget = { title: string; date: string; icon: IconName; gatheringId?: string; getawayId?: string };

// What a countdown is counting to: your own date, a chosen Gathering, or
// the next one coming up. undefined while loading, null if there's nothing.
export function useCountdownTarget(settings: WidgetOf<"countdown">["settings"], refreshKey: number) {
  const { source, gatheringId, getawayId, customTitle, customDate } = settings;
  const [target, setTarget] = useState<CountdownTarget | null | undefined>(undefined);

  useEffect(() => {
    if (source === "custom") {
      setTarget(customDate ? { title: customTitle || "The big day", date: customDate, icon: "calendar" } : null);
      return;
    }
    if (source === "getaway") {
      // One Getaway, or whichever's next; while it's on, it counts as today.
      const today = localDay();
      let query = supabase.from("getaways").select("id, title, kind, starts_on, ends_on");
      query = getawayId ? query.eq("id", getawayId) : query.gte("ends_on", today);
      query
        .order("starts_on")
        .limit(1)
        .then(({ data }) => {
          const row = data?.[0];
          if (!row) return setTarget(null);
          const [y, m, d] = (row.starts_on > today ? row.starts_on : today).split("-").map(Number);
          setTarget({ title: row.title, date: new Date(y, m - 1, d, 12).toISOString(), icon: kindInfo(row.kind).icon, getawayId: row.id });
        });
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
  }, [source, gatheringId, getawayId, customTitle, customDate, refreshKey]);

  return target;
}

function Countdown({ widget, palette, refreshKey, height, shape, icon }: BodyProps<"countdown">) {
  const { source, display } = widget.settings;
  const target = useCountdownTarget(widget.settings, refreshKey);

  if (target === undefined) return null;
  if (!target) {
    if (shape === "icon") return <IconFace icon={icon} palette={palette} />;
    return (
      <Empty
        icon={source === "getaway" ? "plane" : "calendar"}
        palette={palette}
        text={source === "custom" ? "Pick a date in the editor" : source === "getaway" ? "Plan a Getaway" : "Nothing coming up"}
      />
    );
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
    let query = supabase
      .from("gatherings")
      .select(`id, title, kind, ends_at${burrowId ? ", gathering_burrows!inner(burrow_id)" : ""}`)
      .gt("ends_at", new Date().toISOString());
    if (burrowId) query = query.eq("gathering_burrows.burrow_id", burrowId);
    if (kinds.length) query = query.in("kind", kinds);
    query
      .order("ends_at")
      .limit(Math.max(count, 6))
      .then(({ data }) => setRows((data ?? []) as unknown as GatheringRow[]));
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

// --- A Gathering ------------------------------------------------------------------
// One Gathering at a glance (GATH-009): its day and place, your answer and
// who's coming, your gift shopping (only ever your own — GIFT-007) and the
// Potluck. Tapping it opens the Gathering.

function OneGathering({ widget, palette, refreshKey, height, width, shape }: BodyProps<"gathering">) {
  const { session } = useAuth();
  const glance = useGatheringGlance(widget.settings, session?.user.id, refreshKey);

  if (glance === undefined) return null;
  if (glance === "gone" || !glance) {
    if (shape === "icon") return <IconFace icon="celebration" palette={palette} />;
    return (
      <Empty
        icon="celebration"
        palette={palette}
        text={glance === "gone" ? "This Gathering isn't here any more" : "Nothing coming up"}
      />
    );
  }

  const { gathering, over } = glance;
  const kind = gatheringKindInfo(gathering.kind);
  const when = over ? "Already happened" : countdown(gathering.ends_at);
  const lines = glanceLines(glance);
  const whenWhere = [formatDate(gathering.starts_at ?? gathering.ends_at), gathering.place].filter(Boolean).join(" · ");

  if (shape === "icon") {
    const start = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const days = Math.round((start(new Date(gathering.ends_at)) - start(new Date())) / 86400000);
    if (over) return <IconFace icon={kind.icon} palette={palette} />;
    return <IconFace icon={kind.icon} palette={palette} value={days === 0 ? "Today" : String(days)} caption={days === 0 ? undefined : "days"} />;
  }
  if (shape === "strip") {
    return <Strip icon={kind.icon} palette={palette} text={gathering.title} sub={[when, lines[0]?.text].filter(Boolean).join(" · ")} />;
  }

  const big = shape !== "small";
  // The header takes about this much; each line below about lineHeight.
  const header = big ? 74 : 52;
  const lineHeight = big ? 44 : 22;
  const room = Math.max(0, Math.floor((height - header) / lineHeight));
  const shown = lines.slice(0, room);

  return (
    <Animated.View entering={FadeIn.duration(250)} style={{ flex: 1, gap: big ? 10 : 6 }}>
      {big ? (
        <Panel palette={palette} style={[styles.row, { gap: 12 }]}>
          <IconBadge name={kind.icon} size={42} color={palette.deep} background="rgba(255,255,255,0.7)" />
          <View style={{ flex: 1 }}>
            <Text style={[styles.body, { color: palette.text, fontWeight: "800", fontSize: 16 }]} numberOfLines={1}>
              {gathering.title}
            </Text>
            <Muted palette={palette}>{whenWhere}</Muted>
          </View>
          {width > 200 ? <Pill palette={palette} text={over ? "Done" : when} /> : null}
        </Panel>
      ) : (
        <View style={{ gap: 2 }}>
          <View style={[styles.row, { gap: 6 }]}>
            <Icon name={kind.icon} size={15} color={palette.accent} />
            <Text style={[styles.body, { color: palette.text, fontWeight: "800", flex: 1 }]} numberOfLines={1}>
              {gathering.title}
            </Text>
          </View>
          <Muted palette={palette}>{when}</Muted>
        </View>
      )}
      <View style={{ gap: big ? 8 : 4, paddingHorizontal: big ? 4 : 0 }}>
        {shown.map((line, i) => (
          <GlanceRow key={line.key} line={line} palette={palette} big={big} index={i} />
        ))}
      </View>
    </Animated.View>
  );
}

function GlanceRow({ line, palette, big, index }: { line: GlanceLine; palette: Palette; big: boolean; index: number }) {
  return (
    <Animated.View entering={FadeInRight.delay(index * 50).springify().damping(18)} style={[styles.row, { gap: 8, alignItems: big ? "flex-start" : "center" }]}>
      <Icon name={line.icon} size={15} color={palette.accent} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.body, { color: palette.text, fontWeight: big ? "700" : "500" }]} numberOfLines={1}>
          {line.text}
        </Text>
        {big && line.progress ? (
          <ProgressBar palette={palette} done={line.progress.done} total={line.progress.total} />
        ) : big && line.sub ? (
          <Muted palette={palette}>{line.sub}</Muted>
        ) : null}
      </View>
      {big && line.progress && line.sub ? <Muted palette={palette}>{`${line.progress.done}/${line.progress.total}`}</Muted> : null}
    </Animated.View>
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

// --- Hearth pet (CORE-048) ---------------------------------------------------------

// The pet's bed, its bowl and its name. The pet itself is drawn here only
// when it isn't out on the Hearth (pet-roamer.tsx): while you're editing,
// in previews, and with Reduce Motion on. "Outline" drops the card, so the
// bed sits right on your Hearth.
function PetBedWidget({
  widget,
  color,
  width,
  height,
  radius,
  border,
  refreshKey,
  themeText,
  still,
}: {
  widget: WidgetOf<"companion">;
  color?: string;
  width: number;
  height: number;
  radius: number;
  border?: boolean;
  refreshKey: number;
  themeText: string;
  still: boolean;
}) {
  const stage = useContext(PetStageContext);
  const s = widget.settings;
  const info = useHearthPetInfo(s.petId, refreshKey);
  const name = (info?.name ?? s.name).trim() || "Your pet";
  const soft = color ?? tilePalette[0];
  const deep = deepColor(soft);
  const look = widget.look;
  const palette = widgetPalette(look, soft, themeText);
  const pet = stage.pet ?? petSizeForBox(width, height);
  const spots = bedLayout(width, height, pet);
  const night = isNight();
  const hungry = info?.hungryFor ?? null;
  const bedColor = look === "bold" ? soft : deep;
  const status = hungry
    ? `Waiting for ${hungry.toLowerCase()}`
    : night
      ? "Fast asleep"
      : s.wanders
        ? "Likes to wander"
        : "A homebody";
  const side = spots.text && spots.text.x > spots.bed.x + spots.bed.w - 1;

  return (
    <View
      style={[
        { width, height, borderRadius: radius },
        look === "soft" && { backgroundColor: soft, boxShadow: tileBevel },
        look === "bold" && { backgroundColor: deep, boxShadow: tileBevel },
        border && { borderWidth: 2.5, borderColor: look === "bold" ? "rgba(255,255,255,0.6)" : deep },
      ]}
    >
      {widget.showTitle && spots.text ? (
        <View style={{ position: "absolute", left: spots.text.x, top: spots.text.y, width: spots.text.w, height: spots.text.h, justifyContent: side ? "center" : "flex-start" }}>
          <Text style={{ color: look === "outline" ? themeText : palette.text, fontSize: side ? 20 : 15, fontWeight: "800" }} numberOfLines={1}>
            {name}
          </Text>
          <Text style={{ color: look === "outline" ? `${themeText}99` : palette.muted, fontSize: 12, fontWeight: hungry ? "700" : "500" }} numberOfLines={side ? 2 : 1}>
            {status}
          </Text>
        </View>
      ) : null}
      <View style={{ position: "absolute", left: spots.bed.x, top: spots.bed.y }}>
        <BedArt style={s.bed} color={bedColor} width={spots.bed.w} height={spots.bed.h} />
      </View>
      {spots.bowl ? (
        <View style={{ position: "absolute", left: spots.bowl.x, top: spots.bowl.y }}>
          <BowlArt full={!hungry} width={spots.bowl.w} height={spots.bowl.h} color={shade(bedColor, 0.25)} />
        </View>
      ) : null}
      {stage.roaming ? null : (
        <View style={{ position: "absolute", left: spots.pet.x, top: spots.pet.y }}>
          <CritterArt
            critter={s.critter}
            fur={s.fur}
            width={spots.pet.w}
            height={spots.pet.h}
            eyesClosed={night}
            photoUrl={s.photo ? info?.photoUrl ?? null : null}
          />
          {night ? (
            <View style={{ position: "absolute", right: -spots.pet.w * 0.2, top: -spots.pet.h * 0.3 }}>
              <Snooze size={spots.pet.w * 0.5} color={look === "bold" ? "#ffffff" : themeText} still={still} />
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}

// --- Due soon (RHY-008) -----------------------------------------------------------

function Rhythms({ widget, palette, refreshKey, height, shape, icon }: BodyProps<"rhythms">) {
  const { session } = useAuth();
  const summary = useRhythmsSummary(session?.user.id, refreshKey);
  if (!summary) return null;

  const mine = widget.settings.mineOnly;
  const now = summary.now.filter((r) => !mine || r.mine);
  const soon = summary.soon.filter((r) => !mine || r.mine);
  const inDays = (day: string) => {
    const days = daysToDue(day, summary.today);
    return days === 1 ? "tmrw" : days < 7 ? `${days}d` : `${Math.round(days / 7)}w`;
  };

  if (shape === "icon") {
    return now.length ? <IconFace icon={icon} palette={palette} badge={now.length} /> : <IconFace icon="check" palette={palette} />;
  }
  if (!summary.total) return <Empty icon="rhythm" palette={palette} text="Pick your Home's chores in Rhythms" />;
  if (shape === "strip") {
    return (
      <Strip
        icon={now.length ? icon : "check"}
        palette={palette}
        text={now.length ? `${now[0].title}${now[0].overdue ? " · overdue" : " · today"}` : soon.length ? `Next: ${soon[0].title}` : "All caught up"}
        sub={now.length > 1 ? `${now.length} need doing` : soon.length && now.length ? `Then ${soon[0].title}` : soon[0] ? `In ${inDays(soon[0].due_on)}` : null}
      />
    );
  }

  const rows = [
    ...now.map((r) => ({ id: r.id, title: r.title, trailing: r.overdue ? "late" : "today", strong: true })),
    ...soon.map((r) => ({ id: r.id, title: r.title, trailing: inDays(r.due_on), strong: false })),
  ].slice(0, Math.min(widget.settings.count, rowsThatFit(height, 24, shape === "small" ? 110 : 120)));

  const Count = () => (
    <View>
      {now.length ? (
        <Text style={{ fontSize: isBig(shape) ? 44 : 34, fontWeight: "800", color: palette.text, letterSpacing: -1 }}>
          {now.length}
        </Text>
      ) : (
        <Icon name="check" size={isBig(shape) ? 40 : 32} color={palette.accent} />
      )}
      <Muted palette={palette}>{now.length ? (now.length === 1 ? "needs doing" : "need doing") : "all caught up"}</Muted>
    </View>
  );
  const list = rows.length ? (
    <View style={{ gap: 6 }}>
      {rows.map((r) => (
        <View key={r.id} style={styles.row}>
          <Icon name={r.strong ? "warning" : "rhythm"} size={13} color={palette.accent} />
          <Text style={[styles.body, { color: palette.text, flex: 1, fontWeight: r.strong ? "700" : "500" }]} numberOfLines={1}>
            {r.title}
          </Text>
          <Text style={[styles.small, { color: palette.muted }]}>{r.trailing}</Text>
        </View>
      ))}
    </View>
  ) : (
    <Muted palette={palette}>Nothing this month</Muted>
  );

  if (shape === "small") {
    return (
      <View style={{ gap: 8, flex: 1 }}>
        <Count />
        {list}
      </View>
    );
  }
  if (shape === "wide") {
    return (
      <View style={[styles.row, { flex: 1, gap: 14, alignItems: "stretch" }]}>
        <View style={{ justifyContent: "center", minWidth: 110 }}>
          <Count />
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
      <Panel palette={palette} style={{ flex: 1 }}>
        {list}
      </Panel>
    </View>
  );
}

// --- Renewing soon (SUB-006) -------------------------------------------------------

function Subscriptions({ widget, palette, refreshKey, height, shape, icon }: BodyProps<"subscriptions">) {
  const { session } = useAuth();
  const summary = useSubscriptionsSummary(session?.user.id, refreshKey);
  if (!summary) return null;

  const next = summary.next.filter((s) => !widget.settings.mineOnly || s.mine);
  const monthly = next.reduce((sum, s) => sum + (s.on_trial ? 0 : s.monthly), 0);
  const showTotal = widget.settings.showTotal;
  const inDays = (day: string) => {
    const days = daysToDue(day, summary.today);
    return days === 0 ? "today" : days === 1 ? "tmrw" : days < 7 ? `${days}d` : days < 60 ? `${Math.round(days / 7)}w` : `${Math.round(days / 30)}mo`;
  };
  const thisWeek = next.filter((s) => daysToDue(s.renews_on, summary.today) <= 7);

  if (shape === "icon") {
    return thisWeek.length ? <IconFace icon={icon} palette={palette} badge={thisWeek.length} /> : <IconFace icon={icon} palette={palette} />;
  }
  if (!next.length) {
    return <Empty icon="card" palette={palette} text={summary.count ? "Nothing of yours renews" : "Add what you pay for in Subscriptions"} />;
  }
  if (shape === "strip") {
    const first = next[0];
    return (
      <Strip
        icon={first.on_trial ? "warning" : icon}
        palette={palette}
        text={`${first.name} · ${first.on_trial ? "trial ends" : "renews"} ${inDays(first.renews_on)}`}
        sub={showTotal ? `${formatMoney(monthly)} a month` : next[1] ? `Then ${next[1].name}` : null}
      />
    );
  }

  const rows = next.slice(0, Math.min(widget.settings.count, rowsThatFit(height, 24, showTotal ? (shape === "small" ? 110 : 120) : 52)));

  const Total = () => (
    <View>
      <Text style={{ fontSize: isBig(shape) ? 34 : 26, fontWeight: "800", color: palette.text, letterSpacing: -1 }} numberOfLines={1} adjustsFontSizeToFit>
        {formatMoney(monthly)}
      </Text>
      <Muted palette={palette}>a month</Muted>
    </View>
  );
  const list = rows.length ? (
    <View style={{ gap: 6 }}>
      {rows.map((s) => (
        <View key={s.id} style={styles.row}>
          <Icon name={s.on_trial ? "warning" : "card"} size={13} color={palette.accent} />
          <Text style={[styles.body, { color: palette.text, flex: 1, fontWeight: s.on_trial ? "700" : "500" }]} numberOfLines={1}>
            {s.name}
          </Text>
          <Text style={[styles.small, { color: palette.muted }]}>{inDays(s.renews_on)}</Text>
        </View>
      ))}
    </View>
  ) : null;

  if (!showTotal) return <View style={{ flex: 1, justifyContent: "center" }}>{list}</View>;
  if (shape === "small") {
    return (
      <View style={{ gap: 8, flex: 1 }}>
        <Total />
        {list}
      </View>
    );
  }
  if (shape === "wide") {
    return (
      <View style={[styles.row, { flex: 1, gap: 14, alignItems: "stretch" }]}>
        <View style={{ justifyContent: "center", minWidth: 110 }}>
          <Total />
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
      <Total />
      {list ? (
        <Panel palette={palette} style={{ flex: 1 }}>
          {list}
        </Panel>
      ) : null}
    </View>
  );
}

// --- Next dose (SICK-008) -------------------------------------------------------

function SickDay({ widget, palette, refreshKey, height, shape, icon }: BodyProps<"sickday">) {
  const { session } = useAuth();
  const summary = useSickSummary(session?.user.id, refreshKey);
  const { settings } = useNookSettings("sickday", sickdaySettingDefaults);
  const now = useNow();
  if (!summary) return null;

  const sick = summary.sick;
  if (shape === "icon") {
    return sick.length ? <IconFace icon={icon} palette={palette} badge={sick.length} /> : <IconFace icon={icon} palette={palette} />;
  }
  if (!sick.length) return <Empty icon="heart" palette={palette} text="Everyone's well" />;

  const temp = (c: number | null) => (widget.settings.showTemp && c != null ? sickTemp(c, settings.tempUnit) : null);
  const nextWords = (t: (typeof sick)[number]["timers"][number]) =>
    !t.hasTimer ? "given" : !t.wait ? "OK now" : untilWords(t.wait.safeAt - now);

  if (shape === "strip") {
    const first = sick[0];
    const timer = first.timers.find((t) => t.hasTimer);
    return (
      <Strip
        icon={icon}
        palette={palette}
        text={timer ? `${first.name} · ${timer.name} ${timer.wait ? `in ${untilWords(timer.wait.safeAt - now)}` : "OK now"}` : `${first.name} · ${first.title}`}
        sub={[temp(first.tempC), sick.length > 1 ? `${sick.length} sick` : first.title].filter(Boolean).join(" · ") || null}
      />
    );
  }

  // One heading per person, then a line per medicine, as many as fit.
  type Line = { key: string; kind: "person"; s: (typeof sick)[number] } | { key: string; kind: "dose"; t: (typeof sick)[number]["timers"][number] };
  const lines: Line[] = [];
  for (const s of sick) {
    lines.push({ key: s.spellId, kind: "person", s });
    for (const t of s.timers) lines.push({ key: `${s.spellId}:${t.key}`, kind: "dose", t });
  }
  const shown = lines.slice(0, rowsThatFit(height, 22, 44));

  return (
    <View style={{ gap: 5, flex: 1, justifyContent: shape === "wide" ? "center" : "flex-start" }}>
      {shown.map((line) =>
        line.kind === "person" ? (
          <View key={line.key} style={styles.row}>
            <Text style={[styles.body, { color: palette.text, flex: 1, fontWeight: "800" }]} numberOfLines={1}>
              {line.s.name}
              <Text style={{ fontWeight: "500", color: palette.muted }}>{line.s.title !== "Sick" ? ` · ${line.s.title}` : ""}</Text>
            </Text>
            {temp(line.s.tempC) ? (
              <Text style={[styles.small, { color: isFever(line.s.tempC) ? palette.accent : palette.muted, fontWeight: "700" }]}>{temp(line.s.tempC)}</Text>
            ) : null}
          </View>
        ) : (
          <View key={line.key} style={[styles.row, { paddingLeft: 4 }]}>
            <Icon name={line.t.hasTimer && !line.t.wait ? "check" : "pill"} size={12} color={palette.accent} />
            <Text style={[styles.small, { color: palette.text, flex: 1 }]} numberOfLines={1}>
              {line.t.name}
            </Text>
            <Text style={[styles.small, { color: line.t.hasTimer && !line.t.wait ? palette.accent : palette.muted, fontWeight: "700" }]}>
              {nextWords(line.t)}
            </Text>
          </View>
        )
      )}
      {sick.every((s) => !s.timers.length) && lines.length <= shown.length ? <Muted palette={palette}>No medicine given yet</Muted> : null}
    </View>
  );
}

// --- A log (LOG-007) --------------------------------------------------------------

function LittleLogWidget({ widget, palette, refreshKey, width, height, shape, icon }: BodyProps<"littlelog">) {
  const { session } = useAuth();
  const userId = session?.user.id;
  const data = useLittleLogSummary(userId, refreshKey);
  if (!data) return null;

  // The picked log, or whichever of yours was logged most recently.
  const newest = (id: string) => data.entries.get(id)?.[0]?.logged_at ?? "";
  const log =
    data.logs.find((l) => l.id === widget.settings.logId) ??
    (widget.settings.logId ? undefined : [...data.logs].filter((l) => l.owner_id === userId).sort((a, b) => newest(b.id).localeCompare(newest(a.id)))[0]);
  if (!log) {
    if (shape === "icon") return <IconFace icon={icon} palette={palette} />;
    return <Empty icon="chart" palette={palette} text={widget.settings.logId ? "This log isn't here any more" : "Start a log in Little Log"} />;
  }

  const entries = data.entries.get(log.id) ?? [];
  const latest = entries[0];
  const shown = inRange(entries, widget.settings.range);
  const stats = logStats(shown);
  const rangeWord = widget.settings.range === "week" ? "this week" : widget.settings.range === "month" ? "this month" : "in 3 months";
  const short = !latest
    ? "—"
    : log.kind === "pair"
      ? `${formatNumber(latest.value!)}/${formatNumber(latest.value2!)}`
      : log.kind === "scale"
        ? scaleWord(latest.value!)
        : log.kind === "number"
          ? formatNumber(latest.value!)
          : log.kind === "yesno"
            ? `${yesStreak(yesNoDays(entries, 60))}`
            : "";
  const sub = !latest
    ? "Nothing logged yet"
    : log.kind === "yesno"
      ? `day streak · ${agoWords(latest.logged_at)}`
      : [agoWords(latest.logged_at), log.kind === "number" && stats.change !== null ? `${changeWords(stats.change)} ${rangeWord}` : null].filter(Boolean).join(" · ");

  if (shape === "icon") {
    return <IconFace icon={icon} palette={palette} value={log.kind === "text" ? undefined : short} caption={log.kind === "yesno" ? "days" : log.unit ?? undefined} />;
  }
  if (shape === "strip") {
    return <Strip icon={icon} palette={palette} text={latest ? `${log.name} · ${formatEntry(log, latest)}` : log.name} sub={sub} />;
  }

  // The card has 14 of padding each side.
  const chartW = Math.max(0, width - 28);
  const chartH = Math.max(24, Math.min(90, height - (isBig(shape) ? 120 : 100)));
  return (
    <View style={{ flex: 1, gap: 4 }}>
      <Muted palette={palette}>{log.name}</Muted>
      {log.kind === "text" ? (
        <Text style={[styles.body, { color: palette.text }]} numberOfLines={Math.max(2, Math.floor((height - 60) / 20))}>
          {latest?.note ?? "Nothing written yet"}
        </Text>
      ) : (
        <Text style={{ fontSize: isBig(shape) ? 34 : 28, fontWeight: "800", color: palette.text, letterSpacing: -1 }} numberOfLines={1} adjustsFontSizeToFit>
          {short}
          {log.unit && (log.kind === "number" || log.kind === "pair") ? <Text style={{ fontSize: 14, fontWeight: "600", color: palette.muted }}> {log.unit}</Text> : null}
        </Text>
      )}
      <Muted palette={palette}>{sub}</Muted>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        {log.kind === "yesno" ? (
          <View style={{ flexDirection: "row", gap: 4 }}>
            {yesNoDays(entries, 7).map((d) => (
              <View
                key={d.day}
                style={{
                  flex: 1,
                  height: 12,
                  borderRadius: 3,
                  backgroundColor: d.state === "yes" ? palette.accent : d.state === "no" ? palette.panel : "transparent",
                  borderWidth: d.state === null ? 1 : 0,
                  borderColor: palette.faint,
                }}
              />
            ))}
          </View>
        ) : log.kind !== "text" ? (
          <Sparkline entries={shown} color={palette.accent} width={chartW} height={chartH} ring="transparent" />
        ) : null}
      </View>
    </View>
  );
}

// --- A note (NOTE-007) ------------------------------------------------------------

function NoteWidget({ widget, palette, refreshKey, height, shape, icon }: BodyProps<"notes">) {
  const { session } = useAuth();
  const userId = session?.user.id;
  const data = useNotesSummary(userId, refreshKey);
  if (!data) return null;

  // The picked note, or your top pinned one (or newest).
  const note = widget.settings.noteId
    ? data.notes.find((n) => n.id === widget.settings.noteId)
    : sortNotes(data.notes.filter((n) => n.owner_id === userId))[0];
  if (!note) {
    if (shape === "icon") return <IconFace icon={icon} palette={palette} />;
    return <Empty icon="note" palette={palette} text={widget.settings.noteId ? "This note isn't here any more" : "Write a note in the Notes Nook"} />;
  }

  const counts = checklistCounts(note.body);
  if (shape === "icon") {
    const left = counts.total - counts.done;
    return left ? <IconFace icon={icon} palette={palette} badge={left} /> : <IconFace icon={icon} palette={palette} />;
  }
  if (shape === "strip") {
    return <Strip icon={icon} palette={palette} text={noteTitle(note.body)} sub={counts.total ? `${counts.done} of ${counts.total} done` : notePreview(note.body) || null} />;
  }

  // The title, then the lines after it, as many as fit.
  const blocks = noteBlocks(note.body);
  const titleAt = blocks.findIndex((b) => b.text.trim());
  const lines = blocks.slice(titleAt + 1).filter((b) => b.text.trim());
  const fit = rowsThatFit(height, 21, 34);
  return (
    <View style={{ flex: 1, gap: 4 }}>
      <Text style={[styles.body, { color: palette.text, fontWeight: "800", fontSize: 15 }]} numberOfLines={1}>
        {noteTitle(note.body)}
      </Text>
      {lines.slice(0, fit).map((b) =>
        b.kind === "check" ? (
          <View key={b.line} style={styles.row}>
            <Icon name={b.done ? "check" : "todo"} size={12} color={b.done ? palette.muted : palette.accent} />
            <Text
              style={[styles.small, { color: b.done ? palette.muted : palette.text, flex: 1, textDecorationLine: b.done ? "line-through" : "none" }]}
              numberOfLines={1}
            >
              {b.text}
            </Text>
          </View>
        ) : (
          <Text key={b.line} style={[styles.small, { color: palette.text }]} numberOfLines={1}>
            {b.text}
          </Text>
        )
      )}
      {lines.length > fit ? <Muted palette={palette}>+{lines.length - fit} more</Muted> : null}
    </View>
  );
}

// --- Sitter links (SIT-009) -------------------------------------------------------

function Sitter({ widget, palette, refreshKey, height, shape, icon }: BodyProps<"sitter">) {
  const { session } = useAuth();
  const summary = useSitterSummary(session?.user.id, refreshKey);
  if (!summary) return null;

  const live = summary.live;
  const today = localDay();
  const unopened = live.filter((l) => !l.views).length;

  if (shape === "icon") {
    return live.length ? <IconFace icon={icon} palette={palette} badge={live.length} /> : <IconFace icon={icon} palette={palette} />;
  }
  if (!summary.started && !live.length) return <Empty icon="sitter" palette={palette} text="Write your sitter sheet" />;
  if (shape === "strip") {
    return (
      <Strip
        icon={icon}
        palette={palette}
        text={live.length ? `${live[0].label} · ${endsWords(live[0], today)}` : "No sitter links out"}
        sub={live.length > 1 ? `${live.length} links out` : live.length ? (live[0].views ? "Opened" : "Not opened yet") : null}
      />
    );
  }

  const rows = live.slice(0, Math.min(widget.settings.count, rowsThatFit(height, 24, shape === "small" ? 110 : 120)));

  const Count = () => (
    <View>
      <Text style={{ fontSize: isBig(shape) ? 44 : 34, fontWeight: "800", color: palette.text, letterSpacing: -1 }}>{live.length}</Text>
      <Muted palette={palette}>
        {!live.length ? "links out" : unopened ? `out · ${unopened} not opened` : live.length === 1 ? "link out" : "links out"}
      </Muted>
    </View>
  );
  const list = rows.length ? (
    <View style={{ gap: 6 }}>
      {rows.map((l) => (
        <View key={l.id} style={styles.row}>
          <Icon name={l.views ? "check" : "link"} size={13} color={palette.accent} />
          <Text style={[styles.body, { color: palette.text, flex: 1, fontWeight: l.ends_on === today ? "700" : "500" }]} numberOfLines={1}>
            {l.label}
          </Text>
          <Text style={[styles.small, { color: palette.muted }]}>{endsWords(l, today).replace("ends ", "")}</Text>
        </View>
      ))}
    </View>
  ) : (
    <Muted palette={palette}>Make a link before you head out</Muted>
  );

  if (shape === "small") {
    return (
      <View style={{ gap: 8, flex: 1 }}>
        <Count />
        {list}
      </View>
    );
  }
  if (shape === "wide") {
    return (
      <View style={[styles.row, { flex: 1, gap: 14, alignItems: "stretch" }]}>
        <View style={{ justifyContent: "center", minWidth: 110 }}>
          <Count />
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
      <Panel palette={palette} style={{ flex: 1 }}>
        {list}
      </Panel>
    </View>
  );
}

// --- Recipe of the day (REC-011) ---------------------------------------------------

function RecipeOfTheDay({ widget, palette, refreshKey, shape, icon }: BodyProps<"recipe">) {
  const { session } = useAuth();
  const summary = useRecipesSummary(session?.user.id, refreshKey, widget.settings.shelf);
  // A TikTok recipe's thumbnail is looked up fresh (REC-013).
  const imageUrl = useRecipeImage(summary?.today?.image_url ?? null, summary?.today?.source_url ?? null);
  if (!summary) return null;
  const today = summary.today;

  if (shape === "icon") return <IconFace icon={icon} palette={palette} />;
  if (!today) {
    return (
      <Empty
        icon="recipe"
        palette={palette}
        text={summary.count ? `Nothing on ${widget.settings.shelf ?? "that Shelf"} yet` : "Add a recipe to your Recipe Box"}
      />
    );
  }
  const time = formatMinutes((today.prep_minutes ?? 0) + (today.cook_minutes ?? 0));
  const sub = [time, widget.settings.shelf ?? today.shelves[0]].filter(Boolean).join(" · ") || null;
  if (shape === "strip") return <Strip icon={icon} palette={palette} text={today.title} sub={sub} />;

  const title = (
    <View style={{ gap: 2 }}>
      <Muted palette={palette}>Today's pick</Muted>
      <Text style={{ fontSize: isBig(shape) ? 19 : 16, fontWeight: "800", color: palette.text, letterSpacing: -0.3 }} numberOfLines={isBig(shape) ? 2 : 3}>
        {today.title}
      </Text>
      {sub ? <Muted palette={palette}>{sub}</Muted> : null}
    </View>
  );
  const picture = imageUrl ? (
    <Image source={{ uri: imageUrl }} style={{ flex: 1, borderRadius: 14, minHeight: 60 }} contentFit="cover" transition={200} />
  ) : null;

  if (shape === "small") {
    return <View style={{ flex: 1, justifyContent: "flex-end", gap: 8 }}>{title}</View>;
  }
  if (shape === "wide") {
    return (
      <View style={[styles.row, { flex: 1, gap: 14, alignItems: "stretch" }]}>
        <View style={{ flex: 1, justifyContent: "center" }}>{title}</View>
        {picture ? <View style={{ width: "42%" }}>{picture}</View> : null}
      </View>
    );
  }
  return (
    <View style={{ flex: 1, gap: 10 }}>
      {picture}
      {title}
    </View>
  );
}

// --- Photo frame (CORE-046) -----------------------------------------------------------

const FRAMES = {
  wood: { outer: "#8a5a3b", inner: "#5e3b22", highlight: "#b07a52" },
  gold: { outer: "#d4a63c", inner: "#9a7418", highlight: "#f3d98a" },
  white: { outer: "#fbf7f2", inner: "#d9d2c9", highlight: "#ffffff" },
  polaroid: { outer: "#fdfbf7", inner: "#e4ddd3", highlight: "#ffffff" },
} as const;

// Your own pictures in a frame, one after another.
function PhotoFrame({
  settings,
  width,
  height,
  radius,
}: {
  settings: WidgetOf<"frame">["settings"];
  width: number;
  height: number;
  radius: number;
}) {
  const urls = usePhotoUrls(settings.photos);
  const ready = settings.photos.filter((path) => urls.has(path));
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (ready.length < 2) return;
    const timer = setInterval(() => setIndex((i) => i + 1), Math.max(3, settings.seconds) * 1000);
    return () => clearInterval(timer);
  }, [ready.length, settings.seconds]);

  const uri = ready.length ? urls.get(ready[index % ready.length]) : undefined;
  const style = settings.style;
  const frame = style === "none" ? null : FRAMES[style];
  const margin = Math.max(4, Math.min(14, Math.min(width, height) * 0.075));
  const polaroid = style === "polaroid";
  const bottom = polaroid ? Math.min(margin * 3.6, height * 0.28) : margin;
  const innerRadius = frame ? Math.max(2, radius - margin) / (polaroid ? 4 : 2.5) : radius;

  return (
    <View
      style={{
        width,
        height,
        borderRadius: radius,
        overflow: "hidden",
        backgroundColor: frame?.outer ?? "transparent",
        paddingTop: frame ? margin : 0,
        paddingHorizontal: frame ? margin : 0,
        paddingBottom: frame ? bottom : 0,
        boxShadow: frame ? `${tileBevel}, inset 0px 0px 0px 1px ${frame.highlight}` : undefined,
      }}
    >
      <View
        style={{
          flex: 1,
          borderRadius: innerRadius,
          overflow: "hidden",
          backgroundColor: "rgba(120,100,90,0.14)",
          borderWidth: frame ? 1.5 : 0,
          borderColor: frame?.inner,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {uri ? (
          <Image source={{ uri }} style={{ width: "100%", height: "100%" }} contentFit="cover" transition={700} />
        ) : (
          <View style={{ alignItems: "center", gap: 4, padding: 6 }}>
            <Icon name="camera" size={Math.min(28, Math.min(width, height) * 0.3)} color="#8a7a70" />
            {Math.min(width, height) > 110 ? (
              <Text style={{ color: "#8a7a70", fontSize: 12, textAlign: "center" }} numberOfLines={2}>
                {settings.photos.length ? "Loading your photos…" : "Tap Edit, then the frame, to add photos"}
              </Text>
            ) : null}
          </View>
        )}
        {settings.caption && !polaroid && uri ? (
          <View style={styles.captionPill}>
            <Text style={{ color: "#ffffff", fontSize: 12, fontWeight: "700" }} numberOfLines={1}>
              {settings.caption}
            </Text>
          </View>
        ) : null}
      </View>
      {polaroid && settings.caption ? (
        <View style={{ position: "absolute", left: margin, right: margin, bottom: 0, height: bottom, justifyContent: "center" }}>
          <Text style={{ color: "#5b4f46", fontSize: Math.min(15, bottom * 0.5), fontWeight: "600", textAlign: "center" }} numberOfLines={1}>
            {settings.caption}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

// --- Fridge door (CORE-086) ------------------------------------------------------------

// A fridge door with the newest notes and doodles held up by magnets. As
// many as fit are shown; a last magnet says how many more are up. Tapping
// it (outside Edit) opens the fridge itself (app/fridge.tsx).
function FridgeWidget({
  widget,
  color,
  width,
  height,
  radius,
  border,
  refreshKey,
  onHomePage,
}: {
  widget: WidgetOf<"fridge">;
  color?: string;
  width: number;
  height: number;
  radius: number;
  border?: boolean;
  refreshKey: number;
  onHomePage: boolean;
}) {
  const { homeId } = useHomeHearth();
  const place = fridgePlace(widget.settings, { onHomePage, homeId });
  const { notes } = useFridgeNotes(place, refreshKey);
  const soft = color ?? tilePalette[0];
  const deep = deepColor(soft);
  const enamel = widget.look === "bold" ? deep : widget.look === "soft" ? soft : null;
  const ink = widget.look === "bold" ? "rgba(255,255,255,0.85)" : "#5b4f46";
  const shape = widgetShape(width, height);
  const label = widget.showTitle && shape !== "icon" && height >= 110 ? widget.title || "Fridge" : null;

  if (shape === "icon") {
    // A little two-door fridge with how many notes are up.
    return (
      <FridgeDoor width={width} height={height} enamel={enamel} outline={deep} radius={radius} freezerAt={height * 0.36} border={border}>
        {notes.length ? (
          <View style={{ position: "absolute", left: 0, right: 12, top: height * 0.36, bottom: 0, alignItems: "center", justifyContent: "center" }}>
            <Magnet color={noteMagnet(notes[0].id)} size={Math.min(28, width * 0.36)}>
              <Text style={{ color: "#ffffff", fontSize: Math.min(13, width * 0.17), fontWeight: "900" }}>{notes.length > 9 ? "9+" : notes.length}</Text>
            </Magnet>
          </View>
        ) : null}
      </FridgeDoor>
    );
  }

  const freezerAt = shape === "tall" || shape === "large" ? Math.min(height * 0.24, 70) : undefined;
  const pad = { top: label ? 30 : 10, left: 8, right: 22, bottom: 8 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const grid = fridgeGrid(innerW, innerH, notes.length);

  return (
    <FridgeDoor width={width} height={height} enamel={enamel} outline={deep} radius={radius} freezerAt={freezerAt} label={label} border={border}>
      <View style={{ position: "absolute", left: pad.left, top: pad.top, width: innerW, height: innerH }}>
        {notes.length === 0 ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 6 }}>
            <LetterMagnets size={Math.max(16, Math.min(40, Math.min(innerW, innerH) * 0.3))} />
            {innerH >= 120 ? (
              <Text style={{ color: ink, fontSize: 12, fontWeight: "600", textAlign: "center" }} numberOfLines={2}>
                {place ? "Tap to stick up a note" : "Loading your fridge…"}
              </Text>
            ) : null}
          </View>
        ) : (
          notes.slice(0, grid.shown).map((note, i) => {
            const col = i % grid.cols;
            const row = Math.floor(i / grid.cols);
            const jitter = (hashOf(note.id) % 7) - 3;
            return (
              <View
                key={note.id}
                style={{ position: "absolute", left: col * grid.cellW + 4 + jitter, top: row * grid.cellH + 3 }}
              >
                <FridgeNoteCard note={note} width={grid.cellW - 8} height={grid.cellH - 6} />
              </View>
            );
          })
        )}
        {grid.extra > 0 ? (
          <View
            style={{
              position: "absolute",
              left: ((grid.cols * grid.rows - 1) % grid.cols) * grid.cellW,
              top: (grid.rows - 1) * grid.cellH,
              width: grid.cellW,
              height: grid.cellH,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Magnet color={magnets[1]} size={Math.min(40, grid.cellW * 0.5)}>
              <Text style={{ color: "#ffffff", fontSize: 13, fontWeight: "900" }}>+{grid.extra}</Text>
            </Magnet>
          </View>
        ) : null}
      </View>
    </FridgeDoor>
  );
}

// --- Weather (CORE-056) ---------------------------------------------------------------

function WeatherWidget({ widget, palette, shape, width, height, icon, refreshKey }: BodyProps<"weather">) {
  const { place, unit, showForecast } = widget.settings;
  const { weather, loading, failed } = useWeather(place, unit, refreshKey);

  if (!place || !weather) {
    const text = !place ? "Pick a town in this widget's settings" : loading ? "Checking the sky…" : failed ? "Couldn't reach the weather just now" : "Checking the sky…";
    if (shape === "icon") return <IconFace icon={icon} palette={palette} />;
    if (shape === "strip") return <Strip icon={icon} palette={palette} text={place?.name ?? "Weather"} sub={text} />;
    return <Empty icon={icon} palette={palette} text={text} />;
  }

  const sky = conditionIcon(weather.condition, weather.isDay);
  const label = conditionLabel(weather.condition);
  const today = weather.days[0];
  const highLow = today ? `H ${formatTemp(today.high)} · L ${formatTemp(today.low)}` : null;

  if (shape === "icon") return <IconFace icon={sky} palette={palette} value={formatTemp(weather.temp)} />;
  if (shape === "strip") {
    return <Strip icon={sky} palette={palette} text={`${formatTemp(weather.temp)} ${label}`} sub={highLow ? `${place.name} · ${highLow}` : place.name} />;
  }

  const innerWidth = width - 28;
  const innerHeight = height - 28;
  const forecast = showForecast && isBig(shape) ? weather.days : [];
  const side = shape === "wide" || (shape === "large" && innerWidth > innerHeight * 1.3);
  const tempSize = Math.max(28, Math.min(64, (side ? innerWidth * 0.5 : innerWidth) * 0.3, innerHeight * (forecast.length && !side ? 0.22 : 0.34)));

  const now = (
    <View style={[styles.centerFill, { gap: 2 }]}>
      <View style={[styles.row, { gap: 8 }]}>
        <Icon name={sky} size={Math.round(tempSize * 0.7)} color={palette.accent} />
        <Text style={{ fontSize: tempSize, fontWeight: "800", color: palette.text, letterSpacing: -1 }} numberOfLines={1}>
          {formatTemp(weather.temp)}
        </Text>
      </View>
      <Text style={[styles.body, { color: palette.text, fontWeight: "700" }]} numberOfLines={1}>
        {label}
      </Text>
      <Muted palette={palette}>{shape === "small" || !highLow ? place.name : `${place.name} · ${highLow}`}</Muted>
    </View>
  );
  if (!forecast.length) return now;

  const days = (
    <Panel palette={palette} style={side ? { flex: 1, justifyContent: "center", gap: 6 } : { gap: 6 }}>
      {forecast.map((day) => (
        <View key={day.day} style={[styles.row, { gap: 8 }]}>
          <Text style={[styles.small, { color: palette.text, fontWeight: "700", flex: 1 }]} numberOfLines={1}>
            {dayName(day.day, weather.days[0].day)}
          </Text>
          <Icon name={conditionIcon(day.condition, true)} size={15} color={palette.accent} />
          <Text style={[styles.small, { color: palette.text, fontWeight: "700", minWidth: 30, textAlign: "right" }]}>{formatTemp(day.high)}</Text>
          <Text style={[styles.small, { color: palette.muted, minWidth: 30, textAlign: "right" }]}>{formatTemp(day.low)}</Text>
        </View>
      ))}
    </Panel>
  );
  return side ? (
    <View style={[styles.row, { flex: 1, gap: 12 }]}>
      <View style={{ flex: 1 }}>{now}</View>
      {days}
    </View>
  ) : (
    <View style={{ flex: 1, gap: 8 }}>
      {now}
      {days}
    </View>
  );
}

// --- Window (CORE-057) ------------------------------------------------------------------

// A little window with the weather outside: live from a town, or a sky you chose.
function WindowWidget({
  settings,
  width,
  height,
  radius,
  still,
  refreshKey,
}: {
  settings: WidgetOf<"window">["settings"];
  width: number;
  height: number;
  radius: number;
  still: boolean;
  refreshKey: number;
}) {
  const live = settings.source === "live";
  const { weather } = useWeather(live ? settings.place : null, settings.unit, refreshKey);
  // Day turns to night by the clock for a sky you chose; check now and then.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 10 * 60 * 1000);
    return () => clearInterval(timer);
  }, []);
  const sky = windowSky(settings, weather, now);
  const roomy = Math.min(width, height) >= 110;
  const note = live && !settings.place ? "Pick a town" : settings.showTemp && live && weather ? formatTemp(weather.temp) : null;

  return (
    <View style={{ width, height, borderRadius: radius, boxShadow: tileBevel }}>
      <WindowScene
        width={width}
        height={height}
        condition={sky.condition}
        isDay={sky.isDay}
        frame={settings.frame}
        radius={radius}
        still={still}
      />
      {note && (roomy || note.length <= 4) ? (
        <View style={[styles.windowPill, { top: Math.max(8, height * 0.08), right: Math.max(8, width * 0.08) }]}>
          <Text style={{ color: "#ffffff", fontSize: 12, fontWeight: "800" }} numberOfLines={1}>
            {note}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

// --- Clock (CORE-049) -----------------------------------------------------------------

function ClockWidget({ widget, palette, shape, width, height, icon }: BodyProps<"clock">) {
  const { face, hour24, showDate } = widget.settings;
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 10000);
    return () => clearInterval(timer);
  }, []);

  const time = now.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", hour12: !hour24 });
  const longDate = now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  const shortDate = now.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

  if (shape === "icon") {
    return <IconFace icon={icon} palette={palette} value={time.replace(/\s?[AP]M/i, "")} />;
  }
  if (shape === "strip") return <Strip icon={icon} palette={palette} text={time} sub={showDate ? shortDate : null} />;

  const innerWidth = width - 28;
  const innerHeight = height - 28;
  if (face === "analog") {
    const size = Math.max(60, Math.min(innerWidth, innerHeight - (showDate ? 22 : 0)));
    return (
      <View style={styles.centerFill}>
        <AnalogClock size={size} now={now} palette={palette} />
        {showDate ? (
          <Text style={[styles.small, { color: palette.muted, marginTop: 6 }]} numberOfLines={1}>
            {shape === "small" ? shortDate : longDate}
          </Text>
        ) : null}
      </View>
    );
  }
  const fontSize = Math.max(22, Math.min(innerWidth * 0.26, innerHeight * 0.4, 72));
  return (
    <View style={styles.centerFill}>
      <Text
        style={{ fontSize, fontWeight: "800", color: palette.text, letterSpacing: -1 }}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.5}
      >
        {time}
      </Text>
      {showDate ? (
        <Text style={[styles.body, { color: palette.muted }]} numberOfLines={1}>
          {shape === "small" || shape === "tall" ? shortDate : longDate}
        </Text>
      ) : null}
    </View>
  );
}

function AnalogClock({ size, now, palette }: { size: number; now: Date; palette: Palette }) {
  const c = size / 2;
  const r = c - 3;
  const minutes = now.getMinutes();
  const hours = (now.getHours() % 12) + minutes / 60;
  const hand = (angle: number, length: number) => {
    const rad = ((angle - 90) * Math.PI) / 180;
    return { x2: c + Math.cos(rad) * length, y2: c + Math.sin(rad) * length };
  };
  return (
    <Svg width={size} height={size}>
      <Circle cx={c} cy={c} r={r} fill={palette.panel} stroke={palette.accent} strokeWidth={2.5} />
      {Array.from({ length: 12 }, (_, i) => {
        const rad = ((i * 30 - 90) * Math.PI) / 180;
        const long = i % 3 === 0;
        return (
          <Line
            key={i}
            x1={c + Math.cos(rad) * (r - (long ? 9 : 6))}
            y1={c + Math.sin(rad) * (r - (long ? 9 : 6))}
            x2={c + Math.cos(rad) * (r - 2)}
            y2={c + Math.sin(rad) * (r - 2)}
            stroke={palette.muted}
            strokeWidth={long ? 2.5 : 1.5}
            strokeLinecap="round"
          />
        );
      })}
      <Line x1={c} y1={c} {...hand(hours * 30, r * 0.5)} stroke={palette.text} strokeWidth={4} strokeLinecap="round" />
      <Line x1={c} y1={c} {...hand(minutes * 6, r * 0.78)} stroke={palette.text} strokeWidth={2.5} strokeLinecap="round" />
      <Circle cx={c} cy={c} r={4} fill={palette.accent} />
    </Svg>
  );
}

// --- Quote of the day (CORE-049) ---------------------------------------------------------

function QuoteWidget({ widget, palette, shape, width, height, icon }: BodyProps<"quote">) {
  const pool = quotePool(widget.settings.source, widget.settings.mine);
  const text = quoteOfDay(pool, new Date()) ?? "Add your own quotes in this widget's settings";

  if (shape === "icon") return <IconFace icon={icon} palette={palette} />;
  if (shape === "strip") return <Strip icon={icon} palette={palette} text={text} />;

  const innerWidth = width - 28;
  const innerHeight = height - 28;
  const fontSize = Math.max(14, Math.min(22, innerWidth * 0.08 + innerHeight * 0.04));
  const lines = Math.max(2, Math.floor((innerHeight - 30) / (fontSize * 1.4)));
  return (
    <View style={[styles.centerFill, { gap: 8, paddingHorizontal: 4 }]}>
      <Icon name="sparkles" size={16} color={palette.accent} />
      <Text
        style={{ fontSize, lineHeight: fontSize * 1.4, fontWeight: "600", color: palette.text, textAlign: "center", fontStyle: "italic" }}
        numberOfLines={lines}
      >
        “{text}”
      </Text>
    </View>
  );
}

// --- Quick launch (CORE-049) -------------------------------------------------------------

function Launch({ widget, palette, shape, width, height, icon, onChange }: BodyProps<"launch">) {
  const router = useRouter();
  const targets = pickedTargets(widget.settings.targets);
  // Like ticking a reminder: only live outside Edit mode.
  const live = Boolean(onChange);

  if (shape === "icon") return <IconFace icon={icon} palette={palette} badge={targets.length} />;
  if (!targets.length) return <Empty icon={icon} palette={palette} text="Pick where the buttons go" />;

  const gap = 8;
  const innerWidth = width - 28;
  const innerHeight = height - 28;
  const minWidth = shape === "strip" ? 44 : 72;
  const columns = Math.max(1, Math.min(targets.length, Math.floor((innerWidth + gap) / (minWidth + gap))));
  const rows = Math.ceil(targets.length / columns);
  const buttonWidth = (innerWidth - gap * (columns - 1)) / columns;
  const buttonHeight = Math.max(36, Math.min(96, (innerHeight - gap * (rows - 1)) / rows));
  const showLabels = shape !== "strip" && buttonWidth >= 64 && buttonHeight >= 62;

  return (
    <View style={{ flex: 1, flexDirection: "row", flexWrap: "wrap", gap, alignContent: "center", justifyContent: "center" }}>
      {targets.map((target) => (
        <Tap
          key={target.key}
          onPressIn={() => guardTouches()}
          onPress={live ? () => router.push(target.route as never) : undefined}
          disabled={!live}
          accessibilityLabel={`Open ${target.label}`}
          style={{
            width: buttonWidth,
            height: buttonHeight,
            borderRadius: 16,
            backgroundColor: palette.panel,
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
          }}
        >
          <Icon name={target.icon} size={showLabels ? 24 : 22} color={palette.accent} />
          {showLabels ? (
            <Text style={[styles.tiny, { color: palette.text, fontWeight: "700" }]} numberOfLines={1}>
              {target.label}
            </Text>
          ) : null}
        </Tap>
      ))}
    </View>
  );
}

// --- Habit streak (CORE-049) -----------------------------------------------------------

function Streak({ widget, palette, shape, width, height, icon, onChange }: BodyProps<"streak">) {
  const today = dayKey(new Date());
  const { name, days } = widget.settings;
  const streak = currentStreak(days, today);
  const doneToday = days.includes(today);
  const onBold = palette.text === "#ffffff";

  function toggle() {
    onChange?.({ ...widget, settings: { ...widget.settings, days: toggleDay(days, today) } });
  }

  if (shape === "icon") return <IconFace icon={streak ? "flame" : icon} palette={palette} value={String(streak)} caption={doneToday ? "done" : "streak"} />;
  if (shape === "strip") {
    return (
      <Strip
        icon={streak ? "flame" : icon}
        palette={palette}
        text={`${streak} day${streak === 1 ? "" : "s"} · ${name}`}
        sub={doneToday ? "Done today" : "Not yet today"}
      />
    );
  }

  const week = lastDays(7, today);
  const big = shape === "small" ? 40 : 52;
  const dots = (
    <View style={[styles.row, { gap: 6, justifyContent: "center" }]}>
      {week.map((day) => {
        const done = days.includes(day);
        return (
          <View
            key={day}
            style={{
              width: 14,
              height: 14,
              borderRadius: 7,
              backgroundColor: done ? palette.accent : palette.panel,
              borderWidth: day === today ? 2 : 0,
              borderColor: palette.accent,
            }}
          />
        );
      })}
    </View>
  );
  const button = (
    <Tap
      onPressIn={() => guardTouches()}
      onPress={onChange ? toggle : undefined}
      disabled={!onChange}
      style={[
        styles.pill,
        {
          alignSelf: "center",
          paddingHorizontal: 16,
          paddingVertical: 8,
          backgroundColor: doneToday ? palette.panel : onBold ? "#ffffff" : palette.deep,
        },
      ]}
      accessibilityLabel={doneToday ? "Undo today" : "Mark done today"}
    >
      <Text style={{ color: doneToday ? palette.text : onBold ? palette.deep : "#ffffff", fontWeight: "700", fontSize: 13 }}>
        {doneToday ? "Done today ✓" : "Done today"}
      </Text>
    </Tap>
  );

  return (
    <View style={[styles.centerFill, { gap: 8 }]}>
      <View style={{ alignItems: "center" }}>
        <Text style={{ fontSize: big, fontWeight: "800", color: palette.text, letterSpacing: -1, lineHeight: big * 1.05 }}>{streak}</Text>
        <Text style={[styles.small, { color: palette.muted }]} numberOfLines={1}>
          {streak === 1 ? "day" : "days"} · {name}
        </Text>
      </View>
      {height > 150 || shape === "wide" ? dots : null}
      {button}
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
  captionPill: {
    position: "absolute",
    left: 8,
    bottom: 8,
    maxWidth: "85%",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(40,30,24,0.55)",
  },
  windowPill: { position: "absolute", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: "rgba(40,30,24,0.55)" },
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
