import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Alert, StyleSheet, View, useWindowDimensions } from "react-native";
import Animated, { FadeIn, LinearTransition, ZoomIn } from "react-native-reanimated";

import {
  CalendarPage,
  Pill,
  ProgressBar,
  WidgetView,
  useCountdownTarget,
  widgetPalette,
  type Palette,
} from "../../../components/hearth/widgets";
import { Icon, IconBadge, type IconName } from "../../../components/icon";
import { Appear, LoadingScreen, Skeleton, Tap } from "../../../components/motion";
import { NookScroll } from "../../../components/nook-scroll";
import { Text, TextInput } from "../../../components/text";
import { Button, EmptyState, NavCard, SectionHeader } from "../../../components/ui";
import { tap } from "../../../lib/feedback";
import { useHearthView } from "../../../lib/hearth-view";
import { countdown, gatheringKindInfo, gatheringKinds } from "../../../lib/gift-nook";
import {
  hearthThemes,
  inScope,
  locate,
  tileBevel,
  tilePalette,
  updateItem,
  type HearthLayout,
  type WidgetItem,
} from "../../../lib/hearth";
import { syncReminders } from "../../../lib/reminders";
import { supabase } from "../../../lib/supabase";
import { colors, shadow, ui, useTheme } from "../../../lib/theme";
import {
  daysUntil,
  describeSchedule,
  newReminderId,
  timeUntil,
  weekendsUntil,
  weeksAndDays,
  widgetKindInfo,
  type Reminder,
  type WidgetOf,
} from "../../../lib/widgets";

// A widget's own page (CORE-038): tapping a widget on the Hearth (outside
// Edit) opens it here to see everything in it, laid out roomily — the whole
// checklist, every Gathering coming up, the countdown ticking, the full
// note. Especially handy for widgets shrunk to an icon. Edit (top right)
// opens its settings. Inbox and Gifts to buy open their own screens instead.
export default function WidgetPage() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  // The widget may be on the page shared with your Home (CORE-054).
  const { layout, save, isLoading } = useHearthView();
  const { key: themeKey } = useTheme();
  const [refreshKey, setRefreshKey] = useState(0);
  // The newest Hearth, for saving changes made in quick succession.
  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  useFocusEffect(useCallback(() => setRefreshKey((k) => k + 1), []));

  const found = locate(layout, id);
  const item = found?.item.kind === "widget" ? (found.item as WidgetItem) : undefined;

  if (isLoading) return <LoadingScreen />;
  if (!found || !item) {
    return <EmptyState icon="widgets" title="That widget is gone" body="It may have been removed from your Hearth." />;
  }

  const widget = item.widget;
  const info = widgetKindInfo(widget.kind);
  const theme = hearthThemes[themeKey] ?? hearthThemes.hearth;
  const palette = widgetPalette(widget.look, item.color, theme.text);
  const card = { item, palette, icon: item.icon ?? info.icon };
  const edit = () => router.push(`/widget/${id}`);

  // Save a changed widget back where it lives (the Hearth or a Hollow).
  function saveWidget(next: WidgetItem["widget"]) {
    const latest = layoutRef.current;
    const where = locate(latest, id);
    if (!where) return;
    const items = inScope(latest, where.scope, (inner) => updateItem(inner, id, { widget: next } as Partial<WidgetItem>));
    layoutRef.current = { ...latest, items } as HearthLayout;
    save({ items }).catch((error: Error) => Alert.alert("Couldn't save", error.message));
  }

  let body: ReactNode;
  switch (widget.kind) {
    case "countdown":
      body = <CountdownPage widget={widget} {...card} refreshKey={refreshKey} onEdit={edit} />;
      break;
    case "gatherings":
      body = <ComingUpPage widget={widget} {...card} refreshKey={refreshKey} />;
      break;
    case "reminders":
      body = <RemindersPage widget={widget} {...card} widgetId={id} layoutRef={layoutRef} saveWidget={saveWidget} />;
      break;
    case "note":
      body = <NotePage widget={widget} {...card} onEdit={edit} />;
      break;
    default:
      body = <BigWidget item={item} themeText={theme.text} refreshKey={refreshKey} onChange={saveWidget} />;
  }

  return (
    <NookScroll onRefresh={() => setRefreshKey((k) => k + 1)}>
      <Stack.Screen
        options={{
          title: widget.title || info.label,
          headerRight: () => (
            <Tap onPress={edit} hitSlop={10} pressedScale={0.9} style={[ui.row, { gap: 5 }]} accessibilityLabel="Edit this widget">
              <Icon name="edit" size={17} />
              <Text style={{ color: colors.bark, fontSize: 17, fontWeight: "600" }}>Edit</Text>
            </Tap>
          ),
        }}
      />
      {body}
    </NookScroll>
  );
}

