import { useEffect, useState } from "react";
import { View, type AccessibilityActionEvent } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { tap } from "../lib/feedback";
import { colors } from "../lib/theme";
import { Text } from "./text";

// A slider from 0 to 1 (first used for how far Hearth text's decoration
// stretches, CORE-078). Drag the knob or tap anywhere on the track. It moves
// in steps with a little tick on each, and only reports the new value when
// you let go, so dragging doesn't save over and over. With a screen reader,
// swipe up or down to change it a step at a time.

const KNOB = 26;

export function Slider({
  value,
  onChange,
  onSlide,
  label,
  startLabel,
  endLabel,
  step = 0.05,
}: {
  value: number;
  onChange: (value: number) => void;
  // Every step while dragging, before it's let go (e.g. for a live preview).
  onSlide?: (value: number) => void;
  // What it changes, read aloud by a screen reader.
  label: string;
  startLabel?: string;
  endLabel?: string;
  step?: number;
}) {
  const [width, setWidth] = useState(0);
  const [shown, setShown] = useState(value);
  const at = useSharedValue(value);

  useEffect(() => {
    at.value = value;
    setShown(value);
  }, [value, at]);

  function snap(raw: number) {
    "worklet";
    const clamped = Math.min(1, Math.max(0, raw));
    return Math.round(clamped / step) * step;
  }
  function moved(next: number) {
    setShown((prev) => {
      if (prev !== next) tap();
      return next;
    });
    onSlide?.(next);
  }
  function done(next: number) {
    if (Math.abs(next - value) > 0.001) onChange(next);
  }

  const room = Math.max(1, width - KNOB);
  const pan = Gesture.Pan()
    // Sideways only, so the sheet still scrolls and closes up and down.
    .activeOffsetX([-6, 6])
    .failOffsetY([-14, 14])
    .onUpdate((e) => {
      const next = snap((e.x - KNOB / 2) / room);
      if (next !== at.value) {
        at.value = next;
        scheduleOnRN(moved, next);
      }
    })
    .onEnd(() => scheduleOnRN(done, at.value));
  const press = Gesture.Tap().onEnd((e) => {
    const next = snap((e.x - KNOB / 2) / room);
    at.value = next;
    scheduleOnRN(moved, next);
    scheduleOnRN(done, next);
  });

  const knob = useAnimatedStyle(() => ({ transform: [{ translateX: at.value * room }] }));
  const fill = useAnimatedStyle(() => ({ width: at.value * room + KNOB / 2 }));

  function onAction(e: AccessibilityActionEvent) {
    const next = snap(shown + (e.nativeEvent.actionName === "increment" ? step * 2 : -step * 2));
    at.value = next;
    setShown(next);
    done(next);
  }

  return (
    <View style={{ gap: 4 }}>
      <GestureDetector gesture={Gesture.Exclusive(pan, press)}>
        <View
          onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
          style={{ height: 44, justifyContent: "center" }}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={label}
          accessibilityValue={{ min: 0, max: 100, now: Math.round(shown * 100), text: `${Math.round(shown * 100)} percent` }}
          accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
          onAccessibilityAction={onAction}
        >
          <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.barkSoft, marginHorizontal: 0 }} />
          <Animated.View style={[{ position: "absolute", left: 0, height: 8, borderRadius: 4, backgroundColor: colors.bark }, fill]} />
          <Animated.View
            style={[
              {
                position: "absolute",
                left: 0,
                width: KNOB,
                height: KNOB,
                borderRadius: KNOB / 2,
                backgroundColor: colors.white,
                borderWidth: 3,
                borderColor: colors.bark,
                boxShadow: `0px 2px 4px rgba(${colors.shade}, 0.25)`,
              },
              knob,
            ]}
          />
        </View>
      </GestureDetector>
      {startLabel || endLabel ? (
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ color: colors.muted, fontSize: 13 }}>{startLabel}</Text>
          <Text style={{ color: colors.text, fontSize: 13, fontWeight: "600" }}>{Math.round(shown * 100)}%</Text>
          <Text style={{ color: colors.muted, fontSize: 13 }}>{endLabel}</Text>
        </View>
      ) : null}
    </View>
  );
}
