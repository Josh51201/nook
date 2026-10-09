import { describe, expect, it } from "vitest";

import { groupByPerson, isOpenIdea, parsePrice, sortIdeas, type Idea } from "../lib/idea-stash";

const idea = (id: string, about: string, extra: Partial<Idea> = {}): Idea => ({
  id,
  about_id: about,
  kind: "idea",
  title: id,
  notes: null,
  url: null,
  price: null,
  suggested_at: null,
  created_at: `2026-10-0${id.length}T00:00:00Z`,
  ...extra,
});

describe("Idea Stash (GIFT-036)", () => {
  it("only gift ideas not yet suggested are still to do", () => {
    expect(isOpenIdea(idea("a", "x"))).toBe(true);
    expect(isOpenIdea(idea("a", "x", { suggested_at: "2026-10-05T00:00:00Z" }))).toBe(false);
    expect(isOpenIdea(idea("a", "x", { kind: "note" }))).toBe(false);
  });

  it("lists ideas to do first, then notes, then ones already suggested", () => {
    const sorted = sortIdeas([
      idea("done", "x", { suggested_at: "2026-10-05T00:00:00Z" }),
      idea("note", "x", { kind: "note" }),
      idea("todo", "x"),
    ]);
    expect(sorted.map((i) => i.id)).toEqual(["todo", "note", "done"]);
  });

  it("groups by person, the one with the most ideas to do first", () => {
    const groups = groupByPerson([idea("a", "mom"), idea("b", "dad"), idea("c", "dad"), idea("n", "mom", { kind: "note" })]);
    expect(groups.map((g) => [g.aboutId, g.open])).toEqual([
      ["dad", 2],
      ["mom", 1],
    ]);
    expect(groups[1].ideas).toHaveLength(2);
  });

  it("reads prices the way people type them", () => {
    expect(parsePrice("25")).toBe(25);
    expect(parsePrice("$19.99")).toBe(19.99);
    expect(parsePrice("1,200")).toBe(1200);
    expect(parsePrice("  ")).toBeNull();
    expect(parsePrice("lots")).toBeUndefined();
    expect(parsePrice("-5")).toBeUndefined();
  });
});
