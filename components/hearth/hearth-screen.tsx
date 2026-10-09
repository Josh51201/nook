import { StatusBar } from "expo-status-bar";
import { useFocusEffect, useNavigation, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { FixedTextSize, Text } from "../text";
import { HelpButton } from "../help-button";
import { Gesture, GestureDetector, ScrollView } from "react-native-gesture-handler";
import Animated, {
  FadeIn,
  FadeOut,
  ZoomIn,
  scrollTo,
  useAnimatedRef,
  useFrameCallback,
  useReducedMotion,
  useScrollOffset,
  useSharedValue,
} from "react-native-reanimated";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "../../lib/auth-context";
import { activeAmbience, effectiveWallpaper, wallpaperPath, type Ambience, type Corners, type TileShape, type Wallpaper } from "../../lib/decor";
import { tap } from "../../lib/feedback";
import { keepPhotosForScenes, removeUnusedPhotos } from "../../lib/hearth-photos";
import {
  defaultScenes,
  removeScene,
  renameScene,
  saveScene,
  sceneForNow,
  scenePhotoPaths,
  setSchedule,
  switchScene,
  type SceneSchedule,
  type ScenesState,
} from "../../lib/hearth-scenes";
import { useNookSettings } from "../../lib/nook-settings";
import { addEmptyPage, addPage, neighbourPage, removePage, renamePage, switchPage } from "../../lib/hearth-pages";
import { foldItems, hiddenBy } from "../../lib/hearth-folds";
import { allTags, hideTagged, tagMany } from "../../lib/hearth-tags";
import { stackMates, stackPosition, visibleItems as oneOfEachStack } from "../../lib/hearth-stacks";
import type { FoundItem } from "../../lib/hearth-find";
import { copyMany, lockMany, moveManyToPage, moveManyToScope, recolorMany, removeMany } from "../../lib/hearth-select";
import { trinketInfo, type TrinketKey } from "../../lib/trinkets";
import { inSeason } from "../../lib/widget-extras";
import { colors, useTheme } from "../../lib/theme";
import {
  addItem,
  COLUMNS,
  copyItem,
  deepColor,
  everyTopLevel,
  findHollow,
  hearthThemes,
  hollowLookInfo,
  hollowLooks,
  hollowsOf,
  inScope,
  itemColor,
  locate,
  moveItem,
  nudgeItem,
  moveToScope,
  newItemId,
  tidyItems,
  nookLabel,
  removeHollow,
  removeItem,
  resizeItem,
  scopeItems,
  shadowAtLevel,
  updateItem,
  type HearthItem,
  type HearthLayout,
  type HollowItem,
  type LabelItem,
  type NookItem,
  type Scope,
  type TrinketItem,
} from "../../lib/hearth";
import { findNook } from "../../lib/nooks";
import { planBirthdays } from "../../lib/plan-birthdays";
import { hasRealName, useMyProfile } from "../../lib/profile";
import { supabase } from "../../lib/supabase";
import { cancelReminders, syncReminders } from "../../lib/reminders";
import { touchesGuarded } from "../../lib/touch-guard";
import { ambienceForWeather, weatherPlaceOf } from "../../lib/weather";
import { useWeather } from "../../lib/weather-data";
import { widgetKindInfo, type WidgetConfig } from "../../lib/widgets";
import { Firelight, GlowVeil } from "../firelight";
import { AmbienceLayer } from "./ambience";
import { DecorateSheet } from "./decorate-sheet";
import { TrinketArt } from "./trinket-art";
import { WallpaperLayer } from "./wallpaper";
import { Icon, IconBadge, type IconName } from "../icon";
import { Skeleton, Tap } from "../motion";
import { TourScrollArea, TourTarget, useTourAutoStart, useTourScrollArea } from "../tour";
import { AddSheet } from "./add-sheet";
import { GRID_GAP, HearthGrid } from "./hearth-grid";
import { PetStageContext } from "./pet-art";
import { isPetBed, PetRoamers, strideFor } from "./pet-roamer";
import { petSizeForStride } from "../../lib/hearth-pet";
import { useHearthView } from "../../lib/hearth-view";
import { canGoOnHomePage, HOME_PAGE } from "../../lib/home-hearth";
import { fullMessage, overflowing } from "../../lib/hearth-limits";
import { HollowFace } from "./hollow-face";
import { NookZoom, type ZoomRect } from "./nook-zoom";
import { nookRadii } from "./tile-face";
import { FindSheet } from "./find-sheet";
import { ScenesSheet } from "./scenes-sheet";
import { PagesSheet, PageStrip } from "./pages-sheet";
import { ColorManySheet, MoveManySheet, SelectionBar, TagManySheet, type SelectionAction, type SelectionTarget } from "./selection";
import { TagBar } from "./tag-bar";
import { StackShell } from "./stack-shell";
import { TileFace } from "./tile-face";
import { ItemOptions, type MoveTarget } from "./tile-options";
import { WidgetView } from "./widgets";
import { loadRecipesSummary } from "../../lib/recipes-data";

const PADDING = 20;
const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);

// One screen for the Hearth and for the inside of every Hollow
// (CORE-002/003/006-010/018/019/022-024). `scope` is null for the Hearth, or
// a Hollow's id. Both are free-form grids you design: Nook tiles, widgets and
// text placed and sized however you like. Tap Edit (or hold anything) to
// drag items anywhere, resize them from the corner, and add things. On the
// Hearth you can also add Hollows, drop tiles onto them to put them inside,
// and tap one to open its door and step in.
// The Hearth and its Hollows are laid out on a fixed grid, so their text
// ignores the text size setting (CORE-068); the rest of the app follows it.
export function HearthScreen(props: { scope: Scope; reveal?: string }) {
  return (
    <FixedTextSize>
      <HearthScreenBody {...props} />
    </FixedTextSize>
  );
}

