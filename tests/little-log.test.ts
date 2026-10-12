import { describe, expect, it } from "vitest";

import {
  agoWords,
  changeWords,
  chartPoints,
  formatEntry,
  formatNumber,
  groupByDay,
  inRange,
  logStats,
  nearestIndex,
  niceTicks,
  parseNumber,
  starters,
  yesNoDays,
  yesStreak,
} from "../lib/little-log";

const at = (day: string, time = "09:00") => new Date(`${day}T${time}:00`).toISOString();

describe("typing a number (LOG-003)", () => {
  it("reads plain numbers, decimals and thousands", () => {
    expect(parseNumber("182.4")).toBe(182.4);
    expect(parseNumber(" 7 ")).toBe(7);
    expect(parseNumber("1,204")).toBe(1204);
    expect(parseNumber(".5")).toBe(0.5);
    expect(parseNumber("-3")).toBe(-3);
  });

  it("refuses things that aren't a number", () => {
    expect(parseNumber("")).toBeNull();
    expect(parseNumber("abc")).toBeNull();
    expect(parseNumber("120/80")).toBeNull();
    expect(parseNumber("1e12")).toBeNull();
  });
});

describe("showing an entry", () => {
  it("says each kind the way it reads best", () => {
    expect(formatEntry({ kind: "number", unit: "lbs" }, { value: 182.4, value2: null, note: null })).toBe("182.4 lbs");
    expect(formatEntry({ kind: "pair", unit: "mmHg" }, { value: 120, value2: 80, note: null })).toBe("120/80 mmHg");
    expect(formatEntry({ kind: "scale", unit: null }, { value: 4, value2: null, note: null })).toBe("4 · Good");
    expect(formatEntry({ kind: "yesno", unit: null }, { value: 0, value2: null, note: null })).toBe("No");
    expect(formatEntry({ kind: "text", unit: null }, { value: null, value2: null, note: "Slept badly" })).toBe("Slept badly");
  });

  it("rounds to 2 decimals and adds separators", () => {
    expect(formatNumber(1234.567)).toBe("1,234.57");
    expect(formatNumber(3)).toBe("3");
  });

  it("has a starter for each kind, with two labels on a pair", () => {
    for (const kind of ["number", "pair", "scale", "yesno", "text"]) {
      expect(starters.some((s) => s.kind === kind)).toBe(true);
    }
    for (const s of starters.filter((s) => s.kind === "pair")) expect(s.labels).toHaveLength(2);
  });
});

describe("time ranges and history", () => {
  const now = new Date("2026-10-12T12:00:00").getTime();
  const entries = [
    { logged_at: at("2026-10-12", "08:00") },
    { logged_at: at("2026-09-01") },
    { logged_at: at("2026-10-10") },
    { logged_at: at("2026-10-12", "07:00") },
  ];

  it("keeps the range, oldest first", () => {
    const week = inRange(entries, "week", now);
    expect(week.map((e) => e.logged_at)).toEqual([at("2026-10-10"), at("2026-10-12", "07:00"), at("2026-10-12", "08:00")]);
    expect(inRange(entries, "all", now)).toHaveLength(4);
  });

  it("groups history by day, newest first", () => {
    const groups = groupByDay(entries);
    expect(groups.map((g) => g.day)).toEqual(["2026-10-12", "2026-10-10", "2026-09-01"]);
    expect(groups[0].entries).toHaveLength(2);
  });

  it("says how long ago", () => {
    expect(agoWords(at("2026-10-12"), "2026-10-12")).toBe("today");
    expect(agoWords(at("2026-10-11"), "2026-10-12")).toBe("yesterday");
    expect(agoWords(at("2026-10-09"), "2026-10-12")).toBe("3 days ago");
  });
});

describe("stats (LOG-004)", () => {
  it("finds the latest, average, low, high and change", () => {
    const stats = logStats([
      { value: 180, value2: null },
      { value: 184, value2: null },
      { value: 182, value2: null },
    ]);
    expect(stats).toMatchObject({ count: 3, latest: 182, average: 182, low: 180, high: 184, change: 2 });
    expect(changeWords(2)).toBe("+2");
    expect(changeWords(-1.5)).toBe("−1.5");
    expect(changeWords(0)).toBe("no change");
  });

  it("copes with nothing logged", () => {
    expect(logStats([])).toMatchObject({ count: 0, latest: null, average: null, change: null });
  });
});

describe("yes or no logs", () => {
  it("lays out each day, the latest answer that day winning", () => {
    const days = yesNoDays(
      [
        { logged_at: at("2026-10-10"), value: 1 },
        { logged_at: at("2026-10-11", "08:00"), value: 0 },
        { logged_at: at("2026-10-11", "20:00"), value: 1 },
      ],
      4,
      "2026-10-12"
    );
    expect(days.map((d) => d.state)).toEqual([null, "yes", "yes", null]);
  });

  it("counts a streak ending today, or yesterday if today isn't logged yet", () => {
    expect(yesStreak([{ state: "no" }, { state: "yes" }, { state: "yes" }, { state: null }])).toBe(2);
    expect(yesStreak([{ state: "yes" }, { state: "no" }])).toBe(0);
  });
});

describe("charts", () => {
  it("picks round ticks that cover the values", () => {
    const ticks = niceTicks(171, 189);
    expect(ticks[0]).toBeLessThanOrEqual(171);
    expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(189);
    for (const t of ticks) expect(Number.isInteger(t)).toBe(true);
    expect(niceTicks(5, 5).length).toBeGreaterThan(1);
  });

  it("places points by time and value", () => {
    const points = chartPoints(
      [
        { logged_at: at("2026-10-01"), value: 0, value2: null },
        { logged_at: at("2026-10-03"), value: 10, value2: 5 },
      ],
      100,
      50,
      [0, 10]
    );
    expect(points[0]).toEqual({ x: 0, y: 50, y2: null });
    expect(points[1]).toEqual({ x: 100, y: 0, y2: 25 });
    expect(nearestIndex(points, 70)).toBe(1);
  });

  it("centres a single point", () => {
    expect(chartPoints([{ logged_at: at("2026-10-01"), value: 3, value2: null }], 100, 50, [0, 10])[0].x).toBe(50);
  });
});
