import { describe, expect, it } from "vitest";

import { daysUntil, timeUntil, weekendsUntil, weeksAndDays } from "../lib/widgets";

// Wednesday, Dec 2 2026, 6:30 pm local.
const now = new Date(2026, 11, 2, 18, 30, 0);

describe("countdown math", () => {
  it("counts calendar days, not 24-hour blocks", () => {
    expect(daysUntil(new Date(2026, 11, 25), now)).toBe(23);
    expect(daysUntil(new Date(2026, 11, 3, 8, 0), now)).toBe(1);
    expect(daysUntil(new Date(2026, 11, 2, 23, 0), now)).toBe(0);
    expect(daysUntil(new Date(2026, 10, 30), now)).toBe(-2);
  });

  it("ticks down to the start of the day", () => {
    expect(timeUntil(new Date(2026, 11, 3, 15, 0), now)).toEqual({ days: 0, hours: 5, minutes: 30, seconds: 0 });
    expect(timeUntil(new Date(2026, 11, 25), now)).toEqual({ days: 22, hours: 5, minutes: 30, seconds: 0 });
    expect(timeUntil(new Date(2026, 10, 1), now)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  });

  it("counts the Saturdays in between", () => {
    // Dec 5, 12, 19 — the 25th is a Friday.
    expect(weekendsUntil(new Date(2026, 11, 25), now)).toBe(3);
    expect(weekendsUntil(new Date(2026, 11, 5), now)).toBe(0);
    expect(weekendsUntil(new Date(2026, 11, 6), now)).toBe(1);
  });

  it("says it in weeks and days", () => {
    expect(weeksAndDays(5)).toBe("5 days");
    expect(weeksAndDays(1)).toBe("1 day");
    expect(weeksAndDays(14)).toBe("2 weeks");
    expect(weeksAndDays(23)).toBe("3 weeks and 2 days");
    expect(weeksAndDays(8)).toBe("1 week and 1 day");
  });
});