type CardProps = { item: WidgetItem; palette: Palette; icon: IconName };

// --- The colored card at the top --------------------------------------------------
// Drawn like the widget itself (its color and Soft / Bold / Outline look),
// with a big faint copy of its icon tucked in the corner.

function ColorCard({ item, palette, icon, children }: CardProps & { children: ReactNode }) {
  const soft = item.color ?? tilePalette[0];
  const look = item.widget.look;
  return (
    <Appear>
      <View
        style={[
          styles.card,
          look === "soft" && { backgroundColor: soft, boxShadow: `${tileBevel}, ${shadow.boxShadow}` },
          look === "bold" && { backgroundColor: palette.deep, boxShadow: `${tileBevel}, ${shadow.boxShadow}` },
          look === "outline" && { borderWidth: 2, borderColor: palette.deep },
        ]}
      >
        <View style={styles.watermark} pointerEvents="none">
          <Icon name={icon} size={150} color={palette.accent} />
        </View>
        {children}
      </View>
    </Appear>
  );
}

function Fact({ icon, text, index }: { icon: IconName; text: string; index: number }) {
  return (
    <Appear index={index} style={[ui.card, styles.fact]}>
      <IconBadge name={icon} size={36} />
      <Text style={[ui.cardTitle, { flex: 1 }]}>{text}</Text>
    </Appear>
  );
}

// --- Countdown ----------------------------------------------------------------------

