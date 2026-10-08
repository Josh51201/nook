import { describe, expect, it } from "vitest";

import {
  allItems,
  defaultHearthLayout,
  hasNook,
  migrateLayout,
  photoPathsInUse,
  removeNook,
  type HearthItem,
  type HearthLayout,
} from "../lib/hearth-layout";
import { addPage, MAX_PAGES, neighbourPage, removePage, renamePage, switchPage } from "../lib/hearth-pages";
import { defaultWidget } from "../lib/widgets";

// Pages of the Hearth (CORE-051).

const nook = (id: string, x = 0, y = 0): HearthItem => ({ id, kind: "nook", nookId: id, x, y, w: 2, h: 2 });
const withPages = (changes: Partial<HearthLayout>): HearthLayout => ({ ...defaultHearthLayout, ...changes });

describe("Hearth pages (CORE-051)", () => {
  it("starts with one page, and older Hearths get one too", () => {
    const layout = migrateLayout({ items: [nook("a")] });
    expect(layout.pages).toHaveLength(1);
    expect(layout.activePage).toBe(layout.pages[0].id);
    expect(layout.items).toHaveLength(1);
  });

  it("repairs a saved Hearth whose active page is gone", () => {
    const layout = migrateLayout({ pages: [{ id: "x", name: "X" }], activePage: "ghost", items: [] });
    expect(layout.activePage).toBe("x");
  });

  it("adds a page, takes you to it, and keeps the other page's items", () => {
    const start = withPages({ items: [nook("a")] });
    const { changes, id } = addPage(start, "Holidays")!;
    expect(changes.activePage).toBe(id);
    expect(changes.items).toEqual([]);
    expect(changes.otherPages[start.activePage].map((i) => i.id)).toEqual(["a"]);
    expect(changes.pages.map((p) => p.name)).toEqual(["Hearth", "Holidays"]);
  });

  it("switches back and forth without losing anything", () => {
    const start = withPages({ items: [nook("a")] });
    const added = addPage(start, "Holidays")!;
    const onHolidays = withPages({ ...added.changes, items: [nook("b")] });
    const back = switchPage(onHolidays, start.activePage)!;
    expect(back.items.map((i) => i.id)).toEqual(["a"]);
    expect(back.otherPages[added.id].map((i) => i.id)).toEqual(["b"]);
    expect(switchPage(onHolidays, onHolidays.activePage)).toBeNull();
    expect(switchPage(onHolidays, "nope")).toBeNull();
  });

  it("caps the number of pages", () => {
    let layout = withPages({});
    for (let i = 1; i < MAX_PAGES; i++) layout = withPages(addPage(layout, `P${i}`)!.changes);
    expect(layout.pages).toHaveLength(MAX_PAGES);
    expect(addPage(layout, "one more")).toBeNull();
  });

  it("renames a page, ignoring an empty name", () => {
    const layout = withPages({});
    expect(renamePage(layout, "main", "Everyday").pages[0].name).toBe("Everyday");
    expect(renamePage(layout, "main", "   ").pages[0].name).toBe("Hearth");
  });

  it("removing a page moves its items onto the first page, never deleting them", () => {
    const start = withPages({ items: [nook("a")] });
    const added = addPage(start, "Holidays")!;
    const onHolidays = withPages({ ...added.changes, items: [nook("b")] });
    const gone = removePage(onHolidays, added.id)!;
    expect(gone.pages).toHaveLength(1);
    expect(gone.activePage).toBe(start.activePage);
    expect(gone.items.map((i) => i.id).sort()).toEqual(["a", "b"]);
    // Nothing sits on top of anything else.
    const [a, b] = gone.items;
    expect(a.x === b.x && a.y === b.y).toBe(false);
    expect(removePage(withPages({}), "main")).toBeNull(); // the last page stays
  });

  it("swipes to the neighbouring page", () => {
    const added = addPage(withPages({}), "Holidays")!;
    const onHolidays = withPages(added.changes);
    expect(neighbourPage(onHolidays, 1)).toBeNull();
    expect(neighbourPage(onHolidays, -1)).toBe("main");
  });

  it("counts Nooks, photos and removals across every page", () => {
    const frame = defaultWidget("frame");
    if (frame.kind === "frame") frame.settings.photos = ["u/pic.jpg"];
    const layout = withPages({
      items: [nook("a")],
      pages: [
        { id: "main", name: "Hearth" },
        { id: "p2", name: "Holidays" },
      ],
      otherPages: { p2: [nook("b"), { id: "w1", kind: "widget", widget: frame, x: 0, y: 2, w: 2, h: 2 }] },
    });
    expect(hasNook(layout, "b")).toBe(true);
    expect(allItems(layout)).toHaveLength(3);
    expect(photoPathsInUse(layout).has("u/pic.jpg")).toBe(true);
    const removed = removeNook(layout, "b");
    expect(removed.otherPages.p2.map((i) => i.id)).toEqual(["w1"]);
    expect(removed.items.map((i) => i.id)).toEqual(["a"]);
  });
});
