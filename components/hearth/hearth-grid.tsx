import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AccessibilityInfo, StyleSheet, View, type AccessibilityActionEvent } from "react-native";
import { Text } from "../text";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  FadeIn,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { tap } from "../../lib/feedback";
import { cornerRadius, liftLevel } from "../../lib/decor";
import {
  canNudge,
  COLUMNS,
  edgeScrollSpeed,
  itemSpokenName,
  minSize,
  rowsUsed,
  type GridRect,
  type HearthItem,
  type HollowItem,
  type Nudge,
} from "../../lib/hearth-layout";
import { Icon } from "../icon";
import { Tap, useWiggle } from "../motion";
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
  // Where the trash can is on screen while dragging (CORE-040), or null.
  trash: SharedValue<{ x: number; y: number; w: number; h: number } | null>;
  // Where the page tabs are on screen while dragging (CORE-051): drop on one
  // to move the item to that page.
  tabs: SharedValue<{ id: string; x: number; y: number; w: number; h: number }[]>;
};

// How far around the trash can still counts as over it, and how long an item
// has to be held there before letting go removes it (CORE-040) - so brushing
// past on the way somewhere else never deletes anything.
const TRASH_SLOP = 6;
const TRASH_ARM_MS = 450;

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
  shadowAt,
  dragScroll,
  onMove,
  onNudge,
  onResize,
  onPressItem,
  onLongPress,
  onDraggingChange,
  onDropIntoHollow,
  onCopy,
  onTrash,
  onTrashHover,
  onTrashArmed,
  flashId,
  focusId,
  selecting = false,
  selectedIds,
  onToggleLock,
  onTabHover,
  onDropOnTab,
  renderItem,
}: {
  items: HearthItem[];
  width: number;
  editing: boolean;
  accent: string;
  // The resting shadow under tiles and widgets (a CSS box-shadow) at each
  // level: 0 none, 1 widgets' usual, 2 Nook tiles' usual, 3 floating (CORE-042).
  shadowAt?: (level: 0 | 1 | 2 | 3) => string | undefined;
  dragScroll: DragScroll;
  onMove: (id: string, x: number, y: number) => void;
  // One step in a direction, from a screen reader's actions (CORE-075).
  onNudge?: (id: string, way: Nudge) => void;
  onResize: (id: string, w: number, h: number) => void;
  onPressItem: (item: HearthItem) => void;
  onLongPress: () => void;
  onDraggingChange: (dragging: boolean) => void;
  // Dropping a tile onto a Hollow puts it inside (CORE-024). Only on the
  // Hearth itself, since Hollows never hold Hollows.
  onDropIntoHollow?: (id: string, hollowId: string) => void;
  // The copy button in Edit (CORE-039): a copy right here. Not for Hollows.
  onCopy?: (item: HearthItem) => void;
  // Dragged onto the trash can and let go (CORE-040), and whether a dragged
  // item is over it right now.
  onTrash?: (item: HearthItem) => void;
  onTrashHover?: (over: boolean) => void;
  // Held there long enough that letting go will remove it.
  onTrashArmed?: (armed: boolean) => void;
  // An item to make glow for a moment, e.g. a copy just made (CORE-039).
  flashId?: string | null;
  // The tile being moved with the arrow bar glows until it's done (CORE-076).
  focusId?: string | null;
  // Select many (CORE-060): taps pick items instead of opening them, and
  // nothing drags or resizes.
  selecting?: boolean;
  selectedIds?: string[];
  // The lock button in Edit (CORE-061).
  onToggleLock?: (item: HearthItem) => void;
  // A dragged item is over a page tab ("" when it isn't), and let go there.
  onTabHover?: (tabId: string) => void;
  onDropOnTab?: (item: HearthItem, tabId: string) => void;
  renderItem: (item: HearthItem, size: { width: number; height: number }) => ReactNode;
}) {
  const cell = (width - GRID_GAP * (COLUMNS - 1)) / COLUMNS;
  const stride = cell + GRID_GAP;
  const [ghost, setGhost] = useState<GridRect | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dropHollow, setDropHollow] = useState<HollowItem | null>(null);
  const dropHollowRef = useRef<HollowItem | null>(null);

  // Things can end on a half row (CORE-076); the grid shows whole rows.
  const rows = Math.ceil(rowsUsed(items)) + (editing ? EXTRA_EDIT_ROWS : 0);
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
          shadow={isRaised(item) ? shadowAt?.(liftLevel(item.lift, item.kind === "nook")) : undefined}
          dragScroll={dragScroll}
          onPress={() => onPressItem(item)}
          onLongPress={onLongPress}
          onNudge={onNudge ? (way) => onNudge(item.id, way) : undefined}
          onCopy={onCopy && item.kind !== "hollow" ? () => onCopy(item) : undefined}
          onTrashHover={(over) => onTrashHover?.(over)}
          onTrashArmed={(armed) => onTrashArmed?.(armed)}
          flash={flashId === item.id}
          focused={focusId === item.id}
          selecting={selecting}
          selected={selectedIds?.includes(item.id) ?? false}
          onToggleLock={onToggleLock ? () => onToggleLock(item) : undefined}
          onTabHover={(id) => onTabHover?.(id)}
          onTabDrop={(id) => {
            finish();
            onTabHover?.("");
            onDropOnTab?.(item, id);
          }}
          onTrash={() => {
            finish();
            onTrashHover?.(false);
            onTrashArmed?.(false);
            onTrash?.(item);
          }}
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
            // A Trinket has no cell to snap to, so no outline.
            setGhost(item.kind === "trinket" ? null : rect);
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
          <ItemContent item={item} {...liveSize(item, activeId === item.id ? ghost : null, stride)} render={renderItem} />
        </GridItem>
      ))}
    </View>
  );
}

