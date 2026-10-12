import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AccessibilityInfo, StyleSheet, View, type AccessibilityActionEvent } from "react-native";
import { Text } from "../text";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  FadeIn,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { tap } from "../../lib/feedback";
import { CUBBY_OUTSET } from "../../lib/cubbies";
import { cornerRadius, liftLevel } from "../../lib/decor";
import {
  canNudge,
  COLUMNS,
  cubbyContents,
  edgeScrollBottom,
  edgeScrollSpeed,
  itemSpokenName,
  minSize,
  planMove,
  pushItem,
  ROW_STEP,
  rowsUsed,
  stickySnap,
  usesHalfRows,
  type GridRect,
  type HearthItem,
  type HollowItem,
  type MovePlan,
  type Nudge,
} from "../../lib/hearth-layout";
import { trinketAspect, trinketBounds } from "../../lib/trinkets";
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
// A drop the Hearth didn't take after all (too full, or it couldn't save)
// goes back where it was after this long.
const DROP_TIMEOUT_MS = 700;
// How long a change of size takes to play when it isn't being dragged
// (Undo, the size slider; CORE-093), and how long the drop outline takes to
// glide to its next cell. Dragging a corner follows the finger instantly.
const GROW_MS = 180;
// Asks for a drawing that fills whatever frame it's in (a Trinket, which
// the frame resizes on the animation thread).
export const FILL = -1;
const GLIDE_MS = 110;
// Holding a dragged item still this long over a spot with no room shows the
// things there sliding down to make room; letting go then makes it (CORE-092).
const PUSH_HOLD_MS = 700;
// How far a finger holding a Hollow open (CORE-116) moves before it picks the
// Hollow up instead.
const PEEK_SLOP = 12;

