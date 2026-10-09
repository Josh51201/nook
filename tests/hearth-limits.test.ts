import { describe, expect, it } from "vitest";

import { fullMessage, HOME_PAGE_LIMIT, overflowing, PAGE_LIMIT, spaceLoad, spacesOf } from "../lib/hearth-limits";
import type { HearthItem, HearthLayout } from "../lib/hearth-layout";
import { defaultHearthLayout } from "../lib/hearth-layout";
import { HOME_PAGE } from "../lib/home-hearth";

const nook = (id: string): HearthItem => ({ id, kind: "nook", nookId: "gift", x: 0, y: 0, w: 1, h: 1 });
const trinket = (id: string): HearthItem => ({ id, kind: "trinket", piece: "plant", x: 0, y: 0, w: 1, h: 1 });
const many = (n: number, make = nook) => Array.from({ length: n }, (_, i) => make(`i${i}`));
const layout = (items: HearthItem[], extra: Partial<HearthLayout> = {}): HearthLayout => ({ ...defaultHearthLayout, items, ...extra });

describe("Page limits (CORE-066)", () => {
  it("counts Trinkets as half, a stack as one, a Hollow as one", () => {
    expect(spaceLoad([...many(2), ...many(4, (id) => trinket(`t${id}`))])).toBe(4);
    const stacked = [nook("a"), nook("b")].map((i) => ({ ...i, stack: "s" }) as HearthItem);
    expect(spaceLoad(stacked)).toBe(1);
    const hollow: HearthItem = { id: "h", kind: "hollow", name: "H", look: "house", items: many(30), x: 0, y: 0, w: 2, h: 2 };
    expect(spaceLoad([hollow])).toBe(1);
  });

  it("lets a page reach its limit and stops the one past it", () => {
    expect(overflowing(layout(many(PAGE_LIMIT - 1)), layout(many(PAGE_LIMIT)))).toBeNull();
    const blocked = overflowing(layout(many(PAGE_LIMIT)), layout(many(PAGE_LIMIT + 1)));
    expect(blocked?.limit).toBe(PAGE_LIMIT);
    expect(fullMessage(blocked!).body).toContain("new page");
  });

  it("never traps a page that was already over: it can shrink or rearrange", () => {
    const over = layout(many(PAGE_LIMIT + 10));
    expect(overflowing(over, layout(many(PAGE_LIMIT + 5)))).toBeNull();
    expect(overflowing(over, over)).toBeNull();
    expect(overflowing(over, layout(many(PAGE_LIMIT + 11)))).not.toBeNull();
  });

  it("limits each page, and each Hollow, on its own", () => {
    const other = layout([], { pages: [{ id: "main", name: "Hearth" }, { id: "p2", name: "Holidays" }], otherPages: { p2: many(PAGE_LIMIT) } });
    expect(overflowing(other, { ...other, otherPages: { p2: many(PAGE_LIMIT + 1) } })?.name).toBe("Holidays");
    const hollow = (n: number): HearthItem => ({ id: "h", kind: "hollow", name: "Attic", look: "house", items: many(n), x: 0, y: 0, w: 2, h: 2 });
    const grown = overflowing(layout([hollow(PAGE_LIMIT)]), layout([hollow(PAGE_LIMIT + 1)]));
    expect(grown?.where).toBe("hollow");
    expect(spacesOf(layout([hollow(3)])).map((s) => s.key)).toContain("hollow:h");
  });

  it("the shared Home page holds fewer", () => {
    const home = layout([], {
      pages: [{ id: "main", name: "Hearth" }, { id: HOME_PAGE, name: "Home" }],
      otherPages: { [HOME_PAGE]: many(HOME_PAGE_LIMIT) },
    });
    const grown = overflowing(home, { ...home, otherPages: { [HOME_PAGE]: many(HOME_PAGE_LIMIT + 1) } });
    expect(grown?.where).toBe("home");
    expect(fullMessage(grown!).body).toContain(String(HOME_PAGE_LIMIT));
  });
});
