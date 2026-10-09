import { describe, expect, it } from "vitest";

import {
  balances,
  dueWords,
  groupGetaways,
  ideaDue,
  itinerary,
  leftToPack,
  newLines,
  nextGetaway,
  packingFor,
  packProgress,
  rangeWords,
  settleUp,
  shares,
  sortTodos,
  timeWords,
  totalSpent,
  tripState,
  whenWords,
  type Booking,
  type Item,
  type Plan,
} from "../lib/getaways";

const today = "2026-10-09";
const trip = (title: string, starts_on: string, ends_on: string) => ({ title, starts_on, ends_on });

describe("dates (TRIP-001, TRIP-010)", () => {
  it("writes a date range briefly", () => {
    expect(rangeWords("2026-10-20", "2026-10-27", today)).toBe("Oct 20 – 27");
    expect(rangeWords("2026-10-30", "2026-11-02", today)).toBe("Oct 30 – Nov 2");
    expect(rangeWords("2026-12-30", "2027-01-02", today)).toBe("Dec 30, 2026 – Jan 2, 2027");
    expect(rangeWords("2026-10-20", "2026-10-20", today)).toBe("Oct 20");
    expect(rangeWords("2027-03-01", "2027-03-05", today)).toBe("Mar 1 – 5, 2027");
  });

  it("counts down, then counts the days of the trip", () => {
    expect(whenWords(trip("a", "2026-10-21", "2026-10-25"), today)).toBe("In 12 days");
    expect(whenWords(trip("a", "2026-10-10", "2026-10-12"), today)).toBe("Tomorrow");
    expect(whenWords(trip("a", today, "2026-10-12"), today)).toBe("Starts today");
    expect(whenWords(trip("a", "2026-10-07", "2026-10-13"), today)).toBe("Day 3 of 7");
    expect(whenWords(trip("a", "2026-10-01", "2026-10-08"), today)).toBe("Ended yesterday");
    expect(whenWords(trip("a", "2026-09-28", "2026-10-02"), today)).toBe("Ended Oct 2");
  });

  it("sorts into now, coming up and past, and finds the next one", () => {
    const trips = [
      trip("past", "2026-08-01", "2026-08-05"),
      trip("later", "2026-12-20", "2026-12-27"),
      trip("soon", "2026-10-20", "2026-10-22"),
      trip("now", "2026-10-08", "2026-10-10"),
    ];
    const groups = groupGetaways(trips, today);
    expect(groups.now.map((t) => t.title)).toEqual(["now"]);
    expect(groups.upcoming.map((t) => t.title)).toEqual(["soon", "later"]);
    expect(groups.past.map((t) => t.title)).toEqual(["past"]);
    expect(nextGetaway(trips, today)?.title).toBe("now");
    expect(nextGetaway(trips.filter((t) => t.title !== "now"), today)?.title).toBe("soon");
    expect(nextGetaway([trip("past", "2026-08-01", "2026-08-05")], today)).toBeNull();
    expect(tripState(trip("a", today, today), today)).toBe("now");
  });
});

function item(overrides: Partial<Item>): Item {
  return {
    id: overrides.text ?? "i",
    getaway_id: "g",
    kind: "pack",
    text: "Socks",
    for_person: null,
    due_on: null,
    done_at: null,
    done_by: null,
    created_at: "2026-10-01T00:00:00Z",
    ...overrides,
  };
}

describe("packing (TRIP-003, TRIP-008)", () => {
  const items = [
    item({ text: "Sunscreen", for_person: null }),
    item({ text: "Socks", for_person: "me", done_at: "2026-10-08T00:00:00Z" }),
    item({ text: "Swimsuit", for_person: "me" }),
    item({ text: "Teddy", for_person: "kid" }),
    item({ text: "Hold the mail", kind: "todo" }),
  ];

  it("splits lists by whose they are", () => {
    expect(packingFor(items, "me").map((i) => i.text)).toEqual(["Socks", "Swimsuit"]);
    expect(packingFor(items, "shared").map((i) => i.text)).toEqual(["Sunscreen"]);
    expect(packProgress(items, "me")).toEqual({ done: 1, total: 2 });
    expect(packProgress(items)).toEqual({ done: 1, total: 4 });
  });

  it("what's left for you counts your list and the shared one", () => {
    expect(leftToPack(items, "me")).toBe(2);
    expect(leftToPack(items, "kid")).toBe(2);
  });

  it("adds only lines that aren't there yet, ignoring case", () => {
    expect(newLines(["Socks", "sunscreen"], ["socks", "Sunscreen ", "Hat", "hat", " "])).toEqual(["Hat"]);
  });
});