// The free-form Hearth canvas (CORE-006/019). Items sit at exact grid cells;
// in edit mode you hold one to drag it anywhere (an outline shows where it
// will land, whether it'll swap, or that there's no room, CORE-091), or drag
// its corner handle to resize it. Calm, eased motion
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
  onPush,
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
  cubbyMode = false,
  selectedIds,
  onToggleLock,
  onTabHover,
  onDropOnTab,
  spokenNews,
  onPeek,
  onPeekEnd,
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
  // Dropped after holding still over a spot with no room: make room (CORE-092).
  onPush: (id: string, x: number, y: number) => void;
  // One step in a direction, from a screen reader's actions (CORE-075).
  onNudge?: (id: string, way: Nudge) => void;
  onResize: (id: string, w: number, h: number) => void;
  onPressItem: (item: HearthItem) => void;
  // Edit switched on by holding a tile (`picked`: and it's being dragged now,
  // rather than asked for by a screen reader).
  onLongPress: (picked: boolean) => void;
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
  // Cubby mode (CORE-085): only Cubbies can be touched, and everything else
  // is faded so you can see and reach the boxes behind it. Out of it, Cubbies
  // can't be touched at all, so they never get in the way.
  cubbyMode?: boolean;
  selectedIds?: string[];
  // The lock button in Edit (CORE-061).
  onToggleLock?: (item: HearthItem) => void;
  // A dragged item is over a page tab ("" when it isn't), and let go there.
  onTabHover?: (tabId: string) => void;
  onDropOnTab?: (item: HearthItem, tabId: string) => void;
  // Said after a tile's name when something in it is new (CORE-115).
  spokenNews?: (item: HearthItem) => string;
  // Holding a Hollow while just looking peeks inside it (CORE-116); moving
  // the finger then picks it up to arrange, as holding anything else does,
  // and the peek closes (onPeekEnd).
  onPeek?: (item: HollowItem) => void;
  onPeekEnd?: () => void;
  renderItem: (item: HearthItem, size: { width: number; height: number }) => ReactNode;
}) {
  const cell = (width - GRID_GAP * (COLUMNS - 1)) / COLUMNS;
  const stride = cell + GRID_GAP;
  const [ghost, setGhost] = useState<GridRect | null>(null);
  // What letting go right now would do (moving, not resizing).
  const [plan, setPlan] = useState<MovePlan | null>(null);
  const planRef = useRef<MovePlan | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  // The active item is being resized (not moved): it's drawn at the outline's
  // size as you drag its corner, so you watch it grow (CORE-077, CORE-093).
  const [sizing, setSizing] = useState(false);
  const activeKind = activeId ? items.find((item) => item.id === activeId)?.kind : undefined;
  const [dropHollow, setDropHollow] = useState<HollowItem | null>(null);
  const dropHollowRef = useRef<HollowItem | null>(null);
  // While a Cubby (CORE-084) is dragged, the things inside it come along:
  // which ones, and how far the box has been dragged so far.
  const [carriedIds, setCarriedIds] = useState<string[]>([]);
  const carry = useSharedValue({ x: 0, y: 0 });
  // Making room (CORE-092): where everything would go, shown while the item
  // is held over the spot, and the spot it's for.
  const [pushing, setPushing] = useState<{ x: number; y: number; items: Map<string, HearthItem> } | null>(null);
  const pushRef = useRef<{ x: number; y: number } | null>(null);
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Over the trash can or a page tab: no making room there.
  const aimingElsewhere = useRef(false);
  const stopPushing = useCallback(() => {
    if (pushTimer.current) clearTimeout(pushTimer.current);
    pushTimer.current = null;
    if (pushRef.current) {
      pushRef.current = null;
      setPushing(null);
    }
  }, []);
  useEffect(() => stopPushing, [stopPushing]);

  // Cubbies sit behind everything else.
  const ordered = useMemo(
    () => [...items.filter((item) => item.kind === "cubby"), ...items.filter((item) => item.kind !== "cubby")],
    [items]
  );

  // Things can end on a half row (CORE-076); the grid shows whole rows.
  const rows = Math.ceil(rowsUsed(pushing ? [...pushing.items.values()] : items)) + (editing ? EXTRA_EDIT_ROWS : 0);
  const height = Math.max(0, rows * stride - GRID_GAP);

  const begin = useCallback(
    (id: string) => {
      setActiveId(id);
      onDraggingChange(true);
      const cubby = items.find((item) => item.id === id && item.kind === "cubby");
      carry.value = { x: 0, y: 0 };
      setCarriedIds(cubby ? cubbyContents(items, cubby).map((item) => item.id) : []);
    },
    [onDraggingChange, items, carry]
  );
  const finish = useCallback(() => {
    setGhost(null);
    setPlan(null);
    planRef.current = null;
    setSizing(false);
    setDropHollow(null);
    dropHollowRef.current = null;
    setActiveId(null);
    setCarriedIds([]);
    stopPushing();
    aimingElsewhere.current = false;
    onDraggingChange(false);
  }, [onDraggingChange, stopPushing]);

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
      ) : ghost && activeKind !== "trinket" ? (
        <>
          {/* Where it'll land: the open spot it settles into, or the spot of
              the thing it swaps with. With no room it goes back (CORE-091). */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.ghost,
              glide,
              {
                left: (plan?.x ?? ghost.x) * stride,
                top: (plan?.y ?? ghost.y) * stride,
                width: ghost.w * stride - GRID_GAP,
                height: ghost.h * stride - GRID_GAP,
                borderColor: plan?.kind === "blocked" && !pushing ? `${accent}55` : accent,
                backgroundColor: plan?.kind === "blocked" && !pushing ? "transparent" : `${accent}14`,
              },
            ]}
          />
          {plan?.kind === "swap" ? (
            <View
              pointerEvents="none"
              style={[
                styles.ghost,
                {
                  left: plan.to.x * stride,
                  top: plan.to.y * stride,
                  width: ghost.w * stride - GRID_GAP,
                  height: ghost.h * stride - GRID_GAP,
                  borderColor: accent,
                  backgroundColor: `${accent}0d`,
                },
              ]}
            />
          ) : null}
        </>
      ) : null}

      {ordered.map((item, index) => (
        <GridItem
          key={item.id}
          // While making room, everything else is shown where it would go.
          item={(activeId !== item.id && !carriedIds.includes(item.id) && pushing?.items.get(item.id)) || item}
          stride={stride}
          editing={editing}
          seed={index}
          active={activeId === item.id}
          resizing={activeId === item.id && sizing}
          badge={activeId === item.id && plan?.kind === "blocked" ? (pushing ? "push" : "noRoom") : null}
          carry={carry}
          carried={carriedIds.includes(item.id)}
          asleep={item.kind === "cubby" ? !(editing && cubbyMode) : editing && cubbyMode}
          faded={editing && cubbyMode && item.kind !== "cubby"}
          accent={accent}
          shadow={isRaised(item) ? shadowAt?.(liftLevel(item.lift, item.kind === "nook")) : undefined}
          dragScroll={dragScroll}
          onPress={() => onPressItem(item)}
          onLongPress={onLongPress}
          news={spokenNews?.(item) ?? ""}
          onPeek={onPeek && item.kind === "hollow" ? () => onPeek(item) : undefined}
          onPeekEnd={onPeekEnd}
          onNudge={onNudge ? (way) => onNudge(item.id, way) : undefined}
          onCopy={onCopy && item.kind !== "hollow" ? () => onCopy(item) : undefined}
          onTrashHover={(over) => {
            aimingElsewhere.current = over;
            if (over) stopPushing();
            onTrashHover?.(over);
          }}
          onTrashArmed={(armed) => onTrashArmed?.(armed)}
          flash={flashId === item.id}
          focused={focusId === item.id}
          selecting={selecting}
          selected={selectedIds?.includes(item.id) ?? false}
          onToggleLock={onToggleLock ? () => onToggleLock(item) : undefined}
          onTabHover={(id) => {
            aimingElsewhere.current = id !== "";
            if (id) stopPushing();
            onTabHover?.(id);
          }}
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
              onDropIntoHollow && finger && item.kind !== "hollow" && item.kind !== "cubby"
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
            // A Trinket has no cell to snap to, so no outline while it moves;
            // resizing it shows its new size (CORE-098).
            setGhost(item.kind === "trinket" && finger ? null : rect);
            setSizing(!finger);
            // Moving (not resizing): what letting go here would do.
            const next = finger && !target ? planMove(items, item.id, rect.x, rect.y) : null;
            if (next?.kind === "swap" && planRef.current?.kind !== "swap") tap();
            planRef.current = next;
            setPlan(next);
            // Held still over a spot with no room: after a moment, show the
            // things there sliding down to make room (CORE-092).
            if (pushRef.current && (pushRef.current.x !== rect.x || pushRef.current.y !== rect.y)) stopPushing();
            if (pushTimer.current) clearTimeout(pushTimer.current);
            pushTimer.current = null;
            if (next?.kind === "blocked" && !pushRef.current) {
              pushTimer.current = setTimeout(() => {
                pushTimer.current = null;
                if (aimingElsewhere.current) return;
                const moved = pushItem({ items }, item.id, rect.x, rect.y);
                if (moved === items) return;
                tap("success");
                pushRef.current = { x: rect.x, y: rect.y };
                setPushing({ x: rect.x, y: rect.y, items: new Map(moved.map((one) => [one.id, one])) });
              }, PUSH_HOLD_MS);
            }
          }}
          onDrop={(x, y) => {
            // Read before finish() clears them.
            const into = dropHollowRef.current;
            const making = pushRef.current;
            finish();
            if (into && onDropIntoHollow) {
              onDropIntoHollow(item.id, into.id);
              return true;
            }
            // Held there to make room: everything slides down (CORE-092).
            if (making && making.x === x && making.y === y) {
              onPush(item.id, x, y);
              return true;
            }
            // No room, or right back where it was: it goes home (CORE-091).
            const landing = planMove(items, item.id, x, y);
            if (landing.kind === "blocked") tap();
            if (landing.kind === "blocked" || (landing.x === item.x && landing.y === item.y)) return false;
            onMove(item.id, x, y);
            return true;
          }}
          onSettle={finish}
          onResizeEnd={(w, h) => {
            finish();
            if (w !== item.w || h !== item.h) onResize(item.id, w, h);
          }}
          size={activeId === item.id && sizing && ghost ? ghost : item}
          content={(width, height) => <ItemContent item={item} width={width} height={height} render={renderItem} />}
        />
      ))}

      {/* Over everything else, so no tile hides it. */}
      {ghost && plan?.kind === "swap" ? (
        <View
          pointerEvents="none"
          style={[
            styles.labelSpot,
            { left: plan.to.x * stride, top: plan.to.y * stride, width: ghost.w * stride - GRID_GAP },
          ]}
        >
          <View style={[styles.dropLabel, { backgroundColor: accent }]}>
            <Text style={styles.dropLabelText} numberOfLines={1}>
              Swaps to here
            </Text>
          </View>
        </View>
      ) : null}
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

