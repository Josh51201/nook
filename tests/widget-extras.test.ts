import { describe, expect, it } from "vitest";

import { defaultWidget, widgetCategories, widgetKinds } from "../lib/widgets";
import {
  addDays,
  bestStreak,
  cozyQuotes,
  currentStreak,
  dayKey,
  inSeason,
  lastDays,
  launchTargets,
  parseQuotes,
  pickedTargets,
  quoteOfDay,
  quotePool,
  showInWords,
  toggleDay,
} from "../lib/widget-extras";

describe("days", () => {
  it("adds days across month and year ends", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2028-03-01", -1)).toBe("2028-02-29");
  });

  it("formats a date as its local day", () => {
    expect(dayKey(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("lists the last days ending today", () => {
    expect(lastDays(3, "2026-10-08")).toEqual(["2026-10-06", "2026-10-07", "2026-10-08"]);
  });
});

describe("quote of the day (CORE-049)", () => {
  it("is the same all day and different tomorrow", () => {
    const morning = quoteOfDay(cozyQuotes, new Date(2026, 9, 8, 7));
    const night = quoteOfDay(cozyQuotes, new Date(2026, 9, 8, 23));
    const tomorrow = quoteOfDay(cozyQuotes, new Date(2026, 9, 9, 7));
    expect(morning).toBe(night);
    expect(tomorrow).not.toBe(morning);
  });

  it("steps through every quote before repeating", () => {
    const seen = new Set<string | null>();
    for (let d = 0; d < cozyQuotes.length; d++) seen.add(quoteOfDay(cozyQuotes, new Date(2026, 0, 1 + d)));
    expect(seen.size).toBe(cozyQuotes.length);
  });

  it("nothing to show with an empty list", () => {
    expect(quoteOfDay([], new Date())).toBeNull();
    expect(quotePool("mine", [])).toEqual([]);
  });

  it("builds the pool from ours, yours or both, ignoring blanks", () => {
    expect(quotePool("cozy", ["mine"])).toBe(cozyQuotes);
    expect(quotePool("mine", ["  a  ", "", "b"])).toEqual(["a", "b"]);
    expect(quotePool("both", ["a"])).toEqual(["a", ...cozyQuotes]);
  });

  it("tidies what you type, one quote per line", () => {
    expect(parseQuotes("one\n\n  two  \n")).toEqual(["one", "two"]);
    expect(parseQuotes(Array.from({ length: 80 }, (_, i) => `q${i}`).join("\n"))).toHaveLength(50);
    expect(parseQuotes("x".repeat(500))[0]).toHaveLength(200);
  });

  it("every built-in quote is short enough to read at a glance", () => {
    for (const quote of cozyQuotes) expect(quote.length).toBeLessThan(80);
    expect(new Set(cozyQuotes).size).toBe(cozyQuotes.length);
  });
});

describe("habit streak (CORE-049)", () => {
  const today = "2026-10-08";

  it("counts days in a row up to today", () => {
    expect(currentStreak([], today)).toBe(0);
    expect(currentStreak(["2026-10-08"], today)).toBe(1);
    expect(currentStreak(["2026-10-06", "2026-10-07", "2026-10-08"], today)).toBe(3);
  });

  it("holds while today isn't done yet, and breaks after a missed day", () => {
    expect(currentStreak(["2026-10-06", "2026-10-07"], today)).toBe(2);
    expect(currentStreak(["2026-10-05", "2026-10-06"], today)).toBe(0);
    expect(currentStreak(["2026-10-01", "2026-10-02", "2026-10-07", "2026-10-08"], today)).toBe(2);
  });

  it("finds the best run ever", () => {
    expect(bestStreak([])).toBe(0);
    expect(bestStreak(["2026-01-01", "2026-01-02", "2026-01-03", "2026-02-01", "2026-02-02"])).toBe(3);
    expect(bestStreak(["2026-01-01", "2026-01-01"])).toBe(1);
  });

  it("ticks a day, unticks it, and keeps the list sorted and short", () => {
    expect(toggleDay([], today)).toEqual([today]);
    expect(toggleDay([today], today)).toEqual([]);
    expect(toggleDay(["2026-10-09", "2026-10-01"], today)).toEqual(["2026-10-01", "2026-10-08", "2026-10-09"]);
    const long = Array.from({ length: 450 }, (_, i) => addDays("2025-01-01", i));
    expect(toggleDay(long, "2026-12-31")).toHaveLength(400);
  });
});

describe("quick launch (CORE-049)", () => {
  it("offers every ready Nook and the app's own places, each with a route", () => {
    const targets = launchTargets();
    expect(targets.map((t) => t.key)).toEqual(expect.arrayContaining(["gift-nook", "pets", "rhythms", "inbox", "market", "home"]));
    for (const target of targets) expect(target.route.startsWith("/")).toBe(true);
    expect(new Set(targets.map((t) => t.key)).size).toBe(targets.length);
  });

  it("keeps your order and drops buttons that no longer exist", () => {
    expect(pickedTargets(["market", "nope", "inbox"]).map((t) => t.key)).toEqual(["market", "inbox"]);
  });

  it("is offered with starter buttons", () => {
    for (const kind of ["clock", "quote", "launch", "streak"] as const) {
      expect(widgetKinds.some((k) => k.kind === kind)).toBe(true);
      expect(defaultWidget(kind).kind).toBe(kind);
    }
    const launch = defaultWidget("launch");
    if (launch.kind === "launch") expect(pickedTargets(launch.settings.targets).length).toBe(launch.settings.targets.length);
  });
});

describe("Add sheet categories (CORE-059)", () => {
  it("puts every widget kind in exactly one category", () => {
    const listed = widgetCategories.flatMap((c) => c.kinds);
    expect([...listed].sort()).toEqual(widgetKinds.map((k) => k.kind).sort());
  });
});

describe("show only sometimes (CORE-053)", () => {
  const at = (month: number) => new Date(2026, month - 1, 15);

  it("always shows things with no range", () => {
    expect(inSeason(undefined, at(6))).toBe(true);
  });

  it("shows within a range, both ends included", () => {
    const range = { from: 11, to: 12 };
    expect(inSeason(range, at(10))).toBe(false);
    expect(inSeason(range, at(11))).toBe(true);
    expect(inSeason(range, at(12))).toBe(true);
    expect(inSeason(range, at(1))).toBe(false);
  });

  it("a range can wrap round the new year", () => {
    const winter = { from: 11, to: 2 };
    expect([10, 11, 12, 1, 2, 3].map((m) => inSeason(winter, at(m)))).toEqual([false, true, true, true, true, false]);
  });

  it("a single month works", () => {
    expect(inSeason({ from: 7, to: 7 }, at(7))).toBe(true);
    expect(inSeason({ from: 7, to: 7 }, at(8))).toBe(false);
  });

  it("says it in words", () => {
    expect(showInWords(undefined)).toBe("Always");
    expect(showInWords({ from: 11, to: 12 })).toBe("Nov to Dec");
    expect(showInWords({ from: 7, to: 7 })).toBe("Only in Jul");
  });
});
