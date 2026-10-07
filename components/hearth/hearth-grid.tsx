import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { tap } from "../../lib/feedback";
import { COLUMNS, minSize, rowsUsed, type GridRect, type HearthItem } from "../../lib/hearth-layout";
import { Icon } from "../icon";
import { useWiggle } from "../motion";

export const GRID_GAP = 12;
const EXTRA_EDIT_ROWS = 3; // empty rows to drop into while designing
const ease = { duration: 240, easing: Easing.out(Easing.cubic) };

// The free-form Hearth canvas (CORE-006/019). Items sit at exact grid cells;
// in edit mode you hold one to drag it anywhere (an outline shows where it
// will land), or drag its corner handle to resize it. Calm, eased motion
// throughout — no springs (the Hearth felt too bouncy).
export function HearthGrid({
  items,
  width,
  editing,
  accent,
  onMove,
  onResize,
  onPressItem,
  onLongPress,
  onDraggingChange,
  renderItem,
}: {
  items: HearthItem[];
  width: number;
  editing: boolean;
  accent: string;
  onMove: (id: string, x: number, y: number) => void;
  onResize: (id: string, w: number, h: number) => void;
  onPressItem: (item: HearthItem) => void;
  onLongPress: () => void;
  onDraggingChange: (dragging: boolean) => void;
  renderItem: (item: HearthItem, size: { width: number; height: number }) => ReactNode;
}) {
  const cell = (width - GRID_GAP * (COLUMNS - 1)) / COLUMNS;
  const stride = cell + GRID_GAP;
  const [ghost, setGhost] = useState<GridRect | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const rows = rowsUsed(items) + (editing ? EXTRA_EDIT_ROWS : 0);
  const height = Math.max(0, rows * stride - GRID_GAP);

  const begin = useCallback(
    (id: string) => {
      setActiveId(id);
      onDraggingChange(true);
    },
    [onDraggingChange]
  );
  const finish = useCallback(() => {
    setGhost(null);
    setActiveId(null);
    onDraggingChange(false);
  }, [onDraggingChange]);

  if (!width) return null;

  return (
    <View style={{ height, width }}>
      {editing ? (
        <Animated.View entering={FadeIn.duration(250)} style={StyleSheet.absoluteFill} pointerEvents="none">
          {Array.from({ length: rows * COLUMNS }, (_, i) => (
            <View
              key={i}
              style={[
                styles.cell,
                {
                  left: (i % COLUMNS) * stride,
                  top: Math.floor(i / COLUMNS) * stride,
                  width: cell,
                  height: cell,
                  borderColor: `${accent}26`,
                },
              ]}
            />
          ))}
        </Animated.View>
      ) : null}

      {ghost ? (
        <View
          pointerEvents="none"
          style={[
            styles.ghost,
            {
              left: ghost.x * stride,
              top: ghost.y * stride,
              width: ghost.w * stride - GRID_GAP,
              height: ghost.h * stride - GRID_GAP,
              borderColor: accent,
              backgroundColor: `${accent}14`,
            },
          ]}
        />
      ) : null}

      {items.map((item, index) => (
        <GridItem
          key={item.id}
          item={item}
          stride={stride}
          editing={editing}
          seed={index}
          active={activeId === item.id}
          accent={accent}
          onPress={() => onPressItem(item)}
          onLongPress={onLongPress}
          onBegin={() => begin(item.id)}
          onGhost={setGhost}
          onDrop={(x, y) => {
            finish();
            if (x !== item.x || y !== item.y) onMove(item.id, x, y);
          }}
          onResizeEnd={(w, h) => {
            finish();
            if (w !== item.w || h !== item.h) onResize(item.id, w, h);
          }}
        >
          {renderItem(item, { width: item.w * stride - GRID_GAP, height: item.h * stride - GRID_GAP })}
        </GridItem>
      ))}
    </View>
  );
}

