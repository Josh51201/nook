import type { HearthItem, HearthLayout, HearthPage } from "./hearth-layout";

// The Home page (CORE-054): one page of the Hearth that everyone in your
// Home shares (HOME-001). Pure helpers, no React or database, so they're
// unit-testable; loading, saving and live updates are in
// lib/home-hearth-data.ts.
//
// The Home page shows up as one more page tab after your own pages. To keep
// every page tool (swiping, dragging onto a tab, "Move to a page", Find)
// working unchanged, the screens see one combined layout with the Home page
// in it, and each save is split back into the part that is yours and the
// part that is the Home's.

export const HOME_PAGE = "home-page";
export const DEFAULT_HOME_PAGE_NAME = "Home";

export type HomeHearth = { items: HearthItem[]; name: string };

// Your Hearth with the Home page added as the last page. `onHome` is
// whether you're looking at it right now.
export function withHomePage(personal: HearthLayout, home: HomeHearth, onHome: boolean): HearthLayout {
  const page: HearthPage = { id: HOME_PAGE, name: home.name || DEFAULT_HOME_PAGE_NAME };
  const pages = [...personal.pages, page];
  if (!onHome) return { ...personal, pages, otherPages: { ...personal.otherPages, [HOME_PAGE]: home.items } };
  return {
    ...personal,
    pages,
    activePage: HOME_PAGE,
    items: home.items,
    otherPages: { ...personal.otherPages, [personal.activePage]: personal.items },
  };
}

export type SplitChanges = {
  // What to save to your own Hearth, or null if nothing of yours changed.
  personal: Partial<HearthLayout> | null;
  // The Home page's things after the change, or null if they didn't change.
  homeItems: HearthItem[] | null;
  // A new name for the Home page, or null.
  homeName: string | null;
  // Whether you're on the Home page afterwards.
  onHome: boolean;
};

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

// Split a change made to the combined layout into yours and the Home's.
export function splitHomeChanges(personal: HearthLayout, home: HomeHearth, onHome: boolean, changes: Partial<HearthLayout>): SplitChanges {
  const before = withHomePage(personal, home, onHome);
  const after = { ...before, ...changes };
  const byPage: Record<string, HearthItem[]> = { ...after.otherPages, [after.activePage]: after.items };
  const nextOnHome = after.activePage === HOME_PAGE;

  // The Home page can't be removed from the combined layout, only hidden;
  // if a change leaves it out, its things stay as they were.
  const homePage = after.pages.find((p) => p.id === HOME_PAGE);
  const homeItems = homePage && byPage[HOME_PAGE] ? byPage[HOME_PAGE] : home.items;
  const homeName = homePage && homePage.name !== (home.name || DEFAULT_HOME_PAGE_NAME) ? homePage.name : null;

  const pages = after.pages.filter((p) => p.id !== HOME_PAGE);
  const activePage = nextOnHome
    ? pages.some((p) => p.id === personal.activePage)
      ? personal.activePage
      : pages[0]?.id ?? personal.activePage
    : after.activePage;
  const otherPages: HearthLayout["otherPages"] = {};
  for (const page of pages) if (page.id !== activePage) otherPages[page.id] = byPage[page.id] ?? [];
  const mine: Partial<HearthLayout> = { pages, activePage, items: byPage[activePage] ?? [], otherPages };

  // Theme, wallpaper and the rest are always yours.
  const { pages: _p, activePage: _a, items: _i, otherPages: _o, ...rest } = changes;
  const structureChanged =
    !same(pages, personal.pages) ||
    activePage !== personal.activePage ||
    !same(mine.items, personal.items) ||
    !same(otherPages, personal.otherPages);

  return {
    personal: structureChanged || Object.keys(rest).length ? { ...rest, ...(structureChanged ? mine : {}) } : null,
    homeItems: same(homeItems, home.items) ? null : homeItems,
    homeName,
    onHome: nextOnHome,
  };
}

// Hollows hold your own things, so they stay on your own pages.
export function canGoOnHomePage(item: HearthItem) {
  return item.kind !== "hollow";
}

// --- Saving thing by thing ------------------------------------------------------------

export type HomeItemDiff = {
  added: HearthItem[];
  changed: HearthItem[];
  removed: string[];
};

// Only what actually changed is written, so two people changing different
// things at the same moment don't undo each other.
export function diffHomeItems(before: HearthItem[], after: HearthItem[]): HomeItemDiff {
  const old = new Map(before.map((item) => [item.id, item]));
  const now = new Set(after.map((item) => item.id));
  const added: HearthItem[] = [];
  const changed: HearthItem[] = [];
  for (const item of after) {
    const was = old.get(item.id);
    if (!was) added.push(item);
    else if (!same(was, item)) changed.push(item);
  }
  return { added, changed, removed: before.filter((item) => !now.has(item.id)).map((item) => item.id) };
}

// --- Photos ------------------------------------------------------------------------------

export function homePhotoFolder(homeId: string) {
  return `home/${homeId}`;
}

// Photo frames whose pictures aren't in `folder` yet: the copies to make
// and the items pointing at those copies. Pictures on the Home page live in
// the Home's folder so everyone there can see them; your own pages use your
// own private folder.
export function planPhotoMoves(items: HearthItem[], folder: string): { items: HearthItem[]; copies: { from: string; to: string }[] } {
  const copies: { from: string; to: string }[] = [];
  const moved = mapFramePhotos(items, (path) => {
    if (path.startsWith(`${folder}/`)) return path;
    const to = `${folder}/${path.split("/").pop()}`;
    if (!copies.some((c) => c.from === path)) copies.push({ from: path, to });
    return to;
  });
  return { items: moved, copies };
}

// Every photo frame's pictures run through `change`, inside Hollows too.
// Items that don't change are returned as they were.
export function mapFramePhotos(items: HearthItem[], change: (path: string) => string): HearthItem[] {
  return items.map((item) => {
    if (item.kind === "hollow") {
      const inner = mapFramePhotos(item.items, change);
      return inner.some((i, n) => i !== item.items[n]) ? { ...item, items: inner } : item;
    }
    if (item.kind !== "widget" || item.widget.kind !== "frame") return item;
    const before = item.widget.settings.photos;
    const photos = before.map(change);
    if (photos.every((p, n) => p === before[n])) return item;
    return { ...item, widget: { ...item.widget, settings: { ...item.widget.settings, photos } } };
  });
}