function CountdownPage({
  widget,
  refreshKey,
  onEdit,
  ...card
}: CardProps & { widget: WidgetOf<"countdown">; refreshKey: number; onEdit: () => void }) {
  const router = useRouter();
  const { palette } = card;
  const target = useCountdownTarget(widget.settings, refreshKey);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (target === undefined) return <Skeleton height={190} radius={28} />;
  if (!target) {
    return (
      <>
        <EmptyState
          icon="calendar"
          title={widget.settings.source === "custom" ? "No date picked yet" : "Nothing coming up"}
          body={widget.settings.source === "custom" ? "Pick the big day and this will count down to it." : "When a Gathering is planned, it'll count down here."}
        />
        <Button title={widget.settings.source === "custom" ? "Pick a date" : "Change what it counts to"} icon="calendar" onPress={onEdit} />
      </>
    );
  }

  const when = new Date(target.date);
  const days = daysUntil(when, now);
  const left = timeUntil(when, now);
  const fullDate = when.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const weekday = when.toLocaleDateString(undefined, { weekday: "long" });
  const weekends = weekendsUntil(when, now);

  return (
    <>
      <ColorCard {...card}>
        <View style={[ui.row, { gap: 18 }]}>
          <Animated.View entering={ZoomIn.springify().damping(14)}>
            <CalendarPage date={when} palette={palette} size={118} />
          </Animated.View>
          <View style={{ flex: 1 }}>
            {days === 0 ? (
              <>
                <Icon name="sparkles" size={30} color={palette.accent} />
                <Text style={[styles.huge, { color: palette.text, fontSize: 40 }]}>Today!</Text>
              </>
            ) : (
              <Text style={[styles.huge, { color: palette.text }]} numberOfLines={1} adjustsFontSizeToFit>
                {Math.abs(days)}
              </Text>
            )}
            <Text style={[styles.lead, { color: palette.text }]} numberOfLines={3}>
              {days === 0
                ? `${target.title} is here`
                : days > 0
                  ? `day${days === 1 ? "" : "s"} until ${target.title}`
                  : `day${days === -1 ? "" : "s"} since ${target.title}`}
            </Text>
          </View>
        </View>
        <Text style={[styles.note, { color: palette.muted }]}>{fullDate}</Text>
      </ColorCard>

      {days > 0 ? (
        <Appear index={1} style={styles.ticker}>
          {(
            [
              [left.days, "days"],
              [left.hours, "hours"],
              [left.minutes, "min"],
              [left.seconds, "sec"],
            ] as const
          ).map(([value, label]) => (
            <View key={label} style={[ui.card, styles.tick]}>
              <Text style={[styles.tickValue, { color: colors.text }]}>{String(value).padStart(label === "days" ? 1 : 2, "0")}</Text>
              <Text style={ui.muted}>{label}</Text>
            </View>
          ))}
        </Appear>
      ) : null}

      {days > 0 ? (
        <View style={{ gap: 10 }}>
          <Fact index={2} icon="calendar" text={`It's on a ${weekday}`} />
          <Fact index={3} icon="moon" text={`${days} sleep${days === 1 ? "" : "s"} to go`} />
          {days >= 7 ? <Fact index={4} icon="clock" text={`That's ${weeksAndDays(days)}`} /> : null}
          {weekends ? (
            <Fact index={5} icon="sun" text={`${weekends} weekend${weekends === 1 ? "" : "s"} before it`} />
          ) : null}
        </View>
      ) : null}

      {target.gatheringId ? (
        <NavCard
          index={6}
          icon={target.icon}
          title="Open the Gathering"
          subtitle="See who's coming and their Wishbooks"
          onPress={() => router.push(`/gift-nook/gathering/${target.gatheringId}`)}
        />
      ) : null}
    </>
  );
}

// --- Coming up ----------------------------------------------------------------------

type GatheringRow = { id: string; title: string; kind: string; ends_at: string; burrows: { name: string } | null };

function ComingUpPage({ widget, refreshKey, ...card }: CardProps & { widget: WidgetOf<"gatherings">; refreshKey: number }) {
  const router = useRouter();
  const { palette } = card;
  const { burrowId, kinds } = widget.settings;
  const [rows, setRows] = useState<GatheringRow[] | null>(null);

  useEffect(() => {
    let query = supabase
      .from("gatherings")
      .select("id, title, kind, ends_at, burrows(name)")
      .gt("ends_at", new Date().toISOString());
    if (burrowId) query = query.eq("burrow_id", burrowId);
    if (kinds.length) query = query.in("kind", kinds);
    query
      .order("ends_at")
      .limit(50)
      .then(({ data }) => setRows((data ?? []) as unknown as GatheringRow[]));
  }, [burrowId, kinds.join(","), refreshKey]);

  if (!rows) return <Skeleton height={190} radius={28} />;

  const filter = [
    burrowId ? null : "All your Burrows",
    kinds.length ? kinds.map((k) => gatheringKinds.find((g) => g.key === k)?.label ?? k).join(", ") : "Every kind",
  ]
    .filter(Boolean)
    .join(" · ");

  if (!rows.length) {
    return <EmptyState icon="celebration" title="Nothing coming up" body={`No Gatherings planned yet. Showing: ${filter}.`} />;
  }

  const [next] = rows;
  const nextKind = gatheringKindInfo(next.kind);
  const open = (row: GatheringRow) => router.push(`/gift-nook/gathering/${row.id}`);

  // Grouped by month, so a long year reads like a calendar.
  const months: { label: string; rows: GatheringRow[] }[] = [];
  for (const row of rows) {
    const label = new Date(row.ends_at).toLocaleDateString(undefined, { month: "long", year: "numeric" });
    const last = months[months.length - 1];
    if (last?.label === label) last.rows.push(row);
    else months.push({ label, rows: [row] });
  }

  let index = 0;
  return (
    <>
      <Tap onPress={() => open(next)} accessibilityRole="button">
        <ColorCard {...card}>
          <Text style={[styles.eyebrow, { color: palette.muted }]}>NEXT UP</Text>
          <View style={[ui.row, { gap: 14 }]}>
            <IconBadge name={nextKind.icon} size={56} color={palette.deep} background="rgba(255,255,255,0.75)" />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.headline, { color: palette.text }]} numberOfLines={2}>
                {next.title}
              </Text>
              <Text style={[styles.note, { color: palette.muted }]}>
                {new Date(next.ends_at).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
              </Text>
            </View>
          </View>
          <View style={[ui.row, { justifyContent: "space-between" }]}>
            <Pill palette={palette} text={countdown(next.ends_at)} />
            <Text style={[styles.note, { color: palette.muted }]}>
              {rows.length} coming up
            </Text>
          </View>
        </ColorCard>
      </Tap>
      <Text style={[ui.muted, { textAlign: "center" }]}>{filter}</Text>

      {months.map((month) => (
        <View key={month.label} style={{ gap: 10 }}>
          <SectionHeader title={month.label} icon="calendar" />
          {month.rows.map((row) => {
            const kind = gatheringKindInfo(row.kind);
            const date = new Date(row.ends_at).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
            return (
              <NavCard
                key={row.id}
                index={index++}
                icon={kind.icon}
                iconColor={palette.deep}
                iconBackground={`${palette.deep}1f`}
                title={row.title}
                subtitle={[date, row.burrows?.name].filter(Boolean).join(" · ")}
                right={<Text style={[ui.muted, { color: colors.bark, fontWeight: "600" }]}>{countdown(row.ends_at)}</Text>}
                onPress={() => open(row)}
              />
            );
          })}
        </View>
      ))}
    </>
  );
}

