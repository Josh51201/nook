import { useMemo, useRef, type ReactNode } from "react";
import { Animated, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

export type DragHandlers = {
  onPress: () => void;
  onLongPress: () => void;
  onDragStart: () => void;
  onDragMove: (x: number, y: number) => void;
  onDrop: (x: number, y: number) => void;
};

// A Hearth tile that can be tapped, long-pressed, and — in edit mode —
// held and dragged. Gestures run on the JS thread (runOnJS) so this only
// needs react-native-gesture-handler plus React Native's own Animated.
export function DraggableTile({
  editing,
  isDragging,
  handlers,
  viewRef,
  children,
}: {
  editing: boolean;
  isDragging: boolean;
  handlers: DragHandlers;
  viewRef: (view: View | null) => void;
  children: ReactNode;
}) {
  const offset = useRef(new Animated.ValueXY()).current;
  // Latest handlers without rebuilding the gesture mid-drag.
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const gesture = useMemo(() => {
    const tap = Gesture.Tap()
      .runOnJS(true)
      .onEnd((_event, success) => {
        if (success) handlersRef.current.onPress();
      });

    if (!editing) {
      const longPress = Gesture.LongPress()
        .runOnJS(true)
        .minDuration(400)
        .onStart(() => handlersRef.current.onLongPress());
      return Gesture.Exclusive(longPress, tap);
    }

    const pan = Gesture.Pan()
      .runOnJS(true)
      .activateAfterLongPress(180)
      .onStart(() => handlersRef.current.onDragStart())
      .onUpdate((event) => {
        offset.setValue({ x: event.translationX, y: event.translationY });
        handlersRef.current.onDragMove(event.absoluteX, event.absoluteY);
      })
      .onEnd((event) => handlersRef.current.onDrop(event.absoluteX, event.absoluteY))
      // The drop re-lays-out the Hearth, so snap back to "no offset" at once
      // rather than springing from where the finger let go.
      .onFinalize(() => offset.setValue({ x: 0, y: 0 }));
    return Gesture.Exclusive(pan, tap);
  }, [editing, offset]);

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        ref={viewRef}
        collapsable={false}
        style={{
          transform: [...offset.getTranslateTransform(), { scale: isDragging ? 1.05 : 1 }],
          zIndex: isDragging ? 100 : 0,
          elevation: isDragging ? 12 : 0,
          opacity: isDragging ? 0.92 : 1,
          shadowColor: "#000",
          shadowOpacity: isDragging ? 0.25 : 0,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
        }}
      >
        {children}
      </Animated.View>
    </GestureDetector>
  );
}