describe("before you go (TRIP-006)", () => {
  it("puts what's left first, soonest first", () => {
    const sorted = sortTodos([
      item({ text: "done", kind: "todo", done_at: "x", due_on: "2026-10-01" }),
      item({ text: "undated", kind: "todo" }),
      item({ text: "later", kind: "todo", due_on: "2026-10-15" }),
      item({ text: "sooner", kind: "todo", due_on: "2026-10-10" }),
    ]);
    expect(sorted.map((t) => t.text)).toEqual(["sooner", "later", "undated", "done"]);
  });

  it("says when it's due", () => {
    expect(dueWords(null, today)).toBeNull();
    expect(dueWords(today, today)).toBe("Do today");
    expect(dueWords("2026-10-10", today)).toBe("Do by tomorrow");
    expect(dueWords("2026-10-12", today)).toBe("Do in 3 days");
    expect(dueWords("2026-10-08", today)).toBe("Was due yesterday");
    expect(dueWords("2026-10-30", today)).toBe("Do by Oct 30");
  });

  it("gives an idea a do-by day before the trip, never in the past", () => {
    expect(ideaDue(7, "2026-10-30", today)).toBe("2026-10-23");
    expect(ideaDue(21, "2026-10-20", today)).toBe(today);
  });
});

describe("day by day (TRIP-004, TRIP-005)", () => {
  const booking = (overrides: Partial<Booking>): Booking => ({
    id: "b",
    getaway_id: "g",
    kind: "other",
    title: "Thing",
    code: null,
    starts_on: "2026-10-20",
    starts_time: null,
    ends_on: null,
    ends_time: null,
    place: null,
    url: null,
    notes: null,
    created_at: "x",
    ...overrides,
  });
  const plan = (overrides: Partial<Plan>): Plan => ({
    id: "p",
    getaway_id: "g",
    on_day: "2026-10-21",
    at_time: null,
    title: "Plan",
    place: null,
    notes: null,
    created_at: "x",
    ...overrides,
  });

  it("puts confirmations on their days and orders each day by time", () => {
    const days = itinerary(
      { starts_on: "2026-10-20", ends_on: "2026-10-22" },
      [
        booking({ id: "f", kind: "flight", title: "Delta 1432", code: "ABC123", starts_time: "14:30:00", ends_on: "2026-10-20", ends_time: "17:05:00" }),
        booking({ id: "s", kind: "stay", title: "Seaside Inn", starts_time: "16:00:00", ends_on: "2026-10-22", ends_time: "11:00:00" }),
      ],
      [
        plan({ id: "aq", title: "Aquarium", at_time: "09:00:00" }),
        plan({ id: "beach", title: "Beach day" }),
        plan({ id: "early", title: "Pack the car", on_day: "2026-10-19" }),
      ]
    );
    expect(days.map((d) => d.day)).toEqual(["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22"]);
    expect(days[0].label).toMatch(/^Before · /);
    expect(days[1].label).toMatch(/^Day 1 · /);
    expect(days[1].entries.map((e) => e.title)).toEqual(["Delta 1432", "Check in: Seaside Inn"]);
    expect(days[1].entries[0].sub).toBe("Confirmation ABC123");
    expect(days[2].entries.map((e) => e.title)).toEqual(["Beach day", "Aquarium"]);
    expect(days[3].entries.map((e) => e.title)).toEqual(["Check out: Seaside Inn"]);
  });

  it("writes times in 12-hour form", () => {
    expect(timeWords("14:30:00")).toBe("2:30 PM");
    expect(timeWords("00:05")).toBe("12:05 AM");
    expect(timeWords("12:00")).toBe("12:00 PM");
    expect(timeWords(null)).toBeNull();
  });
});

describe("shared costs (TRIP-009)", () => {
  const cost = (paid_by: string, amount_cents: number, split_among: string[], is_payback = false) => ({
    paid_by,
    amount_cents,
    split_among,
    is_payback,
  });

  it("splits to the cent", () => {
    const s = shares({ amount_cents: 1000, split_among: ["a", "b", "c"] });
    expect([...s.values()]).toEqual([334, 333, 333]);
  });

  it("works out who owes whom with the fewest paybacks", () => {
    const b = balances([cost("a", 9000, ["a", "b", "c"]), cost("b", 3000, ["a", "b", "c"])]);
    expect(Object.fromEntries(b)).toEqual({ a: 5000, b: -1000, c: -4000 });
    expect(settleUp(b)).toEqual([
      { from: "c", to: "a", cents: 4000 },
      { from: "b", to: "a", cents: 1000 },
    ]);
  });

  it("a payback evens things out and isn't counted as spending", () => {
    const costs = [cost("a", 6000, ["a", "b"]), cost("b", 3000, ["a"], true)];
    expect(settleUp(balances(costs))).toEqual([]);
    expect(totalSpent(costs)).toBe(6000);
  });

  it("a kid's share goes to their grown-up", () => {
    const b = balances([cost("a", 9000, ["a", "b", "kid"])], new Map([["kid", "b"]]));
    expect(Object.fromEntries(b)).toEqual({ a: 6000, b: -6000 });
  });
});