// The drop outline glides from cell to cell instead of jumping.
const glide = {
  transitionProperty: ["left", "top", "width", "height"] as ("left" | "top" | "width" | "height")[],
  transitionDuration: GLIDE_MS,
  transitionTimingFunction: "ease-out" as const,
};

// The shadow follows the item's outline: Nook tiles are arched (CORE-036).
function shadowShape(item: HearthItem, stride: number, size: { w: number; h: number } = item) {
  const width = size.w * stride - GRID_GAP;
  const height = size.h * stride - GRID_GAP;
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
// everything solid gets a shadow. A Cubby draws its own, around its edge.
function isRaised(item: HearthItem) {
  if (item.kind === "label" || item.kind === "trinket" || item.kind === "cubby") return false;
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
  resizing,
  badge,
  carry,
  carried,
  asleep,
  faded,
  accent,
  shadow,
  dragScroll,
  onPress,
  onLongPress,
  news,
  onPeek,
  onPeekEnd,
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
  onSettle,
  onResizeEnd,
  size,
  content,
}: {
  item: HearthItem;
  stride: number;
  editing: boolean;
  seed: number;
  active: boolean;
  // Its corner is being dragged: it keeps up with the finger, no easing.
  resizing: boolean;
  // Being dragged over a spot with no room (CORE-091): it fades a little and
  // says so; held there, it's making room (CORE-092).
  badge: "noRoom" | "push" | null;
  // Inside a Cubby that's being dragged: it moves along by `carry`.
  carry: SharedValue<{ x: number; y: number }>;
  carried: boolean;
  // Can't be touched right now (Cubby mode, CORE-085), and faded out of the way.
  asleep: boolean;
  faded: boolean;
  accent: string;
  shadow?: string;
  dragScroll: DragScroll;
  onPress: () => void;
  onLongPress: (picked: boolean) => void;
  news: string;
  onPeek?: () => void;
  onPeekEnd?: () => void;
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
  // True if it's going somewhere new; false and it goes back where it was.
  onDrop: (x: number, y: number) => boolean;
  // A drag or resize is over, however it ended.
  onSettle: () => void;
  onResizeEnd: (w: number, h: number) => void;
  // The size it's drawn at: its own, or the outline's while being resized.
  size: { w: number; h: number };
  content: (width: number, height: number) => ReactNode;
}) {
  const min = minSize(item);
  const halfRows = usesHalfRows(item);
  const carries = item.kind === "cubby";

  // Changing size plays smoothly (CORE-093): the frame (and its shadow) grows
  // or shrinks to the new size while what's inside, already laid out for it,
  // is revealed or tucked away. While that plays, the inside is drawn at the
  // larger of the two sizes so there's never a gap, then settles. Dragging a
  // corner skips it so the size keeps up with the finger, and Boxes and
  // Trinkets just change, since they draw past their edges.
  const reduceMotion = useReducedMotion();
  const grows = !reduceMotion && !resizing && item.kind !== "cubby" && item.kind !== "trinket";
  const boxW = size.w * stride - GRID_GAP;
  const boxH = size.h * stride - GRID_GAP;
  // A Trinket's size while its corner is dragged lives on the animation
  // thread (CORE-098): the frame follows the finger frame by frame with no
  // trip through React, and its drawing scales with it (it has no fixed
  // pixel size), so resizing stays smooth.
  const liveW = useSharedValue(boxW);
  const liveH = useSharedValue(boxH);
  const boxNow = useRef({ w: boxW, h: boxH });
  boxNow.current = { w: boxW, h: boxH };
  useEffect(() => {
    liveW.value = boxW;
    liveH.value = boxH;
  }, [boxW, boxH, liveW, liveH]);
  const liveStyle = useAnimatedStyle(() => ({ width: liveW.value, height: liveH.value }));
  // If a resize doesn't take (too full, or it couldn't save), go back to
  // the size the Hearth has.
  const syncLive = useCallback(() => {
    setTimeout(() => {
      liveW.value = boxNow.current.w;
      liveH.value = boxNow.current.h;
    }, 700);
  }, [liveW, liveH]);
  const shown = useRef({ w: boxW, h: boxH });
  const [held, setHeld] = useState<{ w: number; h: number } | null>(null);
  const changed = grows && (shown.current.w !== boxW || shown.current.h !== boxH);
  const inside =
    held ?? (changed ? { w: Math.max(shown.current.w, boxW), h: Math.max(shown.current.h, boxH) } : null);
  useLayoutEffect(() => {
    const last = shown.current;
    shown.current = { w: boxW, h: boxH };
    if (!grows || (last.w === boxW && last.h === boxH)) return;
    setHeld((was) => ({ w: Math.max(was?.w ?? 0, last.w, boxW), h: Math.max(was?.h ?? 0, last.h, boxH) }));
  }, [boxW, boxH, grows]);
  // Once it has played, the inside settles at the new size.
  useEffect(() => {
    if (!held) return;
    const timer = setTimeout(() => setHeld(null), GROW_MS + 40);
    return () => clearTimeout(timer);
  }, [held]);
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
  // A big box rocking about would be a lot, so Cubbies hold still.
  const wiggle = useWiggle(editing && !active && !carries, seed);
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

  // Riding along in a dragged Cubby, as the item's own animations see it.
  const carriedNow = useSharedValue(false);

  // New position from the layout: glide there. If this is the tile that was
  // just dropped, carry on from where the finger let go instead of jumping;
  // the same if it was riding in a Cubby that was just let go.
  useEffect(() => {
    const nextLeft = item.x * stride;
    const nextTop = item.y * stride;
    if (carriedNow.value !== carried) {
      if (!carried) {
        const c = carry.value;
        dragX.value = left.value + dragX.value + c.x - nextLeft;
        dragY.value = top.value + dragY.value + c.y - nextTop;
        left.value = nextLeft;
        top.value = nextTop;
        dragX.value = withTiming(0, ease);
        dragY.value = withTiming(0, ease);
      }
      carriedNow.value = carried;
      if (!carried) return;
    }
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
  }, [item.x, item.y, stride, left, top, dragX, dragY, dropping, carried, carriedNow, carry]);

  // Latest callbacks without rebuilding gestures mid-drag.
  const handlers = useRef({ onPress, onLongPress, onPeek, onPeekEnd, onBegin, onGhost, onDrop, onSettle, onResizeEnd, onTrash, onTrashHover, onTrashArmed, onTabHover, onTabDrop });
  handlers.current = { onPress, onLongPress, onPeek, onPeekEnd, onBegin, onGhost, onDrop, onSettle, onResizeEnd, onTrash, onTrashHover, onTrashArmed, onTabHover, onTabDrop };
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
    handlers.current.onLongPress(true);
  }, []);
  const askToArrange = useCallback(() => handlers.current.onLongPress(false), []);
  // Peeking into a Hollow (CORE-116).
  const canPeek = Boolean(onPeek);
  const peek = useCallback(() => {
    tap();
    handlers.current.onPeek?.();
  }, []);
  const askToPeek = useCallback(() => handlers.current.onPeek?.(), []);
  const peekToDrag = useCallback(() => {
    handlers.current.onPeekEnd?.();
    tap();
    handlers.current.onLongPress(true);
  }, []);
  // Held to peek, finger still down and not moved far yet.
  const peeking = useSharedValue(false);
  // Held while locked in Edit: nothing happens.
  const stuck = useSharedValue(false);
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
  // Glide back home from wherever it was let go.
  const springBack = useCallback(() => {
    dropping.value = false;
    dragX.value = withTiming(0, ease);
    dragY.value = withTiming(0, ease);
  }, [dropping, dragX, dragY]);
  const drop = useCallback(
    (x: number, y: number) => {
      if (!handlers.current.onDrop(x, y)) return springBack();
      // Going somewhere new, so the layout will move it; if that never comes
      // (too full, or it couldn't save), don't leave it stranded on top of
      // something else.
      setTimeout(() => {
        if (dropping.value) springBack();
      }, DROP_TIMEOUT_MS);
    },
    [dropping, springBack]
  );
  const settle = useCallback(() => handlers.current.onSettle(), []);
  // A drag or resize that started here, so its end can tidy up after it.
  const began = useSharedValue(false);
  const edge = useCallback((speed: number) => onEdge(speed), [onEdge]);

  function follow() {
    "worklet";
    const g = geo.value;
    const dy = rawY.value + (scrollY.value - startScroll.value);
    dragX.value = rawX.value;
    dragY.value = dy;
    if (carries) carry.value = { x: rawX.value, y: dy };
    // Sticky, so a finger near a line doesn't flip between two cells (CORE-091).
    const nextX = Math.min(COLUMNS - g.w, Math.max(0, stickySnap(g.x + rawX.value / g.stride, targetX.value, 1)));
    // Up and down snap to half rows (CORE-076).
    const nextY = Math.max(0, stickySnap(g.y + dy / g.stride, targetY.value, ROW_STEP));
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
  // A Trinket resizes at any size, keeping its drawing's shape, between its
  // smallest and biggest (CORE-098).
  const aspect = item.kind === "trinket" ? trinketAspect(item.piece) : 1;
  const bounds = item.kind === "trinket" ? trinketBounds(item.piece) : { minW: 1, maxW: 4 };
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
    // Picked up, held at `grabAtX/Y` on the item.
    function pickUp(grabAtX: number, grabAtY: number) {
      "worklet";
      geo.value = { x, y, w, h, stride };
      rawX.value = 0;
      rawY.value = 0;
      startScroll.value = scrollY.value;
      dragging.value = true;
      lastSpeed.value = 0;
      targetX.value = x;
      targetY.value = y;
      grabX.value = grabAtX;
      grabY.value = grabAtY;
      fingerX.value = Math.floor((x * stride + grabAtX) / stride);
      fingerY.value = Math.floor((y * stride + grabAtY) / stride);
      lifted.value = withTiming(1, { duration: 160 });
      began.value = true;
      scheduleOnRN(begin);
      scheduleOnRN(ghost, x, y, w, h, fingerX.value, fingerY.value);
    }
    // A locked Hollow can still be peeked into, just not picked up.
    const locked = Boolean(item.locked);
    const pan = Gesture.Pan()
      .enabled(!selecting && (!locked || canPeek))
      .activateAfterLongPress(300)
      .onStart((event) => {
        // A Hollow held while just looking peeks inside instead (CORE-116).
        if (canPeek && !editingNow.value) {
          peeking.value = true;
          scheduleOnRN(peek);
          return;
        }
        if (locked) {
          stuck.value = true;
          return;
        }
        if (!editingNow.value) scheduleOnRN(hold);
        pickUp(event.x, event.y);
      })
      .onUpdate((event) => {
        if (stuck.value) return;
        if (peeking.value) {
          // Moving on from a peek picks the Hollow up to arrange, as
          // holding anything else does.
          if (locked || Math.hypot(event.translationX, event.translationY) < PEEK_SLOP) return;
          peeking.value = false;
          scheduleOnRN(peekToDrag);
          pickUp(event.x - event.translationX, event.y - event.translationY);
        }
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
        const scrollBottom = edgeScrollBottom(viewBottom.value, bin === null ? null : bin.y - TRASH_SLOP);
        const speed = over || hit !== "" ? 0 : edgeScrollSpeed(event.absoluteY, viewTop.value, scrollBottom);
        if (speed !== lastSpeed.value) {
          lastSpeed.value = speed;
          scheduleOnRN(edge, speed);
        }
      })
      .onEnd(() => {
        // Let go of a peek: it stays open to look at.
        if (peeking.value || stuck.value) return;
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
        peeking.value = false;
        stuck.value = false;
        // However it ended (even interrupted), nothing stays picked up.
        if (began.value) {
          began.value = false;
          scheduleOnRN(settle);
        }
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
  }, [selecting, item.locked, canPeek, peek, peekToDrag, peeking, stuck, free, carries, carry, x, y, w, h, stride, press, hold, editingNow, begin, ghost, drop, settle, began, edge, trash, tabs, tabOver, tabHover, tabDrop, trashDrop, trashHover, trashArmed, overTrash, armed, doomed, dragX, dragY, lifted, pressed, dropping, targetX, targetY, grabX, grabY, fingerX, fingerY, viewTop, viewBottom, scrollY]);

  const resizeGesture = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(1)
        .onStart(() => {
          targetW.value = w;
          targetH.value = h;
          began.value = true;
          scheduleOnRN(begin);
          scheduleOnRN(ghost, x, y, w, h);
        })
        .onUpdate((event) => {
          if (free) {
            // Along the corner's own diagonal, so the shape never changes.
            const along = ((event.translationX / stride) * w + (event.translationY / stride) * h) / (w * w + h * h);
            const room = Math.max(bounds.minW, Math.min(bounds.maxW, COLUMNS - x));
            const freeW = Math.round(Math.min(room, Math.max(bounds.minW, w * (1 + along))) * 50) / 50;
            const freeH = Math.round((freeW / aspect) * 100) / 100;
            targetW.value = freeW;
            targetH.value = freeH;
            liveW.value = freeW * stride - GRID_GAP;
            liveH.value = freeH * stride - GRID_GAP;
            return;
          }
          const nextW = Math.min(COLUMNS - x, Math.max(min.w, stickySnap(w + event.translationX / stride, targetW.value, 1)));
          // Text can be half a row tall; everything else is whole rows.
          const rawH = h + event.translationY / stride;
          const nextH = Math.min(8, Math.max(min.h, stickySnap(rawH, targetH.value, halfRows ? ROW_STEP : 1)));
          if (nextW !== targetW.value || nextH !== targetH.value) {
            targetW.value = nextW;
            targetH.value = nextH;
            scheduleOnRN(sizeTick, x, y, nextW, nextH);
          }
        })
        .onEnd(() => {
          scheduleOnRN(resizeEnd, targetW.value, targetH.value);
          if (free) scheduleOnRN(syncLive);
        })
        .onFinalize(() => {
          if (began.value) {
            began.value = false;
            scheduleOnRN(settle);
          }
        }),
    [x, y, w, h, min.w, min.h, stride, halfRows, free, aspect, bounds.minW, bounds.maxW, begin, ghost, sizeTick, resizeEnd, settle, syncLive, began, targetW, targetH, liveW, liveH]
  );

  const style = useAnimatedStyle(() => ({
    left: left.value,
    top: top.value,
    transform: [
      { translateX: dragX.value + (carriedNow.value ? carry.value.x : 0) },
      { translateY: dragY.value + (carriedNow.value ? carry.value.y : 0) },
      { scale: 1 + lifted.value * 0.04 - pressed.value * 0.03 - doomed.value * 0.35 },
    ],
    opacity: 1 - doomed.value * 0.4,
    shadowOpacity: lifted.value * 0.22,
  }));

  // A Cubby can be grabbed by its edge too, which shows around the things in
  // it, and its buttons sit on that edge in the middle of a cell, so they
  // never land on the buttons at the corners of the things inside it.
  const outset = carries ? CUBBY_OUTSET : 0;
  const cellSize = stride - GRID_GAP;
  const boxWidth = w * stride - GRID_GAP;
  const boxHeight = h * stride - GRID_GAP;
  const nearX = (w >= 2 ? cellSize / 2 : cellSize * 0.25) - 13;
  const farX = (w >= 2 ? boxWidth - cellSize / 2 : cellSize * 0.75) - 13;
  const edgeSpots = carries
    ? {
        lock: { left: farX, top: -outset - 13 },
        copy: { left: nearX, top: boxHeight + outset - 13 },
        handle: { left: farX, top: boxHeight + outset - 13 },
      }
    : null;
  const showGrip = carries && editing && !asleep && !selecting && !item.locked && !active;
  // Edit buttons, for whatever can be touched right now.
  const controls = editing && !selecting && !asleep;

  return (
    <Animated.View
      style={[
        styles.item,
        // A Cubby stays behind everything even while it's dragged; what's in
        // it rides along on top.
        carries
          ? { zIndex: 0, elevation: 0 }
          : { zIndex: active || carried ? 100 : focused ? 50 : 1, elevation: active || carried ? 12 : focused ? 6 : 0 },
        style,
      ]}
      pointerEvents={asleep ? "none" : "auto"}
    >
      {/* Keyed by shape: the phone doesn't redraw a shadow when only the corner
          radii change, so a new shape gets a fresh view. */}
      <GestureDetector gesture={moveGesture}>
        <Animated.View
          key={`${item.kind === "nook" ? (item.shape ?? "arch") : ""}-${item.corners ?? ""}-${shadow ?? ""}`}
          style={[shadow ? { ...shadowShape(item, stride, size), boxShadow: shadow } : null, carries ? { margin: -outset, padding: outset } : null, faded ? styles.faded : null, badge === "noRoom" ? styles.noRoomItem : null, wiggle]}
          {...spokenAs(item, editing, { press, hold: askToArrange, nudge: onNudge, peek: canPeek ? askToPeek : undefined }, news)}
        >
          <Animated.View
            style={
              free
                ? liveStyle
                : [
                    {
                      width: boxW,
                      height: boxH,
                      transitionProperty: ["width", "height"],
                      transitionDuration: grows ? GROW_MS : 0,
                      transitionTimingFunction: "ease-out",
                    },
                    inside ? [styles.clip, shadowShape(item, stride, size)] : null,
                  ]
            }
          >
            {free ? content(FILL, FILL) : content(inside ? Math.max(inside.w, boxW) : boxW, inside ? Math.max(inside.h, boxH) : boxH)}
          </Animated.View>
          {showGrip ? (
            // Something to hold to pick the box up, on its top edge.
            <Animated.View entering={FadeIn.duration(200)} style={[styles.copyButton, styles.grip, { left: outset + nearX, borderColor: accent }]}>
              <Icon name="drag" size={12} color={accent} />
            </Animated.View>
          ) : null}
        </Animated.View>
      </GestureDetector>
      <Animated.View
        pointerEvents="none"
        style={[styles.glow, shadowShape(item, stride), { borderColor: accent, boxShadow: `0px 0px 18px 2px ${accent}` }, glowStyle]}
      />
      {/* On the dragged item itself, so it's never hidden (CORE-091/092). */}
      {badge ? (
        <Animated.View key={badge} entering={FadeIn.duration(120)} pointerEvents="none" style={styles.noRoomSpot}>
          <View style={[styles.dropLabel, styles.noRoom, badge === "push" ? { backgroundColor: accent } : null]}>
            <Icon name={badge === "push" ? "check" : "close"} size={12} color="#ffffff" />
            <Text style={styles.dropLabelText} numberOfLines={1}>
              {badge === "push" ? "Let go to make room" : "No room · hold to make room"}
            </Text>
          </View>
        </Animated.View>
      ) : null}
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
      {controls && onToggleLock && !active ? (
        <Animated.View entering={FadeIn.duration(200)} style={edgeSpots ? [styles.at, edgeSpots.lock] : styles.lockBadge}>
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
      {controls && !item.locked ? (
        <GestureDetector gesture={resizeGesture}>
          <Animated.View
            entering={FadeIn.duration(200)}
            style={[edgeSpots ? [styles.edgeHandle, edgeSpots.handle] : styles.handle, { borderColor: accent }]}
            // A little room around it for a thumb, but not so much that a
            // scroll starting near a corner resizes the tile instead.
            hitSlop={8}
            accessibilityLabel="Drag to resize"
          >
            <Icon name="resize" size={12} color={accent} />
          </Animated.View>
        </GestureDetector>
      ) : null}
      {controls && onCopy && !active ? (
        <Animated.View entering={FadeIn.duration(200)} style={edgeSpots ? [styles.at, edgeSpots.copy] : styles.copy}>
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
  ghost: { position: "absolute", borderRadius: 24, borderWidth: 2, borderStyle: "dashed", alignItems: "center" },
  dropTarget: { position: "absolute", borderRadius: 28, borderWidth: 3, zIndex: 50, alignItems: "center" },
  dropLabel: { position: "absolute", top: -14, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, maxWidth: "100%" },
  dropLabelText: { color: "#ffffff", fontSize: 12, fontWeight: "800" },
  noRoom: {
    position: "relative",
    top: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#4a403a",
    paddingHorizontal: 12,
    paddingVertical: 5,
    boxShadow: "0px 2px 8px rgba(0, 0, 0, 0.3)",
  },
  noRoomItem: { opacity: 0.6 },
  // Centred just above the dragged item.
  noRoomSpot: { position: "absolute", top: -34, left: -40, right: -40, alignItems: "center" },
  // Where the swap label sits: above the spot, over every tile.
  labelSpot: { position: "absolute", zIndex: 200, elevation: 20, alignItems: "center" },
  clip: { overflow: "hidden" },
  item: {
    position: "absolute",
    shadowColor: "#3a2414",
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  copy: { position: "absolute", left: -6, top: -6 },
  faded: { opacity: 0.3 },
  // Placed by `left` and `top` alone (a Cubby's edge buttons).
  at: { position: "absolute" },
  grip: { position: "absolute", top: -13 },
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
  edgeHandle: {
    position: "absolute",
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
  { press, hold, nudge, peek }: { press: () => void; hold: () => void; nudge?: (way: Nudge) => void; peek?: () => void },
  news = ""
) {
  if (item.kind === "widget" && !editing) return {};
  const moves = editing && nudge ? nudgeWays.filter((way) => canNudge(item, way)) : [];
  return {
    accessible: true,
    accessibilityRole: "button" as const,
    accessibilityLabel: `${itemSpokenName(item)}${editing ? "" : news}${editing && item.locked ? ", locked" : ""}`,
    accessibilityHint: editing ? "Double-tap for its options." : item.kind === "label" ? undefined : "Double-tap to open.",
    accessibilityActions: [
      { name: "activate" },
      ...(editing || !peek ? [] : [{ name: "peek", label: "Peek inside" }]),
      ...(editing ? [] : [{ name: "longpress", label: "Arrange your Hearth" }]),
      ...moves.map((way) => ({ name: `move-${way}`, label: `Move ${way}` })),
    ],
    onAccessibilityAction: (event: AccessibilityActionEvent) => {
      const name = event.nativeEvent.actionName;
      if (name === "activate") press();
      else if (name === "longpress") hold();
      else if (name === "peek") peek?.();
      else if (name.startsWith("move-") && nudge) {
        const way = name.slice(5) as Nudge;
        nudge(way);
        AccessibilityInfo.announceForAccessibility(`Moved ${way}`);
      }
    },
  };
}
