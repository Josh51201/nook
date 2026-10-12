import type { Notice } from "./inbox";
import type { HearthItem, HearthLayout } from "./hearth-layout";
import type { WidgetConfig } from "./widgets";

// What's new on the Hearth (CORE-114..116). Your unread inbox notices are
// matched to the tiles and widgets they're about, so each can wear a little
// dot (badges, CORE-115), a stack can flip to whichever widget needs you
// (smart stacks, CORE-114), and a Hollow or page tab shows a dot when
// something inside it has news, so a closed Hollow never hides it. Only your
// own notices are used, so it never shows anything your inbox doesn't
// (GIFT-007). Pure (no React or database), so it's unit-testable.

export type NewsNotice = Pick<Notice, "nook" | "kind" | "title" | "data" | "created_at">;

export type NewsContext = {
  // Unread, newest first.
  notices: NewsNotice[];
  // A Fridge door with a note you haven't seen (CORE-086); on the Home page
  // it's always the Home's fridge.
  fridgeHasNews?: (settings: WidgetConfig & { kind: "fridge" }, onHomePage: boolean) => boolean;
};

// `nook` is the Nook the newest notice came from (none for a fridge note).
export type News = { count: number; latest: string; nook?: string };

const FRIDGE_LINE = "A new note on the fridge";

type Match = (notice: NewsNotice) => boolean;

const fromNook = (nook: string): Match => (notice) => notice.nook === nook;
const aboutGathering = (id: string): Match => (notice) => notice.data?.gathering_id === id;

// Which notices a widget is about, or null for widgets that never have news
// (the Inbox widget already counts everything, so it doesn't get a dot too).
export function widgetNoticeMatch(widget: WidgetConfig): Match | null {
  switch (widget.kind) {
    case "gatherings":
      return fromNook("gatherings");
    case "gathering":
      return widget.settings.gatheringId ? aboutGathering(widget.settings.gatheringId) : fromNook("gatherings");
    case "countdown": {
      const s = widget.settings;
      if (s.source === "gathering" && s.gatheringId) return aboutGathering(s.gatheringId);
      if (s.source === "getaway") {
        const id = s.getawayId;
        return id ? (notice) => notice.data?.getaway_id === id : fromNook("getaways");
      }
      return null;
    }
    case "tucks":
      return (notice) => notice.nook === "gift-nook" && notice.kind === "tuck_changed";
    case "cards":
      return fromNook("letterbox");
    case "pets":
      return fromNook("pets");
    case "rhythms":
      return fromNook("rhythms");
    case "sitter":
      return fromNook("sitter");
    case "subscriptions":
      return fromNook("subscriptions");
    case "sickday":
      return fromNook("sickday");
    default:
      return null;
  }
}

// The notices about one item. A Hollow gathers everything inside it, each
// notice counted once even if two things in there are about it.
function matching(item: HearthItem, ctx: NewsContext, onHomePage: boolean, found: Set<NewsNotice>): boolean {
  let fridge = false;
  if (item.kind === "nook") {
    for (const notice of ctx.notices) if (notice.nook === item.nookId) found.add(notice);
  } else if (item.kind === "widget") {
    if (item.widget.kind === "fridge") {
      fridge = Boolean(ctx.fridgeHasNews?.(item.widget, onHomePage));
    } else {
      const match = widgetNoticeMatch(item.widget);
      if (match) for (const notice of ctx.notices) if (match(notice)) found.add(notice);
    }
  } else if (item.kind === "hollow") {
    for (const inner of item.items) if (matching(inner, ctx, onHomePage, found)) fridge = true;
  }
  return fridge;
}

function tally(found: Set<NewsNotice>, fridge: boolean, notices: NewsNotice[]): News | null {
  const count = found.size + (fridge ? 1 : 0);
  if (!count) return null;
  // Newest first, as the notices came.
  const newest = notices.find((notice) => found.has(notice));
  return { count, latest: newest?.title ?? FRIDGE_LINE, nook: newest?.nook };
}

