import { useCallback, useMemo, useRef, type ReactNode } from "react";
import type { View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  FadeIn,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { useWiggle } from "../motion";

export type DragHandlers = {
  onPress: () => void;
  onLongPress: () => void;
  onDragStart: () => void;
  onDragMove: (x: number, y: number) => void;
  onDrop: (x: number, y: number) => void;
};

// A Hearth tile that can be tapped, long-pressed, and — in edit mode —
// held and dragged. The drag itself runs on the UI thread (Reanimated), so
// the tile tracks your finger smoothly; React only hears about the start,
// the section you're hovering, and the drop. While editing, tiles wiggle
// like iPhone home-screen icons; other tiles glide when the order changes.
export function DraggableTile({
  editing,
  isDragging,
  handlers,
  viewRef,
  seed,
  children,
}: {
  editing: boolean;
  isDragging: boolean;
  handlers: DragHandlers;
  viewRef: (view: View | null) => void;
  seed: number;
  children: ReactNode;
}) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const lifted = useSharedValue(0);
  const wiggle = useWiggle(editing && !isDragging, seed);

  // Latest handlers without rebuilding the gesture mid-drag.
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const press = useCallback(() => handlersRef.current.onPress(), []);
  const longPress = useCallback(() => handlersRef.current.onLongPress(), []);
  const dragStart = useCallback(() => handlersRef.current.onDragStart(), []);
  const dragMove = useCallback((x: number, y: number) => handlersRef.current.onDragMove(x, y), []);
  const drop = useCallback((x: number, y: number) => handlersRef.current.onDrop(x, y), []);

  const gesture = useMemo(() => {
    const tap = Gesture.Tap().onEnd((_event, success) => {
      if (success) scheduleOnRN(press);
    });

    if (!editing) {
      const hold = Gesture.LongPress()
        .minDuration(400)
        .onStart(() => scheduleOnRN(longPress));
      return Gesture.Exclusive(hold, tap);
    }

    const pan = Gesture.Pan()
      .activateAfterLongPress(180)
      .onStart(() => {
        lifted.value = withSpring(1, { damping: 14, stiffness: 260 });
        scheduleOnRN(dragStart);
      })
      .onUpdate((event) => {
        translateX.value = event.translationX;
        translateY.value = event.translationY;
        scheduleOnRN(dragMove, event.absoluteX, event.absoluteY);
      })
      .onEnd((event) => {
        scheduleOnRN(drop, event.absoluteX, event.absoluteY);
      })
      .onFinalize(() => {
        // The drop re-lays-out the Hearth, so let go of the offset at once;
        // the layout transition below glides the tile into its new spot.
        translateX.value = 0;
        translateY.value = 0;
        lifted.value = withSpring(0, { damping: 16, stiffness: 220 });
      });
    return Gesture.Exclusive(pan, tap);
  }, [editing, press, longPress, dragStart, dragMove, drop, translateX, translateY, lifted]);

  const dragStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: 1 + lifted.value * 0.06 },
    ],
    shadowOpacity: lifted.value * 0.25,
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        ref={viewRef}
        collapsable={false}
        entering={FadeIn.duration(250)}
        layout={LinearTransition.springify().damping(18).stiffness(170)}
        style={[
          {
            zIndex: isDragging ? 100 : 0,
            elevation: isDragging ? 12 : 0,
            shadowColor: "#3a2414",
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 8 },
          },
          dragStyle,
        ]}
      >
        <Animated.View style={wiggle}>{children}</Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}
