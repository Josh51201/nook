import { describe, expect, it } from "vitest";

import { defaultHearthLayout, type HearthItem, type HearthLayout } from "../lib/hearth-layout";
import { addPage, removePage, renamePage, switchPage } from "../lib/hearth-pages";
import { moveManyToPage } from "../lib/hearth-select";
import {
  canGoOnHomePage,
  diffHomeItems,
  HOME_PAGE,
  homePhotoFolder,
  planPhotoMoves,
  splitHomeChanges,
  withHomePage,
  type HomeHearth,
} from "../lib/home-hearth";
import { defaultWidget } from "../lib/widgets";

const note = (id: string, x = 0, y = 0): HearthItem => ({ id, kind: "widget", widget: defaultWidget("note"), x, y, w: 2, h: 2 });
const frame = (id: string, photos: string[]): HearthItem => {
  const widget = defaultWidget("frame");
  return { id, kind: "widget", widget: { ...widget, settings: { ...(widget.settings as object), photos } } as never, x: 0, y: 0, w: 2, h: 2 };
};

const personal: HearthLayout = {
  ...defaultHearthLayout,
  pages: [
    { id: "main", name: "Everyday" },
    { id: "hols", name: "Holidays" },
  ],
  activePage: "main",
  items: [note("mine-1")],
  otherPages: { hols: [note("hol-1")] },
};
const home: HomeHearth = { items: [note("shared-1"), note("shared-2", 2, 0)], name: "Home" };

