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
import { StyleSheet, Text, useWindowDimensions, View, type StyleProp, type ViewStyle } from "react-native";
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
  isOnScreen,
  placeBubble,
  resolveSteps,
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
// arrow explains it. Lives in the tabs layout, so it can point at the tab
// bar too. Outside the provider (e.g. inside a Hollow) all of it is a no-op.

type Seen = Record<TourKey, boolean>;
const tourDefaults: Seen = { hearth: false, burrows: false };

type TourContextValue = {
  register: (id: string, ref: RefObject<View | null>) => () => void;
  maybeStart: (key: TourKey) => void;
  replay: () => Promise<void>;
};

const TourContext = createContext<TourContextValue | null>(null);

const AnimatedPath = Animated.createAnimatedComponent(Path);

export function TourProvider({ children }: { children: ReactNode }) {
  const { settings: seen, update, isLoading, error } = useNookSettings("tours", tourDefaults);
  const targets = useRef(new Map<string, RefObject<View | null>>());
  const [active, setActive] = useState<{ key: TourKey; steps: TourStep[]; rects: Map<string, Rect> } | null>(null);
  const starting = useRef(false);
  const { width, height } = useWindowDimensions();

  const register = useCallback((id: string, ref: RefObject<View | null>) => {
    targets.current.set(id, ref);
    return () => {
      if (targets.current.get(id) === ref) targets.current.delete(id);
    };
  }, []);

  // Measure every target the tour mentions, so we know which are on screen.
  const measureAll = useCallback(
    async (steps: TourStep[]) => {
      const rects = new Map<string, Rect>();
      await Promise.all(
        steps.map(
          (step) =>
            new Promise<void>((resolve) => {
              const view = step.target ? targets.current.get(step.target)?.current : null;
              if (!step.target || !view) return resolve();
              view.measureInWindow((x, y, w, h) => {
                const rect = { x, y, width: w, height: h };
                if (isOnScreen(rect, { width, height })) rects.set(step.target!, rect);
                resolve();
              });
            })
        )
      );
      return rects;
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
      setTimeout(async () => {
        const rects = await measureAll(tours[key]);
        starting.current = false;
        const steps = resolveSteps(tours[key], new Set(rects.keys()));
        setActive((current) => current ?? { key, steps, rects });
      }, 700);
    },
    [isLoading, error, seen, active, measureAll]
  );

  const finish = useCallback(() => {
    if (!active) return;
    update({ [active.key]: true } as Partial<Seen>).catch(() => {});
    setActive(null);
  }, [active, update]);

  const replay = useCallback(() => update({ hearth: false, burrows: false }), [update]);

  const value = useMemo(() => ({ register, maybeStart, replay }), [register, maybeStart, replay]);

  return (
    <TourContext.Provider value={value}>
      {children}
      {active ? <TourOverlay key={active.key} steps={active.steps} rects={active.rects} onDone={finish} /> : null}
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
  const ref = useRef<View>(null);
  useEffect(() => tour?.register(id, ref), [tour, id]);
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

function TourOverlay({ steps, rects, onDone }: { steps: TourStep[]; rects: Map<string, Rect>; onDone: () => void }) {
  const { width, height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const [index, setIndex] = useState(0);
  const step = steps[index];
  const rect = step?.target ? rects.get(step.target) ?? null : null;
  const placement = placeBubble(rect, { width, height });
  const isLast = index === steps.length - 1;

  // The spotlight glides from one target to the next. With nothing to
  // point at, it shrinks to a dot in the middle (the whole screen dims).
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
