import {
  findFreeSpot,
  newItemId,
  normalizeStacks,
  type HearthItem,
  type HearthLayout,
  type WidgetItem,
} from "./hearth-layout";
import { defaultWidget, widgetKindInfo, type WidgetKind } from "./widgets";

// Widget stacks (CORE-050): several widgets in one spot that you swipe
// through. Each is still an ordinary widget (so it can be edited, copied or
// removed like any other); they just share a `stack` id and the same spot
// and size. Pure helpers, no React.

export const MAX_STACK = 6;

export function stackMates(items: HearthItem[], item: HearthItem): HearthItem[] {
  return item.stack ? items.filter((other) => other.stack === item.stack) : [item];
}

// What the grid draws: one widget from each stack (the one at `shown[stack]`,
// the first by default) and everything that isn't stacked.
export function visibleItems(items: HearthItem[], shown: Record<string, number>): HearthItem[] {
  return items.filter((item) => {
    if (!item.stack) return true;
    const mates = items.filter((other) => other.stack === item.stack);
    const index = Math.min(Math.max(0, shown[item.stack] ?? 0), mates.length - 1);
    return mates[index] === item;
  });
}

// A new widget of `kind` joins the stack of widget `id`, taking its spot and
// size. A widget on its own becomes a stack of two.
export function addToStack(
  layout: Pick<HearthLayout, "items">,
  id: string,
  kind: WidgetKind
): { items: HearthItem[]; id: string } | null {
  const base = layout.items.find((item) => item.id === id);
  if (!base || base.kind !== "widget") return null;
  if (stackMates(layout.items, base).length >= MAX_STACK) return null;
  const stack = base.stack ?? newItemId("s");
  const newId = newItemId("w");
  const size = widgetKindInfo(kind).minSize;
  const added: WidgetItem = {
    id: newId,
    kind: "widget",
    widget: defaultWidget(kind),
    x: base.x,
    y: base.y,
    w: Math.max(base.w, size.w),
    h: Math.max(base.h, size.h),
    stack,
    ...(base.stackStill ? { stackStill: true } : {}),
  };
  const items = layout.items.map((item) => (item.id === id ? { ...item, stack } : item));
  return { items: [...items, added], id: newId };
}

// Takes a widget out of its stack, to a free spot of its own.
export function unstack(layout: Pick<HearthLayout, "items">, id: string): HearthItem[] {
  const item = layout.items.find((i) => i.id === id);
  if (!item?.stack) return layout.items;
  const others = layout.items.filter((i) => i.id !== id);
  const spot = findFreeSpot(others, item.w, item.h);
  const { stack: _stack, stackStill: _still, ...alone } = item;
  return normalizeStacks([...others, { ...alone, ...spot } as HearthItem]);
}

// Where a widget sits in its stack: [position, count], or null if alone.
export function stackPosition(items: HearthItem[], item: HearthItem): [number, number] | null {
  if (!item.stack) return null;
  const mates = stackMates(items, item);
  return mates.length > 1 ? [mates.indexOf(item), mates.length] : null;
}

// Smart stacks (CORE-114): whether the stack flips by itself to whichever
// widget has news. Set on every widget in it, so it survives any one of them
// leaving.
export function setStackStill(items: HearthItem[], stack: string, still: boolean): HearthItem[] {
  return items.map((item) => {
    if (item.stack !== stack) return item;
    if (still) return { ...item, stackStill: true };
    const { stackStill: _still, ...rest } = item;
    return rest as HearthItem;
  });
}