function HearthScreenBody({ scope, reveal }: { scope: Scope; reveal?: string }) {
  const router = useRouter();
  // Your own pages, plus the page shared with your Home (CORE-054).
  const { layout, save, isLoading, error, reload, personal, home, showsHome, onHome } = useHearthView(scope);
  // The theme in effect right now (Dusk while the phone is dark, if asked).
  const { key: themeKey } = useTheme();
  const theme = hearthThemes[themeKey] ?? hearthThemes.hearth;
  const hollow = scope ? findHollow(layout, scope) : null;
  const items = scopeItems(layout, scope);

  const [editing, setEditing] = useState(false);
  const [gridWidth, setGridWidth] = useState(0);
  const [optionsFor, setOptionsFor] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [decorating, setDecorating] = useState(false);
  const [pagesOpen, setPagesOpen] = useState(false);
  const [finding, setFinding] = useState(false);
  const [scenesOpen, setScenesOpen] = useState(false);
  // Scenes (CORE-052) are kept in their own saved row.
  const scenesStore = useNookSettings<ScenesState>("hearth-scenes", defaultScenes);
  const scenes = scenesStore.settings;
  const scenesReady = !scenesStore.isLoading && !scenesStore.error;
  const lastAutoScene = useRef<string | null>(null);
  // Section dividers folded shut right now (CORE-064): just how it is drawn.
  const [folded, setFolded] = useState<string[]>([]);
  // Tags switched off right now (CORE-065): also just how it is drawn.
  const [hiddenTags, setHiddenTags] = useState<string[]>([]);
  // Dragging onto a page tab (CORE-051): where the tabs are, and which one
  // the dragged item is over.
  const tabRects = useSharedValue<{ id: string; x: number; y: number; w: number; h: number }[]>([]);
  const tabNodes = useRef<Record<string, View | null>>({});
  const [hoverTab, setHoverTab] = useState("");
  // A thing to bring into view and glow (from Find, CORE-063).
  const [revealId, setRevealId] = useState<string | null>(reveal ?? null);
  // Select many (CORE-060): picking several things to act on together.
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [pickSheet, setPickSheet] = useState<"move" | "color" | "tag" | null>(null);
  // Which widget of each stack is showing (CORE-050).
  const [stackShown, setStackShown] = useState<Record<string, number>>({});
  const [dragging, setDragging] = useState(false);
  // Edit started by holding an item: the tip card at the top stays away until
  // you let go, so the grid doesn't slide out from under your finger.
  const [holdStarted, setHoldStarted] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [openingHollow, setOpeningHollow] = useState<string | null>(null);
  // Inside a Hollow: the sheet for the Hollow itself (name, look, color, size).
  const [hollowOptions, setHollowOptions] = useState(false);
  const entering = useRef(false);
  const navigation = useNavigation();
  const tourScroll = useTourScrollArea();
  const { profile } = useMyProfile();
  // "Match the weather" (CORE-058) follows the place on your Weather or Window widget.
  const matchPlace = layout.ambience === "weather" ? weatherPlaceOf(everyTopLevel(layout)) : null;
  const outside = useWeather(matchPlace?.place, matchPlace?.unit ?? "f", refreshKey);
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  const [barHeight, setBarHeight] = useState(0);
  // The page row under the bar (CORE-051), so the fade starts below it.
  const [stripHeight, setStripHeight] = useState(0);

  // Auto-scroll while dragging (CORE-029): hold an item near the top or
  // bottom of the screen and the page scrolls along with it. The grid
  // reports how fast (onEdge); this runs the scrolling frame by frame and
  // tells dragged items how far the page has moved.
  // The page is scrolled on the UI thread, in step with the dragged item, so
  // the item doesn't bounce against it: the frame callback below moves the
  // page, and the item follows the page's real offset.
  const scrollView = useAnimatedRef<Animated.ScrollView>();
  const scrollY = useScrollOffset(scrollView);
  const edgeSpeed = useSharedValue(0);
  const viewHeight = useSharedValue(0);
  const contentHeight = useSharedValue(0);
  const viewTop = useSharedValue(0);
  const viewBottom = useSharedValue(0);
  // The trash can while dragging (CORE-040): where it is, whether something
  // is over it, and the last thing thrown away (to undo).
  const trashRect = useSharedValue<{ x: number; y: number; w: number; h: number } | null>(null);
  const trashRef = useRef<View>(null);
  const [overTrash, setOverTrash] = useState(false);
  const [trashArmed, setTrashArmed] = useState(false);
  // A short message along the bottom ("Removed …  Undo", "Copied …").
  const [toast, setToast] = useState<{ text: string; action?: { label: string; run: () => void } } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // A copy just made glows for a moment (CORE-039); where the grid starts.
  const [flashId, setFlashId] = useState<string | null>(null);
  const gridTop = useRef(0);
  // Reminder alerts are only cancelled once the chance to undo has passed.
  const pendingCancel = useRef<(() => void) | null>(null);
  const draggingNow = useRef(false);

  // Where each page tab is right now, for dropping an item onto one.
  function measureTabs() {
    const ids = Object.keys(tabNodes.current).filter((id) => tabNodes.current[id]);
    const found: { id: string; x: number; y: number; w: number; h: number }[] = [];
    let waiting = ids.length;
    if (!waiting) tabRects.value = [];
    for (const id of ids) {
      tabNodes.current[id]?.measureInWindow((x, y, w, h) => {
        found.push({ id, x, y, w, h });
        waiting -= 1;
        if (waiting === 0) tabRects.value = found;
      });
    }
  }

  const measureViewport = useCallback(() => {
    tourScroll.area.viewport.current?.measureInWindow((_x, y, _width, height) => {
      viewTop.value = y;
      viewBottom.value = y + height;
      viewHeight.value = height;
    });
  }, [tourScroll.area.viewport, viewTop, viewBottom, viewHeight]);

  const setEdge = useCallback(
    (speed: number) => {
      edgeSpeed.value = speed;
    },
    [edgeSpeed]
  );

  // Speeds are "pixels per 60 Hz frame"; scale by the real time between
  // frames so the page glides at the same pace however busy the phone is.
  useFrameCallback((frame) => {
    "worklet";
    const speed = edgeSpeed.value;
    if (!speed) return;
    const dt = Math.min(48, frame.timeSincePreviousFrame ?? 16.7);
    const max = Math.max(0, contentHeight.value - viewHeight.value);
    const next = Math.min(max, Math.max(0, scrollY.value + (speed * dt) / 16.7));
    if (next !== scrollY.value) scrollTo(scrollView, 0, next, false);
  });

  // The tour and "scroll to the copy" scroll the page by asking this ref.
  useEffect(() => {
    tourScroll.scrollRef.current = {
      scrollTo: (options) =>
        (scrollView.current as unknown as { scrollTo?: (o: { y: number; animated?: boolean }) => void } | null)?.scrollTo?.(
          options
        ),
    };
  }, [scrollView, tourScroll.scrollRef]);
  const dragScroll = useMemo(
    () => ({ scrollY, top: viewTop, bottom: viewBottom, onEdge: setEdge, trash: trashRect, tabs: tabRects }),
    [scrollY, viewTop, viewBottom, setEdge, trashRect, tabRects]
  );

  function onDraggingChange(isDragging: boolean) {
    draggingNow.current = isDragging;
    setDragging(isDragging);
    if (!isDragging) setHoldStarted(false);
    if (isDragging) {
      measureViewport();
      measureTabs();
    } else {
      tabRects.value = [];
      setHoverTab("");
      setEdge(0);
      trashRect.value = null;
      setOverTrash(false);
      setTrashArmed(false);
    }
  }

  const scrollProps = {
    ...tourScroll.scrollProps,
    // Frequent enough for the dragged item to follow the page smoothly.
    scrollEventThrottle: 16,
    onContentSizeChange: (width: number, height: number) => {
      tourScroll.scrollProps.onContentSizeChange(width, height);
      contentHeight.value = height;
    },
  };
  const unread = useUnreadCount(!scope, refreshKey);

  // The first time someone lands on their Hearth, show them around (CORE-026).
  useTourAutoStart(!scope && !isLoading && !error);

  // On the Hearth, tuck the tab bar away while a sheet is open so the sheet
  // reaches the bottom of the screen (CORE-025).
  // Stepping into a Nook from its tile (CORE-034).
  const [zoom, setZoom] = useState<{
    rect: ZoomRect;
    color: string;
    icon: IconName;
    iconColor: string;
    corners?: Corners;
    shape?: TileShape;
    route: string;
    direction: "in" | "out";
    pushed: boolean;
  } | null>(null);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const gridRef = useRef<View>(null);
  const reduceMotion = useReducedMotion();

  const sheetOpen = adding || decorating || pagesOpen || finding || scenesOpen || pickSheet !== null || optionsFor !== null || zoom !== null;
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
      // Back from a Nook we zoomed into: shrink back into its tile.
      const lastZoom = zoomRef.current;
      if (lastZoom?.pushed) setZoom({ ...lastZoom, direction: "out", pushed: false });
      if (!scope) planBirthdays().then((created) => created && setRefreshKey((k) => k + 1));
    }, [scope])
  );

  // A page or Hollow only holds so much (CORE-066). True, after saying so, if
  // this change would put one over.
  function tooFull(changes: Partial<HearthLayout>) {
    const space = overflowing(layout, { ...layout, ...changes });
    if (!space) return false;
    const message = fullMessage(space);
    Alert.alert(message.title, message.body);
    return true;
  }

  // Saves, unless a page or Hollow would be over its limit: then it says so
  // and returns false, so callers can skip their "done" message.
  function persist(next: HearthItem[]) {
    if (tooFull({ items: next })) return false;
    save({ items: next }).catch((saveError: Error) => Alert.alert("Couldn't save your Hearth", saveError.message));
    return true;
  }
  // Apply an edit to whatever this screen is showing (Hearth or a Hollow).
  function persistHere(edit: (inner: HearthLayout) => HearthItem[]) {
    return persist(inScope(layout, scope, edit));
  }

  // Pages of the Hearth (CORE-051). Hollows have just the one.
  function goToPage(id: string) {
    const changes = switchPage(layout, id);
    if (!changes) return;
    tap();
    setPagesOpen(false);
    save(changes).catch((saveError: Error) => Alert.alert("Couldn't change page", saveError.message));
  }
  // Photos that other scenes still need must not be cleaned up.
  useEffect(() => {
    if (scenesReady) keepPhotosForScenes(scenePhotoPaths(scenes));
  }, [scenesReady, scenes]);

  // Swap in a scene: the Hearth you're leaving is stored back into its scene
  // first, so nothing is lost (CORE-052).
  async function useScene(id: string, automatic = false) {
    if (!scenesReady || isLoading) return;
    if (scenes.active === id) return;
    // Scenes are yours alone: the Home page is never part of one.
    const result = switchScene(scenes, personal.layout, id);
    if (!result) {
      if (!automatic) {
        Alert.alert("Can't switch yet", "You have the most scenes there can be. Remove one first, so this Hearth can be kept.");
      }
      return;
    }
    const before = scenes;
    try {
      // The scenes are written first, so the Hearth you're leaving is safe.
      await scenesStore.update({ scenes: result.state.scenes, active: result.state.active });
      await personal.save({ ...result.show });
    } catch (switchError) {
      scenesStore.update({ scenes: before.scenes, active: before.active }).catch(() => {});
      Alert.alert("Couldn't switch scenes", (switchError as Error).message);
      return;
    }
    stopSelecting();
    setFolded([]);
    tap("success");
    setScenesOpen(false);
    settleToast();
    const name = result.state.scenes.find((s) => s.id === id)?.name ?? "Scene";
    const back = before.active;
    showToast(
      automatic ? `${name} is on` : `Switched to ${name}`,
      back ? { label: "Switch back", run: () => (settleToast(), void useScene(back)) } : undefined,
      5000
    );
  }

  // A scene with a schedule switches on by itself when you open the Hearth
  // in its time slot, once per change, so a scene you pick by hand stays.
  useFocusEffect(
    useCallback(() => {
      if (scope || !scenesReady || isLoading || editing) return;
      const match = sceneForNow(scenes, new Date());
      if (!match) return;
      if (match.id === scenes.active) {
        lastAutoScene.current = match.id;
        return;
      }
      if (lastAutoScene.current === match.id) return;
      lastAutoScene.current = match.id;
      void useScene(match.id, true);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scope, scenesReady, isLoading, editing, scenes, layout])
  );

  function saveCurrentScene(name: string) {
    const saved = saveScene(scenes, personal.layout, name);
    if (!saved) return Alert.alert("That's the most scenes", "Remove one to save another.");
    tap("success");
    scenesStore
      .update({ scenes: saved.state.scenes, active: saved.state.active })
      .catch((saveError: Error) => Alert.alert("Couldn't save the scene", saveError.message));
  }
  const changeScenes = (next: ScenesState) =>
    scenesStore.update({ scenes: next.scenes, active: next.active }).catch((saveError: Error) => Alert.alert("Couldn't save that", saveError.message));

  // An item dropped on a page tab moves to that page; the "New page" tab
  // makes one first (CORE-051).
  function dropOnTab(item: HearthItem, tabId: string) {
    setHoverTab("");
    let work: HearthLayout = layout;
    let target = tabId;
    let created: Pick<HearthLayout, "pages" | "otherPages"> | null = null;
    if (tabId === "new") {
      const added = addEmptyPage(layout);
      if (!added) return Alert.alert("That's the most pages", "Remove a page to make room for another.");
      created = added.changes;
      work = { ...layout, ...added.changes };
      target = added.id;
    }
    if (target === layout.activePage) return;
    if (target === HOME_PAGE && !canGoOnHomePage(item)) {
      return Alert.alert("Hollows stay on your own pages", "Put the things inside it on the Home page instead.");
    }
    const moved = moveManyToPage(work, [item.id], target);
    if (!moved) return;
    if (tooFull({ ...(created ?? {}), ...moved })) return;
    const before = { items: layout.items, otherPages: layout.otherPages };
    const name = work.pages.find((p) => p.id === target)?.name ?? "that page";
    tap("success");
    save({ ...(created ?? {}), ...moved }).catch((saveError: Error) => Alert.alert("Couldn't move it", saveError.message));
    settleToast();
    showToast(
      `Moved “${itemLabel(item)}” to ${name}`,
      {
        label: "Undo",
        run: () => {
          if (toastTimer.current) clearTimeout(toastTimer.current);
          toastTimer.current = null;
          tap();
          save(before).catch(() => {});
          setToast(null);
        },
      },
      5000
    );
  }

  function toggleLock(item: HearthItem) {
    persistHere((inner) => updateItem(inner, item.id, { locked: item.locked ? undefined : true }));
  }

  function swipePage(step: 1 | -1) {
    const next = neighbourPage(layout, step);
    if (next) goToPage(next);
  }
  function addNewPage(name: string) {
    const added = addPage(layout, name);
    if (!added) return;
    tap("success");
    setPagesOpen(false);
    save(added.changes).catch((saveError: Error) => Alert.alert("Couldn't add the page", saveError.message));
  }
  function removeAPage(id: string) {
    if (id === HOME_PAGE) return hideHomePage();
    const page = layout.pages.find((p) => p.id === id);
    Alert.alert(`Remove “${page?.name}”?`, "Everything on it moves to your first page.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          const changes = removePage(layout, id);
          if (changes) save(changes).catch((saveError: Error) => Alert.alert("Couldn't remove it", saveError.message));
        },
      },
    ]);
  }
  // The Home page can't be removed (it's everyone's), only hidden from your
  // own Hearth; Pages brings it back.
  function hideHomePage() {
    Alert.alert(`Hide “${home.name}”?`, "It stays as it is for everyone else in your Home. You can bring it back from Pages.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Hide",
        onPress: () => {
          home.setOnHomePage(false);
          personal.save({ hideHomePage: true }).catch((saveError: Error) => Alert.alert("Couldn't hide it", saveError.message));
        },
      },
    ]);
  }
  function showHomePage() {
    tap("success");
    setPagesOpen(false);
    home.setOnHomePage(true);
    personal.save({ hideHomePage: false }).catch((saveError: Error) => Alert.alert("Couldn't show it", saveError.message));
  }
  const canSwipePages = !scope && !editing && layout.pages.length > 1;
  // The page tabs show with two or more pages, and always while editing, so
  // there is somewhere to drop things.
  const showStrip = !scope && (layout.pages.length > 1 || editing);
  const knownTags = allTags(layout);
  const showTags = knownTags.length > 0 && !editing;
  const pageSwipe = Gesture.Pan()
    .runOnJS(true)
    .enabled(canSwipePages)
    .activeOffsetX([-30, 30])
    .failOffsetY([-18, 18])
    .onEnd((event) => {
      if (event.translationX < -70) swipePage(1);
      else if (event.translationX > 70) swipePage(-1);
    });

  function openNook(nookId: string) {
    const route = findNook(nookId)?.route;
    if (route) router.push(route);
  }

  // Tapping a tile: it grows to fill the screen, then the Nook appears.
  function openNookFromTile(item: NookItem) {
    const nook = findNook(item.nookId);
    if (!nook?.route) return;
    const route = nook.route;
    if (reduceMotion || !gridRef.current || zoomRef.current) return router.push(route);
    const stride = (gridWidth - GRID_GAP * (COLUMNS - 1)) / COLUMNS + GRID_GAP;
    const look = item.look ?? "soft";
    const deep = item.color ? deepColor(item.color) : nook.iconColor;
    gridRef.current.measureInWindow((gx, gy) => {
      tap();
      setZoom({
        rect: { x: gx + item.x * stride, y: gy + item.y * stride, width: item.w * stride - GRID_GAP, height: item.h * stride - GRID_GAP },
        color: look === "bold" ? deep : look === "outline" ? theme.background : itemColor(item),
        icon: item.icon ?? nook.icon,
        iconColor: look === "bold" ? "#ffffff" : deep,
        corners: item.corners,
        shape: item.shape,
        route,
        direction: "in",
        pushed: false,
      });
    });
  }

  const finishZoom = useCallback(() => {
    const current = zoomRef.current;
    if (!current) return;
    if (current.direction === "in") {
      setZoom({ ...current, pushed: true });
      router.push(current.route as never);
    } else {
      setZoom(null);
    }
  }, [router]);

  // Tapping a widget outside edit mode opens it up to see everything in it
  // (CORE-038): widgets that are a window onto your own stuff (Inbox, Gifts
  // to buy, Card season) open that list; the rest open their own page, with Edit there.
  // In edit mode a tap opens its settings instead.
  function openWidget(item: HearthItem & { kind: "widget" }) {
    switch (item.widget.kind) {
      case "tucks":
        return router.push("/gift-nook/my-tucks");
      case "inbox":
        return router.push("/inbox");
      case "cards":
        return router.push("/letterbox/season");
      case "pets":
        return router.push("/pets");
      case "rhythms":
        return router.push("/rhythms");
      case "sitter":
        return router.push("/sitter");
      case "recipe":
        // Today's pick opens straight to its page (REC-011).
        if (!session?.user.id) return router.push("/recipes");
        return loadRecipesSummary(session.user.id, item.widget.settings.shelf)
          .then((summary) => router.push(summary.today ? `/recipes/${summary.today.id}` : "/recipes"))
          .catch(() => router.push("/recipes"));
      case "greeting":
        return;
      case "companion":
        // A pet from Pet Care opens its page there (CORE-048).
        if (item.widget.settings.petId) return router.push(`/pets/${item.widget.settings.petId}`);
        return router.push(`/widget/view/${item.id}`);
      default:
        return router.push(`/widget/view/${item.id}`);
    }
  }

  function enterHollow(id: string) {
    if (entering.current) return;
    entering.current = true;
    router.push(`/hollow/${id}`);
  }

  function stopSelecting() {
    setSelecting(false);
    setPicked([]);
    setPickSheet(null);
  }

  function onPressItem(item: HearthItem) {
    // A checkbox inside a widget was just pressed; that's not an "open".
    if (touchesGuarded()) return;
    if (item.kind === "label" && item.divider && !editing && !selecting) {
      tap();
      setFolded((prev) => (prev.includes(item.id) ? prev.filter((id) => id !== item.id) : [...prev, item.id]));
      return;
    }
    if (selecting) {
      tap();
      setPicked((prev) => (prev.includes(item.id) ? prev.filter((id) => id !== item.id) : [...prev, item.id]));
      return;
    }
    if (item.kind === "widget") {
      if (editing) router.push(`/widget/${item.id}`);
      else openWidget(item);
    } else if (editing) {
      setOptionsFor(item.id);
    } else if (item.kind === "nook") {
      openNookFromTile(item);
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
    if (tooFull({ items: next })) return;
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
    if (!persistHere((inner) =>
      addItem(inner, { id, kind: "label", text: scope ? "Up top" : "My Nooks", size: "heading", align: "left", w: 4, h: 1 })
    )) return;
    setEditing(true);
    setOptionsFor(id);
  }

  function addHollow() {
    setAdding(false);
    const id = newItemId("h");
    const count = hollowsOf(layout).length;
    if (!persist(
      addItem(layout, {
        id,
        kind: "hollow",
        name: count ? `Hollow ${count + 1}` : "My Hollow",
        look: hollowLooks[count % hollowLooks.length].look,
        items: [],
        w: 2,
        h: 2,
      })
    )) return;
    tap("success");
    setEditing(true);
    setOptionsFor(id); // name it and pick its look straight away
  }

  // A Trinket (CORE-045): a little decoration, added and ready to customize.
  function addTrinket(piece: TrinketKey) {
    setAdding(false);
    const info = trinketInfo(piece);
    const id = newItemId("t");
    if (!persistHere((inner) => addItem(inner, { id, kind: "trinket", piece, color: info.color, ...info.size }))) return;
    tap("success");
    setEditing(true);
    setOptionsFor(id);
  }

  // Wallpaper for this space and ambience for the whole Hearth (CORE-041, 047).
  // A photo that's no longer used anywhere is deleted from storage.
  function changeWallpaper(next: Wallpaper | undefined) {
    const previous = wallpaperPath(scope ? hollow?.wallpaper : layout.wallpaper);
    const nextLayout: HearthLayout = scope
      ? { ...layout, items: updateItem(layout, scope, { wallpaper: next } as Partial<HearthItem>) }
      : { ...layout, wallpaper: next ?? { kind: "none" } };
    const saving = scope ? save({ items: nextLayout.items }) : save({ wallpaper: nextLayout.wallpaper });
    saving
      .then(async () => {
        if (previous) await removeUnusedPhotos([previous], nextLayout);
      })
      .catch((saveError: Error) => Alert.alert("Couldn't save that", saveError.message));
  }

  function changeAmbience(next: Ambience) {
    save({ ambience: next }).catch((saveError: Error) => Alert.alert("Couldn't save that", saveError.message));
  }

  // Clear the bottom message; anything thrown away is now gone for good.
  function settleToast() {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = null;
    pendingCancel.current?.();
    pendingCancel.current = null;
    setToast(null);
  }

  function showToast(text: string, action?: { label: string; run: () => void }, ms = 4000) {
    setToast({ text, action });
    toastTimer.current = setTimeout(settleToast, ms);
  }

  function itemLabel(item: HearthItem) {
    if (item.kind === "widget") return item.widget.title || widgetKindInfo(item.widget.kind).label;
    if (item.kind === "nook") return nookLabel(item);
    if (item.kind === "hollow") return item.name;
    if (item.kind === "trinket") return trinketInfo(item.piece).label;
    return item.text;
  }

  // Dropped on the trash can (CORE-040): gone, with a few seconds to undo.
  function trash(item: HearthItem) {
    settleToast();
    tap("success");
    const before = layout.items;
    if (item.kind === "hollow") persist(removeHollow(layout, item.id));
    else persistHere((inner) => removeItem(inner, item.id));
    if (item.kind === "widget" && item.widget.kind === "reminders") {
      const reminders = item.widget.settings.items;
      pendingCancel.current = () => cancelReminders(reminders);
    }
    showToast(
      `Removed “${itemLabel(item)}”`,
      {
        label: "Undo",
        run: () => {
          if (toastTimer.current) clearTimeout(toastTimer.current);
          toastTimer.current = null;
          pendingCancel.current = null; // its alerts were never cancelled
          tap();
          persist(before);
          setToast(null);
        },
      },
      5000
    );
  }

  useEffect(() => () => settleToast(), []);

  function remove(item: HearthItem) {
    if (item.locked) return Alert.alert("It's locked", "Unlock it first to remove it.");
    if (item.kind === "hollow") return persist(removeHollow(layout, item.id));
    if (item.kind === "widget" && item.widget.kind === "reminders") cancelReminders(item.widget.settings.items);
    persistHere((inner) => removeItem(inner, item.id));
  }

  // Select many (CORE-060). Leaving Edit puts the picking away.
  useEffect(() => {
    if (!editing) stopSelecting();
  }, [editing]);

  // Picked things that are really still here.
  const pickedIds = picked.filter((id) => items.some((i) => i.id === id));

  function pickTargets(): SelectionTarget[] {
    const chosen = new Set(pickedIds);
    const targets: SelectionTarget[] = [];
    const moved = () => {
      tap("success");
      stopSelecting();
    };
    if (scope) {
      targets.push({
        key: "hearth",
        label: "The Hearth",
        icon: "hearth",
        onPick: () => {
          if (persist(moveManyToScope(layout, pickedIds, null))) moved();
        },
      });
    }
    for (const h of hollowsOf(layout)) {
      if (h.id === scope || chosen.has(h.id)) continue;
      targets.push({
        key: h.id,
        label: h.name,
        icon: "burrow",
        onPick: () => {
          if (persist(moveManyToScope(layout, pickedIds, h.id))) moved();
        },
      });
    }
    for (const page of layout.pages) {
      if (page.id === layout.activePage) continue;
      targets.push({
        key: `page-${page.id}`,
        label: `Page: ${page.name}`,
        icon: "widgets",
        onPick: () => {
          if (page.id === HOME_PAGE && items.some((i) => pickedIds.includes(i.id) && !canGoOnHomePage(i))) {
            return Alert.alert("Hollows stay on your own pages", "Pick the other things, or put what's inside the Hollow on the Home page.");
          }
          const next = moveManyToPage(layout, pickedIds, page.id);
          if (next && tooFull(next)) return;
          if (next) save(next).catch((saveError: Error) => Alert.alert("Couldn't move them", saveError.message));
          moved();
        },
      });
    }
    return targets;
  }

  function copyPicked() {
    const { items: next, copyIds } = copyMany(layout, pickedIds, scope);
    if (!copyIds.length) return Alert.alert("Nothing to copy", "Hollows can't be copied.");
    if (!persist(next)) return;
    tap("success");
    stopSelecting();
    settleToast();
    showToast(`Copied ${copyIds.length} ${copyIds.length === 1 ? "thing" : "things"}`);
  }

  function removePicked() {
    const chosen = items.filter((i) => pickedIds.includes(i.id) && !i.locked);
    if (!chosen.length) return Alert.alert("They're locked", "Unlock them first to remove them.");
    Alert.alert(
      `Remove ${chosen.length} ${chosen.length === 1 ? "thing" : "things"}?`,
      chosen.some((i) => i.kind === "hollow") ? "A Hollow keeps what's inside — it goes back onto your Hearth." : undefined,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            settleToast();
            tap("success");
            const before = layout.items;
            persist(removeMany(layout, pickedIds));
            const reminders = chosen.flatMap((i) => (i.kind === "widget" && i.widget.kind === "reminders" ? i.widget.settings.items : []));
            if (reminders.length) pendingCancel.current = () => cancelReminders(reminders);
            stopSelecting();
            showToast(
              `Removed ${chosen.length}`,
              {
                label: "Undo",
                run: () => {
                  if (toastTimer.current) clearTimeout(toastTimer.current);
                  toastTimer.current = null;
                  pendingCancel.current = null;
                  tap();
                  persist(before);
                  setToast(null);
                },
              },
              5000
            );
          },
        },
      ]
    );
  }

  function onPickAction(action: SelectionAction) {
    if (action === "move") setPickSheet("move");
    else if (action === "color") setPickSheet("color");
    else if (action === "copy") copyPicked();
    else if (action === "lock") lockPicked();
    else if (action === "tag") setPickSheet("tag");
    else removePicked();
  }

  // Lock (CORE-061) everything picked, or unlock it if it's all locked already.
  function lockPicked() {
    const chosen = items.filter((i) => pickedIds.includes(i.id));
    const lock = !chosen.every((i) => i.locked);
    persist(lockMany(layout, pickedIds, lock));
    tap("success");
    stopSelecting();
    settleToast();
    showToast(lock ? `Locked ${chosen.length} in place` : `Unlocked ${chosen.length}`);
  }

  // Tidy up (CORE-062): close the gaps, with a way back.
  function tidyUp() {
    const before = layout.items;
    const next = inScope(layout, scope, (inner) => tidyItems(inner.items));
    settleToast();
    if (JSON.stringify(next) === JSON.stringify(before)) return showToast("Already tidy");
    tap("success");
    persist(next);
    showToast(
      "Tidied up",
      {
        label: "Undo",
        run: () => {
          if (toastTimer.current) clearTimeout(toastTimer.current);
          toastTimer.current = null;
          tap();
          persist(before);
          setToast(null);
        },
      },
      5000
    );
  }

  // Find (CORE-063): go to what was picked, switching page or stepping into
  // its Hollow first, then bring it into view with a glow.
  async function goToFound(found: FoundItem) {
    setFinding(false);
    try {
      if (found.pageId !== layout.activePage) {
        const changes = switchPage(layout, found.pageId);
        if (changes) await save(changes);
      }
    } catch (switchError) {
      return Alert.alert("Couldn't go there", (switchError as Error).message);
    }
    tap("success");
    if (found.hollowId) router.push({ pathname: "/hollow/[id]", params: { id: found.hollowId, flash: found.item.id } });
    else setRevealId(found.item.id);
  }

  useEffect(() => {
    if (!revealId || !gridWidth) return;
    const item = items.find((i) => i.id === revealId);
    if (!item) return;
    setRevealId(null);
    if (item.stack) {
      const place = stackMates(items, item).indexOf(item);
      setStackShown((prev) => ({ ...prev, [item.stack as string]: place }));
    }
    setFlashId(item.id);
    setTimeout(() => setFlashId(null), 2600);
    const stride = (gridWidth - GRID_GAP * (COLUMNS - 1)) / COLUMNS + GRID_GAP;
    setTimeout(() => {
      tourScroll.area.viewport.current?.measureInWindow((_x, _y, _w, height) => {
        const y = gridTop.current + item.y * stride - (height - item.h * stride) / 2;
        tourScroll.scrollRef.current?.scrollTo({ y: Math.max(0, y), animated: true });
      });
    }, 250);
  }, [revealId, gridWidth, items]);

  const optionsItem = (items.find((i) => i.id === optionsFor && i.kind !== "widget") ?? null) as
    | NookItem
    | LabelItem
    | HollowItem
    | TrinketItem
    | null;

  // Where the item in the options sheet could move to.
  const moveTargets: MoveTarget[] = [
    ...(scope ? [{ scope: null, label: "The Hearth" }] : []),
    ...hollowsOf(layout)
      .filter((h) => h.id !== scope && h.id !== optionsFor)
      .map((h) => ({ scope: h.id, label: h.name })),
  ];

  // Where a copy could go: right here first, then everywhere else (CORE-039).
  const copyTargets: MoveTarget[] = [
    { scope, label: "Right here" },
    ...(scope ? [{ scope: null, label: "The Hearth" }] : []),
    ...hollowsOf(layout)
      .filter((h) => h.id !== scope)
      .map((h) => ({ scope: h.id, label: h.name })),
  ];

  // Make a copy (CORE-039) and show where it went: here, it scrolls into
  // view and glows; somewhere else, a message says where, with a way there.
  function copyTo(id: string, target: Scope) {
    const original = locate(layout, id)?.item;
    const { items: next, copyId } = copyItem(layout, id, target);
    if (!copyId || !original) return;
    if (!persist(next)) return;
    settleToast();
    const label = itemLabel(original);
    if (target === scope) {
      setFlashId(copyId);
      setTimeout(() => setFlashId(null), 2600);
      showToast(`Copied “${label}”`);
      const copy = scopeItems({ ...layout, items: next }, scope).find((i) => i.id === copyId);
      const stride = (gridWidth - GRID_GAP * (COLUMNS - 1)) / COLUMNS + GRID_GAP;
      if (copy) {
        // Let the grid grow to fit it, then bring it to the middle of the screen.
        setTimeout(() => {
          tourScroll.area.viewport.current?.measureInWindow((_x, _y, _w, height) => {
            const y = gridTop.current + copy.y * stride - (height - copy.h * stride) / 2;
            tourScroll.scrollRef.current?.scrollTo({ y: Math.max(0, y), animated: true });
          });
        }, 150);
      }
    } else if (target) {
      const name = findHollow(layout, target)?.name ?? "that Hollow";
      showToast(`Copied “${label}” into “${name}”`, { label: "Open", run: () => (settleToast(), router.push(`/hollow/${target}`)) });
    } else {
      showToast(`Copied “${label}” onto your Hearth`, { label: "Go there", run: () => (settleToast(), router.back()) });
    }
  }

  const isEmpty = items.length === 0;

  // Things set to show only in some months (CORE-053) are hidden out of
  // season, but stay (dimmed) while you're editing so you can find them.
  const today = new Date();
  const inSight = oneOfEachStack(items, stackShown);
  const inSeasonItems = editing ? inSight : inSight.filter((item) => inSeason(item.showIn, today));
  // Folding and hidden tags only apply when you are looking, not designing.
  const visibleItems = editing ? inSeasonItems : foldItems(hideTagged(inSeasonItems, hiddenTags), folded);

  // The Hearth pet (CORE-048) wanders the grid while you're just looking:
  // not while editing, and not with Reduce Motion on.
  const petsOut = !editing && !reduceMotion && gridWidth > 0 && visibleItems.some(isPetBed);
  const petStage = { roaming: petsOut, pet: gridWidth ? petSizeForStride(strideFor(gridWidth)) : null };

  function renderItem(item: HearthItem, size: { width: number; height: number }) {
    const inner = renderInner(item, size);
    return editing && !inSeason(item.showIn, today) ? <View style={{ opacity: 0.4 }}>{inner}</View> : inner;
  }

  function renderInner(item: HearthItem, size: { width: number; height: number }) {
    // Keyed by the look of its shape, so changing the shape rebuilds the whole
    // tile (its clipping and decoration) rather than patching it in place.
    if (item.kind === "nook") {
      return (
        <TileFace
          key={`${item.shape ?? "arch"}-${item.corners ?? "soft"}`}
          item={item}
          {...size}
          refreshKey={refreshKey}
          themeText={theme.text}
        />
      );
    }
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
      const place = stackPosition(items, item);
      const view = (
        <WidgetView
          widget={item.widget}
          color={item.color}
          icon={item.icon}
          {...size}
          refreshKey={refreshKey}
          themeText={theme.text}
          corners={item.corners}
          border={item.border}
          still={editing}
          onChange={editing ? undefined : (widget) => changeWidget(item, widget)}
        />
      );
      if (!place || !item.stack) return view;
      const stack = item.stack;
      return (
        <StackShell
          width={size.width}
          height={size.height}
          count={place[1]}
          index={place[0]}
          color={item.widget.look === "bold" ? "#ffffff" : theme.text}
          onSelect={(i) => {
            tap();
            setStackShown((prev) => ({ ...prev, [stack]: i }));
          }}
        >
          {view}
        </StackShell>
      );
    }
    if (item.kind === "trinket") {
      return (
        <TrinketArt
          piece={item.piece}
          color={item.color ?? trinketInfo(item.piece).color}
          flip={item.flip}
          width={size.width}
          height={size.height}
          still={editing}
        />
      );
    }
    const fontSize = { title: 30, heading: 19, caption: 14 }[item.size];
    if (item.divider) {
      const isFolded = folded.includes(item.id) && !editing;
      const hidden = hiddenBy(items, item.id);
      const tint = item.color ? deepColor(item.color) : theme.text;
      return (
        <View style={[size, { flexDirection: "row", alignItems: "flex-end", gap: 10, paddingHorizontal: 4, paddingBottom: 4 }]}>
          <Text numberOfLines={1} style={{ fontSize, fontWeight: "800", color: tint, flexShrink: 1 }}>
            {item.text}
          </Text>
          <View style={{ flex: 1, height: 2, borderRadius: 1, backgroundColor: `${tint}33`, marginBottom: fontSize * 0.32 }} />
          {isFolded && hidden ? (
            <Text style={{ color: theme.muted, fontSize: 13, marginBottom: 1 }}>{hidden} hidden</Text>
          ) : null}
          <View style={{ transform: [{ rotate: isFolded ? "0deg" : "90deg" }], marginBottom: 1 }}>
            <Icon name="chevron" size={16} color={tint} />
          </View>
        </View>
      );
    }
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
  const wallpaper = effectiveWallpaper(layout.wallpaper, hollow?.wallpaper, Boolean(scope));
  const ambienceKind = activeAmbience(
    layout.ambience,
    new Date(),
    outside.weather ? ambienceForWeather(outside.weather.condition) : null
  );

  return (
    <View style={[styles.fill, { backgroundColor: theme.background }]}>
      <WallpaperLayer wallpaper={wallpaper} background={theme.background} dark={theme.dark} />
      <Firelight variant="hearth" color={theme.glow} strength={theme.dark ? 0.34 : 0.26} />
      <SafeAreaView style={styles.fill} edges={["top", "left", "right"]}>
        <StatusBar style={theme.dark ? "light" : "dark"} />
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
              {/* Out of the way while arranging, when the header is busiest. */}
              {editing ? null : <HelpButton color={theme.accent} />}
            </View>
          </View>
        </View>

        {showStrip || showTags ? (
          <View onLayout={(e) => setStripHeight(e.nativeEvent.layout.height)}>
          {showStrip ? (
            <PageStrip
            pages={layout.pages}
            activeId={layout.activePage}
            homeId={showsHome ? HOME_PAGE : undefined}
            accent={theme.accent}
            text={theme.text}
            background={theme.background}
            hoverId={hoverTab}
            canAdd={editing}
            tabRef={(id, node) => {
              if (node) tabNodes.current[id] = node;
              else delete tabNodes.current[id];
            }}
            onSwitch={goToPage}
            onAdd={() => addNewPage("")}
          />
          ) : null}
            {showTags ? (
              <TagBar
                tags={knownTags}
                hidden={hiddenTags}
                accent={theme.accent}
                text={theme.text}
                background={theme.background}
                onToggle={(tag) =>
                  setHiddenTags((prev) =>
                    prev.some((h) => h.toLowerCase() === tag.toLowerCase())
                      ? prev.filter((h) => h.toLowerCase() !== tag.toLowerCase())
                      : [...prev, tag]
                  )
                }
                onShowAll={() => setHiddenTags([])}
              />
            ) : null}
          </View>
        ) : null}

        <GestureDetector gesture={pageSwipe}>
        <View style={styles.fill} collapsable={false}>
        <TourScrollArea area={tourScroll.area}>
          <AnimatedScrollView
            ref={scrollView}
            {...scrollProps}
            contentContainerStyle={styles.container}
            scrollEnabled={!dragging}
            keyboardShouldPersistTaps="handled"
          >
            {editing && !holdStarted ? (
              <Animated.View
                entering={FadeIn.duration(200)}
                exiting={FadeOut.duration(150)}
                style={[styles.hint, { backgroundColor: `${theme.accent}18`, flexDirection: "column", alignItems: "stretch", gap: 10 }]}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <Icon name="drag" size={18} color={theme.accent} />
                  <Text style={{ color: theme.text, flex: 1 }}>
                    {scope
                      ? "Hold anything and drag it anywhere, or onto the trash to remove it. Drag a corner to resize, tap ⧉ to copy, tap to customize."
                      : "Hold anything and drag it anywhere — onto a Hollow to put it inside, or onto the trash to remove it. Drag a corner to resize, tap ⧉ to copy, tap to customize."}
                  </Text>
                </View>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  <Pill icon="palette" label="Decorate" accent={theme.accent} background={theme.background} onPress={() => setDecorating(true)} />
                  {scope ? null : (
                    <Pill icon="widgets" label="Pages" accent={theme.accent} background={theme.background} onPress={() => setPagesOpen(true)} />
                  )}
                  {isEmpty ? null : (
                    <>
                      <Pill
                        icon="check"
                        label={selecting ? "Stop selecting" : "Select"}
                        accent={theme.accent}
                        background={theme.background}
                        onPress={() => {
                          tap();
                          setSelecting((s) => !s);
                          setPicked([]);
                        }}
                      />
                      {scope ? null : (
                        <Pill icon="sparkles" label="Scenes" accent={theme.accent} background={theme.background} onPress={() => setScenesOpen(true)} />
                      )}
                      <Pill icon="tidy" label="Tidy up" accent={theme.accent} background={theme.background} onPress={tidyUp} />
                      {scope ? null : (
                        <Pill icon="search" label="Find" accent={theme.accent} background={theme.background} onPress={() => setFinding(true)} />
                      )}
                    </>
                  )}
                </View>
              </Animated.View>
            ) : null}

            {onHome && !isEmpty && !isLoading ? (
              <Animated.View entering={FadeIn.duration(200)} style={[styles.hint, { backgroundColor: `${theme.accent}12` }]}>
                <Icon name="group" size={18} color={theme.accent} />
                <Text style={{ color: theme.text, flex: 1 }}>
                  Shared with {listNames(home.others)}. Anyone in your Home can change this page.
                </Text>
              </Animated.View>
            ) : null}

            <View
              ref={gridRef}
              collapsable={false}
              onLayout={(e) => {
                setGridWidth(e.nativeEvent.layout.width);
                gridTop.current = e.nativeEvent.layout.y;
              }}
            >
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
                    {scope ? "Nothing in here yet" : onHome ? `${home.name}, for everyone` : "Make this place yours"}
                  </Text>
                  <Text style={{ color: theme.muted, textAlign: "center" }}>
                    {onHome
                      ? "This page is shared with everyone in your Home. Put up a shopping list, a sticky note or a countdown, and anyone can tick, move or change it. You can also drag things here onto this page's tab."
                      : scope
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
                <PetStageContext.Provider value={petStage}>
                <Animated.View key={layout.activePage} entering={FadeIn.duration(180)}>
                <HearthGrid
                  items={visibleItems}
                  width={gridWidth}
                  editing={editing}
                  accent={theme.accent}
                  shadowAt={(level) => shadowAtLevel(themeKey, level)}
                  onMove={(id, x, y) => persistHere((inner) => moveItem(inner, id, x, y))}
                  onNudge={(id, way) => persistHere((inner) => nudgeItem(inner, id, way))}
                  onResize={(id, w, h) => persistHere((inner) => resizeItem(inner, id, w, h))}
                  onDropIntoHollow={
                    scope
                      ? undefined
                      : (id, hollowId) => {
                          if (persist(moveToScope(layout, id, hollowId))) tap("success");
                        }
                  }
                  onPressItem={onPressItem}
                  onLongPress={() => {
                    setHoldStarted(true);
                    setEditing(true);
                  }}
                  onCopy={(item) => copyTo(item.id, scope)}
                  onTrash={trash}
                  onTrashHover={setOverTrash}
                  onTrashArmed={setTrashArmed}
                  flashId={flashId}
                  selecting={selecting}
                  selectedIds={picked}
                  onToggleLock={toggleLock}
                  onTabHover={setHoverTab}
                  onDropOnTab={scope ? undefined : dropOnTab}
                  onDraggingChange={onDraggingChange}
                  dragScroll={dragScroll}
                  renderItem={renderItem}
                />
                {petsOut ? <PetRoamers items={visibleItems} gridWidth={gridWidth} refreshKey={refreshKey} themeText={theme.text} /> : null}
                </Animated.View>
                </PetStageContext.Provider>
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
          </AnimatedScrollView>
        </TourScrollArea>
        </View>
        </GestureDetector>
      </SafeAreaView>

      {/* The weather in the air (CORE-047), paused while editing. */}
      {ambienceKind && !editing && !zoom ? <AmbienceLayer kind={ambienceKind} /> : null}

      {/* The trash can, while dragging (CORE-040). */}
      {dragging ? (
        <View pointerEvents="none" style={[styles.trashArea, { bottom: (scope ? insets.bottom : 0) + 20 }]}>
          <Animated.View entering={ZoomIn.duration(180)}>
            <View
              ref={trashRef}
              collapsable={false}
              onLayout={() =>
                trashRef.current?.measureInWindow((x, y, w, h) => {
                  trashRect.value = { x, y, w, h };
                })
              }
              style={[
                styles.trash,
                {
                  backgroundColor: trashArmed ? colors.error : theme.background,
                  borderColor: overTrash ? colors.error : `${theme.text}33`,
                  borderStyle: overTrash && !trashArmed ? "dashed" : "solid",
                  transform: [{ scale: trashArmed ? 1.1 : overTrash ? 1.04 : 1 }],
                },
              ]}
            >
              <Icon name="trash" size={20} color={trashArmed ? "#ffffff" : overTrash ? colors.error : theme.text} />
              <Text style={{ color: trashArmed ? "#ffffff" : overTrash ? colors.error : theme.text, fontWeight: "700" }}>
                {trashArmed ? "Let go to remove" : overTrash ? "Hold..." : "Hold here to remove"}
              </Text>
            </View>
          </Animated.View>
        </View>
      ) : toast ? (
        <Animated.View
          key={toast.text}
          entering={FadeIn.duration(180)}
          style={[styles.trashArea, { bottom: (scope ? insets.bottom : 0) + 20 }]}
          pointerEvents="box-none"
        >
          <View style={[styles.trash, styles.toast, { backgroundColor: theme.text, borderColor: theme.text }]}>
            <Icon
              name={toast.action?.label === "Undo" ? (toast.text.startsWith("Tidied") ? "tidy" : toast.text.startsWith("Moved") ? "widgets" : "trash") : toast.text.includes("ocked") ? "lock" : "copy"}
              size={16}
              color={theme.background}
            />
            <Text style={{ color: theme.background, flexShrink: 1 }} numberOfLines={2}>
              {toast.text}
            </Text>
            {toast.action ? (
              <Tap onPress={toast.action.run} hitSlop={12} accessibilityRole="button">
                <Text style={{ color: theme.background, fontWeight: "800" }}>{toast.action.label}</Text>
              </Tap>
            ) : null}
          </View>
        </Animated.View>
      ) : null}

      {selecting && editing ? (
        <SelectionBar
          count={pickedIds.length}
          allLocked={pickedIds.length > 0 && items.filter((i) => pickedIds.includes(i.id)).every((i) => i.locked)}
          accent={theme.accent}
          background={theme.background}
          text={theme.text}
          bottom={(scope ? insets.bottom : 0) + 12}
          onAction={onPickAction}
          onDone={stopSelecting}
        />
      ) : null}

      {/* Content melts away under the top bar instead of meeting a hard edge. */}
      {barHeight > 0 ? (
        <GlowVeil
          top={insets.top + barHeight + (showStrip || showTags ? stripHeight : 0)}
          height={16}
          background={theme.background}
          color={theme.glow}
          strength={theme.dark ? 0.34 : 0.26}
        />
      ) : null}

      {zoom ? (
        <NookZoom
          key={`${zoom.route}-${zoom.direction}`}
          rect={zoom.rect}
          radii={nookRadii(zoom.rect.width, zoom.rect.height, zoom.corners, zoom.shape)}
          color={zoom.color}
          background={theme.background}
          icon={zoom.icon}
          iconColor={zoom.iconColor}
          direction={zoom.direction}
          onDone={finishZoom}
        />
      ) : null}

      {/* Sheets sit inside the screen (not system pop-ups) so opening another
          screen from them can't collide with a half-dismissed pop-up. */}
      <ItemOptions
        item={optionsItem}
        onChange={(changes) => optionsFor && persistHere((inner) => updateItem(inner, optionsFor, changes))}
        onResize={(w, h) => optionsFor && persistHere((inner) => resizeItem(inner, optionsFor, w, h))}
        onNudge={(way) => optionsFor && persistHere((inner) => nudgeItem(inner, optionsFor, way))}
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
        onDivider={
          optionsItem?.kind === "label"
            ? (on) => {
                const id = optionsItem.id;
                persistHere((inner) => {
                  const next = updateItem(inner, id, { divider: on || undefined } as Partial<HearthItem>);
                  return on ? resizeItem({ ...inner, items: next }, id, COLUMNS, 1) : next;
                });
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
        copyTargets={copyTargets}
        onCopyTo={(target) => {
          const id = optionsFor;
          setOptionsFor(null);
          if (id) copyTo(id, target);
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

      <DecorateSheet
        visible={decorating}
        onClose={() => setDecorating(false)}
        userId={session?.user.id}
        inHollow={Boolean(scope)}
        hollowName={hollow?.name}
        wallpaper={scope ? hollow?.wallpaper : layout.wallpaper}
        onWallpaper={changeWallpaper}
        ambience={layout.ambience}
        onAmbience={changeAmbience}
        weatherPlace={weatherPlaceOf(everyTopLevel(layout))?.place.name}
      />

      <MoveManySheet visible={pickSheet === "move"} count={pickedIds.length} targets={pickTargets()} onClose={() => setPickSheet(null)} />
      <TagManySheet
        visible={pickSheet === "tag"}
        count={pickedIds.length}
        tags={knownTags.map((tag) => ({
          tag,
          has: items.filter((i) => pickedIds.includes(i.id) && (i.tags ?? []).some((t) => t.toLowerCase() === tag.toLowerCase())).length,
        }))}
        onToggle={(tag, on) => persist(tagMany(layout, pickedIds, tag, on))}
        onAdd={(tag) => persist(tagMany(layout, pickedIds, tag, true))}
        onClose={() => setPickSheet(null)}
      />
      <ColorManySheet
        visible={pickSheet === "color"}
        count={pickedIds.length}
        onPick={(color) => {
          persist(recolorMany(layout, pickedIds, color));
          tap("success");
          stopSelecting();
        }}
        onClose={() => setPickSheet(null)}
      />

      <ScenesSheet
        visible={scenesOpen}
        onClose={() => setScenesOpen(false)}
        state={scenes}
        ready={scenesReady}
        onSave={saveCurrentScene}
        onUse={(id) => void useScene(id)}
        onRename={(id, name) => changeScenes(renameScene(scenes, id, name))}
        onSchedule={(id, schedule: SceneSchedule | undefined) => changeScenes(setSchedule(scenes, id, schedule))}
        onRemove={(id) => {
          const scene = scenes.scenes.find((s) => s.id === id);
          Alert.alert(`Remove “${scene?.name}”?`, "The Hearth you're looking at stays as it is.", [
            { text: "Cancel", style: "cancel" },
            { text: "Remove", style: "destructive", onPress: () => changeScenes(removeScene(scenes, id)) },
          ]);
        }}
      />

      <FindSheet visible={finding} onClose={() => setFinding(false)} layout={layout} onPick={goToFound} />

      <PagesSheet
        visible={pagesOpen}
        onClose={() => setPagesOpen(false)}
        pages={layout.pages}
        activeId={layout.activePage}
        onSwitch={goToPage}
        onAdd={addNewPage}
        onRename={(id, name) => save(renamePage(layout, id, name)).catch(() => {})}
        onRemove={removeAPage}
        homeId={showsHome ? HOME_PAGE : undefined}
        homeHidden={!scope && home.available && Boolean(personal.layout.hideHomePage)}
        homeName={home.name}
        onShowHome={showHomePage}
      />

      <AddSheet
        visible={adding}
        onClose={() => setAdding(false)}
        onAddWidget={addWidget}
        onAddLabel={addLabel}
        onAddHollow={scope || onHome ? undefined : addHollow}
        onAddTrinket={addTrinket}
        hollowName={hollow?.name}
        onOpenMarket={() => {
          setAdding(false);
          router.push("/market");
        }}
      />
    </View>
  );
}

// A small button in the Edit hint.
function Pill({
  icon,
  label,
  accent,
  background,
  onPress,
}: {
  icon: IconName;
  label: string;
  accent: string;
  background: string;
  onPress: () => void;
}) {
  return (
    <Tap onPress={onPress} hitSlop={8} style={[styles.decorateButton, { backgroundColor: accent }]} accessibilityLabel={label}>
      <Icon name={icon} size={14} color={background} />
      <Text style={{ color: background, fontWeight: "700", fontSize: 13 }}>{label}</Text>
    </Tap>
  );
}

// "Good evening, Josh" for the top of the Hearth.
// "Sarah", "Sarah and Mom", "Sarah, Mom and Dad".
function listNames(names: string[]) {
  if (!names.length) return "your Home";
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

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
  trashArea: { position: "absolute", left: 0, right: 0, alignItems: "center", zIndex: 60 },
  trash: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 22,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    boxShadow: "0px 10px 24px -8px rgba(0,0,0,0.35)",
  },
  toast: { gap: 12, maxWidth: "92%", height: undefined, minHeight: 52, paddingVertical: 10 },
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
  decorateButton: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
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