// --- Reminders (checklists, shopping lists) -----------------------------------------

function RemindersPage({
  widget,
  widgetId,
  layoutRef,
  saveWidget,
  ...card
}: CardProps & {
  widget: WidgetOf<"reminders">;
  widgetId: string;
  layoutRef: { current: HearthLayout };
  saveWidget: (widget: WidgetOf<"reminders">) => void;
}) {
  const { palette } = card;
  const items = widget.settings.items;
  const toDo = items.filter((r) => !r.done);
  const checked = items.filter((r) => r.done);
  const [draft, setDraft] = useState("");
  // What's actually scheduled on this phone right now, and a queue so
  // quick taps reschedule one after another.
  const onPhone = useRef<Reminder[]>(items);
  const queue = useRef<Promise<void>>(Promise.resolve());

  function latestItems() {
    const where = locate(layoutRef.current, widgetId);
    return where?.item.kind === "widget" && where.item.widget.kind === "reminders" ? where.item.widget.settings.items : null;
  }

  // The list changes on screen straight away; phone alerts catch up after.
  function change(next: Reminder[]) {
    saveWidget({ ...widget, settings: { ...widget.settings, items: next } });
    queue.current = queue.current.then(async () => {
      const wanted = latestItems();
      if (!wanted) return;
      const synced = await syncReminders(widget.title, wanted, onPhone.current).catch(() => null);
      if (!synced) return;
      onPhone.current = synced;
      const ids = new Map(synced.map((r) => [r.id, r.notificationId]));
      const now = latestItems();
      if (!now || now.every((r) => !ids.has(r.id) || r.notificationId === ids.get(r.id))) return;
      saveWidget({
        ...widget,
        settings: { ...widget.settings, items: now.map((r) => (ids.has(r.id) ? { ...r, notificationId: ids.get(r.id) } : r)) },
      });
    });
  }

  function toggle(reminder: Reminder) {
    tap(reminder.done ? "light" : "success");
    change(items.map((r) => (r.id === reminder.id ? { ...r, done: !r.done } : r)));
  }

  function add() {
    const text = draft.trim();
    if (!text) return;
    tap();
    change([...items, { id: newReminderId(), text, done: false }]);
    setDraft("");
  }

  function remove(reminder: Reminder) {
    Alert.alert(`Remove “${reminder.text || "this one"}”?`, undefined, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => change(items.filter((r) => r.id !== reminder.id)) },
    ]);
  }

  function clearChecked() {
    Alert.alert(`Clear ${checked.length} checked-off item${checked.length === 1 ? "" : "s"}?`, undefined, [
      { text: "Cancel", style: "cancel" },
      { text: "Clear", style: "destructive", onPress: () => change(items.filter((r) => !r.done)) },
    ]);
  }

  const row = (reminder: Reminder) => (
    <Animated.View key={reminder.id} entering={FadeIn.duration(200)} layout={LinearTransition.springify().damping(20)}>
      <Tap
        onPress={() => toggle(reminder)}
        onLongPress={() => remove(reminder)}
        style={[ui.card, styles.reminder]}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: reminder.done }}
      >
        <View style={[styles.check, { borderColor: palette.deep }, reminder.done && { backgroundColor: palette.deep }]}>
          {reminder.done ? <Icon name="check" size={15} color="#ffffff" /> : null}
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[ui.cardTitle, reminder.done && styles.done]}>{reminder.text || "Untitled"}</Text>
          {reminder.schedule ? (
            <View style={[ui.row, { gap: 5 }]}>
              <Icon name="bell" size={12} color={colors.muted} />
              <Text style={[ui.muted, { fontSize: 13 }]}>{describeSchedule(reminder.schedule)}</Text>
            </View>
          ) : null}
        </View>
      </Tap>
    </Animated.View>
  );

  return (
    <>
      <ColorCard {...card}>
        <View style={[ui.row, { justifyContent: "space-between", alignItems: "flex-end" }]}>
          <View>
            <Text style={[styles.huge, { color: palette.text, fontSize: 52 }]}>
              {items.length && !toDo.length ? "All done!" : toDo.length}
            </Text>
            {items.length && !toDo.length ? null : (
              <Text style={[styles.lead, { color: palette.text }]}>{toDo.length === 1 ? "thing to do" : "things to do"}</Text>
            )}
          </View>
          {items.length ? (
            <Text style={[styles.note, { color: palette.muted }]}>
              {checked.length} of {items.length} checked off
            </Text>
          ) : null}
        </View>
        {items.length ? <ProgressBar palette={palette} done={checked.length} total={items.length} /> : null}
      </ColorCard>

      <SectionHeader title="To do" icon="todo" />
      {toDo.map(row)}
      {items.length && !toDo.length ? (
        <Text style={[ui.muted, { textAlign: "center" }]}>Everything's checked off. Nice work!</Text>
      ) : null}

      <View style={[ui.row, { gap: 10 }]}>
        <TextInput
          style={[ui.input, { flex: 1 }]}
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={add}
          submitBehavior="submit"
          returnKeyType="done"
          placeholder={items.length ? "Add something…" : "Add your first item…"}
          placeholderTextColor={colors.muted}
        />
        <Tap
          onPress={add}
          disabled={!draft.trim()}
          pressedScale={0.88}
          style={[styles.addButton, { backgroundColor: colors.bark }]}
          accessibilityLabel="Add to the list"
        >
          <Icon name="add" size={22} color={colors.onAccent} />
        </Tap>
      </View>

      {checked.length ? (
        <>
          <SectionHeader title="Checked off" icon="check" />
          {checked.map(row)}
          <View style={[ui.row, { gap: 10 }]}>
            <Button
              title="Uncheck all"
              icon="undo"
              variant="secondary"
              style={{ flex: 1 }}
              onPress={() => change(items.map((r) => ({ ...r, done: false })))}
            />
            <Button title="Clear them" icon="trash" variant="secondary" style={{ flex: 1 }} onPress={clearChecked} />
          </View>
        </>
      ) : null}

      <Text style={[ui.muted, { textAlign: "center", fontSize: 13 }]}>
        Tap to check off · hold to remove{items.some((r) => r.schedule) ? " · set alert times in Edit" : ""}
      </Text>
    </>
  );
}