// What's drawn inside a tile or widget. While you drag, the grid re-renders
// every time the outline moves to a new cell; this keeps the insides from
// being redrawn each time, which is what made dragging choppy.
const ItemContent = memo(
  function ItemContent({
    item,
    width,
    height,
    render,
  }: {
    item: HearthItem;
    width: number;
    height: number;
    render: (item: HearthItem, size: { width: number; height: number }) => ReactNode;
  }) {
    return <>{render(item, { width, height })}</>;
  },
  (a, b) => a.item === b.item && a.width === b.width && a.height === b.height && a.render === b.render
);

// Text being resized redraws at the new size as you drag the corner, so you
// see how it'll fit before letting go (CORE-077). Everything else keeps its
// size until you let go.
function liveSize(item: HearthItem, ghost: GridRect | null, stride: number) {
  const resizing = ghost && item.kind === "label" && ghost.x === item.x && ghost.y === item.y;
  const rect = resizing ? ghost : item;
  return { width: rect.w * stride - GRID_GAP, height: rect.h * stride - GRID_GAP };
}

// The shadow follows the item's outline: Nook tiles are arched (CORE-036).
function shadowShape(item: HearthItem, stride: number) {
  const width = item.w * stride - GRID_GAP;
  const height = item.h * stride - GRID_GAP;
  if (item.kind === "widget") return { borderRadius: cornerRadius(item.corners, width, height) };
  if (item.kind !== "nook") return { borderRadius: 24 };
  const { top, bottom } = nookRadii(width, height, item.corners, item.shape);
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
  if (item.kind === "label" || item.kind === "trinket") return false;
  // A shadow you asked for is always drawn, even under an outline.
  if (item.lift) return true;
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
  onNudge,
  onCopy,
  onTrash,
  onTrashHover,
  onTrashArmed,
  flash,
  focused,
  selecting,
  selected,
  onToggleLock,
  onTabHover,
  onTabDrop,
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
  onNudge?: (way: Nudge) => void;
  onCopy?: () => void;
  onTrash: () => void;
  onTrashHover: (over: boolean) => void;
  onTrashArmed: (armed: boolean) => void;
  flash?: boolean;
  focused?: boolean;
  selecting: boolean;
  selected: boolean;
  onToggleLock?: () => void;
  onTabHover: (tabId: string) => void;
  onTabDrop: (tabId: string) => void;
  onBegin: () => void;
  onGhost: (rect: GridRect, finger: { x: number; y: number } | null) => void;
  onDrop: (x: number, y: number) => void;
  onResizeEnd: (w: number, h: number) => void;
  children: ReactNode;
}) {
  const min = minSize(item);
  const halfRows = item.kind === "label";
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
  // Edit mode as the gesture sees it (it must not be rebuilt when it changes).
  const editingNow = useSharedValue(editing);
  useEffect(() => {
    editingNow.value = editing;
  }, [editing, editingNow]);

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
  const { scrollY, top: viewTop, bottom: viewBottom, onEdge, trash, tabs } = dragScroll;
  // The page tab the finger is over, or "".
  const tabOver = useSharedValue("");
  // Held over the trash can: it shrinks away a little, ready to go.
  const overTrash = useSharedValue(false);
  const doomed = useSharedValue(0);
  // 0 until the item has been held over the trash long enough, then 1.
  const armed = useSharedValue(0);
  // A ring of light that pulses once around a new copy.
  const glow = useSharedValue(0);
  useEffect(() => {
    if (!flash) return;
    glow.value = withSequence(
      withTiming(1, { duration: 220 }),
      withTiming(0.35, { duration: 380 }),
      withTiming(1, { duration: 380 }),
      withDelay(500, withTiming(0, { duration: 700 }))
    );
  }, [flash, glow]);
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value, transform: [{ scale: 1 + glow.value * 0.03 }] }));

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
  const handlers = useRef({ onPress, onLongPress, onBegin, onGhost, onDrop, onResizeEnd, onTrash, onTrashHover, onTrashArmed, onTabHover, onTabDrop });
  handlers.current = { onPress, onLongPress, onBegin, onGhost, onDrop, onResizeEnd, onTrash, onTrashHover, onTrashArmed, onTabHover, onTabDrop };
  const trashArmed = useCallback((on: boolean) => {
    if (on) tap("success");
    handlers.current.onTrashArmed(on);
  }, []);
  const trashDrop = useCallback(() => handlers.current.onTrash(), []);
  const tabHover = useCallback((id: string) => {
    if (id) tap();
    handlers.current.onTabHover(id);
  }, []);
  const tabDrop = useCallback((id: string) => handlers.current.onTabDrop(id), []);
  const trashHover = useCallback((over: boolean) => {
    if (over) tap();
    handlers.current.onTrashHover(over);
  }, []);
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
    // Up and down snap to half rows (CORE-076).
    const nextY = Math.max(0, Math.round((g.y + dy / g.stride) * 2) / 2);
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
  const free = item.kind === "trinket";
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
    // The same hold-then-drag gesture whether or not the Hearth is in Edit
    // mode, so holding a tile that isn't being edited yet switches Edit on
    // AND picks the tile up in one go (the gesture isn't rebuilt when Edit
    // switches on, so the finger already down keeps dragging).
    const pan = Gesture.Pan()
      .enabled(!selecting && !item.locked)
      .activateAfterLongPress(300)
      .onStart((event) => {
        if (!editingNow.value) scheduleOnRN(hold);
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
        // Over the trash can?
        const bin = trash.value;
        const over =
          bin !== null &&
          event.absoluteX >= bin.x - TRASH_SLOP &&
          event.absoluteX <= bin.x + bin.w + TRASH_SLOP &&
          event.absoluteY >= bin.y - TRASH_SLOP &&
          event.absoluteY <= bin.y + bin.h + TRASH_SLOP;
        if (over !== overTrash.value) {
          overTrash.value = over;
          if (over) {
            doomed.value = withTiming(0.3, { duration: 160 });
            armed.value = withDelay(
              TRASH_ARM_MS,
              withTiming(1, { duration: 1 }, (finished) => {
                if (finished) {
                  doomed.value = withTiming(1, { duration: 160 });
                  scheduleOnRN(trashArmed, true);
                }
              })
            );
          } else {
            if (armed.value === 1) scheduleOnRN(trashArmed, false);
            armed.value = 0;
            doomed.value = withTiming(0, { duration: 160 });
          }
          scheduleOnRN(trashHover, over);
        }
        // Over a page tab?
        const spots = tabs.value;
        let hit = "";
        for (let i = 0; i < spots.length; i++) {
          const spot = spots[i];
          if (
            event.absoluteX >= spot.x - 4 &&
            event.absoluteX <= spot.x + spot.w + 4 &&
            event.absoluteY >= spot.y - 6 &&
            event.absoluteY <= spot.y + spot.h + 6
          ) {
            hit = spot.id;
          }
        }
        if (hit !== tabOver.value) {
          tabOver.value = hit;
          scheduleOnRN(tabHover, hit);
        }
        // Near the top or bottom of the screen? Scroll that way (not while
        // aiming at the trash can or a page tab).
        const speed = over || hit !== "" ? 0 : edgeScrollSpeed(event.absoluteY, viewTop.value, viewBottom.value);
        if (speed !== lastSpeed.value) {
          lastSpeed.value = speed;
          scheduleOnRN(edge, speed);
        }
      })
      .onEnd(() => {
        if (overTrash.value && armed.value === 1) {
          dropping.value = false;
          scheduleOnRN(trashDrop);
          return;
        }
        if (tabOver.value !== "") {
          dropping.value = false;
          scheduleOnRN(tabDrop, tabOver.value);
          return;
        }
        // A Trinket lands exactly where it was let go; everything else
        // snaps to a cell.
        const moved = free || targetX.value !== x || targetY.value !== y;
        dropping.value = moved;
        scheduleOnRN(
          drop,
          free ? Math.min(COLUMNS - w, Math.max(0, x + dragX.value / stride)) : targetX.value,
          free ? Math.max(0, y + dragY.value / stride) : targetY.value
        );
      })
      .onFinalize(() => {
        dragging.value = false;
        if (overTrash.value) {
          overTrash.value = false;
          if (armed.value === 1) scheduleOnRN(trashArmed, false);
          armed.value = 0;
          scheduleOnRN(trashHover, false);
        }
        doomed.value = withTiming(0, { duration: 200 });
        if (tabOver.value !== "") {
          tabOver.value = "";
          scheduleOnRN(tabHover, "");
        }
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
  }, [selecting, item.locked, free, x, y, w, h, stride, press, hold, editingNow, begin, ghost, drop, edge, trash, tabs, tabOver, tabHover, tabDrop, trashDrop, trashHover, trashArmed, overTrash, armed, doomed, dragX, dragY, lifted, pressed, dropping, targetX, targetY, grabX, grabY, fingerX, fingerY, viewTop, viewBottom, scrollY]);

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
          // Text can be half a row tall; everything else is whole rows.
          const rawH = h + event.translationY / stride;
          const nextH = Math.min(8, Math.max(min.h, halfRows ? Math.round(rawH * 2) / 2 : Math.round(rawH)));
          if (nextW !== targetW.value || nextH !== targetH.value) {
            targetW.value = nextW;
            targetH.value = nextH;
            scheduleOnRN(sizeTick, x, y, nextW, nextH);
          }
        })
        .onEnd(() => {
          scheduleOnRN(resizeEnd, targetW.value, targetH.value);
        }),
    [x, y, w, h, min.w, min.h, stride, halfRows, begin, ghost, sizeTick, resizeEnd, targetW, targetH]
  );

  const style = useAnimatedStyle(() => ({
    left: left.value,
    top: top.value,
    transform: [
      { translateX: dragX.value },
      { translateY: dragY.value },
      { scale: 1 + lifted.value * 0.04 - pressed.value * 0.03 - doomed.value * 0.35 },
    ],
    opacity: 1 - doomed.value * 0.4,
    shadowOpacity: lifted.value * 0.22,
  }));

  return (
    <Animated.View style={[styles.item, { zIndex: active ? 100 : focused ? 50 : 1, elevation: active ? 12 : focused ? 6 : 0 }, style]}>
      {/* Keyed by shape: the phone doesn't redraw a shadow when only the corner
          radii change, so a new shape gets a fresh view. */}
      <GestureDetector gesture={moveGesture}>
        <Animated.View
          key={`${item.kind === "nook" ? (item.shape ?? "arch") : ""}-${item.corners ?? ""}-${shadow ?? ""}`}
          style={[shadow ? { ...shadowShape(item, stride), boxShadow: shadow } : null, wiggle]}
          {...spokenAs(item, editing, { press, hold, nudge: onNudge })}
        >
          {children}
        </Animated.View>
      </GestureDetector>
      <Animated.View
        pointerEvents="none"
        style={[styles.glow, shadowShape(item, stride), { borderColor: accent, boxShadow: `0px 0px 18px 2px ${accent}` }, glowStyle]}
      />
      {focused ? (
        <View
          pointerEvents="none"
          style={[styles.glow, shadowShape(item, stride), { borderColor: accent, borderWidth: 3, opacity: 1, boxShadow: `0px 0px 16px 2px ${accent}99` }]}
        />
      ) : null}
      {selecting ? (
        <>
          <View
            pointerEvents="none"
            style={[styles.glow, shadowShape(item, stride), { borderColor: accent, opacity: selected ? 1 : 0.35, borderStyle: selected ? "solid" : "dashed" }]}
          />
          <View
            pointerEvents="none"
            style={[styles.pick, { borderColor: accent, backgroundColor: selected ? accent : "#ffffff" }]}
            accessibilityLabel={selected ? "Selected" : "Not selected"}
          >
            {selected ? <Icon name="check" size={14} color="#ffffff" /> : null}
          </View>
        </>
      ) : null}
      {editing && !selecting && onToggleLock && !active ? (
        <Animated.View entering={FadeIn.duration(200)} style={styles.lockBadge}>
          <Tap
            onPress={() => {
              tap("success");
              onToggleLock();
            }}
            hitSlop={12}
            pressedScale={0.8}
            style={[styles.copyButton, { borderColor: accent, backgroundColor: item.locked ? accent : "#ffffff" }]}
            accessibilityRole="button"
            accessibilityLabel={item.locked ? "Unlock" : "Lock in place"}
          >
            <Icon name={item.locked ? "lock" : "unlock"} size={12} color={item.locked ? "#ffffff" : accent} />
          </Tap>
        </Animated.View>
      ) : null}
      {editing && !selecting && !item.locked ? (
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
      {editing && !selecting && onCopy && !active ? (
        <Animated.View entering={FadeIn.duration(200)} style={styles.copy}>
          <Tap
            onPress={() => {
              tap("success");
              onCopy();
            }}
            hitSlop={12}
            pressedScale={0.8}
            style={[styles.copyButton, { borderColor: accent }]}
            accessibilityRole="button"
            accessibilityLabel="Make a copy"
          >
            <Icon name="copy" size={12} color={accent} />
          </Tap>
        </Animated.View>
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
  copy: { position: "absolute", left: -6, top: -6 },
  lockBadge: { position: "absolute", right: -6, top: -6 },
  pick: {
    position: "absolute",
    left: -6,
    top: -6,
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  glow: { position: "absolute", left: -4, top: -4, right: -4, bottom: -4, borderWidth: 3, opacity: 0 },
  copyButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
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

// How a tile reads to a screen reader (CORE-075): its name as a button, and —
// while arranging — actions to move it a step at a time (swipe up or down on
// iPhone, or the actions menu on Android), since dragging can't be done by
// touch-exploring. A widget with its own buttons inside (a checklist) keeps
// them reachable one by one, except while arranging.
const nudgeWays: Nudge[] = ["up", "down", "left", "right"];

function spokenAs(
  item: HearthItem,
  editing: boolean,
  { press, hold, nudge }: { press: () => void; hold: () => void; nudge?: (way: Nudge) => void }
) {
  if (item.kind === "widget" && !editing) return {};
  const moves = editing && nudge ? nudgeWays.filter((way) => canNudge(item, way)) : [];
  return {
    accessible: true,
    accessibilityRole: "button" as const,
    accessibilityLabel: `${itemSpokenName(item)}${editing && item.locked ? ", locked" : ""}`,
    accessibilityHint: editing ? "Double-tap for its options." : item.kind === "label" ? undefined : "Double-tap to open.",
    accessibilityActions: [
      { name: "activate" },
      ...(editing ? [] : [{ name: "longpress", label: "Arrange your Hearth" }]),
      ...moves.map((way) => ({ name: `move-${way}`, label: `Move ${way}` })),
    ],
    onAccessibilityAction: (event: AccessibilityActionEvent) => {
      const name = event.nativeEvent.actionName;
      if (name === "activate") press();
      else if (name === "longpress") hold();
      else if (name.startsWith("move-") && nudge) {
        const way = name.slice(5) as Nudge;
        nudge(way);
        AccessibilityInfo.announceForAccessibility(`Moved ${way}`);
      }
    },
  };
}
