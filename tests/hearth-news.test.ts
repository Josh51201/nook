import { describe, expect, it } from "vitest";

import { defaultHearthLayout, type HearthItem, type HearthLayout } from "../lib/hearth-layout";
import {
  newsFor,
  pagesWithNews,
  smartStackPick,
  smartStacks,
  stackIsSmart,
  stackNewsKey,
  type NewsContext,
  type NewsNotice,
} from "../lib/hearth-news";
import { addToStack, setStackStill, unstack } from "../lib/hearth-stacks";
import { defaultWidget, type WidgetConfig, type WidgetKind } from "../lib/widgets";

// What's new on the Hearth: badges (CORE-115), smart stacks (CORE-114) and
// what a Hollow peek says (CORE-116).

let clock = 0;
function notice(nook: string, kind: string, title: string, data: NewsNotice["data"] = {}): NewsNotice {
  clock += 1;
  return { nook, kind, title, data, created_at: new Date(Date.UTC(2026, 9, 12, 0, 0, clock)).toISOString() };
}
// Newest first, as the Hearth loads them.
const ctxOf = (notices: NewsNotice[], fridge = false): NewsContext => ({
  notices: [...notices].sort((a, b) => b.created_at.localeCompare(a.created_at)),
  fridgeHasNews: () => fridge,
});

const nook = (id: string, nookId: string, x = 0, y = 0): HearthItem => ({ id, kind: "nook", nookId, x, y, w: 2, h: 2 });
function widget(id: string, kind: WidgetKind, x = 0, y = 0, change?: (w: WidgetConfig) => WidgetConfig): HearthItem {
  const base = defaultWidget(kind);
  return { id, kind: "widget", widget: change ? change(base) : base, x, y, w: 2, h: 2 };
}
const hollow = (id: string, items: HearthItem[]): HearthItem => ({ id, kind: "hollow", name: "Den", look: "house", items, x: 0, y: 0, w: 1, h: 1 });

describe("Badges (CORE-115)", () => {
  it("a Nook tile has news when its Nook has unread notices", () => {
    const ctx = ctxOf([notice("pets", "meal_missed", "Biscuit missed dinner"), notice("rhythms", "rhythm_due", "Water the plants")]);
    expect(newsFor(nook("p", "pets"), ctx)).toEqual({ count: 1, latest: "Biscuit missed dinner", nook: "pets" });
    expect(newsFor(nook("g", "gift-nook"), ctx)).toBeNull();
  });

  it("counts several and names the newest", () => {
    const ctx = ctxOf([notice("rhythms", "rhythm_due", "Older"), notice("rhythms", "rhythm_overdue", "Newer")]);
    expect(newsFor(nook("r", "rhythms"), ctx)).toMatchObject({ count: 2, latest: "Newer" });
  });

  it("widgets pick up the notices they're about", () => {
    const ctx = ctxOf([
      notice("sickday", "sick_dose_ready", "Tylenol is OK again"),
      notice("gift-nook", "tuck_changed", "A gift you tucked changed"),
      notice("gift-nook", "new_gifts", "Mia added gifts"),
    ]);
    expect(newsFor(widget("s", "sickday"), ctx)?.latest).toBe("Tylenol is OK again");
    // Gifts to buy only cares about gifts you've tucked away.
    expect(newsFor(widget("t", "tucks"), ctx)).toMatchObject({ count: 1, latest: "A gift you tucked changed" });
    // Widgets that aren't about a Nook never have news; the Inbox widget
    // already shows its own count.
    expect(newsFor(widget("c", "clock"), ctx)).toBeNull();
    expect(newsFor(widget("i", "inbox"), ctx)).toBeNull();
  });

  it("a widget about one Gathering only lights up for that Gathering", () => {
    const ctx = ctxOf([notice("gatherings", "gathering_changed", "Picnic moved", { gathering_id: "g2" })]);
    const pick = (id: string | null) =>
      widget("w", "gathering", 0, 0, (w) => (w.kind === "gathering" ? { ...w, settings: { ...w.settings, gatheringId: id } } : w));
    expect(newsFor(pick("g1"), ctx)).toBeNull();
    expect(newsFor(pick("g2"), ctx)).not.toBeNull();
    // Whichever's next: any Gathering news.
    expect(newsFor(pick(null), ctx)).not.toBeNull();
  });

  it("a Fridge door has news when it has a note you haven't seen", () => {
    const fridge = widget("f", "fridge");
    expect(newsFor(fridge, ctxOf([], true))).toEqual({ count: 1, latest: "A new note on the fridge", nook: undefined });
    expect(newsFor(fridge, ctxOf([], false))).toBeNull();
  });

  it("a Hollow gathers news from everything inside, each notice once", () => {
    const ctx = ctxOf([notice("pets", "meal_missed", "Biscuit missed dinner")]);
    // A Pet Care tile and a Pet Care widget inside, both about the same notice.
    const den = hollow("h", [nook("p", "pets"), widget("w", "pets", 2, 0), widget("c", "clock", 0, 2)]);
    expect(newsFor(den, ctx)).toMatchObject({ count: 1, latest: "Biscuit missed dinner" });
    expect(newsFor(hollow("empty", [widget("c", "clock")]), ctx)).toBeNull();
  });

  it("only ever uses the notices it's given (your own inbox), so it can't reveal more than the inbox does (GIFT-007)", () => {
    // The owner's own inbox never has claim notices; with nothing given,
    // the Gift Nook tile and Gifts to buy show nothing at all.
    const ctx = ctxOf([]);
    expect(newsFor(nook("g", "gift-nook"), ctx)).toBeNull();
    expect(newsFor(widget("t", "tucks"), ctx)).toBeNull();
    expect(newsFor(hollow("h", [nook("g", "gift-nook")]), ctx)).toBeNull();
  });

  it("other pages with news get a dot, Hollows included, but not the page you're on", () => {
    const layout: HearthLayout = {
      ...defaultHearthLayout,
      pages: [
        { id: "a", name: "Everyday" },
        { id: "b", name: "Holidays" },
        { id: "c", name: "Quiet" },
      ],
      activePage: "a",
      items: [nook("p", "pets")],
      otherPages: { b: [hollow("h", [nook("p2", "pets")])], c: [widget("c", "clock")] },
    };
    const ctx = ctxOf([notice("pets", "meal_missed", "Biscuit missed dinner")]);
    expect(pagesWithNews(layout, ctx, "home", "a")).toEqual(["b"]);
    expect(pagesWithNews(layout, ctx, "home")).toEqual(["a", "b"]);
  });
});

