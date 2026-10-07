import { useEffect, type ReactNode } from "react";
import { Pressable, View, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { colors, ui } from "../lib/theme";

// Motion building blocks shared by every screen. All of it runs on the UI
// thread (Reanimated), and all of it calms down when the phone's "Reduce
// Motion" setting is on.

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Anything tappable: presses in a little and springs back.
export function Tap({
  style,
  children,
  pressedScale = 0.97,
  ...props
}: Omit<PressableProps, "style" | "children"> & {
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  pressedScale?: number;
}) {
  const scale = useSharedValue(1);
  const reduceMotion = useReducedMotion();
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  // Only dim things that *would* do something (a disabled button). A card
  // with nothing to tap uses `disabled` just to stay still, and stays crisp.
  const isDisabledControl = Boolean(props.disabled && (props.onPress || props.onLongPress));

  return (
    <AnimatedPressable
      {...props}
      onPressIn={(event) => {
        if (!reduceMotion) scale.value = withSpring(pressedScale, { damping: 18, stiffness: 400 });
        props.onPressIn?.(event);
      }}
      onPressOut={(event) => {
        scale.value = withSpring(1, { damping: 14, stiffness: 300 });
        props.onPressOut?.(event);
      }}
      style={[style, isDisabledControl ? { opacity: 0.55 } : null, animatedStyle]}
    >
      {children}
    </AnimatedPressable>
  );
}

// List items flow in one after another, then glide into place whenever the
// list changes (filtering, adding, removing).
export function Appear({
  index = 0,
  children,
  style,
}: {
  index?: number;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(index, 8) * 45)
        .springify()
        .damping(20)
        .stiffness(180)}
      exiting={FadeOut.duration(160)}
      layout={LinearTransition.springify().damping(20).stiffness(180)}
      style={style}
    >
      {children}
    </Animated.View>
  );
}

// For content that swaps in place (e.g. a tuck footer changing state).
export function FadeSwap({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(120)} style={style}>
      {children}
    </Animated.View>
  );
}

// Gently pulsing placeholder while something loads.
export function Skeleton({ height, width = "100%", radius = 12 }: { height: number; width?: number | `${number}%`; radius?: number }) {
  const opacity = useSharedValue(0.5);
  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 700, easing: Easing.inOut(Easing.quad) }), -1, true);
    return () => cancelAnimation(opacity);
  }, [opacity]);
  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View
      style={[{ height, width, borderRadius: radius, backgroundColor: colors.border }, animatedStyle]}
    />
  );
}

// Whole-screen loading state: a few card-shaped placeholders instead of a
// lonely spinner, so the screen doesn't jump when content arrives.
export function LoadingScreen({ cards = 3 }: { cards?: number }) {
  return (
    <View style={[ui.screen, { backgroundColor: colors.background, flex: 1 }]}>
      {Array.from({ length: cards }, (_, i) => (
        <View key={i} style={[ui.card, { gap: 10 }]}>
          <View style={ui.row}>
            <Skeleton height={40} width={40} radius={15} />
            <View style={{ flex: 1, gap: 8 }}>
              <Skeleton height={14} width="60%" />
              <Skeleton height={12} width="40%" />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

// A gentle sway for things you can rearrange (Hearth edit mode) — small
// and slow so the Hearth feels calm rather than jittery.
export function useWiggle(active: boolean, seed = 0) {
  const rotation = useSharedValue(0);
  const reduceMotion = useReducedMotion();
  useEffect(() => {
    if (active && !reduceMotion) {
      const amount = 0.55 + (seed % 3) * 0.08;
      rotation.value = withSequence(
        withTiming(-amount, { duration: 160 + (seed % 4) * 25, easing: Easing.out(Easing.sin) }),
        withRepeat(withTiming(amount, { duration: 320, easing: Easing.inOut(Easing.sin) }), -1, true)
      );
    } else {
      cancelAnimation(rotation);
      rotation.value = withTiming(0, { duration: 180, easing: Easing.out(Easing.quad) });
    }
  }, [active, reduceMotion, rotation, seed]);
  return useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));
}
