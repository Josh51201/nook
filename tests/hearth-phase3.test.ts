import { describe, expect, it } from "vitest";

import { gratitudeStreak, memoryFor, promptFor, todaysLine, writeLine, MAX_GRATITUDE, type GratitudeLine } from "../lib/gratitude";
import { formatTimer, newTimer, pauseTimer, resetTimer, startTimer, timeLeft, timerState, toggleTimer, durationWords } from "../lib/kitchen-timer";
import { daylightWords, moonLitPath, moonPhase, seasonOf, sunProgress, sunTimes } from "../lib/sky";
import { currentName, nextName, passTurn, spinTurn, withNames, type WhoseTurn } from "../lib/whose-turn";
import { defaultWidget, widgetCategories, widgetKinds } from "../lib/widgets";

// Phase 3 Hearth widgets: Kitchen timer (CORE-109), Whose turn? (CORE-111),
// Sky (CORE-112) and Gratitude jar (CORE-113).

const minutesUtc = (date: Date) => date.getUTCHours() * 60 + date.getUTCMinutes();

describe("Sky (CORE-112)", () => {
  it("works out sunrise and sunset close to the published times", () => {
    // London, midsummer: about 03:43 and 20:21 UTC.
    const london = sunTimes(new Date(2026, 5, 21, 12), 51.5074, -0.1278);
    expect(london.kind).toBe("normal");
    if (london.kind !== "normal") return;
    expect(Math.abs(minutesUtc(london.sunrise) - (3 * 60 + 43))).toBeLessThanOrEqual(5);
    expect(Math.abs(minutesUtc(london.sunset) - (20 * 60 + 21))).toBeLessThanOrEqual(5);
    // New York, midwinter: about 12:16 and 21:32 UTC.
    const ny = sunTimes(new Date(2026, 11, 21, 12), 40.7128, -74.006);
    if (ny.kind !== "normal") throw new Error("expected a normal day");
    expect(Math.abs(minutesUtc(ny.sunrise) - (12 * 60 + 16))).toBeLessThanOrEqual(5);
    expect(Math.abs(minutesUtc(ny.sunset) - (21 * 60 + 32))).toBeLessThanOrEqual(5);
    expect(daylightWords(ny)).toMatch(/^9h \d+m of daylight$/);
  });

  it("knows when the sun doesn't rise or set", () => {
    expect(sunTimes(new Date(2026, 5, 21, 12), 78.2, 15.6).kind).toBe("midnightSun");
    expect(sunTimes(new Date(2026, 11, 21, 12), 78.2, 15.6).kind).toBe("polarNight");
  });

  it("places the sun across the sky by day, and not at night", () => {
    const sun = { kind: "normal" as const, sunrise: new Date(2026, 0, 1, 7), sunset: new Date(2026, 0, 1, 17), noon: new Date(2026, 0, 1, 12) };
    expect(sunProgress(new Date(2026, 0, 1, 12), sun)).toBeCloseTo(0.5);
    expect(sunProgress(new Date(2026, 0, 1, 22), sun)).toBeNull();
  });

  it("names the moon's phase", () => {
    expect(moonPhase(new Date(Date.UTC(2024, 0, 25, 17, 54))).name).toBe("Full moon");
    expect(moonPhase(new Date(Date.UTC(2024, 0, 11, 11, 57))).name).toBe("New moon");
    expect(moonPhase(new Date(Date.UTC(2024, 0, 18, 3, 53))).name).toBe("First quarter");
    const full = moonPhase(new Date(Date.UTC(2024, 0, 25, 17, 54)));
    expect(full.lit).toBeGreaterThan(0.99);
    expect(moonLitPath(0, 10, 10, 10)).toBe("");
    expect(moonLitPath(0.25, 10, 10, 10)).toMatch(/^M 10 0 A 10 10 0 0 1 10 20/);
  });

  it("knows the season, flipped south of the equator", () => {
    expect(seasonOf(new Date(2026, 9, 12))).toBe("fall");
    expect(seasonOf(new Date(2026, 0, 12), 40)).toBe("winter");
    expect(seasonOf(new Date(2026, 0, 12), -33)).toBe("summer");
  });
});

describe("Kitchen timer (CORE-109)", () => {
  const t0 = Date.UTC(2026, 9, 12, 12);

  it("runs, pauses where it was, carries on and rings", () => {
    const timer = newTimer("Eggs", 420);
    expect(timerState(timer, t0)).toBe("idle");
    const running = startTimer(timer, t0);
    expect(timerState(running, t0 + 1000)).toBe("running");
    expect(timeLeft(running, t0 + 60_500)).toBe(360);
    const paused = pauseTimer(running, t0 + 60_000);
    expect(timerState(paused, t0 + 999_999)).toBe("paused");
    expect(timeLeft(paused)).toBe(360);
    const again = startTimer(paused, t0 + 100_000);
    expect(timeLeft(again, t0 + 100_000)).toBe(360);
    expect(timerState(again, t0 + 100_000 + 360_000)).toBe("done");
    expect(timerState(resetTimer(again))).toBe("idle");
  });

  it("one button plays, pauses, and sets a rung timer back", () => {
    const timer = newTimer("Tea", 240);
    const on = toggleTimer(timer, t0);
    expect(timerState(on, t0)).toBe("running");
    expect(timerState(toggleTimer(on, t0 + 1000), t0 + 1000)).toBe("paused");
    expect(timerState(toggleTimer(on, t0 + 300_000), t0 + 300_000)).toBe("idle");
  });

  it("says times plainly", () => {
    expect(formatTimer(245)).toBe("4:05");
    expect(formatTimer(3900)).toBe("1:05:00");
    expect(durationWords(720)).toBe("12 min");
    expect(durationWords(3900)).toBe("1 hr 5 min");
    expect(durationWords(45)).toBe("45 sec");
  });
});

