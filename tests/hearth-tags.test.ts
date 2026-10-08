import { describe, expect, it } from "vitest";

import { defaultHearthLayout, type HearthItem, type HearthLayout } from "../lib/hearth-layout";
import { allTags, cleanTag, hasTag, hideTagged, MAX_TAGS_PER_ITEM, tagMany, withTag } from "../lib/hearth-tags";
import { addPage } from "../lib/hearth-pages";

// Tags and filters (CORE-065).

const card = (id: string, tags?: string[]): HearthItem => ({ id, kind: "nook", nookId: id, x: 0, y: 0, w: 2, h: 2, tags });
const layoutOf = (items: HearthItem[]): HearthLayout => ({ ...defaultHearthLayout, items });

describe("Tags (CORE-065)", () => {
  it("tidies what's typed", () => {
    expect(cleanTag("  Kids   stuff ")).toBe("Kids stuff");
    expect(cleanTag("a".repeat(40))).toHaveLength(16);
  });

  it("adds and removes a tag, ignoring case and repeats", () => {
    expect(withTag(undefined, "Kids", true)).toEqual(["Kids"]);
    expect(withTag(["Kids"], "kids", true)).toEqual(["Kids"]);
    expect(withTag(["Kids", "Home"], "KIDS", false)).toEqual(["Home"]);
    expect(withTag(["Kids"], "Kids", false)).toBeUndefined();
    expect(withTag(undefined, "   ", true)).toBeUndefined();
  });

  it("holds only so many per item", () => {
    let tags: string[] | undefined;
    for (let i = 0; i < MAX_TAGS_PER_ITEM + 3; i++) tags = withTag(tags, `t${i}`, true);
    expect(tags).toHaveLength(MAX_TAGS_PER_ITEM);
  });

  it("lists every tag in use, across pages and Hollows, once", () => {
    const hollow: HearthItem = { id: "h", kind: "hollow", name: "H", look: "house", x: 0, y: 2, w: 2, h: 2, items: [card("in", ["Gifts", "kids"])] };
    const start = layoutOf([card("a", ["Kids"]), hollow]);
    const added = addPage(start, "Holidays")!;
    const layout: HearthLayout = { ...start, pages: added.changes.pages, otherPages: { [added.id]: [card("b", ["Home"])] } };
    expect(allTags(layout)).toEqual(["Gifts", "Home", "Kids"]);
  });

  it("tags and untags several at once, even inside a Hollow", () => {
    const hollow: HearthItem = { id: "h", kind: "hollow", name: "H", look: "house", x: 0, y: 2, w: 2, h: 2, items: [card("in")] };
    const layout = layoutOf([card("a"), card("b"), hollow]);
    const tagged = tagMany(layout, ["a", "in"], "Kids", true);
    expect(tagged.find((i) => i.id === "a")!.tags).toEqual(["Kids"]);
    const inside = (tagged.find((i) => i.id === "h") as Extract<HearthItem, { kind: "hollow" }>).items[0];
    expect(hasTag(inside, "kids")).toBe(true);
    expect(tagged.find((i) => i.id === "b")!.tags).toBeUndefined();
    const cleared = tagMany(layoutOf(tagged), ["a"], "Kids", false);
    expect(cleared.find((i) => i.id === "a")!.tags).toBeUndefined();
  });

  it("hides whatever has a switched-off tag, and nothing else", () => {
    const items = [card("a", ["Kids"]), card("b", ["Home", "Gifts"]), card("c")];
    expect(hideTagged(items, [])).toBe(items);
    expect(hideTagged(items, ["kids"]).map((i) => i.id)).toEqual(["b", "c"]);
    expect(hideTagged(items, ["Gifts", "Kids"]).map((i) => i.id)).toEqual(["c"]);
  });
});