describe("Smart stacks (CORE-114)", () => {
  function stackOf(): HearthItem[] {
    const base = { ...defaultHearthLayout, items: [widget("clock", "clock")] };
    let items = addToStack(base, "clock", "pets")!.items;
    items = addToStack({ items }, "clock", "rhythms")!.items;
    return items;
  }
  const stackId = (items: HearthItem[]) => items[0].stack!;
  const kinds = (items: HearthItem[]) => items.map((i) => (i.kind === "widget" ? i.widget.kind : i.kind));

  it("picks the widget with news, the newest if several", () => {
    const items = stackOf();
    expect(kinds(items)).toEqual(["clock", "pets", "rhythms"]);
    expect(smartStackPick(items, ctxOf([]))).toBeNull();
    const pets = notice("pets", "meal_missed", "Biscuit missed dinner");
    expect(smartStackPick(items, ctxOf([pets]))).toBe(1);
    const chore = notice("rhythms", "rhythm_overdue", "Bins are overdue");
    expect(smartStackPick(items, ctxOf([pets, chore]))).toBe(2);
  });

  it("shows the news, then goes back to your choice once it's read", () => {
    const items = stackOf();
    const stack = stackId(items);
    const ctx = ctxOf([notice("pets", "meal_missed", "Biscuit missed dinner")]);
    expect(smartStacks(items, { [stack]: 0 }, ctx, {})[stack]).toBe(1);
    expect(smartStacks(items, { [stack]: 0 }, ctxOf([]), {})[stack]).toBe(0);
  });

  it("after you swipe away, your choice stands until newer news comes", () => {
    const items = stackOf();
    const stack = stackId(items);
    const first = ctxOf([notice("pets", "meal_missed", "Biscuit missed dinner")]);
    const swiped = { [stack]: stackNewsKey(items, first) };
    expect(smartStacks(items, { [stack]: 0 }, first, swiped)[stack]).toBe(0);
    const later = ctxOf([...first.notices, notice("rhythms", "rhythm_overdue", "Bins are overdue")]);
    expect(smartStacks(items, { [stack]: 0 }, later, swiped)[stack]).toBe(2);
  });

  it("can be switched off for a stack, and the setting follows the stack", () => {
    const items = stackOf();
    const stack = stackId(items);
    const still = setStackStill(items, stack, true);
    expect(stackIsSmart(still)).toBe(false);
    const ctx = ctxOf([notice("pets", "meal_missed", "Biscuit missed dinner")]);
    expect(smartStacks(still, { [stack]: 0 }, ctx, {})[stack]).toBe(0);
    // A widget added later joins as it is; one taken out leaves it behind.
    const grown = addToStack({ items: still }, "clock", "sitter")!.items;
    expect(grown.every((i) => i.stackStill)).toBe(true);
    const freed = unstack({ items: grown }, "clock").find((i) => i.id === "clock")!;
    expect(freed.stack).toBeUndefined();
    expect(freed.stackStill).toBeUndefined();
    expect(stackIsSmart(setStackStill(still, stack, false))).toBe(true);
  });
});