// --- Sticky note ----------------------------------------------------------------------

function NotePage({ widget, onEdit, ...card }: CardProps & { widget: WidgetOf<"note">; onEdit: () => void }) {
  const { palette } = card;
  const { text, textSize, align } = widget.settings;
  const [height, setHeight] = useState(0);
  const fontSize = { small: 17, medium: 21, large: 27 }[textSize];
  const lineHeight = Math.round(fontSize * 1.45);

  if (!text) {
    return (
      <>
        <EmptyState icon="edit" title="This note is blank" body="Write anything you want to see every day." />
        <Button title="Write something" icon="edit" onPress={onEdit} />
      </>
    );
  }

  return (
    <View style={{ paddingTop: 12 }}>
      {widget.look === "soft" ? <View style={styles.tape} /> : null}
      <ColorCard {...card}>
        <View style={{ minHeight: 320 }} onLayout={(e) => setHeight(e.nativeEvent.layout.height)}>
          {widget.look !== "bold" ? (
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              {Array.from({ length: Math.floor(height / lineHeight) }, (_, i) => (
                <View key={i} style={[styles.rule, { top: (i + 1) * lineHeight, borderColor: `${palette.deep}26` }]} />
              ))}
            </View>
          ) : null}
          <Text
            selectable
            style={{
              color: palette.text,
              fontSize,
              lineHeight,
              textAlign: align,
              fontWeight: textSize === "large" ? "700" : "500",
            }}
          >
            {text}
          </Text>
        </View>
      </ColorCard>
    </View>
  );
}