describe("Gratitude jar (CORE-113)", () => {
  const today = "2026-10-12";

  it("keeps one line a day, newest first, and can take today's back", () => {
    let lines: GratitudeLine[] = [{ day: "2026-10-10", text: "Soup" }];
    lines = writeLine(lines, today, "  Sunny walk  ");
    expect(lines).toEqual([
      { day: today, text: "Sunny walk" },
      { day: "2026-10-10", text: "Soup" },
    ]);
    lines = writeLine(lines, today, "Pancakes");
    expect(todaysLine(lines, today)?.text).toBe("Pancakes");
    expect(writeLine(lines, today, "")).toHaveLength(1);
    const full = Array.from({ length: MAX_GRATITUDE }, (_, i) => ({ day: `2020-01-${String((i % 28) + 1).padStart(2, "0")}x${i}`, text: "x" }));
    expect(writeLine(full, today, "new")).toHaveLength(MAX_GRATITUDE);
  });

  it("hands back a year-ago or month-ago line first", () => {
    const lines = [
      { day: "2025-10-12", text: "A year ago" },
      { day: "2026-09-12", text: "A month ago" },
    ];
    expect(memoryFor(lines, today)).toEqual({ line: lines[0], why: "year" });
    expect(memoryFor([lines[1]], today)).toEqual({ line: lines[1], why: "month" });
    expect(memoryFor([], today)).toBeNull();
  });

  it("otherwise now and then, the same line all day, and never today's", () => {
    const lines = ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"].map((day) => ({ day, text: day }));
    const shown = Array.from({ length: 30 }, (_, i) => memoryFor(lines, `2026-11-${String(i + 1).padStart(2, "0")}`));
    const some = shown.filter(Boolean).length;
    expect(some).toBeGreaterThan(3);
    expect(some).toBeLessThan(20);
    expect(memoryFor(lines, "2026-11-05")).toEqual(memoryFor(lines, "2026-11-05"));
    expect(memoryFor([{ day: today, text: "today" }, ...lines], today)?.line.day ?? "").not.toBe(today);
  });

  it("counts a streak and asks the same question all day", () => {
    const lines = ["2026-10-12", "2026-10-11", "2026-10-10", "2026-10-08"].map((day) => ({ day, text: "x" }));
    expect(gratitudeStreak(lines, today)).toBe(3);
    expect(gratitudeStreak(lines.slice(1), today)).toBe(2);
    expect(promptFor(today)).toBe(promptFor(today));
  });
});

describe("Whose turn? (CORE-111)", () => {
  const base: WhoseTurn = { task: "Dishes", names: ["Mia", "Bo", "Cy"], mode: "rotate", current: 0, history: [] };

  it("goes round in order and remembers who did it", () => {
    expect(currentName(base)).toBe("Mia");
    expect(nextName(base)).toBe("Bo");
    const after = passTurn(passTurn(passTurn(base)));
    expect(currentName(after)).toBe("Mia");
    expect(after.history.map((h) => h.name)).toEqual(["Cy", "Bo", "Mia"]);
  });

  it("spins to anyone but the last one picked", () => {
    let turn = spinTurn({ ...base, mode: "spin" }, 0);
    for (let i = 0; i < 50; i++) {
      const before = turn.current;
      turn = spinTurn(turn, Math.random());
      expect(turn.current).not.toBe(before);
    }
    expect(spinTurn({ ...base, names: ["Solo"] }, 0.9).current).toBe(0);
  });

  it("keeps it the same person's turn when names change", () => {
    const bo = { ...base, current: 1 };
    expect(currentName(withNames(bo, ["Cy", "Bo", " ", "Dee"]))).toBe("Bo");
    expect(currentName(withNames(bo, ["Cy", "Dee"]))).toBe("Cy");
  });
});

describe("Phase 3 widgets in the Add sheet", () => {
  it("each has a home and a default", () => {
    for (const kind of ["timer", "sky", "gratitude", "turn"] as const) {
      expect(widgetKinds.some((k) => k.kind === kind)).toBe(true);
      expect(widgetCategories.filter((c) => c.kinds.includes(kind))).toHaveLength(1);
      expect(defaultWidget(kind).kind).toBe(kind);
    }
  });
});