// What's new about one tile, widget or Hollow, or null for nothing.
export function newsFor(item: HearthItem, ctx: NewsContext, onHomePage = false): News | null {
  const found = new Set<NewsNotice>();
  const fridge = matching(item, ctx, onHomePage, found);
  return tally(found, fridge, ctx.notices);
}

export function newsForAll(items: HearthItem[], ctx: NewsContext, onHomePage = false): News | null {
  const found = new Set<NewsNotice>();
  let fridge = false;
  for (const item of items) if (matching(item, ctx, onHomePage, found)) fridge = true;
  return tally(found, fridge, ctx.notices);
}

// Pages (other than `skip`, the one you're on) with news somewhere on them,
// Hollows included, so their tabs can wear a dot.
export function pagesWithNews(
  layout: Pick<HearthLayout, "pages" | "activePage" | "items" | "otherPages">,
  ctx: NewsContext,
  homePageId: string,
  skip?: string
): string[] {
  return layout.pages
    .filter((page) => page.id !== skip)
    .filter((page) => {
      const items = page.id === layout.activePage ? layout.items : layout.otherPages[page.id] ?? [];
      return newsForAll(items, ctx, page.id === homePageId) !== null;
    })
    .map((page) => page.id);
}

// Smart stacks (CORE-114): which widget in a stack needs you now, or null
// for none. With news on more than one, the newest news wins; a fridge note
// counts as newer than any notice, since it's taken down within days.
export function smartStackPick(mates: HearthItem[], ctx: NewsContext, onHomePage = false): number | null {
  let best: number | null = null;
  let bestRank = Infinity;
  mates.forEach((mate, index) => {
    const found = new Set<NewsNotice>();
    const fridge = matching(mate, ctx, onHomePage, found);
    if (!fridge && !found.size) return;
    // Lower is newer (notices come newest first).
    const rank = fridge ? -1 : ctx.notices.findIndex((notice) => found.has(notice));
    if (rank < bestRank) {
      best = index;
      bestRank = rank;
    }
  });
  return best;
}

// Whether a stack flips by itself: on unless switched off on any of its
// widgets (they share the setting; the editor sets it on all of them).
export function stackIsSmart(mates: HearthItem[]): boolean {
  return !mates.some((mate) => mate.stackStill);
}

// Said after a tile's name for screen readers.
export function spokenNews(news: News | null): string {
  if (!news) return "";
  return news.count === 1 ? `, 1 new: ${news.latest}` : `, ${news.count} new`;
}

// A stack's news right now, as one string. When it changes, a smart stack
// may flip again, even if you'd swiped it back to something else.
export function stackNewsKey(mates: HearthItem[], ctx: NewsContext, onHomePage = false): string {
  const pick = smartStackPick(mates, ctx, onHomePage);
  if (pick === null) return "";
  const news = newsFor(mates[pick], ctx, onHomePage);
  return `${mates[pick].id}:${news?.count ?? 0}:${news?.latest ?? ""}`;
}

// Which widget each stack shows: the one you chose (`chosen`, the first by
// default), unless the stack is smart and one of its widgets has news. After
// you swipe away from that news (`swiped` holds the stack's news key when you
// did), your choice stands until the news changes.
export function smartStacks(
  items: HearthItem[],
  chosen: Record<string, number>,
  ctx: NewsContext,
  swiped: Record<string, string>,
  onHomePage = false
): Record<string, number> {
  const shown = { ...chosen };
  const stacks = new Map<string, HearthItem[]>();
  for (const item of items) if (item.stack) stacks.set(item.stack, [...(stacks.get(item.stack) ?? []), item]);
  for (const [stack, mates] of stacks) {
    if (mates.length < 2 || !stackIsSmart(mates)) continue;
    const pick = smartStackPick(mates, ctx, onHomePage);
    if (pick === null || swiped[stack] === stackNewsKey(mates, ctx, onHomePage)) continue;
    shown[stack] = pick;
  }
  return shown;
}
