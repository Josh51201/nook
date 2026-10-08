import { useFocusEffect } from "expo-router";
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

import { tap } from "../lib/feedback";
import { useNookSettings } from "../lib/nook-settings";
import { colors, shadow } from "../lib/theme";
import {
  holePath,
  isWithin,
  placeBubble,
  resolveSteps,
  revealOffset,
  spotlight,
  tours,
  type Rect,
  type TourKey,
  type TourStep,
} from "../lib/tour";
import { Icon, IconBadge } from "./icon";
import { Tap } from "./motion";

// The first-time tour (CORE-026). Screens wrap the things worth pointing at
// in <TourTarget id="…">, and call useTourAutoStart("hearth", ready) so the
// tour starts the first time someone lands there. The overlay dims the
// screen, cuts a soft spotlight around the target, and a bubble with an
// arrow explains it. Targets inside a <TourScrollArea> are scrolled into
// view first. Lives in the tabs layout, so it can point at the tab bar too.
// Outside the provider (e.g. inside a Hollow) all of it is a no-op.

type Seen = Record<TourKey, boolean>;
const tourDefaults: Seen = { hearth: false, burrows: false };

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
  maybeStart: (key: TourKey) => void;
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
  const { settings: seen, update, isLoading, error } = useNookSettings("tours", tourDefaults);
  const targets = useRef(new Map<string, Target>());
  const scrolled = useRef(new Set<ScrollArea>());
  const [active, setActive] = useState<{ key: TourKey; steps: TourStep[] } | null>(null);
  const starting = useRef(false);
  const { width, height } = useWindowDimensions();

  const register = useCallback((id: string, target: Target) => {
    targets.current.set(id, target);
    return () => {
      if (targets.current.get(id) === target) targets.current.delete(id);
    };
  }, []);

  // Find a target on screen, scrolling its list to it if need be. Null if
  // it can't be shown (the bubble then sits in the middle).
  const locate = useCallback(
    async (id: string) => {
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

  const maybeStart = useCallback(
    (key: TourKey) => {
      // Not loaded (or couldn't load) yet: better to skip than to show the
      // tour every single time.
      if (isLoading || error || seen[key] || active || starting.current) return;
      starting.current = true;
      // Give the screen a moment to settle (entrance animations, layout).
      setTimeout(() => {
        starting.current = false;
        const present = new Set(
          [...targets.current].filter(([, target]) => target.ref.current).map(([id]) => id)
        );
        const steps = resolveSteps(tours[key], present);
        setActive((current) => current ?? { key, steps });
      }, 700);
    },
    [isLoading, error, seen, active]
  );

  const finish = useCallback(() => {
    if (!active) return;
    update({ [active.key]: true } as Partial<Seen>).catch(() => {});
    // Put any list we scrolled back at the top, where it started.
    scrolled.current.forEach((area) => area.scrollTo(0));
    scrolled.current.clear();
    setActive(null);
  }, [active, update]);

  const replay = useCallback(() => update({ hearth: false, burrows: false }), [update]);

  const value = useMemo(() => ({ register, maybeStart, replay }), [register, maybeStart, replay]);

  return (
    <TourContext.Provider value={value}>
      {children}
      {active ? <TourOverlay key={active.key} steps={active.steps} locate={locate} onDone={finish} /> : null}
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

// Start this screen's tour the first time someone sees it, once `ready`
// (its content has loaded, so the things to point at exist).
export function useTourAutoStart(key: TourKey, ready: boolean) {
  const tour = useContext(TourContext);
  useFocusEffect(
    useCallback(() => {
      if (ready) tour?.maybeStart(key);
    }, [tour, key, ready])
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
  locate: (id: string) => Promise<Rect | null>;
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
    const target = steps[index]?.target;
    (target ? locate(target) : Promise.resolve(null)).then((next) => {
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
              {isLast ? null : <Icon name="chevron" size={12} color={colors.white} />}
            </Tap>
          </View>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
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
  nextText: { color: colors.white, fontSize: 15, fontWeight: "700" },
});
