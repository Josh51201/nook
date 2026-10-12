import AsyncStorage from "@react-native-async-storage/async-storage";
import { StatusBar } from "expo-status-bar";
import { useFocusEffect, useNavigation, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Alert, StyleSheet, useWindowDimensions, View } from "react-native";
import { FixedTextSize, Text } from "../text";
import { useShowHelp } from "../help-button";
import { ItemPreview } from "./item-preview";
import { LabelFace } from "./label-face";
import { MoveBar } from "./move-bar";
import { takeMoveRequest } from "../../lib/move-request";
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
import { activeAmbience, effectiveWallpaper, liftLevel, wallpaperPath, type Ambience, type Corners, type TileShape, type Wallpaper } from "../../lib/decor";
import { tap } from "../../lib/feedback";
import { keepPhotosForScenes, removeUnusedPhotos } from "../../lib/hearth-photos";
import {
  defaultScenes,
  removeScene,
  addAndSwitch,
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
import { cubbyStyleInfo, type CubbyStyle } from "../../lib/cubbies";
import { inSeason } from "../../lib/widget-extras";
import { colors, useTheme } from "../../lib/theme";
import {
  addItem,
  COLUMNS,
  copyItem,
  cubbyContents,
  deepColor,
  tilePalette,
  everyTopLevel,
  findHollow,
  gatheringWidgets,
  hearthThemes,
  hollowLookInfo,
  hollowLooks,
  hollowsOf,
  inScope,
  itemColor,
  locate,
  moveItem,
  pushItem,
  nudgeItem,
  canNudge,
  itemDisplayName,
  type Nudge,
  moveToScope,
  newItemId,
  tidyItems,
  nookLabel,
  removeEverywhere,
  removeHollow,
  removeItem,
  resizeItem,
  scopeItems,
  shadowAtLevel,
  updateItem,
  type HearthItem,
  type HearthLayout,
  type CubbyItem,
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
import { CubbyArt } from "./cubby-art";
import { WallpaperLayer } from "./wallpaper";
import { Icon, IconBadge, type IconName } from "../icon";
import { Skeleton, Tap } from "../motion";
import { TourScrollArea, TourTarget, useTourAutoStart, useTourScrollArea } from "../tour";
import { AddSheet } from "./add-sheet";
import { EditBar, EditMoreSheet, PaintBar, type MoreTool } from "./edit-bar";
import { lookOf, paintItem, takePaintRequest, type Look } from "../../lib/hearth-looks";
import { StarterSheet } from "./starter-sheet";
import { isFreshPage, starterInfo, startFrom, type StarterId } from "../../lib/hearth-starters";
import { GRID_GAP, HearthGrid } from "./hearth-grid";
import { PetStageContext } from "./pet-art";
import { isPetBed, PetRoamers, strideFor } from "./pet-roamer";
import { petSizeForStride } from "../../lib/hearth-pet";
import { useHearthView } from "../../lib/hearth-view";
import { emptyHistory, remember, stepBack, stepForward, type History } from "../../lib/hearth-history";
import { canGoOnHomePage, HOME_PAGE } from "../../lib/home-hearth";
import { fridgePlace, fridgeRoute, placeKey } from "../../lib/fridge";
import { markFridgesSeen, useFridgeNews } from "../../lib/fridge-data";
import { useFireSound } from "./fire-sound";
import { ShareSheet, type OpenedLook } from "./share-sheet";
import { isHearthLook, lookAsSnapshot, receiveTheme, sceneNameFor } from "../../lib/hearth-share";
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
import { gatheringWidgetsToTakeOff, widgetGathering } from "../../lib/gatherings-data";

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
  const { layout, save: saveView, isLoading, error, reload, personal, home, showsHome, onHome } = useHearthView(scope);
  // The theme in effect right now (Dusk while the phone is dark, if asked).
  const { key: themeKey } = useTheme();
  const theme = hearthThemes[themeKey] ?? hearthThemes.hearth;
  const hollow = scope ? findHollow(layout, scope) : null;
  const items = scopeItems(layout, scope);

  const [editing, setEditing] = useState(false);
  // Undo and Redo in Edit (CORE-095): the Hearth as it was before each change.
  const [history, setHistory] = useState<History<HearthLayout>>(emptyHistory);
  const editingNow = useRef(editing);
  editingNow.current = editing;
  const layoutNow = useRef(layout);
  layoutNow.current = layout;
  // Every save goes through here. While editing, the Hearth as it was just
  // before is kept so the change can be undone; things that aren't edits
  // (switching pages, undoing itself) pass `undoable: false`.
  function save(changes: Partial<HearthLayout>, { undoable = true }: { undoable?: boolean } = {}) {
    if (undoable && editingNow.current) setHistory((h) => remember(h, layoutNow.current));
    return saveView(changes);
  }
  // Edit's toolbar (CORE-094): its More sheet, its height (so messages sit
  // above it), and the one-line tip at the top until it's put away.
  const [moreOpen, setMoreOpen] = useState(false);
  const [editBarHeight, setEditBarHeight] = useState(0);
  const [tipHidden, setTipHidden] = useState(true);
  useEffect(() => {
    AsyncStorage.getItem(EDIT_TIP_KEY)
      .then((value) => setTipHidden(value === "1"))
      .catch(() => setTipHidden(false));
  }, []);
  function hideTip(hidden: boolean) {
    setTipHidden(hidden);
    AsyncStorage.setItem(EDIT_TIP_KEY, hidden ? "1" : "0").catch(() => {});
  }
  // Pasting a copied look onto things, one tap each (CORE-097).
  const [painting, setPainting] = useState<Look | null>(null);
  // Starter layouts (CORE-096): the picker, and whether the offer on a brand
  // new Hearth has been turned down.
  const [startersOpen, setStartersOpen] = useState(false);
  const [starterOfferHidden, setStarterOfferHidden] = useState(true);
  useEffect(() => {
    AsyncStorage.getItem(STARTER_OFFER_KEY)
      .then((value) => setStarterOfferHidden(value === "1"))
      .catch(() => setStarterOfferHidden(false));
  }, []);
  function hideStarterOffer() {
    setStarterOfferHidden(true);
    AsyncStorage.setItem(STARTER_OFFER_KEY, "1").catch(() => {});
  }
  const [gridWidth, setGridWidth] = useState(0);
  const { height: windowHeight } = useWindowDimensions();
  const [optionsFor, setOptionsFor] = useState<string | null>(null);
  // Moving a tile with the arrow bar, watching the Hearth (CORE-076).
  const [movingId, setMovingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [decorating, setDecorating] = useState(false);
  const [pagesOpen, setPagesOpen] = useState(false);
  const [finding, setFinding] = useState(false);
  const [scenesOpen, setScenesOpen] = useState(false);
  // Share a look (CORE-055).
  const [sharing, setSharing] = useState(false);
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
  // Cubby mode (CORE-085): reach the boxes behind your widgets.
  const [cubbyMode, setCubbyMode] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [pickSheet, setPickSheet] = useState<"move" | "color" | "tag" | null>(null);
  // Which widget of each stack is showing (CORE-050).
  const [stackShown, setStackShown] = useState<Record<string, number>>({});
  const [dragging, setDragging] = useState(false);
  // Edit started by holding an item: the tip card at the top stays away until
  // you let go, so the grid doesn't slide out from under your finger.
  const [holdStarted, setHoldStarted] = useState(false);
  const holdStartedNow = useRef(false);
  // ...and when it does come in, the page scrolls down by its height so the
  // Hearth stays exactly where it was under your finger (CORE-091).
  const keepGridStill = useRef(false);
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
  const showHelp = useShowHelp();
  // The soft fireplace sound, if it's on (CORE-047).
  useFireSound(layout.fireSound);
  // Fridge doors (CORE-086): which fridges have a note you haven't seen, so
  // their page tabs (the Home page's above all) wear a little note.
  const fridgeNews = useFridgeNews(home.homeId, refreshKey);
  const fridgesOn = (pageItems: HearthItem[], onHomePage: boolean) =>
    pageItems.flatMap((item) => {
      if (item.kind !== "widget" || item.widget.kind !== "fridge") return [];
      const place = fridgePlace(item.widget.settings, { onHomePage, homeId: home.homeId });
      return place ? [place] : [];
    });
  const onHomePageNow = !scope && layout.activePage === HOME_PAGE;
  const pagesWithNews = scope
    ? []
    : layout.pages
        .filter((page) => {
          const pageItems = page.id === layout.activePage ? layout.items : layout.otherPages[page.id] ?? [];
          return fridgesOn(pageItems, page.id === HOME_PAGE).some((place) => fridgeNews.has(placeKey(place)));
        })
        .map((page) => page.id);
  // Looking at a fridge counts as seeing what's on it.
  const unseenHere = editing ? [] : fridgesOn(items, onHomePageNow).filter((place) => fridgeNews.has(placeKey(place)));
  const unseenKey = unseenHere.map(placeKey).join(",");
  useEffect(() => {
    if (!unseenKey || !navigation.isFocused()) return;
    const timer = setTimeout(() => void markFridgesSeen(unseenHere), 1200);
    return () => clearTimeout(timer);
    // `unseenKey` stands for `unseenHere`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unseenKey, refreshKey]);

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
  const [toast, setToast] = useState<{ text: string; action?: { label: string; run: () => void }; icon?: IconName } | null>(null);
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
    if (!isDragging && holdStartedNow.current) {
      holdStartedNow.current = false;
      keepGridStill.current = true;
      setTimeout(() => (keepGridStill.current = false), 1000);
    }
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

  const sheetOpen = startersOpen || moreOpen || adding || decorating || pagesOpen || finding || scenesOpen || sharing || pickSheet !== null || optionsFor !== null || zoom !== null || movingId !== null;
  // The tab bar and Edit bar come back only once a sheet has finished sliding
  // away (it takes ~300ms), the tab bar first and the Edit bar just after, so
  // nothing resizes or fades in while the sheet is still moving.
  const [tabBarHidden, setTabBarHidden] = useState(false);
  const [barsHidden, setBarsHidden] = useState(false);
  useEffect(() => {
    if (sheetOpen) {
      setTabBarHidden(true);
      setBarsHidden(true);
      return;
    }
    const tabTimer = setTimeout(() => setTabBarHidden(false), 330);
    const barTimer = setTimeout(() => setBarsHidden(false), 420);
    return () => {
      clearTimeout(tabTimer);
      clearTimeout(barTimer);
    };
  }, [sheetOpen]);
  useEffect(() => {
    if (!scope) navigation.setOptions({ tabBarStyle: tabBarHidden ? { display: "none" } : undefined });
  }, [scope, tabBarHidden, navigation]);

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

  // A Gathering widget set to take itself off does so the day after its
  // Gathering (GATH-010), wherever it is on your own pages. Never on the Home
  // page: that's everyone's, and they may not all be invited.
  const personalRef = useRef(personal);
  personalRef.current = personal;
  useEffect(() => {
    if (scope || isLoading || editing) return;
    const widgets = gatheringWidgets(personalRef.current.layout).map((item) => ({
      id: item.id,
      gatheringId: item.widget.settings.gatheringId!,
      whenOver: item.widget.settings.whenOver,
    }));
    if (!widgets.some((w) => w.whenOver === "remove")) return;
    let live = true;
    gatheringWidgetsToTakeOff(widgets).then((ids) => {
      if (!live || !ids.length) return;
      const gone = new Set(ids);
      const latest = personalRef.current;
      latest.save(removeEverywhere(latest.layout, (item) => gone.has(item.id))).catch(() => {});
    });
    return () => {
      live = false;
    };
  }, [refreshKey, scope, isLoading, editing]);

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
  function persist(next: HearthItem[], options?: { undoable?: boolean }) {
    if (next === layout.items) return true;
    if (tooFull({ items: next })) return false;
    save({ items: next }, options).catch((saveError: Error) => Alert.alert("Couldn't save your Hearth", saveError.message));
    return true;
  }
  // Apply an edit to whatever this screen is showing (Hearth or a Hollow).
  function persistHere(edit: (inner: HearthLayout) => HearthItem[]) {
    return persist(inScope(layout, scope, edit));
  }

  // Begin from a starter layout (CORE-096), with a way back.
  function useStarter(id: StarterId) {
    const starter = starterInfo(id);
    const result = startFrom(layout, id);
    if (!result) {
      return Alert.alert("No room for another page", "You have the most pages there can be. Remove one first, then try again.");
    }
    if (tooFull(result.changes)) return;
    const before = layout;
    setStartersOpen(false);
    hideStarterOffer();
    tap("success");
    save(result.changes).catch((saveError: Error) => Alert.alert("Couldn't set that up", saveError.message));
    settleToast();
    showToast(
      result.newPage ? `Added a “${starter.name}” page` : `Here's your ${starter.name} Hearth — make it yours`,
      {
        label: "Undo",
        run: () => {
          if (toastTimer.current) clearTimeout(toastTimer.current);
          toastTimer.current = null;
          tap();
          save(before, { undoable: false }).catch(() => {});
          setToast(null);
        },
      },
      6000,
      starter.icon
    );
  }

  // Step back through what was changed while editing, or forward again (CORE-095).
  function undoEdit() {
    const step = stepBack(history, layout);
    if (!step) return;
    tap();
    settleToast();
    setHistory(step.history);
    save(step.show, { undoable: false }).catch((saveError: Error) => Alert.alert("Couldn't undo that", saveError.message));
    AccessibilityInfo.announceForAccessibility("Undone");
  }
  function redoEdit() {
    const step = stepForward(history, layout);
    if (!step) return;
    tap();
    settleToast();
    setHistory(step.history);
    save(step.show, { undoable: false }).catch((saveError: Error) => Alert.alert("Couldn't redo that", saveError.message));
    AccessibilityInfo.announceForAccessibility("Redone");
  }

  // Pages of the Hearth (CORE-051). Hollows have just the one.
  function goToPage(id: string) {
    const changes = switchPage(layout, id);
    if (!changes) return;
    tap();
    setPagesOpen(false);
    save(changes, { undoable: false }).catch((saveError: Error) => Alert.alert("Couldn't change page", saveError.message));
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
      // A different Hearth now: earlier edits can't be undone onto it.
      setHistory(emptyHistory());
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

  // Toasts call the newest useScene, not the one from when they were made.
  const latestUseScene = useRef(useScene);
  latestUseScene.current = useScene;

  // A theme family shared (CORE-055): its colors, wallpaper and ambience on
  // your Hearth, with Undo.
  function useSharedTheme({ look, fromName }: OpenedLook) {
    const first = fromName.trim().split(" ")[0] || "Family";
    const received = receiveTheme(look, personal.layout.customThemes, first);
    if (!received) {
      return Alert.alert("You have the most themes", "Remove one of your own themes in Settings → Theme to make room for this one.");
    }
    const mine = personal.layout;
    const before = { theme: mine.theme, customThemes: mine.customThemes, wallpaper: mine.wallpaper, ambience: mine.ambience };
    personal
      .save({
        theme: received.theme,
        customThemes: received.customThemes,
        wallpaper: look.wallpaper?.kind === "photo" ? { kind: "none" } : look.wallpaper ?? { kind: "none" },
        ambience: look.ambience ?? "off",
      })
      .then(() => {
        tap("success");
        setSharing(false);
        settleToast();
        showToast(`Using ${first}'s theme`, { label: "Undo", run: () => (settleToast(), void personal.save(before)) }, 6000);
      })
      .catch((saveError: Error) => Alert.alert("Couldn't use that theme", saveError.message));
  }

  // A whole Hearth family shared (CORE-055) becomes a new scene and switches
  // on; the Hearth you're leaving is kept as a scene, so nothing is lost.
  async function trySharedHearth({ look, fromName }: OpenedLook) {
    if (!isHearthLook(look) || !scenesReady || isLoading) return;
    const first = fromName.trim().split(" ")[0] || "Family";
    const received = receiveTheme(look, personal.layout.customThemes, first);
    if (!received) {
      return Alert.alert("You have the most themes", "Remove one of your own themes in Settings → Theme to make room for theirs.");
    }
    const result = addAndSwitch(scenes, personal.layout, sceneNameFor(fromName), lookAsSnapshot(look, received.theme));
    if (!result) {
      return Alert.alert(
        "Make room in Scenes first",
        `Trying ${first}'s Hearth keeps yours safe as a scene, and you have the most scenes there can be. Remove one in Edit → Scenes.`
      );
    }
    const before = scenes;
    try {
      await scenesStore.update({ scenes: result.state.scenes, active: result.state.active });
      await personal.save({ ...result.show, customThemes: received.customThemes });
      setHistory(emptyHistory());
    } catch (switchError) {
      scenesStore.update({ scenes: before.scenes, active: before.active }).catch(() => {});
      return Alert.alert("Couldn't switch to it", (switchError as Error).message);
    }
    stopSelecting();
    setFolded([]);
    tap("success");
    setSharing(false);
    settleToast();
    // Where "Switch back" goes: the scene you were on, or the one just made for it.
    const back = before.active ?? result.state.scenes.find((s) => s.id !== result.id && !before.scenes.some((b) => b.id === s.id))?.id;
    showToast(
      `Trying ${first}'s Hearth`,
      back ? { label: "Switch back", run: () => (settleToast(), void latestUseScene.current(back)) } : undefined,
      6000
    );
  }

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
      case "subscriptions":
        return router.push("/subscriptions");
      case "sickday":
        return router.push("/sickday");
      case "countdown":
        // A Getaway countdown opens that Getaway (TRIP-010).
        if (item.widget.settings.source === "getaway") {
          const tripId = item.widget.settings.getawayId;
          return router.push(tripId ? `/getaways/${tripId}` : "/getaways");
        }
        return router.push(`/widget/view/${item.id}`);
      case "recipe":
        // Today's pick opens straight to its page (REC-011).
        if (!session?.user.id) return router.push("/recipes");
        return loadRecipesSummary(session.user.id, item.widget.settings.shelf)
          .then((summary) => router.push(summary.today ? `/recipes/${summary.today.id}` : "/recipes"))
          .catch(() => router.push("/recipes"));
      case "gathering":
        // Opens the Gathering it's showing (GATH-009).
        return widgetGathering(item.widget.settings)
          .then((row) => router.push(row && row !== "gone" ? `/gatherings/${row.id}` : "/gatherings"))
          .catch(() => router.push("/gatherings"));
      case "greeting":
        return;
      case "fridge": {
        const place = fridgePlace(item.widget.settings, { onHomePage: onHomePageNow, homeId: home.homeId });
        // The big door takes the widget's color (CORE-086).
        const soft = item.color ?? tilePalette[0];
        const enamel = item.widget.look === "bold" ? deepColor(soft) : item.widget.look === "soft" ? soft : null;
        return router.push((place ? fridgeRoute(place, enamel) : `/widget/view/${item.id}`) as never);
      }
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

  // Copy a look (CORE-097): from here on, tapping things gives them it.
  function startPainting(look: Look) {
    tap("success");
    settleToast();
    stopSelecting();
    setCubbyMode(false);
    setPainting(look);
  }
  function paintOne(item: HearthItem) {
    if (!painting) return;
    const next = paintItem(item, painting);
    if (!next) {
      tap();
      settleToast();
      const why =
        item.kind === "label"
          ? "Text only takes a look copied from text"
          : item.kind === "trinket" || item.kind === "cubby"
            ? "Decorations and boxes keep their own look"
            : "Tiles take a look copied from a tile or widget";
      return showToast(why, undefined, 2500, "palette");
    }
    tap("success");
    persistHere((inner) => updateItem(inner, item.id, next));
    setFlashId(item.id);
    setTimeout(() => setFlashId((id) => (id === item.id ? null : id)), 900);
  }

  function onPressItem(item: HearthItem) {
    // A checkbox inside a widget was just pressed; that's not an "open".
    if (touchesGuarded()) return;
    // While moving with the arrows, tapping another tile moves that one.
    if (movingId) {
      tap();
      setMovingId(item.id);
      return;
    }
    if (item.kind === "label" && item.divider && !editing && !selecting) {
      tap();
      setFolded((prev) => (prev.includes(item.id) ? prev.filter((id) => id !== item.id) : [...prev, item.id]));
      return;
    }
    if (painting && editing) {
      paintOne(item);
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
      addItem(inner, { id, kind: "label", text: scope ? "Up top" : "My Nooks", size: "heading", align: "left", w: 4, h: 0.5 })
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

  // A Cubby (CORE-084): a decorated box to put behind things. It goes in the
  // first open spot, ready to be dragged around whatever it should hold.
  function addCubby(style: CubbyStyle) {
    setAdding(false);
    const info = cubbyStyleInfo(style);
    const id = newItemId("b");
    if (!persistHere((inner) => addItem(inner, { id, kind: "cubby", style, color: info.color, w: 4, h: 2 }))) return;
    tap("success");
    setEditing(true);
    stopSelecting();
    setCubbyMode(true);
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

  function showToast(text: string, action?: { label: string; run: () => void }, ms = 4000, icon?: IconName) {
    setToast({ text, action, icon });
    toastTimer.current = setTimeout(settleToast, ms);
  }

  function itemLabel(item: HearthItem) {
    if (item.kind === "widget") return item.widget.title || widgetKindInfo(item.widget.kind).label;
    if (item.kind === "nook") return nookLabel(item);
    if (item.kind === "hollow") return item.name;
    if (item.kind === "trinket") return trinketInfo(item.piece).label;
    if (item.kind === "cubby") return cubbyStyleInfo(item.style).label;
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
          persist(before, { undoable: false });
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

  // Select many (CORE-060). Leaving Edit puts the picking away, and Cubby
  // mode (CORE-085) too.
  useEffect(() => {
    if (!editing) {
      stopSelecting();
      setCubbyMode(false);
      setHistory(emptyHistory());
      setMoreOpen(false);
      setPainting(null);
    }
  }, [editing]);
  const hasCubby = items.some((item) => item.kind === "cubby");
  useEffect(() => {
    if (!hasCubby) setCubbyMode(false);
  }, [hasCubby]);

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
                  persist(before, { undoable: false });
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
          persist(before, { undoable: false });
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
    if (found.item.kind === "cubby" && !found.hollowId) {
      stopSelecting();
      setCubbyMode(true);
    }
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

  // Moving with the arrow bar (CORE-076): keep the tile in view above the
  // bar as it goes, stop when editing ends, and pick up a "Move it on your
  // Hearth" from the widget editor.
  const movingItem = movingId ? items.find((i) => i.id === movingId) : undefined;
  useEffect(() => {
    if (!movingItem || !gridWidth) return;
    const stride = (gridWidth - GRID_GAP * (COLUMNS - 1)) / COLUMNS + GRID_GAP;
    const top = gridTop.current + movingItem.y * stride;
    const bottom = top + movingItem.h * stride;
    const shown = scrollY.value;
    const room = viewHeight.value - 250;
    if (top < shown + 16) tourScroll.scrollRef.current?.scrollTo({ y: Math.max(0, top - 24), animated: true });
    else if (room > 0 && bottom > shown + room) tourScroll.scrollRef.current?.scrollTo({ y: bottom - room + 16, animated: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movingItem?.id, movingItem?.x, movingItem?.y, gridWidth]);
  useEffect(() => {
    if (!editing) setMovingId(null);
  }, [editing]);
  useEffect(() => {
    if (movingId && !isLoading && !movingItem) setMovingId(null);
  }, [movingId, movingItem, isLoading]);
  useFocusEffect(
    useCallback(() => {
      const look = takePaintRequest();
      if (!look) return;
      setEditing(true);
      setSelecting(false);
      setCubbyMode(false);
      setPainting(look);
    }, [])
  );
  useFocusEffect(
    useCallback(() => {
      const id = takeMoveRequest();
      if (!id) return;
      measureViewport();
      setEditing(true);
      setMovingId(id);
    }, [measureViewport])
  );

  function nudgeMoving(way: Nudge) {
    if (!movingId) return;
    persistHere((inner) => nudgeItem(inner, movingId, way));
    AccessibilityInfo.announceForAccessibility(`Moved ${way}`);
  }

  const optionsItem = (items.find((i) => i.id === optionsFor && i.kind !== "widget") ?? null) as
    | NookItem
    | LabelItem
    | HollowItem
    | TrinketItem
    | CubbyItem
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
          onHomePage={onHomePageNow}
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
    if (item.kind === "cubby") {
      return (
        <CubbyArt
          uid={item.id}
          styleKey={item.style}
          color={itemColor(item)}
          pattern={item.pattern}
          fill={item.fill}
          corners={item.corners}
          shadow={shadowAtLevel(themeKey, liftLevel(item.lift, false))}
          width={size.width}
          height={size.height}
        />
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
    return (
      <LabelFace
        item={item}
        {...size}
        theme={theme}
        folded={item.divider && folded.includes(item.id) && !editing}
        hiddenCount={item.divider ? hiddenBy(items, item.id) : 0}
      />
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

  // The item as it'll look on the Hearth, kept at the top of its options
  // while you change it (CORE-079).
  function renderPreview(item: HearthItem) {
    const stride = (gridWidth - GRID_GAP * (COLUMNS - 1)) / COLUMNS + GRID_GAP;
    const size = { width: item.w * stride - GRID_GAP, height: item.h * stride - GRID_GAP };
    if (!gridWidth) return null;
    // A Cubby is shown with what's in it, so you can see how it looks together.
    const inside =
      item.kind === "cubby"
        ? cubbyContents(oneOfEachStack(items, stackShown), item).sort((a, b) => (a.kind === "cubby" ? 0 : 1) - (b.kind === "cubby" ? 0 : 1))
        : [];
    return (
      <ItemPreview
        {...size}
        maxHeight={windowHeight * 0.22}
        background={theme.background}
        backdrop={<WallpaperLayer wallpaper={wallpaper} background={theme.background} dark={theme.dark} />}
      >
        {renderInner(item, size)}
        {inside.map((inner) => (
          <View
            key={inner.id}
            style={{
              position: "absolute",
              left: (inner.x - item.x) * stride,
              top: (inner.y - item.y) * stride,
              width: inner.w * stride - GRID_GAP,
              height: inner.h * stride - GRID_GAP,
            }}
          >
            {renderInner(inner, { width: inner.w * stride - GRID_GAP, height: inner.h * stride - GRID_GAP })}
          </View>
        ))}
      </ItemPreview>
    );
  }
  const ambienceKind = activeAmbience(
    layout.ambience,
    new Date(),
    outside.weather ? ambienceForWeather(outside.weather.condition) : null
  );

  // Edit's toolbar (CORE-094), whenever nothing else is using the bottom.
  // Both step aside while a sheet is open, so they never cover its bottom.
  const editBarShown = editing && !selecting && !painting && !dragging && !movingItem && !barsHidden && !hollowOptions;
  const paintBarShown = editing && !!painting && !dragging && !movingItem && !barsHidden && !hollowOptions;
  const moreTools: MoreTool[] = [];
  if (!isEmpty) {
    moreTools.push({
      key: "select",
      label: "Select several",
      hint: "Pick a few things to move, color, tag, lock or remove together.",
      icon: "check",
      onPress: () => {
        tap();
        setCubbyMode(false);
        setPainting(null);
        setSelecting(true);
        setPicked([]);
      },
    });
  }
  if (hasCubby) {
    moreTools.push({
      key: "cubbies",
      label: cubbyMode ? "Done with Cubbies" : "Cubbies",
      hint: "Reach the boxes behind your tiles to move or decorate them.",
      icon: "category",
      onPress: () => {
        tap();
        stopSelecting();
        setCubbyMode((on) => !on);
      },
    });
  }
  if (!isEmpty && !scope) {
    moreTools.push({ key: "tidy", label: "Tidy up", hint: "Close the gaps, keeping everything in its column.", icon: "tidy", onPress: tidyUp });
    moreTools.push({ key: "find", label: "Find", hint: "Search for something on any page or in a Hollow.", icon: "search", onPress: () => setFinding(true) });
    moreTools.push({ key: "scenes", label: "Scenes", hint: "Save this look and switch between looks.", icon: "sparkles", onPress: () => setScenesOpen(true) });
  }
  if (!scope) {
    moreTools.push({
      key: "starters",
      label: "Start from a layout",
      hint: "Family & gifts, Home & chores, Just me, or Christmas.",
      icon: "sparkles",
      onPress: () => setStartersOpen(true),
    });
    moreTools.push({ key: "share", label: "Share your look", hint: "Send your theme or whole Hearth to someone.", icon: "share", onPress: () => setSharing(true) });
  }
  if (tipHidden) {
    moreTools.push({ key: "tip", label: "Show the tip again", hint: "The one-line reminder of how moving works.", icon: "drag", onPress: () => hideTip(false) });
  }
  // The "?" lives here rather than in the header, so the header has room for
  // your name (CORE-069).
  moreTools.push({ key: "help", label: "Help", hint: "Answers to common questions, and the tour.", icon: "help", onPress: showHelp });

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

        {showStrip || showTags ? (
          <View onLayout={(e) => setStripHeight(e.nativeEvent.layout.height)}>
          {showStrip ? (
            <PageStrip
            pages={layout.pages}
            activeId={layout.activePage}
            homeId={showsHome ? HOME_PAGE : undefined}
            newsIds={pagesWithNews}
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
            // Room to scroll the last row above the arrow bar while moving.
            contentContainerStyle={[styles.container, movingId ? { paddingBottom: 240 } : editing ? { paddingBottom: 130 } : null]}
            scrollEnabled={!dragging}
            keyboardShouldPersistTaps="handled"
          >
            {editing && !holdStarted && (cubbyMode || !tipHidden) ? (
              <Animated.View
                entering={FadeIn.duration(200)}
                exiting={FadeOut.duration(150)}
                style={[styles.hint, { backgroundColor: `${theme.accent}18` }]}
              >
                <Icon name={cubbyMode ? "category" : "drag"} size={18} color={theme.accent} />
                <Text style={{ color: theme.text, flex: 1 }}>
                  {cubbyMode
                    ? "Cubby mode: everything else is faded so you can reach the boxes. Hold a box to move it with what's inside; drag ↘ to resize, tap to decorate."
                    : scope
                    ? "Hold anything and drag it: to an open spot, onto something its size to swap, or onto the trash. Hold still where there's no room to make room. Drag a corner to resize; tap to change it."
                    : "Hold anything and drag it: to an open spot, onto something its size to swap, onto a Hollow, or onto the trash. Hold still where there's no room to make room. Drag a corner to resize; tap to change it."}
                </Text>
                {cubbyMode ? (
                  <Pill
                    icon="check"
                    label="Done"
                    accent={theme.accent}
                    background={theme.background}
                    onPress={() => {
                      tap();
                      setCubbyMode(false);
                    }}
                  />
                ) : (
                  <Tap onPress={() => hideTip(true)} hitSlop={12} pressedScale={0.85} accessibilityRole="button" accessibilityLabel="Hide this tip">
                    <Icon name="close" size={16} color={theme.muted} />
                  </Tap>
                )}
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
                const y = e.nativeEvent.layout.y;
                if (keepGridStill.current && y !== gridTop.current) {
                  keepGridStill.current = false;
                  (scrollView.current as unknown as { scrollTo?: (o: { y: number; animated?: boolean }) => void } | null)?.scrollTo?.({
                    y: Math.max(0, scrollY.value + y - gridTop.current),
                    animated: false,
                  });
                }
                gridTop.current = y;
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
                  {scope || onHome ? null : (
                    <Tap
                      style={[styles.outlineButton, { borderColor: theme.accent, alignSelf: "stretch" }]}
                      onPress={() => setStartersOpen(true)}
                    >
                      <Icon name="sparkles" size={18} color={theme.accent} />
                      <Text style={{ color: theme.accent, fontWeight: "600" }}>Start from a layout</Text>
                    </Tap>
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
                  onPush={(id, x, y) => {
                    if (persistHere((inner) => pushItem(inner, id, x, y))) tap("success");
                  }}
                  onNudge={(id, way) => persistHere((inner) => nudgeItem(inner, id, way))}
                  focusId={movingId}
                  onResize={(id, w, h) => persistHere((inner) => resizeItem(inner, id, w, h))}
                  onDropIntoHollow={
                    scope
                      ? undefined
                      : (id, hollowId) => {
                          if (persist(moveToScope(layout, id, hollowId))) tap("success");
                        }
                  }
                  onPressItem={onPressItem}
                  onLongPress={(picked) => {
                    if (picked) {
                      holdStartedNow.current = true;
                      setHoldStarted(true);
                    }
                    setEditing(true);
                  }}
                  onCopy={(item) => copyTo(item.id, scope)}
                  onTrash={trash}
                  onTrashHover={setOverTrash}
                  onTrashArmed={setTrashArmed}
                  flashId={flashId}
                  selecting={selecting}
                  cubbyMode={cubbyMode}
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

            {!scope && !editing && !isLoading && !isEmpty && !starterOfferHidden && isFreshPage(layout) ? (
              <Animated.View entering={FadeIn.duration(250)} exiting={FadeOut.duration(150)} style={[styles.offer, { borderColor: `${theme.accent}55` }]}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <Icon name="sparkles" size={20} color={theme.accent} />
                  <Text style={{ color: theme.text, fontWeight: "800", fontSize: 16, flex: 1 }}>Start with a ready-made Hearth?</Text>
                  <Tap onPress={hideStarterOffer} hitSlop={12} pressedScale={0.85} accessibilityRole="button" accessibilityLabel="No thanks">
                    <Icon name="close" size={16} color={theme.muted} />
                  </Tap>
                </View>
                <Text style={{ color: theme.muted }}>
                  Family & gifts, Home & chores, Just me, or Christmas. Everything in it can be moved or changed after.
                </Text>
                <Tap style={[styles.addButton, { backgroundColor: theme.accent }]} onPress={() => setStartersOpen(true)}>
                  <Icon name="sparkles" size={18} color={theme.background} />
                  <Text style={[styles.addButtonText, { color: theme.background }]}>Choose a layout</Text>
                </Tap>
              </Animated.View>
            ) : null}

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
          style={[styles.trashArea, { bottom: (scope ? insets.bottom : 0) + (editBarShown || paintBarShown ? 12 + (editBarHeight || 64) + 10 : 20) }]}
          pointerEvents="box-none"
        >
          <View style={[styles.trash, styles.toast, { backgroundColor: theme.text, borderColor: theme.text }]}>
            <Icon
              name={toast.icon ?? (toast.action?.label === "Undo" ? (toast.text.startsWith("Tidied") ? "tidy" : toast.text.startsWith("Moved") ? "widgets" : "trash") : toast.text.includes("ocked") ? "lock" : "copy")}
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

      {editBarShown ? (
        <EditBar
          accent={theme.accent}
          background={theme.background}
          text={theme.text}
          bottom={(scope ? insets.bottom : 0) + 12}
          canUndo={history.past.length > 0}
          canRedo={history.future.length > 0}
          onUndo={undoEdit}
          onRedo={redoEdit}
          onAdd={() => setAdding(true)}
          onDecorate={() => setDecorating(true)}
          onPages={scope ? undefined : () => setPagesOpen(true)}
          onTidy={tidyUp}
          onMore={() => setMoreOpen(true)}
          onLayout={setEditBarHeight}
        />
      ) : null}
      {paintBarShown && painting ? (
        <PaintBar
          look={painting}
          accent={theme.accent}
          background={theme.background}
          text={theme.text}
          bottom={(scope ? insets.bottom : 0) + 12}
          onDone={() => {
            tap();
            setPainting(null);
          }}
        />
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

      {movingItem ? (
        <MoveBar
          name={itemDisplayName(movingItem)}
          at={movingItem}
          can={(way) => canNudge(movingItem, way)}
          onNudge={nudgeMoving}
          onDone={() => {
            tap("success");
            setMovingId(null);
          }}
          theme={theme}
        />
      ) : null}

      {/* Sheets sit inside the screen (not system pop-ups) so opening another
          screen from them can't collide with a half-dismissed pop-up. */}
      <ItemOptions
        item={optionsItem}
        onChange={(changes) => optionsFor && persistHere((inner) => updateItem(inner, optionsFor, changes))}
        onResize={(w, h) => optionsFor && persistHere((inner) => resizeItem(inner, optionsFor, w, h))}
        renderPreview={renderPreview}
        onStartMove={() => {
          const id = optionsFor;
          setOptionsFor(null);
          setMovingId(id);
        }}
        onCopyLook={
          optionsItem && lookOf(optionsItem)
            ? () => {
                const look = lookOf(optionsItem);
                setOptionsFor(null);
                if (look) startPainting(look);
              }
            : undefined
        }
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
          renderPreview={renderPreview}
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
        fireSound={layout.fireSound}
        onFireSound={(fireSound) => save({ fireSound }).catch((saveError: Error) => Alert.alert("Couldn't save that", saveError.message))}
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

      {scope ? null : (
        <ShareSheet
          visible={sharing}
          onClose={() => setSharing(false)}
          layout={personal.layout}
          onUseTheme={useSharedTheme}
          onTryHearth={(opened) => void trySharedHearth(opened)}
        />
      )}

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

      <EditMoreSheet visible={moreOpen} onClose={() => setMoreOpen(false)} tools={moreTools} accent={theme.accent} />

      <StarterSheet
        visible={startersOpen}
        onClose={() => setStartersOpen(false)}
        onPick={useStarter}
        fresh={isFreshPage(layout)}
        accent={theme.accent}
      />

      <AddSheet
        visible={adding}
        onClose={() => setAdding(false)}
        onAddWidget={addWidget}
        onAddLabel={addLabel}
        onAddHollow={scope || onHome ? undefined : addHollow}
        onAddTrinket={addTrinket}
        onAddCubby={addCubby}
        hollowName={hollow?.name}
        onOpenMarket={() => {
          setAdding(false);
          router.push("/market");
        }}
      />
    </View>
  );
}

// Whether the one-line tip at the top of Edit has been put away (CORE-094).
const EDIT_TIP_KEY = "nook.hearth.editTipHidden";
// Whether "Start with a ready-made Hearth?" has been turned down (CORE-096).
const STARTER_OFFER_KEY = "nook.hearth.starterOfferHidden";

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
  offer: { gap: 10, padding: 16, borderWidth: 1.5, borderStyle: "dashed", borderRadius: 20 },
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
