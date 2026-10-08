import { StatusBar } from "expo-status-bar";
import { useFocusEffect, useNavigation, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import Animated, { FadeIn, FadeOut, ZoomIn, useSharedValue } from "react-native-reanimated";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { tap } from "../../lib/feedback";
import {
  addItem,
  deepColor,
  findHollow,
  hearthThemes,
  hollowLookInfo,
  hollowLooks,
  hollowsOf,
  inScope,
  itemColor,
  moveItem,
  moveToScope,
  newItemId,
  removeHollow,
  removeItem,
  resizeItem,
  scopeItems,
  tileShadow,
  updateItem,
  useHearthLayout,
  type HearthItem,
  type HearthLayout,
  type HollowItem,
  type LabelItem,
  type NookItem,
  type Scope,
} from "../../lib/hearth";
import { findNook } from "../../lib/nooks";
import { planBirthdays } from "../../lib/plan-birthdays";
import { hasRealName, useMyProfile } from "../../lib/profile";
import { supabase } from "../../lib/supabase";
import { cancelReminders, syncReminders } from "../../lib/reminders";
import { touchesGuarded } from "../../lib/touch-guard";
import { widgetKindInfo, type WidgetConfig } from "../../lib/widgets";
import { Firelight, GlowVeil } from "../firelight";
import { Icon, IconBadge } from "../icon";
import { Skeleton, Tap } from "../motion";
import { TourScrollArea, TourTarget, useTourAutoStart, useTourScrollArea } from "../tour";
import { AddSheet } from "./add-sheet";
import { GRID_GAP, HearthGrid } from "./hearth-grid";
import { HollowFace } from "./hollow-face";
import { TileFace } from "./tile-face";
import { ItemOptions, type MoveTarget } from "./tile-options";
import { WidgetView } from "./widgets";

const PADDING = 20;

// One screen for the Hearth and for the inside of every Hollow
// (CORE-002/003/006-010/018/019/022-024). `scope` is null for the Hearth, or
// a Hollow's id. Both are free-form grids you design: Nook tiles, widgets and
// text placed and sized however you like. Tap Edit (or hold anything) to
// drag items anywhere, resize them from the corner, and add things. On the
// Hearth you can also add Hollows, drop tiles onto them to put them inside,
// and tap one to open its door and step in.
export function HearthScreen({ scope }: { scope: Scope }) {
  const router = useRouter();
  const { layout, save, isLoading, error, reload } = useHearthLayout();
  const theme = hearthThemes[layout.theme] ?? hearthThemes.hearth;
  const hollow = scope ? findHollow(layout, scope) : null;
  const items = scopeItems(layout, scope);

  const [editing, setEditing] = useState(false);
  const [gridWidth, setGridWidth] = useState(0);
  const [optionsFor, setOptionsFor] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [openingHollow, setOpeningHollow] = useState<string | null>(null);
  // Inside a Hollow: the sheet for the Hollow itself (name, look, color, size).
  const [hollowOptions, setHollowOptions] = useState(false);
  const entering = useRef(false);
  const navigation = useNavigation();
  const tourScroll = useTourScrollArea();
  const { profile } = useMyProfile();
  const insets = useSafeAreaInsets();
  const [barHeight, setBarHeight] = useState(0);

  // Auto-scroll while dragging (CORE-029): hold an item near the top or
  // bottom of the screen and the page scrolls along with it. The grid
  // reports how fast (onEdge); this runs the scrolling frame by frame and
  // tells dragged items how far the page has moved.
  const scrollY = useSharedValue(0);
  const viewTop = useSharedValue(0);
  const viewBottom = useSharedValue(0);
  const viewHeight = useRef(0);
  const edgeSpeed = useRef(0);
  const frame = useRef<number | null>(null);
  const draggingNow = useRef(false);

  const measureViewport = useCallback(() => {
    tourScroll.area.viewport.current?.measureInWindow((_x, y, _width, height) => {
      viewTop.value = y;
      viewBottom.value = y + height;
      viewHeight.current = height;
    });
  }, [tourScroll.area.viewport, viewTop, viewBottom]);

  const setEdge = useCallback(
    (speed: number) => {
      edgeSpeed.current = speed;
      if (speed === 0 || frame.current !== null) return;
      const tick = () => {
        const step = edgeSpeed.current;
        if (!step) {
          frame.current = null;
          return;
        }
        const metrics = tourScroll.area.metrics.current;
        const max = Math.max(0, metrics.content - viewHeight.current);
        const next = Math.min(max, Math.max(0, metrics.offset + step));
        if (next !== metrics.offset) {
          metrics.offset = next;
          scrollY.value = next;
          tourScroll.scrollRef.current?.scrollTo({ y: next, animated: false });
        }
        frame.current = requestAnimationFrame(tick);
      };
      frame.current = requestAnimationFrame(tick);
    },
    [tourScroll.area.metrics, tourScroll.scrollRef, scrollY]
  );
  useEffect(
    () => () => {
      edgeSpeed.current = 0;
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    },
    []
  );
  const dragScroll = useMemo(
    () => ({ scrollY, top: viewTop, bottom: viewBottom, onEdge: setEdge }),
    [scrollY, viewTop, viewBottom, setEdge]
  );

  function onDraggingChange(isDragging: boolean) {
    draggingNow.current = isDragging;
    setDragging(isDragging);
    if (isDragging) measureViewport();
    else setEdge(0);
  }

  // While the page is being scrolled for a drag, its own scroll events lag
  // behind and would only fight us; otherwise they keep everything in sync.
  const scrollProps = {
    ...tourScroll.scrollProps,
    onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = event.nativeEvent.contentOffset.y;
      if (edgeSpeed.current !== 0) return;
      tourScroll.scrollProps.onScroll(event);
      if (!draggingNow.current) scrollY.value = y;
    },
  };
  const unread = useUnreadCount(!scope, refreshKey);

  // The first time someone lands on their Hearth, show them around (CORE-026).
  useTourAutoStart(!scope && !isLoading && !error);

  // On the Hearth, tuck the tab bar away while a sheet is open so the sheet
  // reaches the bottom of the screen (CORE-025).
  const sheetOpen = adding || optionsFor !== null;
  useEffect(() => {
    if (!scope) navigation.setOptions({ tabBarStyle: sheetOpen ? { display: "none" } : undefined });
  }, [scope, sheetOpen, navigation]);

  // Each time this screen comes back into view: refresh widgets, close any
  // Hollow door we walked through, and (on the Hearth) make sure upcoming
  // family birthdays have their Gatherings (GIFT-035).
  useFocusEffect(
    useCallback(() => {
      setRefreshKey((k) => k + 1);
      setOpeningHollow(null);
      entering.current = false;
      if (!scope) planBirthdays().then((created) => created && setRefreshKey((k) => k + 1));
    }, [scope])
  );

  function persist(next: HearthItem[]) {
    save({ items: next }).catch((saveError: Error) => Alert.alert("Couldn't save your Hearth", saveError.message));
  }
  // Apply an edit to whatever this screen is showing (Hearth or a Hollow).
  function persistHere(edit: (inner: HearthLayout) => HearthItem[]) {
    persist(inScope(layout, scope, edit));
  }

  function openNook(nookId: string) {
    const route = findNook(nookId)?.route;
    if (route) router.push(route);
  }

  // Tapping a widget outside edit mode: widgets that are a window onto your
  // own stuff (Inbox, Gifts to buy) open that list; every other widget opens
  // its own settings — never somewhere you didn't ask to go.
  function openWidget(item: HearthItem & { kind: "widget" }) {
    switch (item.widget.kind) {
      case "tucks":
        return router.push("/gift-nook/my-tucks");
      case "inbox":
        return router.push("/inbox");
      case "greeting":
        return;
      default:
        return router.push(`/widget/${item.id}`);
    }
  }

  function enterHollow(id: string) {
    if (entering.current) return;
    entering.current = true;
    router.push(`/hollow/${id}`);
  }

  function onPressItem(item: HearthItem) {
    // A checkbox inside a widget was just pressed; that's not an "open".
    if (touchesGuarded()) return;
    if (item.kind === "widget") {
      if (editing) router.push(`/widget/${item.id}`);
      else openWidget(item);
    } else if (editing) {
      setOptionsFor(item.id);
    } else if (item.kind === "nook") {
      openNook(item.nookId);
    } else if (item.kind === "hollow") {
      tap();
      setOpeningHollow(item.id); // the door swings open, then we step in
    }
  }

  async function changeWidget(item: HearthItem & { kind: "widget" }, widget: WidgetConfig) {
    if (widget.kind === "reminders" && item.widget.kind === "reminders") {
      const synced = await syncReminders(widget.title, widget.settings.items, item.widget.settings.items);
      widget = { ...widget, settings: { ...widget.settings, items: synced } };
    }
    persistHere((inner) => updateItem(inner, item.id, { widget } as Partial<HearthItem>));
  }

  function addWidget(widget: WidgetConfig) {
    setAdding(false);
    const size = widgetKindInfo(widget.kind).size;
    const id = newItemId("w");
    const next = inScope(layout, scope, (inner) => addItem(inner, { id, kind: "widget", widget, ...size }));
    save({ items: next })
      .then(async () => {
        tap("success");
        // Ready-made ideas may come with reminders to schedule.
        if (widget.kind === "reminders" && widget.settings.items.some((r) => r.schedule)) {
          const synced = await syncReminders(widget.title, widget.settings.items, []);
          const withIds = { ...widget, settings: { ...widget.settings, items: synced } };
          save({
            items: inScope({ ...layout, items: next }, scope, (inner) =>
              updateItem(inner, id, { widget: withIds } as Partial<HearthItem>)
            ),
          }).catch(() => {});
        }
        router.push(`/widget/${id}`);
      })
      .catch((saveError: Error) => Alert.alert("Couldn't add it", saveError.message));
  }

  function addLabel() {
    setAdding(false);
    const id = newItemId("l");
    persistHere((inner) =>
      addItem(inner, { id, kind: "label", text: scope ? "Up top" : "My Nooks", size: "heading", align: "left", w: 4, h: 1 })
    );
    setEditing(true);
    setOptionsFor(id);
  }

  function addHollow() {
    setAdding(false);
    const id = newItemId("h");
    const count = hollowsOf(layout).length;
    persist(
      addItem(layout, {
        id,
        kind: "hollow",
        name: count ? `Hollow ${count + 1}` : "My Hollow",
        look: hollowLooks[count % hollowLooks.length].look,
        items: [],
        w: 2,
        h: 2,
      })
    );
    tap("success");
    setEditing(true);
    setOptionsFor(id); // name it and pick its look straight away
  }

  function remove(item: HearthItem) {
    if (item.kind === "hollow") return persist(removeHollow(layout, item.id));
    if (item.kind === "widget" && item.widget.kind === "reminders") cancelReminders(item.widget.settings.items);
    persistHere((inner) => removeItem(inner, item.id));
  }

  const optionsItem = (items.find((i) => i.id === optionsFor && i.kind !== "widget") ?? null) as
    | NookItem
    | LabelItem
    | HollowItem
    | null;

  // Where the item in the options sheet could move to.
  const moveTargets: MoveTarget[] = [
    ...(scope ? [{ scope: null, label: "The Hearth" }] : []),
    ...hollowsOf(layout)
      .filter((h) => h.id !== scope && h.id !== optionsFor)
      .map((h) => ({ scope: h.id, label: h.name })),
  ];

  const isEmpty = items.length === 0;

  function renderItem(item: HearthItem, size: { width: number; height: number }) {
    if (item.kind === "nook") return <TileFace item={item} {...size} refreshKey={refreshKey} themeText={theme.text} />;
    if (item.kind === "hollow") {
      return (
        <HollowFace
          item={item}
          {...size}
          opening={openingHollow === item.id}
          onOpened={() => enterHollow(item.id)}
        />
      );
    }
    if (item.kind === "widget") {
      return (
        <WidgetView
          widget={item.widget}
          color={item.color}
          icon={item.icon}
          {...size}
          refreshKey={refreshKey}
          themeText={theme.text}
          onChange={editing ? undefined : (widget) => changeWidget(item, widget)}
        />
      );
    }
    const fontSize = { title: 30, heading: 19, caption: 14 }[item.size];
    return (
      <View style={[size, { justifyContent: "flex-end", paddingHorizontal: 4, paddingBottom: 2 }]}>
        <Text
          numberOfLines={2}
          style={{
            fontSize,
            fontWeight: item.size === "caption" ? "500" : "800",
            textAlign: item.align,
            color: item.color ? deepColor(item.color) : item.size === "caption" ? theme.muted : theme.text,
            letterSpacing: item.size === "title" ? -0.5 : 0,
          }}
        >
          {item.text}
        </Text>
      </View>
    );
  }

  // A Hollow that's been removed (e.g. from another phone) while we're inside.
  if (scope && !isLoading && !hollow) {
    return (
      <SafeAreaView style={[styles.fill, styles.center, { backgroundColor: theme.background }]}>
        <IconBadge name="burrow" size={64} color={theme.accent} background={`${theme.accent}1f`} />
        <Text style={[styles.emptyTitle, { color: theme.text }]}>This Hollow is gone</Text>
        <Tap onPress={() => router.back()} style={[styles.outlineButton, { borderColor: theme.accent }]}>
          <Text style={{ color: theme.accent, fontWeight: "600" }}>Back to the Hearth</Text>
        </Tap>
      </SafeAreaView>
    );
  }

  const title = scope ? hollow?.name ?? "" : layout.title || "The Hearth";

  return (
    <View style={[styles.fill, { backgroundColor: theme.background }]}>
      <Firelight variant="hearth" color={theme.glow} strength={layout.theme === "dusk" ? 0.34 : 0.26} />
      <SafeAreaView style={styles.fill} edges={["top", "left", "right"]}>
        <StatusBar style={layout.theme === "dusk" ? "light" : "dark"} />
        {/* The top bar stays put while the Hearth scrolls beneath it, so the
            inbox and Edit are always in reach. */}
        <View style={styles.topBar} onLayout={(e) => setBarHeight(e.nativeEvent.layout.height)}>
          {scope ? (
            <Tap
              onPress={() => router.back()}
              hitSlop={12}
              pressedScale={0.9}
              style={[styles.back]}
              accessibilityLabel="Back to the Hearth"
            >
              <Icon name="hearth" size={18} color={theme.accent} />
              <Text style={{ color: theme.accent, fontSize: 16, fontWeight: "600" }}>Hearth</Text>
            </Tap>
          ) : null}

          <View style={styles.header}>
            <View style={styles.titleRow}>
              {hollow ? (
                <IconBadge
                  name={hollowLookInfo(hollow.look).icon}
                  size={44}
                  color={deepColor(itemColor(hollow))}
                  background={itemColor(hollow)}
                />
              ) : (
                <View style={[styles.flame, { backgroundColor: `${theme.accent}1f`, boxShadow: `0px 0px 12px 0px ${theme.glow}66` }]}>
                  <Icon name="flame" size={26} color={theme.accent} />
                </View>
              )}
              <View style={{ flexShrink: 1 }}>
                {scope ? null : (
                  <Text style={[styles.greeting, { color: theme.accent }]} numberOfLines={1}>
                    {greeting(profile && hasRealName(profile.display_name) ? profile.display_name!.trim().split(" ")[0] : null)}
                  </Text>
                )}
                <Text style={[styles.title, { color: theme.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                  {title}
                </Text>
              </View>
            </View>
            <View style={styles.headerButtons}>
              {editing ? (
                <Tap onPress={() => setAdding(true)} hitSlop={10} pressedScale={0.85} accessibilityLabel="Add">
                  <Icon name="add" size={24} color={theme.accent} />
                </Tap>
              ) : null}
              <TourTarget id="hearth-edit">
                <Tap
                  onPress={() => {
                    tap();
                    setEditing((e) => !e);
                  }}
                  hitSlop={10}
                  style={[
                    styles.editButton,
                    { backgroundColor: editing ? theme.accent : "transparent", borderColor: theme.accent },
                  ]}
                >
                  <Text style={[styles.headerButton, { color: editing ? theme.background : theme.accent }]}>
                    {editing ? "Done" : "Edit"}
                  </Text>
                </Tap>
              </TourTarget>
              {scope ? null : (
                <TourTarget id="hearth-inbox">
                  <InboxBell
                    unread={unread}
                    color={theme.accent}
                    background={theme.background}
                    onPress={() => router.push("/inbox")}
                  />
                </TourTarget>
              )}
              {/* The Hearth's own settings are in the Settings tab. */}
              {hollow ? (
                <Tap
                  onPress={() => setHollowOptions(true)}
                  hitSlop={10}
                  pressedScale={0.85}
                  accessibilityLabel={`${hollow.name} settings`}
                >
                  <Icon name="settings" size={24} color={theme.accent} />
                </Tap>
              ) : null}
            </View>
          </View>
        </View>

        <TourScrollArea area={tourScroll.area}>
          <ScrollView
            ref={tourScroll.scrollRef as never}
            {...scrollProps}
            contentContainerStyle={styles.container}
            scrollEnabled={!dragging}
            keyboardShouldPersistTaps="handled"
          >
            {editing ? (
              <Animated.View
                entering={FadeIn.duration(200)}
                exiting={FadeOut.duration(150)}
                style={[styles.hint, { backgroundColor: `${theme.accent}18` }]}
              >
                <Icon name="drag" size={18} color={theme.accent} />
                <Text style={{ color: theme.text, flex: 1 }}>
                  {scope
                    ? "Hold anything and drag it anywhere. Drag a corner to resize. Tap to customize or move it back to the Hearth."
                    : "Hold anything and drag it anywhere — or onto a Hollow to put it inside. Drag a corner to resize. Tap to customize, or + to add."}
                </Text>
              </Animated.View>
            ) : null}

            <View onLayout={(e) => setGridWidth(e.nativeEvent.layout.width)}>
              {error ? (
                <View style={{ gap: 8 }}>
                  <Text style={{ color: "#c0392b" }}>Couldn't load your Hearth: {error}</Text>
                  <Tap onPress={reload} style={[styles.outlineButton, { borderColor: theme.accent }]}>
                    <Text style={{ color: theme.accent, fontWeight: "600" }}>Try again</Text>
                  </Tap>
                </View>
              ) : isLoading ? (
                <View style={styles.skeletons}>
                  {[0, 1, 2, 3].map((i) => (
                    <Skeleton key={i} height={gridWidth ? (gridWidth - GRID_GAP) / 2 : 160} width="48%" radius={24} />
                  ))}
                </View>
              ) : isEmpty ? (
                <Animated.View entering={FadeIn.duration(250)} style={[styles.emptyCard, { borderColor: theme.muted }]}>
                  <IconBadge name={scope ? "burrow" : "hearth"} size={72} color={theme.accent} background={`${theme.accent}1f`} />
                  <Text style={[styles.emptyTitle, { color: theme.text }]}>
                    {scope ? "Nothing in here yet" : "Make this place yours"}
                  </Text>
                  <Text style={{ color: theme.muted, textAlign: "center" }}>
                    {scope
                      ? "Add widgets or text here, or go back to your Hearth and drag Nooks and widgets onto this Hollow."
                      : "Add a Nook from the Market, or a widget — a countdown, reminders, a note — and arrange it all however you like."}
                  </Text>
                  <TourTarget id="hearth-add" style={{ alignSelf: "stretch" }}>
                    <Tap style={[styles.addButton, { backgroundColor: theme.accent }]} onPress={() => setAdding(true)}>
                      <Icon name="add" size={18} color={theme.background} />
                      <Text style={[styles.addButtonText, { color: theme.background }]}>
                        {scope ? "Add something" : "Add to your Hearth"}
                      </Text>
                    </Tap>
                  </TourTarget>
                  {scope ? null : (
                    <TourTarget id="hearth-market" style={{ alignSelf: "stretch" }}>
                      <Tap
                        style={[styles.outlineButton, { borderColor: theme.accent }]}
                        onPress={() => router.push("/market")}
                      >
                        <Icon name="market" size={18} color={theme.accent} />
                        <Text style={{ color: theme.accent, fontWeight: "600" }}>Visit the Market</Text>
                      </Tap>
                    </TourTarget>
                  )}
                </Animated.View>
              ) : (
                <HearthGrid
                  items={items}
                  width={gridWidth}
                  editing={editing}
                  accent={theme.accent}
                  shadow={tileShadow(layout.theme)}
                  onMove={(id, x, y) => persistHere((inner) => moveItem(inner, id, x, y))}
                  onResize={(id, w, h) => persistHere((inner) => resizeItem(inner, id, w, h))}
                  onDropIntoHollow={
                    scope
                      ? undefined
                      : (id, hollowId) => {
                          tap("success");
                          persist(moveToScope(layout, id, hollowId));
                        }
                  }
                  onPressItem={onPressItem}
                  onLongPress={() => setEditing(true)}
                  onDraggingChange={onDraggingChange}
                  dragScroll={dragScroll}
                  renderItem={renderItem}
                />
              )}
            </View>

            {!isEmpty && !isLoading ? (
              <View style={[styles.footerRow, { marginTop: 8 }]}>
                <TourTarget id="hearth-add" style={{ flex: 1 }}>
                  <Tap style={[styles.addButton, { backgroundColor: theme.accent }]} onPress={() => setAdding(true)}>
                    <Icon name="widgets" size={18} color={theme.background} />
                    <Text style={[styles.addButtonText, { color: theme.background }]}>Add</Text>
                  </Tap>
                </TourTarget>
                {scope ? null : (
                  <TourTarget id="hearth-market" style={{ flex: 1 }}>
                    <Tap
                      style={[styles.outlineButton, { borderColor: theme.accent }]}
                      onPress={() => router.push("/market")}
                    >
                      <Icon name="market" size={18} color={theme.accent} />
                      <Text style={{ color: theme.accent, fontWeight: "600" }}>Market</Text>
                    </Tap>
                  </TourTarget>
                )}
              </View>
            ) : null}
          </ScrollView>
        </TourScrollArea>
      </SafeAreaView>

      {/* Content melts away under the top bar instead of meeting a hard edge. */}
      {barHeight > 0 ? (
        <GlowVeil
          top={insets.top + barHeight}
          height={16}
          background={theme.background}
          color={theme.glow}
          strength={layout.theme === "dusk" ? 0.34 : 0.26}
        />
      ) : null}

      {/* Sheets sit inside the screen (not system pop-ups) so opening another
          screen from them can't collide with a half-dismissed pop-up. */}
      <ItemOptions
        item={optionsItem}
        onChange={(changes) => optionsFor && persistHere((inner) => updateItem(inner, optionsFor, changes))}
        onResize={(w, h) => optionsFor && persistHere((inner) => resizeItem(inner, optionsFor, w, h))}
        onOpen={
          optionsItem?.kind === "nook"
            ? () => {
                const nookId = optionsItem.nookId;
                setOptionsFor(null);
                openNook(nookId);
              }
            : optionsItem?.kind === "hollow"
              ? () => {
                  const id = optionsItem.id;
                  setOptionsFor(null);
                  setEditing(false);
                  setOpeningHollow(id);
                }
              : undefined
        }
        onRemove={() => {
          const item = optionsItem;
          setOptionsFor(null);
          if (item) remove(item);
        }}
        onClose={() => setOptionsFor(null)}
        moveTargets={moveTargets}
        onMoveTo={(target) => {
          const id = optionsFor;
          setOptionsFor(null);
          if (id) persist(moveToScope(layout, id, target));
        }}
      />

      {hollow ? (
        <ItemOptions
          item={hollowOptions ? hollow : null}
          onChange={(changes) => persist(updateItem(layout, hollow.id, changes))}
          onResize={(w, h) => persist(resizeItem(layout, hollow.id, w, h))}
          onRemove={() => {
            setHollowOptions(false);
            persist(removeHollow(layout, hollow.id));
            router.back();
          }}
          onClose={() => setHollowOptions(false)}
        />
      ) : null}

      <AddSheet
        visible={adding}
        onClose={() => setAdding(false)}
        onAddWidget={addWidget}
        onAddLabel={addLabel}
        onAddHollow={scope ? undefined : addHollow}
        hollowName={hollow?.name}
        onOpenMarket={() => {
          setAdding(false);
          router.push("/market");
        }}
      />
    </View>
  );
}

// "Good evening, Josh" for the top of the Hearth.
function greeting(name: string | null) {
  const hour = new Date().getHours();
  const hello = hour < 5 ? "Up late" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  return name ? `${hello}, ${name}` : hello;
}

// How many unread notices are waiting, for the Hearth's inbox bell.
function useUnreadCount(enabled: boolean, refreshKey: number) {
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .is("read_at", null)
      .then(({ count }) => {
        if (!cancelled) setUnread(count ?? 0);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, refreshKey]);
  return unread;
}

// The inbox, top right of the Hearth: a bell with a little count when
// there's something new to look at.
function InboxBell({
  unread,
  color,
  background,
  onPress,
}: {
  unread: number;
  color: string;
  background: string;
  onPress: () => void;
}) {
  return (
    <Tap
      onPress={onPress}
      hitSlop={10}
      pressedScale={0.85}
      accessibilityRole="button"
      accessibilityLabel={unread ? `Inbox, ${unread} unread` : "Inbox"}
    >
      <Icon name="bell" size={24} color={color} bounce={unread || undefined} />
      {unread > 0 ? (
        <Animated.View
          key={unread}
          entering={ZoomIn.springify().damping(12)}
          style={[styles.badge, { borderColor: background }]}
        >
          <Text style={styles.badgeText}>{unread > 9 ? "9+" : unread}</Text>
        </Animated.View>
      ) : null}
    </Tap>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  badge: {
    position: "absolute",
    top: -6,
    right: -9,
    minWidth: 19,
    height: 19,
    borderRadius: 10,
    borderWidth: 2,
    paddingHorizontal: 4,
    backgroundColor: "#c2415a",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: "#ffffff", fontSize: 10.5, fontWeight: "800" },
  center: { alignItems: "center", justifyContent: "center", gap: 14, padding: 24 },
  container: { padding: PADDING, paddingTop: 16, gap: 16, paddingBottom: 32 },
  topBar: { paddingHorizontal: PADDING, paddingTop: 6, paddingBottom: 14, zIndex: 5 },
  back: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", marginBottom: 6 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 12, flexShrink: 1 },
  flame: { width: 46, height: 46, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  greeting: { fontSize: 11.5, fontWeight: "800", letterSpacing: 1.1, textTransform: "uppercase", marginBottom: 1 },
  title: { fontSize: 30, fontWeight: "800", flexShrink: 1, letterSpacing: -0.6 },
  headerButtons: { flexDirection: "row", alignItems: "center", gap: 16 },
  headerButton: { fontSize: 15, fontWeight: "700" },
  editButton: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 5 },
  hint: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 16 },
  skeletons: { flexDirection: "row", flexWrap: "wrap", gap: GRID_GAP },
  emptyCard: { alignItems: "center", gap: 10, padding: 24, borderWidth: 1, borderStyle: "dashed", borderRadius: 24 },
  emptyTitle: { fontSize: 19, fontWeight: "800" },
  footerRow: { flexDirection: "row", gap: 12 },
  outlineButton: {
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  addButton: { borderRadius: 16, padding: 15, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  addButtonText: { fontSize: 16, fontWeight: "600" },
});