function GridItem({
  item,
  stride,
  editing,
  seed,
  active,
  accent,
  onPress,
  onLongPress,
  onBegin,
  onGhost,
  onDrop,
  onResizeEnd,
  children,
}: {
  item: HearthItem;
  stride: number;
  editing: boolean;
  seed: number;
  active: boolean;
  accent: string;
  onPress: () => void;
  onLongPress: () => void;
  onBegin: () => void;
  onGhost: (rect: GridRect) => void;
  onDrop: (x: number, y: number) => void;
  onResizeEnd: (w: number, h: number) => void;
  children: ReactNode;
}) {
  const min = minSize(item);
  const left = useSharedValue(item.x * stride);
  const top = useSharedValue(item.y * stride);
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const lifted = useSharedValue(0);
  const dropping = useSharedValue(false);
  const targetX = useSharedValue(item.x);
  const targetY = useSharedValue(item.y);
  const targetW = useSharedValue(item.w);
  const targetH = useSharedValue(item.h);
  const wiggle = useWiggle(editing && !active, seed);

  // New position from the layout: glide there. If this is the tile that was
  // just dropped, carry on from where the finger let go instead of jumping.
  useEffect(() => {
    const nextLeft = item.x * stride;
    const nextTop = item.y * stride;
    if (dropping.value) {
      dragX.value = left.value + dragX.value - nextLeft;
      dragY.value = top.value + dragY.value - nextTop;
      left.value = nextLeft;
      top.value = nextTop;
      dragX.value = withTiming(0, ease);
      dragY.value = withTiming(0, ease);
      dropping.value = false;
    } else {
      left.value = withTiming(nextLeft, ease);
      top.value = withTiming(nextTop, ease);
    }
  }, [item.x, item.y, stride, left, top, dragX, dragY, dropping]);

  // Latest callbacks without rebuilding gestures mid-drag.
  const handlers = useRef({ onPress, onLongPress, onBegin, onGhost, onDrop, onResizeEnd });
  handlers.current = { onPress, onLongPress, onBegin, onGhost, onDrop, onResizeEnd };
  const press = useCallback(() => handlers.current.onPress(), []);
  const hold = useCallback(() => {
    tap();
    handlers.current.onLongPress();
  }, []);
  const begin = useCallback(() => {
    tap();
    handlers.current.onBegin();
  }, []);
  const ghost = useCallback((x: number, y: number, w: number, h: number) => {
    handlers.current.onGhost({ x, y, w, h });
  }, []);
  const sizeTick = useCallback((x: number, y: number, w: number, h: number) => {
    tap();
    handlers.current.onGhost({ x, y, w, h });
  }, []);
  const drop = useCallback((x: number, y: number) => handlers.current.onDrop(x, y), []);
  const resizeEnd = useCallback((w: number, h: number) => handlers.current.onResizeEnd(w, h), []);

  const { x, y, w, h } = item;
  const moveGesture = useMemo(() => {
    const tapGesture = Gesture.Tap().onEnd((_e, success) => {
      if (success) scheduleOnRN(press);
    });
    if (!editing) {
      const longPress = Gesture.LongPress()
        .minDuration(400)
        .onStart(() => scheduleOnRN(hold));
      return Gesture.Exclusive(longPress, tapGesture);
    }
    const pan = Gesture.Pan()
      .activateAfterLongPress(150)
      .onStart(() => {
        targetX.value = x;
        targetY.value = y;
        lifted.value = withTiming(1, { duration: 160 });
        scheduleOnRN(begin);
        scheduleOnRN(ghost, x, y, w, h);
      })
      .onUpdate((event) => {
        dragX.value = event.translationX;
        dragY.value = event.translationY;
        const nextX = Math.min(COLUMNS - w, Math.max(0, Math.round(x + event.translationX / stride)));
        const nextY = Math.max(0, Math.round(y + event.translationY / stride));
        if (nextX !== targetX.value || nextY !== targetY.value) {
          targetX.value = nextX;
          targetY.value = nextY;
          scheduleOnRN(ghost, nextX, nextY, w, h);
        }
      })
      .onEnd(() => {
        const moved = targetX.value !== x || targetY.value !== y;
        dropping.value = moved;
        scheduleOnRN(drop, targetX.value, targetY.value);
      })
      .onFinalize(() => {
        lifted.value = withTiming(0, { duration: 200 });
        if (!dropping.value) {
          dragX.value = withTiming(0, ease);
          dragY.value = withTiming(0, ease);
        }
      });
    return Gesture.Exclusive(pan, tapGesture);
  }, [editing, x, y, w, h, stride, press, hold, begin, ghost, drop, dragX, dragY, lifted, dropping, targetX, targetY]);

  const resizeGesture = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(1)
        .onStart(() => {
          targetW.value = w;
          targetH.value = h;
          scheduleOnRN(begin);
          scheduleOnRN(ghost, x, y, w, h);
        })
        .onUpdate((event) => {
          const nextW = Math.min(COLUMNS - x, Math.max(min.w, Math.round(w + event.translationX / stride)));
          const nextH = Math.min(8, Math.max(min.h, Math.round(h + event.translationY / stride)));
          if (nextW !== targetW.value || nextH !== targetH.value) {
            targetW.value = nextW;
            targetH.value = nextH;
            scheduleOnRN(sizeTick, x, y, nextW, nextH);
          }
        })
        .onEnd(() => {
          scheduleOnRN(resizeEnd, targetW.value, targetH.value);
        }),
    [x, y, w, h, min.w, min.h, stride, begin, ghost, sizeTick, resizeEnd, targetW, targetH]
  );

  const style = useAnimatedStyle(() => ({
    left: left.value,
    top: top.value,
    transform: [{ translateX: dragX.value }, { translateY: dragY.value }, { scale: 1 + lifted.value * 0.04 }],
    shadowOpacity: lifted.value * 0.22,
  }));

  return (
    <Animated.View style={[styles.item, { zIndex: active ? 100 : 1, elevation: active ? 12 : 0 }, style]}>
      <GestureDetector gesture={moveGesture}>
        <Animated.View style={wiggle}>{children}</Animated.View>
      </GestureDetector>
      {editing ? (
        <GestureDetector gesture={resizeGesture}>
          <Animated.View
            entering={FadeIn.duration(200)}
            style={[styles.handle, { borderColor: accent }]}
            hitSlop={14}
            accessibilityLabel="Drag to resize"
          >
            <Icon name="resize" size={12} color={accent} />
          </Animated.View>
        </GestureDetector>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  cell: { position: "absolute", borderRadius: 18, borderWidth: 1, borderStyle: "dashed" },
  ghost: { position: "absolute", borderRadius: 24, borderWidth: 2, borderStyle: "dashed" },
  item: {
    position: "absolute",
    shadowColor: "#3a2414",
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  handle: {
    position: "absolute",
    right: -6,
    bottom: -6,
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
});
