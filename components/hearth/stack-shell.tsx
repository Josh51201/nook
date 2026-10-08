import { StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

import { Tap } from "../motion";
import type { ReactNode } from "react";

// A stack of widgets (CORE-050): one is shown, swipe sideways for the next,
// and little dots along the bottom say how many there are and which you're
// on. Tap a dot to jump to it.
export function StackShell({
  width,
  height,
  count,
  index,
  color,
  onSelect,
  children,
}: {
  width: number;
  height: number;
  count: number;
  index: number;
  color: string;
  onSelect: (index: number) => void;
  children: ReactNode;
}) {
  const step = (by: 1 | -1) => onSelect((index + by + count) % count);
  const swipe = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX([-20, 20])
    .failOffsetY([-15, 15])
    .onEnd((event) => {
      if (event.translationX < -40) step(1);
      else if (event.translationX > 40) step(-1);
    });
  const showDots = width >= 70 && height >= 70;

  return (
    <GestureDetector gesture={swipe}>
      <View style={{ width, height }} collapsable={false}>
        {children}
        {showDots ? (
          <View pointerEvents="box-none" style={styles.dots}>
            {Array.from({ length: count }, (_, i) => (
              <Tap
                key={i}
                onPress={() => onSelect(i)}
                hitSlop={6}
                pressedScale={0.8}
                accessibilityLabel={`Widget ${i + 1} of ${count}`}
                style={[styles.dot, { backgroundColor: color, opacity: i === index ? 0.95 : 0.3 }, i === index && styles.dotOn]}
              />
            ))}
          </View>
        ) : null}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  dots: { position: "absolute", left: 0, right: 0, bottom: 5, flexDirection: "row", justifyContent: "center", gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dotOn: { width: 14 },
});
