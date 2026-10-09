import { describe, expect, it } from "vitest";

import {
  addPoint,
  cleanDoodle,
  comesDownWords,
  fridgeGrid,
  fridgePlace,
  fridgeRoute,
  fridgesWithNews,
  MAX_POINTS,
  noteMagnet,
  noteTilt,
  paperOf,
  placeKey,
  postedWords,
  strokePath,
  toDoodlePoint,
} from "../lib/fridge";
import { noticeIcon, noticeRoute } from "../lib/inbox";
import { defaultWidget, widgetCategories } from "../lib/widgets";

// The Fridge door (CORE-086).

describe("which fridge a widget shows", () => {
  const home = { onHomePage: false, homeId: "h1" };

  it("is your Home's unless you picked a Burrow", () => {
    expect(fridgePlace({ place: "home", burrowId: null }, home)).toEqual({ kind: "home", id: "h1" });
    expect(fridgePlace({ place: "burrow", burrowId: "b1" }, home)).toEqual({ kind: "burrow", id: "b1" });
  });

  it("on the Home page it's always the Home's, even if it was a Burrow's", () => {
    expect(fridgePlace({ place: "burrow", burrowId: "b1" }, { onHomePage: true, homeId: "h1" })).toEqual({ kind: "home", id: "h1" });
  });

  it("a Burrow choice with no Burrow falls back to the Home", () => {
    expect(fridgePlace({ place: "burrow", burrowId: null }, home)).toEqual({ kind: "home", id: "h1" });
  });

  it("is nothing until your Home is known", () => {
    expect(fridgePlace({ place: "home", burrowId: null }, { onHomePage: false, homeId: null })).toBeNull();
  });

  it("opens the right fridge, in the widget's color when it has one", () => {
    expect(fridgeRoute({ kind: "home", id: "h1" })).toBe("/fridge?home=h1");
    expect(fridgeRoute({ kind: "burrow", id: "b1" }, "#f6d9c4")).toBe("/fridge?burrow=b1&color=%23f6d9c4");
    expect(fridgeRoute({ kind: "home", id: "h1" }, "red; drop table")).toBe("/fridge?home=h1");
  });

  it("is a new widget kind with sensible defaults, in the Add sheet", () => {
    const widget = defaultWidget("fridge");
    expect(widget.kind).toBe("fridge");
    expect(widget.settings).toEqual({ place: "home", burrowId: null });
    expect(widgetCategories.some((c) => c.kinds.includes("fridge"))).toBe(true);
  });
});

describe("how notes hang", () => {
  it("always hang the same way for the same note", () => {
    expect(noteTilt("abc")).toBe(noteTilt("abc"));
    expect(noteMagnet("abc")).toBe(noteMagnet("abc"));
    for (const id of ["a", "b", "note-1", "f0e1d2c3-0000-4000-8000-123456789abc"]) {
      expect(Math.abs(noteTilt(id))).toBeLessThanOrEqual(6);
    }
  });

  it("an unknown paper falls back to the first", () => {
    expect(paperOf("mint").key).toBe("mint");
    expect(paperOf("glitter").key).toBe("lemon");
  });

  it("fit in a grid, with the last spot saying how many more", () => {
    expect(fridgeGrid(170, 250, 3)).toMatchObject({ cols: 2, rows: 3, shown: 3, extra: 0 });
    // 4 spots, 7 notes: 3 shown and "+4".
    expect(fridgeGrid(170, 170, 7)).toMatchObject({ cols: 2, rows: 2, shown: 3, extra: 4 });
    // Exactly full: no "+" needed.
    expect(fridgeGrid(170, 170, 4)).toMatchObject({ shown: 4, extra: 0 });
    // A tiny one still has one spot.
    expect(fridgeGrid(40, 30, 2)).toMatchObject({ cols: 1, rows: 1, shown: 0, extra: 2 });
  });
});

