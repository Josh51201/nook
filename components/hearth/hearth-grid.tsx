import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "../text";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  FadeIn,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { tap } from "../../lib/feedback";
import { COLUMNS, edgeScrollSpeed, minSize, rowsUsed, type GridRect, type HearthItem, type HollowItem } from "../../lib/hearth-layout";
import { Icon } from "../icon";
import { useWiggle } from "../motion";
import { nookRadii } from "./tile-face";

export const GRID_GAP = 12;
const EXTRA_EDIT_ROWS = 3; // empty rows to drop into while designing
const ease = { duration: 240, easing: Easing.out(Easing.cubic) };

// How the screen's scroll area looks to a dragged item, so the page can
// scroll along with it: how far it's scrolled now, and where it sits on
// the screen. `onEdge` is told how fast to scroll (negative = up, 0 =
// stop) while a finger is held near the top or bottom edge.
export type DragScroll = {
  scrollY: SharedValue<number>;
  top: SharedValue<number>;
  bottom: SharedValue<number>;
  onEdge: (speed: number) => void;
};

// The free-form Hearth canvas (CORE-006/019). Items sit at exact grid cells;
// in edit mode you hold one to drag it anywhere (an outline shows where it
// will land), or drag its corner handle to resize it. Calm, eased motion
// throughout — no springs (the Hearth felt too bouncy). Tiles and widgets
// rest on a soft shadow, sink a touch when pressed, and lift higher while
// dragged, so the Hearth has some depth. Hold an item near the top or bottom
// of the screen and the page scrolls along, so a long Hearth can be
// rearranged in one go.
export function HearthGrid({
  items,
  width,
  editing,
  accent,
  shadow,
  nookShadow,
  dragScroll,
  onMove,
  onResize,
  onPressItem,
  onLongPress,
  onDraggingChange,
  onDropIntoHollow,
  renderItem,
}: {
  items: HearthItem[];
  width: number;
  editing: boolean;
  accent: string;
  // The resting shadow under tiles and widgets (a CSS box-shadow), and the
  // deeper one Nook tiles sit on.
  shadow?: string;
  nookShadow?: string;
  dragScroll: DragScroll;
  onMove: (id: string, x: number, y: number) => void;
  onResize: (id: string, w: number, h: number) => void;
  onPressItem: (item: HearthItem) => void;
  onLongPress: () => void;
  onDraggingChange: (dragging: boolean) => void;
  // Dropping a tile onto a Hollow puts it inside (CORE-024). Only on the
  // Hearth itself, since Hollows never hold Hollows.
  onDropIntoHollow?: (id: string, hollowId: string) => void;
  renderItem: (item: HearthItem, size: { width: number; height: number }) => ReactNode;
}) {
  const cell = (width - GRID_GAP * (COLUMNS - 1)) / COLUMNS;
  const stride = cell + GRID_GAP;
  const [ghost, setGhost] = useState<GridRect | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dropHollow, setDropHollow] = useState<HollowItem | null>(null);
  const dropHollowRef = useRef<HollowItem | null>(null);

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
    setDropHollow(null);
    dropHollowRef.current = null;
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

      {dropHollow ? (
        <View
          pointerEvents="none"
          style={[
            styles.dropTarget,
            {
              left: dropHollow.x * stride - 6,
              top: dropHollow.y * stride - 6,
              width: dropHollow.w * stride - GRID_GAP + 12,
              height: dropHollow.h * stride - GRID_GAP + 12,
              borderColor: accent,
              backgroundColor: accent + "22",
            },
          ]}
        >
          <View style={[styles.dropLabel, { backgroundColor: accent }]}>
            <Text style={styles.dropLabelText} numberOfLines={1}>
              Put in {dropHollow.name}
            </Text>
          </View>
        </View>
      ) : ghost ? (
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
          shadow={isRaised(item) ? (item.kind === "nook" ? nookShadow ?? shadow : shadow) : undefined}
          dragScroll={dragScroll}
          onPress={() => onPressItem(item)}
          onLongPress={onLongPress}
          onBegin={() => begin(item.id)}
          onGhost={(rect, finger) => {
            // Is the finger over a Hollow? (Not for Hollows themselves.)
            const target =
              onDropIntoHollow && finger && item.kind !== "hollow"
                ? ((items.find(
                    (other) =>
                      other.kind === "hollow" &&
                      other.id !== item.id &&
                      finger.x >= other.x &&
                      finger.x < other.x + other.w &&
                      finger.y >= other.y &&
                      finger.y < other.y + other.h
                  ) as HollowItem | undefined) ?? null)
                : null;
            if (target && target.id !== dropHollowRef.current?.id) tap();
            dropHollowRef.current = target;
            setDropHollow(target);
            setGhost(rect);
          }}
          onDrop={(x, y) => {
            const into = dropHollowRef.current;
            finish();
            if (into && onDropIntoHollow) onDropIntoHollow(item.id, into.id);
            else if (x !== item.x || y !== item.y) onMove(item.id, x, y);
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

// The shadow follows the item's outline: Nook tiles are arched (CORE-036).
function shadowShape(item: HearthItem, stride: number) {
  if (item.kind !== "nook") return { borderRadius: 24 };
  const { top, bottom } = nookRadii(item.w * stride - GRID_GAP, item.h * stride - GRID_GAP);
  return {
    borderTopLeftRadius: top,
    borderTopRightRadius: top,
    borderBottomLeftRadius: bottom,
    borderBottomRightRadius: bottom,
  };
}

// Text labels and see-through (outline) widgets float flat on the Hearth;
// everything solid gets a shadow.
function isRaised(item: HearthItem) {
  if (item.kind === "label") return false;
  if (item.kind === "widget") return item.widget.look !== "outline";
  if (item.kind === "nook") return item.look !== "outline";
  return true;
}

function GridItem({
  item,
  stride,
  editing,
  seed,
  active,
  accent,
  shadow,
  dragScroll,
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
  shadow?: string;
  dragScroll: DragScroll;
  onPress: () => void;
  onLongPress: () => void;
  onBegin: () => void;
  onGhost: (rect: GridRect, finger: { x: number; y: number } | null) => void;
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
  const pressed = useSharedValue(0);
  const dropping = useSharedValue(false);
  const targetX = useSharedValue(item.x);
  const targetY = useSharedValue(item.y);
  const targetW = useSharedValue(item.w);
  const targetH = useSharedValue(item.h);
  // Where in the tile the finger grabbed it, and which grid cell it's over.
  const grabX = useSharedValue(0);
  const grabY = useSharedValue(0);
  const fingerX = useSharedValue(-1);
  const fingerY = useSharedValue(-1);
  const wiggle = useWiggle(editing && !active, seed);

  // Dragging while the page scrolls: the finger's own movement (raw), plus
  // how far the page has scrolled since the drag began, is where the item
  // is. Everything `follow` reads is a shared value, so it can run both as
  // the finger moves and as the page scrolls under a still finger.
  const rawX = useSharedValue(0);
  const rawY = useSharedValue(0);
  const startScroll = useSharedValue(0);
  const dragging = useSharedValue(false);
  const lastSpeed = useSharedValue(0);
  const geo = useSharedValue({ x: 0, y: 0, w: 1, h: 1, stride: 1 });
  const { scrollY, top: viewTop, bottom: viewBottom, onEdge } = dragScroll;

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
  const ghost = useCallback((x: number, y: number, w: number, h: number, fx?: number, fy?: number) => {
    handlers.current.onGhost({ x, y, w, h }, fx === undefined || fy === undefined ? null : { x: fx, y: fy });
  }, []);
  const sizeTick = useCallback((x: number, y: number, w: number, h: number) => {
    tap();
    handlers.current.onGhost({ x, y, w, h }, null);
  }, []);
  const drop = useCallback((x: number, y: number) => handlers.current.onDrop(x, y), []);
  const edge = useCallback((speed: number) => onEdge(speed), [onEdge]);

  function follow() {
    "worklet";
    const g = geo.value;
    const dy = rawY.value + (scrollY.value - startScroll.value);
    dragX.value = rawX.value;
    dragY.value = dy;
    const nextX = Math.min(COLUMNS - g.w, Math.max(0, Math.round(g.x + rawX.value / g.stride)));
    const nextY = Math.max(0, Math.round(g.y + dy / g.stride));
    const fx = Math.floor((g.x * g.stride + grabX.value + rawX.value) / g.stride);
    const fy = Math.floor((g.y * g.stride + grabY.value + dy) / g.stride);
    if (nextX !== targetX.value || nextY !== targetY.value || fx !== fingerX.value || fy !== fingerY.value) {
      targetX.value = nextX;
      targetY.value = nextY;
      fingerX.value = fx;
      fingerY.value = fy;
      scheduleOnRN(ghost, nextX, nextY, g.w, g.h, fx, fy);
    }
  }

  // The page scrolled under a finger that is holding still: keep up.
  useAnimatedReaction(
    () => scrollY.value,
    () => {
      if (dragging.value) follow();
    }
  );
  const resizeEnd = useCallback((w: number, h: number) => handlers.current.onResizeEnd(w, h), []);

  const { x, y, w, h } = item;
  const moveGesture = useMemo(() => {
    const tapGesture = Gesture.Tap()
      .onBegin(() => {
        pressed.value = withTiming(1, { duration: 90 });
      })
      .onEnd((_e, success) => {
        if (success) scheduleOnRN(press);
      })
      .onFinalize(() => {
        pressed.value = withTiming(0, { duration: 180 });
      });
    if (!editing) {
      const longPress = Gesture.LongPress()
        .minDuration(400)
        .onStart(() => scheduleOnRN(hold));
      return Gesture.Exclusive(longPress, tapGesture);
    }
    const pan = Gesture.Pan()
      .activateAfterLongPress(150)
      .onStart((event) => {
        geo.value = { x, y, w, h, stride };
        rawX.value = 0;
        rawY.value = 0;
        startScroll.value = scrollY.value;
        dragging.value = true;
        lastSpeed.value = 0;
        targetX.value = x;
        targetY.value = y;
        grabX.value = event.x;
        grabY.value = event.y;
        fingerX.value = Math.floor((x * stride + event.x) / stride);
        fingerY.value = Math.floor((y * stride + event.y) / stride);
        lifted.value = withTiming(1, { duration: 160 });
        scheduleOnRN(begin);
        scheduleOnRN(ghost, x, y, w, h, fingerX.value, fingerY.value);
      })
      .onUpdate((event) => {
        rawX.value = event.translationX;
        rawY.value = event.translationY;
        follow();
        // Near the top or bottom of the screen? Scroll that way.
        const speed = edgeScrollSpeed(event.absoluteY, viewTop.value, viewBottom.value);
        if (speed !== lastSpeed.value) {
          lastSpeed.value = speed;
          scheduleOnRN(edge, speed);
        }
      })
      .onEnd(() => {
        const moved = targetX.value !== x || targetY.value !== y;
        dropping.value = moved;
        scheduleOnRN(drop, targetX.value, targetY.value);
      })
      .onFinalize(() => {
        dragging.value = false;
        if (lastSpeed.value !== 0) {
          lastSpeed.value = 0;
          scheduleOnRN(edge, 0);
        }
        lifted.value = withTiming(0, { duration: 200 });
        if (!dropping.value) {
          dragX.value = withTiming(0, ease);
          dragY.value = withTiming(0, ease);
        }
      });
    return Gesture.Exclusive(pan, tapGesture);
  }, [editing, x, y, w, h, stride, press, hold, begin, ghost, drop, edge, dragX, dragY, lifted, pressed, dropping, targetX, targetY, grabX, grabY, fingerX, fingerY, viewTop, viewBottom, scrollY]);

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
    transform: [
      { translateX: dragX.value },
      { translateY: dragY.value },
      { scale: 1 + lifted.value * 0.04 - pressed.value * 0.03 },
    ],
    shadowOpacity: lifted.value * 0.22,
  }));

  return (
    <Animated.View style={[styles.item, { zIndex: active ? 100 : 1, elevation: active ? 12 : 0 }, style]}>
      <GestureDetector gesture={moveGesture}>
        <Animated.View style={[shadow ? { ...shadowShape(item, stride), boxShadow: shadow } : null, wiggle]}>{children}</Animated.View>
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
  dropTarget: { position: "absolute", borderRadius: 28, borderWidth: 3, zIndex: 50, alignItems: "center" },
  dropLabel: { position: "absolute", top: -14, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, maxWidth: "100%" },
  dropLabelText: { color: "#ffffff", fontSize: 12, fontWeight: "800" },
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