describe("The Home page (CORE-054)", () => {
  it("shows up as the last page, after your own", () => {
    const view = withHomePage(personal, home, false);
    expect(view.pages.map((p) => p.id)).toEqual(["main", "hols", HOME_PAGE]);
    expect(view.activePage).toBe("main");
    expect(view.otherPages[HOME_PAGE]).toBe(home.items);

    const there = withHomePage(personal, home, true);
    expect(there.activePage).toBe(HOME_PAGE);
    expect(there.items).toBe(home.items);
    expect(there.otherPages.main).toBe(personal.items);
  });

  it("saves your own changes to your own Hearth only", () => {
    const split = splitHomeChanges(personal, home, false, { items: [...personal.items, note("mine-2")] });
    expect(split.homeItems).toBeNull();
    expect(split.personal?.items?.map((i) => i.id)).toEqual(["mine-1", "mine-2"]);
    expect(split.onHome).toBe(false);
  });

  it("saves changes on the Home page to the Home only", () => {
    const split = splitHomeChanges(personal, home, true, { items: [home.items[0]] });
    expect(split.personal).toBeNull();
    expect(split.homeItems?.map((i) => i.id)).toEqual(["shared-1"]);
    expect(split.onHome).toBe(true);
  });

  it("theme and the like are always yours, even from the Home page", () => {
    const split = splitHomeChanges(personal, home, true, { theme: "sage" });
    expect(split.personal).toEqual({ theme: "sage" });
    expect(split.homeItems).toBeNull();
  });

  it("goes to the Home page and back without changing anything", () => {
    const to = switchPage(withHomePage(personal, home, false), HOME_PAGE)!;
    const there = splitHomeChanges(personal, home, false, to);
    expect(there).toMatchObject({ personal: null, homeItems: null, onHome: true });

    const back = switchPage(withHomePage(personal, home, true), "main")!;
    expect(splitHomeChanges(personal, home, true, back)).toMatchObject({ personal: null, homeItems: null, onHome: false });

    const elsewhere = switchPage(withHomePage(personal, home, true), "hols")!;
    const split = splitHomeChanges(personal, home, true, elsewhere);
    expect(split.personal?.activePage).toBe("hols");
    expect(split.personal?.items?.map((i) => i.id)).toEqual(["hol-1"]);
    expect(split.personal?.otherPages?.main?.map((i) => i.id)).toEqual(["mine-1"]);
    expect(split.homeItems).toBeNull();
  });

  it("moves things onto the Home page and off it again", () => {
    const view = withHomePage(personal, home, false);
    const shared = splitHomeChanges(personal, home, false, moveManyToPage(view, ["mine-1"], HOME_PAGE)!);
    expect(shared.personal?.items).toEqual([]);
    expect(shared.homeItems?.map((i) => i.id)).toEqual(["shared-1", "shared-2", "mine-1"]);

    const fromHome = withHomePage(personal, home, true);
    const taken = splitHomeChanges(personal, home, true, moveManyToPage(fromHome, ["shared-2"], "hols")!);
    expect(taken.homeItems?.map((i) => i.id)).toEqual(["shared-1"]);
    expect(taken.personal?.otherPages?.hols?.map((i) => i.id)).toEqual(["hol-1", "shared-2"]);
    expect(taken.personal?.items?.map((i) => i.id)).toEqual(["mine-1"]);
  });

  it("renames the Home page for everyone", () => {
    const view = withHomePage(personal, home, false);
    const split = splitHomeChanges(personal, home, false, renamePage(view, HOME_PAGE, "Our place"));
    expect(split.homeName).toBe("Our place");
    expect(split.personal).toBeNull();
  });

  it("a new page of your own takes you off the Home page", () => {
    const added = addPage(withHomePage(personal, home, true), "Garden")!;
    const split = splitHomeChanges(personal, home, true, added.changes);
    expect(split.onHome).toBe(false);
    expect(split.personal?.pages?.map((p) => p.name)).toEqual(["Everyday", "Holidays", "Garden"]);
    expect(split.personal?.pages?.some((p) => p.id === HOME_PAGE)).toBe(false);
    expect(split.homeItems).toBeNull();
  });

  it("can't be removed, and doesn't count against your own six pages", () => {
    expect(removePage(withHomePage(personal, home, false), HOME_PAGE)).toBeNull();
    const six: HearthLayout = {
      ...personal,
      pages: Array.from({ length: 5 }, (_, i) => ({ id: `p${i}`, name: `P${i}` })),
      activePage: "p0",
      otherPages: Object.fromEntries(Array.from({ length: 4 }, (_, i) => [`p${i + 1}`, []])),
    };
    expect(addPage(withHomePage(six, home, false), "Sixth")).not.toBeNull();
  });

  it("keeps Hollows on your own pages", () => {
    expect(canGoOnHomePage(note("n"))).toBe(true);
    expect(canGoOnHomePage({ id: "h", kind: "hollow", name: "H", look: "house", items: [], x: 0, y: 0, w: 2, h: 2 })).toBe(false);
  });

  it("writes only what changed", () => {
    const moved = { ...home.items[1], x: 0, y: 2 } as HearthItem;
    const diff = diffHomeItems(home.items, [home.items[0], moved, note("new")]);
    expect(diff.added.map((i) => i.id)).toEqual(["new"]);
    expect(diff.changed.map((i) => i.id)).toEqual(["shared-2"]);
    expect(diff.removed).toEqual([]);
    expect(diffHomeItems(home.items, [home.items[1]]).removed).toEqual(["shared-1"]);
    expect(diffHomeItems(home.items, home.items)).toEqual({ added: [], changed: [], removed: [] });
  });

  it("copies a frame's pictures into the Home's folder, and back out", () => {
    const folder = homePhotoFolder("h1");
    const plan = planPhotoMoves([note("n"), frame("f", ["u1/a.jpg", `${folder}/b.jpg`])], folder);
    expect(plan.copies).toEqual([{ from: "u1/a.jpg", to: `${folder}/a.jpg` }]);
    const moved = plan.items[1] as HearthItem & { kind: "widget" };
    expect((moved.widget.settings as { photos: string[] }).photos).toEqual([`${folder}/a.jpg`, `${folder}/b.jpg`]);
    // Nothing to do: the same items come back.
    expect(planPhotoMoves(plan.items, folder).items[1]).toBe(plan.items[1]);
    expect(planPhotoMoves(plan.items, "u1").copies.map((c) => c.to)).toEqual(["u1/a.jpg", "u1/b.jpg"]);
  });

  it("GIFT-007: a shared Gifts to buy widget carries only its settings, never anyone's tucks", () => {
    // Each person's phone loads its own list for whoever is looking.
    expect(Object.keys(defaultWidget("tucks").settings).sort()).toEqual(["count", "include"]);
  });
});