describe("words", () => {
  const now = new Date("2026-10-09T12:00:00Z");
  it("says when it was put up", () => {
    expect(postedWords("2026-10-09T12:00:00Z", now)).toBe("just now");
    expect(postedWords("2026-10-09T11:45:00Z", now)).toBe("15 min ago");
    expect(postedWords("2026-10-09T09:00:00Z", now)).toBe("3 hr ago");
    expect(postedWords("2026-10-08T12:00:00Z", now)).toBe("yesterday");
    expect(postedWords("2026-10-06T12:00:00Z", now)).toBe("3 days ago");
  });

  it("says when it comes down", () => {
    expect(comesDownWords("2026-10-09T12:20:00Z", now)).toBe("Comes down in 20 min");
    expect(comesDownWords("2026-10-09T13:00:00Z", now)).toBe("Comes down in 1 hour");
    expect(comesDownWords("2026-10-09T20:00:00Z", now)).toBe("Comes down in 8 hours");
    expect(comesDownWords("2026-10-10T12:00:00Z", now)).toBe("Comes down tomorrow");
    expect(comesDownWords("2026-10-16T12:00:00Z", now)).toBe("Comes down in 7 days");
  });
});

describe("news on the page tabs", () => {
  const now = new Date("2026-10-09T12:00:00Z");
  it("lists fridges with an unseen note that's still up", () => {
    const keys = fridgesWithNews(
      [
        { data: { home_id: "h1", expires_at: "2026-10-10T12:00:00Z" } },
        { data: { burrow_id: "b1", expires_at: "2026-10-09T11:00:00Z" } }, // already came down
        { data: { burrow_id: "b2" } },
      ],
      now
    );
    expect([...keys].sort()).toEqual([placeKey({ kind: "burrow", id: "b2" }), placeKey({ kind: "home", id: "h1" })].sort());
  });

  it("a fridge notice in the inbox opens its fridge", () => {
    const notice = { nook: "fridge", kind: "fridge_note", data: { home_id: "h1" } };
    expect(noticeRoute(notice)).toBe("/fridge?home=h1");
    expect(noticeRoute({ ...notice, data: { burrow_id: "b1" } })).toBe("/fridge?burrow=b1");
    expect(noticeIcon(notice)).toBe("fridge");
  });
});

describe("doodles", () => {
  it("keeps points on the 0–1000 square", () => {
    expect(toDoodlePoint(150, 75, 300)).toEqual([500, 250]);
    expect(toDoodlePoint(-20, 400, 300)).toEqual([0, 1000]);
  });

  it("skips points right on top of the last one, and stops when full", () => {
    const start = { c: "#000", w: 8, p: [100, 100] };
    expect(addPoint(start, [102, 101], 1)).toBe(start);
    expect(addPoint(start, [140, 100], 1).p).toEqual([100, 100, 140, 100]);
    expect(addPoint(start, [400, 400], MAX_POINTS)).toBe(start);
  });

  it("draws smooth paths, and a dot for a tap", () => {
    expect(strokePath([0, 0], 100)).toMatch(/^M0 0 L/);
    expect(strokePath([0, 0, 1000, 1000], 100)).toBe("M0 0 L100 100");
    const curve = strokePath([0, 0, 500, 0, 1000, 500, 1000, 1000], 100);
    expect(curve.startsWith("M0 0 Q50 0")).toBe(true);
    expect(curve.endsWith("L100 100")).toBe(true);
  });

  it("drops anything that isn't a proper stroke", () => {
    expect(cleanDoodle(null)).toEqual([]);
    expect(cleanDoodle([{ c: "#000", w: 8, p: [1, 2] }, { c: 3 }, { c: "#fff", w: 4, p: ["x", 2] }, null])).toEqual([{ c: "#000", w: 8, p: [1, 2] }]);
  });
});

describe("note sizes on the widget", () => {
  it("a few notes get big spots; many get smaller ones", () => {
    // The default 2×3 Fridge door, about 140 × 217 inside.
    expect(fridgeGrid(140, 217, 1)).toMatchObject({ cols: 1, shown: 1 });
    expect(fridgeGrid(140, 217, 5)).toMatchObject({ cols: 2, rows: 3, shown: 5, extra: 0 });
    expect(fridgeGrid(140, 217, 9)).toMatchObject({ cols: 2, rows: 3, shown: 5, extra: 4 });
  });
});