// --- Anything else: the widget itself, big --------------------------------------------

// `onChange` lets the buttons inside work here too (e.g. a habit's "Done today").
function BigWidget({
  item,
  themeText,
  refreshKey,
  onChange,
}: {
  item: WidgetItem;
  themeText: string;
  refreshKey: number;
  onChange: (widget: WidgetItem["widget"]) => void;
}) {
  const { width } = useWindowDimensions();
  return (
    <Appear style={{ alignItems: "center" }}>
      <WidgetView
        widget={item.widget}
        color={item.color}
        icon={item.icon}
        width={width - 40}
        height={340}
        refreshKey={refreshKey}
        themeText={themeText}
        onChange={onChange}
      />
    </Appear>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 28, padding: 20, gap: 14, overflow: "hidden" },
  watermark: { position: "absolute", right: -30, bottom: -36, opacity: 0.1, transform: [{ rotate: "-12deg" }] },
  huge: { fontSize: 72, fontWeight: "800", letterSpacing: -2, lineHeight: 80 },
  lead: { fontSize: 17, fontWeight: "600" },
  headline: { fontSize: 22, fontWeight: "800", letterSpacing: -0.3 },
  eyebrow: { fontSize: 12, fontWeight: "800", letterSpacing: 0.8 },
  note: { fontSize: 14, fontWeight: "500" },
  ticker: { flexDirection: "row", gap: 10 },
  tick: { flex: 1, alignItems: "center", paddingVertical: 14, paddingHorizontal: 4, gap: 0 },
  tickValue: { fontSize: 28, fontWeight: "800", letterSpacing: -0.5, fontVariant: ["tabular-nums"] },
  fact: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  reminder: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14 },
  check: { width: 26, height: 26, borderRadius: 9, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  done: { textDecorationLine: "line-through", opacity: 0.55 },
  addButton: { width: 50, height: 50, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  tape: {
    position: "absolute",
    top: 0,
    alignSelf: "center",
    zIndex: 2,
    width: 84,
    height: 26,
    backgroundColor: "rgba(255,255,255,0.6)",
    transform: [{ rotate: "-3deg" }],
    borderRadius: 3,
    boxShadow: "0px 1px 3px rgba(0,0,0,0.08)",
  },
  rule: { position: "absolute", left: 0, right: 0, borderBottomWidth: 1 },
});
