import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import {
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeOut,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

import { useAuth } from "../lib/auth-context";
import { tap } from "../lib/feedback";
import { useNookSettings } from "../lib/nook-settings";
import { colors, shadow, themed } from "../lib/theme";
import {
  firstTour,
  holePath,
  isWithin,
  placeBubble,
  resolveSteps,
  revealOffset,
  spotlight,
  type Rect,
  type TourScreen,
  type TourStep,
} from "../lib/tour";
import { Icon, IconBadge } from "./icon";
import { Tap } from "./motion";

// The first-time tour (CORE-026). Screens wrap the things worth pointing at
// in <TourTarget id="…">; the Hearth calls useTourAutoStart(ready) so the
// tour starts the first time someone ever lands there — and never again,
// unless they ask for it in Settings. The overlay dims the
// screen, cuts a soft spotlight around the target, and a bubble with an
// arrow explains it. Targets inside a <TourScrollArea> are scrolled into
// view first. Lives in the tabs layout, so it can point at the tab bar too.
// Outside the provider (e.g. inside a Hollow) all of it is a no-op.

const tourDefaults = { hearth: false };

// Once the tour has started for someone, it never starts again on its own.
// Remembered three ways, so nothing can bring it back by accident: on the
// account (follows them to a new phone), on this phone (in case that save
// fails), and for as long as the app stays open.
const startedThisSession = new Set<string>();
const phoneKey = (userId: string) => `nook.tourSeen.${userId}`;

// A scrolling list the tour can move to bring a target into view.
type ScrollArea = {
  viewport: RefObject<View | null>;
  metrics: RefObject<{ offset: number; content: number }>;
  scrollTo: (y: number) => void;
};
const ScrollAreaContext = createContext<ScrollArea | null>(null);

type Target = { ref: RefObject<View | null>; area: ScrollArea | null };

type TourContextValue = {
  register: (id: string, target: Target) => () => void;
  maybeStart: () => void;
  replay: () => Promise<void>;
};

const TourContext = createContext<TourContextValue | null>(null);

const AnimatedPath = Animated.createAnimatedComponent(Path);

function measure(view: View | null | undefined) {
  return new Promise<Rect | null>((resolve) => {
    if (!view) return resolve(null);
    view.measureInWindow((x, y, width, height) => resolve({ x, y, width, height }));
  });
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function TourProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user.id;
  const { settings: seen, update, isLoading, error } = useNookSettings("tours", tourDefaults);
  const [seenOnPhone, setSeenOnPhone] = useState<boolean | null>(null);
  const targets = useRef(new Map<string, Target>());
  const scrolled = useRef(new Set<ScrollArea>());
  const screen = useRef<TourScreen>("hearth");
  const [active, setActive] = useState<TourStep[] | null>(null);
  const starting = useRef(false);
  const { width, height } = useWindowDimensions();

  useEffect(() => {
    if (!userId) return;
    setSeenOnPhone(null);
    AsyncStorage.getItem(phoneKey(userId))
      .then((value) => setSeenOnPhone(value === "1"))
      .catch(() => setSeenOnPhone(false));
  }, [userId]);

  const register = useCallback((id: string, target: Target) => {
    targets.current.set(id, target);
    return () => {
      if (targets.current.get(id) === target) targets.current.delete(id);
    };
  }, []);

  // Get to a step's target: switch tabs if the step lives on another one,
  // wait for the target to appear (that tab may still be loading), and
  // scroll its list to it if need be. Null if it can't be shown (the bubble
  // then sits in the middle).
  const locate = useCallback(
    async (step: TourStep) => {
      if (step.screen && step.screen !== screen.current) {
        screen.current = step.screen;
        router.navigate(`/${step.screen}`);
        await wait(450);
      }
      const id = step.target;
      if (!id) return null;
      for (let tries = 0; tries < 25 && !targets.current.get(id)?.ref.current; tries++) await wait(120);
      const target = targets.current.get(id);
      let rect = await measure(target?.ref.current);
      const area = target?.area;
      const viewport = area ? await measure(area.viewport.current) : null;
      if (!target || !rect) return null;
      if (!area || !viewport) return isWithin(rect, { x: 0, y: 0, width, height }) ? rect : null;
      const next = revealOffset(rect, viewport, area.metrics.current.offset, area.metrics.current.content);
      if (next !== null) {
        scrolled.current.add(area);
        area.scrollTo(next);
        await wait(450);
        rect = await measure(target.ref.current);
      }
      return isWithin(rect, viewport) ? rect : null;
    },
    [width, height]
  );

  const maybeStart = useCallback(() => {
    // Wait until we know for sure it hasn't been seen — on the account and
    // on this phone. If either can't be read, skip it rather than risk
    // showing it again.
    if (!userId || isLoading || error || seenOnPhone !== false || seen.hearth) return;
    if (startedThisSession.has(userId) || active || starting.current) return;
    starting.current = true;
    // Give the screen a moment to settle (entrance animations, layout).
    setTimeout(() => {
      starting.current = false;
      if (startedThisSession.has(userId)) return;
      // Counts as seen from the moment it starts, so closing the app (or
      // wandering off) halfway through doesn't bring it back.
      startedThisSession.add(userId);
      setSeenOnPhone(true);
      AsyncStorage.setItem(phoneKey(userId), "1").catch(() => {});
      update({ hearth: true }).catch(() => {});

      const present = new Set(
        [...targets.current].filter(([, target]) => target.ref.current).map(([id]) => id)
      );
      screen.current = "hearth";
      setActive(resolveSteps(firstTour, present, "hearth"));
    }, 700);
  }, [userId, isLoading, error, seenOnPhone, seen.hearth, active, update]);

  const finish = useCallback(() => {
    // Back home to the Hearth, with any list we scrolled back at the top.
    if (screen.current !== "hearth") {
      screen.current = "hearth";
      router.navigate("/hearth");
    }
    scrolled.current.forEach((area) => area.scrollTo(0));
    scrolled.current.clear();
    setActive(null);
  }, []);

  // Settings → "Show me around again".
  const replay = useCallback(async () => {
    if (!userId) return;
    startedThisSession.delete(userId);
    await AsyncStorage.removeItem(phoneKey(userId)).catch(() => {});
    setSeenOnPhone(false);
    await update({ hearth: false });
  }, [userId, update]);

  const value = useMemo(() => ({ register, maybeStart, replay }), [register, maybeStart, replay]);

  return (
    <TourContext.Provider value={value}>
      {children}
      {active ? <TourOverlay steps={active} locate={locate} onDone={finish} /> : null}
    </TourContext.Provider>
  );
}

export function useTour() {
  return useContext(TourContext);
}

// Wrap anything the tour should be able to point at.
export function TourTarget({
  id,
  style,
  children,
}: {
  id: string;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const tour = useContext(TourContext);
  const area = useContext(ScrollAreaContext);
  const ref = useRef<View>(null);
  useEffect(() => tour?.register(id, { ref, area }), [tour, id, area]);
  return (
    <View ref={ref} collapsable={false} style={style}>
      {children}
    </View>
  );
}

// Start the tour the first time someone ever sees this screen (the
// Hearth), once `ready` (its content has loaded, so the things to point at
// exist).
export function useTourAutoStart(ready: boolean) {
  const tour = useContext(TourContext);
  useFocusEffect(
    useCallback(() => {
      if (ready) tour?.maybeStart();
    }, [tour, ready])
  );
}

// Lets the tour scroll a list to reach targets inside it. Give the
// ScrollView `ref={scrollRef}` and `{...scrollProps}`, and wrap it in
// <TourScrollArea area={area}>.
export function useTourScrollArea() {
  const scrollRef = useRef<{ scrollTo: (options: { y: number; animated?: boolean }) => void }>(null);
  const viewport = useRef<View>(null);
  const metrics = useRef({ offset: 0, content: 0 });
  const area = useMemo<ScrollArea>(
    () => ({
      viewport,
      metrics,
      scrollTo: (y) => {
        metrics.current.offset = y;
        scrollRef.current?.scrollTo({ y, animated: true });
      },
    }),
    []
  );
  const scrollProps = {
    scrollEventThrottle: 32,
    onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      metrics.current.offset = event.nativeEvent.contentOffset.y;
    },
    onContentSizeChange: (_width: number, contentHeight: number) => {
      metrics.current.content = contentHeight;
    },
  };
  return { area, scrollRef, scrollProps };
}

export function TourScrollArea({ area, children }: { area: ScrollArea; children: ReactNode }) {
  return (
    <ScrollAreaContext.Provider value={area}>
      <View ref={area.viewport} collapsable={false} style={{ flex: 1 }}>
        {children}
      </View>
    </ScrollAreaContext.Provider>
  );
}

function TourOverlay({
  steps,
  locate,
  onDone,
}: {
  steps: TourStep[];
  locate: (step: TourStep) => Promise<Rect | null>;
  onDone: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const [index, setIndex] = useState(0);
  // Where this step's target is, once it's been found (and scrolled to).
  const [found, setFound] = useState<{ index: number; rect: Rect | null } | null>(null);
  const step = steps[index];
  const ready = found?.index === index;
  const rect = ready ? found.rect : null;
  const placement = placeBubble(rect, { width, height });
  const isLast = index === steps.length - 1;

  useEffect(() => {
    let cancelled = false;
    const current = steps[index];
    (current ? locate(current) : Promise.resolve(null)).then((next) => {
      if (!cancelled) setFound({ index, rect: next });
    });
    return () => {
      cancelled = true;
    };
  }, [index, steps, locate]);

  // The spotlight glides from one target to the next. With nothing to
  // point at (or while scrolling to the next thing), it shrinks to a dot in
  // the middle and the whole screen dims.
  const hole = rect ? spotlight(rect) : { x: width / 2, y: height / 2, width: 0, height: 0 };
  const hx = useSharedValue(hole.x);
  const hy = useSharedValue(hole.y);
  const hw = useSharedValue(hole.width);
  const hh = useSharedValue(hole.height);
  useEffect(() => {
    const timing = { duration: reduceMotion ? 0 : 380, easing: Easing.inOut(Easing.cubic) };
    hx.value = withTiming(hole.x, timing);
    hy.value = withTiming(hole.y, timing);
    hw.value = withTiming(hole.width, timing);
    hh.value = withTiming(hole.height, timing);
  }, [hole.x, hole.y, hole.width, hole.height, reduceMotion, hx, hy, hw, hh]);

  const holeProps = useAnimatedProps(() => ({
    d: holePath(width, height, hx.value, hy.value, hw.value, hh.value, 18),
  }));

  // A soft ring around the target that gently breathes.
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (reduceMotion) return;
    pulse.value = withRepeat(
      withSequence(withTiming(1.06, { duration: 700 }), withTiming(1, { duration: 700 })),
      -1,
      false
    );
  }, [pulse, reduceMotion]);
  const ringStyle = useAnimatedStyle(() => ({
    left: hx.value,
    top: hy.value,
    width: hw.value,
    height: hh.value,
    opacity: hw.value > 0 ? 1 : 0,
    transform: [{ scale: pulse.value }],
  }));

  if (!step) return null;

  function next() {
    tap();
    if (isLast) onDone();
    else setIndex((i) => i + 1);
  }

  const bubblePosition: ViewStyle =
    placement.side === "below"
      ? { top: placement.top }
      : placement.side === "above"
        ? { bottom: placement.bottom }
        : { top: height * 0.3 };
  const entering = (placement.side === "above" ? FadeInDown : FadeInUp).springify().damping(18).stiffness(200);

  return (
    <Animated.View
      entering={FadeIn.duration(250)}
      exiting={FadeOut.duration(200)}
      style={StyleSheet.absoluteFill}
      accessibilityViewIsModal
    >
      {/* Catches every touch: the tour is moved along with its buttons. */}
      <View style={StyleSheet.absoluteFill} onStartShouldSetResponder={() => true} />
      <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
        <AnimatedPath animatedProps={holeProps} fill="rgba(34, 22, 14, 0.62)" fillRule="evenodd" />
      </Svg>
      <Animated.View pointerEvents="none" style={[styles.ring, ringStyle]} />

      {ready ? (
        <Animated.View key={index} entering={entering} style={[styles.bubble, bubblePosition]}>
          {placement.side !== "center" ? (
            <View
              style={[
                styles.arrow,
                { left: placement.arrowX - 9 },
                placement.side === "below" ? { top: -8 } : { bottom: -8 },
              ]}
            />
          ) : null}
          <View style={styles.titleRow}>
            <IconBadge name={step.icon} size={placement.side === "center" ? 48 : 38} />
            <Text style={styles.title} accessibilityRole="header">
              {step.title}
            </Text>
          </View>
          <Text style={styles.body}>{step.body}</Text>
          <View style={styles.footer}>
            {isLast ? (
              <View />
            ) : (
              <Tap onPress={onDone} hitSlop={10} accessibilityRole="button">
                <Text style={styles.skip}>Skip</Text>
              </Tap>
            )}
            {steps.length > 1 ? (
              <View style={styles.dots} accessibilityLabel={`Step ${index + 1} of ${steps.length}`}>
                {steps.map((_, i) => (
                  <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
                ))}
              </View>
            ) : null}
            <Tap onPress={next} style={styles.next} accessibilityRole="button">
              <Text style={styles.nextText}>{isLast ? "Got it" : index === 0 && !rect ? "Show me" : "Next"}</Text>
              {isLast ? null : <Icon name="chevron" size={12} color={colors.onAccent} />}
            </Tap>
          </View>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    ring: {
      position: "absolute",
      borderRadius: 18,
      borderWidth: 2.5,
      borderColor: "#f6d9c4",
    },
    bubble: {
      position: "absolute",
      left: 16,
      right: 16,
      backgroundColor: colors.background,
      borderRadius: 24,
      padding: 18,
      gap: 10,
      ...shadow,
    },
    arrow: {
      position: "absolute",
      width: 18,
      height: 18,
      backgroundColor: colors.background,
      transform: [{ rotate: "45deg" }],
      borderRadius: 3,
    },
    titleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    title: { flex: 1, fontSize: 19, fontWeight: "800", color: colors.text, letterSpacing: -0.3 },
    body: { fontSize: 15, lineHeight: 21, color: colors.text },
    footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
    skip: { color: colors.muted, fontSize: 15, fontWeight: "600" },
    dots: { flexDirection: "row", gap: 6 },
    dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border },
    dotActive: { backgroundColor: colors.bark, width: 16 },
    next: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: colors.bark,
      borderRadius: 999,
      paddingVertical: 9,
      paddingHorizontal: 18,
    },
    nextText: { color: colors.onAccent, fontSize: 15, fontWeight: "700" },
  })
);
