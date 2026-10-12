import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useReanimatedKeyboardAnimation } from "react-native-keyboard-controller";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { colors, themed } from "../lib/theme";

// A bottom sheet that lives *inside* the screen (not a system pop-up), so
// opening another screen from it can never collide with a half-dismissed
// pop-up. Drag the grabber or header down to close it, or tap the dim
// background. Content below the header scrolls/behaves normally. While the
// keyboard is up, the sheet rides on top of it, so the field and the button
// under it stay in sight (CORE-016).
//
// Render it as the last child of a screen's root View (it fills the screen).
export function BottomSheet({
  visible,
  onClose,
  header,
  preview,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  // Shown under the grabber; dragging it also closes the sheet.
  header?: ReactNode;
  // Stays put under the header while the content scrolls (a live preview of
  // what you're changing, CORE-079).
  preview?: ReactNode;
  children: ReactNode;
}) {
  const { height } = useWindowDimensions();
  const [mounted, setMounted] = useState(visible);
  const translateY = useSharedValue(height);
  const dim = useSharedValue(0);
  // Negative while the keyboard is open: how far up its top edge is. The
  // sheet fills the screen down to the bottom edge, so lifting it by exactly
  // that much puts it right on top of the keyboard. (A KeyboardAvoidingView
  // worked this out from its own position, which came up short under a
  // screen's header and left the bottom of the sheet behind the keyboard.)
  const { height: keyboard } = useReanimatedKeyboardAnimation();

  // Latest onClose without rebuilding the gesture.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const requestClose = useCallback(() => closeRef.current(), []);
  const unmount = useCallback(() => setMounted(false), []);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      translateY.value = withTiming(0, { duration: 300, easing: Easing.out(Easing.cubic) });
      dim.value = withTiming(1, { duration: 250 });
    } else {
      // Slide away from wherever it is now (including mid-drag), then unmount.
      dim.value = withTiming(0, { duration: 220 });
      translateY.value = withTiming(height, { duration: 240, easing: Easing.in(Easing.cubic) }, (finished) => {
        if (finished) scheduleOnRN(unmount);
      });
    }
  }, [visible, height, translateY, dim, unmount]);

  const drag = Gesture.Pan()
    .onUpdate((event) => {
      translateY.value = Math.max(0, event.translationY);
      dim.value = Math.max(0, 1 - event.translationY / 400);
    })
    .onEnd((event) => {
      if (event.translationY > 100 || event.velocityY > 900) {
        scheduleOnRN(requestClose);
      } else {
        translateY.value = withTiming(0, { duration: 200, easing: Easing.out(Easing.cubic) });
        dim.value = withTiming(1, { duration: 200 });
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
  const dimStyle = useAnimatedStyle(() => ({ opacity: dim.value }));
  const liftStyle = useAnimatedStyle(() => ({ paddingBottom: Math.max(0, -keyboard.value) }));

  if (!mounted) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={visible ? "auto" : "none"}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.dim, dimStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={requestClose} accessibilityLabel="Close" />
      </Animated.View>
      <Animated.View style={[styles.bottom, liftStyle]} pointerEvents="box-none">
        <Animated.View style={[styles.sheet, { maxHeight: height * 0.88 }, sheetStyle]}>
          <GestureDetector gesture={drag}>
            <View style={styles.header} collapsable={false}>
              <View style={styles.grabber} />
              {header}
            </View>
          </GestureDetector>
          {preview ? <View style={{ marginBottom: 12 }}>{preview}</View> : null}
          {children}
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    dim: { backgroundColor: "rgba(0,0,0,0.3)" },
    bottom: { flex: 1, justifyContent: "flex-end" },
    sheet: {
      backgroundColor: colors.background,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingHorizontal: 20,
      paddingBottom: 30,
    },
    header: { paddingTop: 10, paddingBottom: 12, gap: 12 },
    grabber: {
      alignSelf: "center",
      width: 44,
      height: 5,
      borderRadius: 3,
      backgroundColor: colors.border,
    },
  })
);
