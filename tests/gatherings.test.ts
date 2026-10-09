import { describe, expect, it } from "vitest";

import { defaultTitle, endOfDay, groupGatherings, guestCounts, guestSummary, invitedIds, rsvpLabel, whenFields, whenWords } from "../lib/gatherings";

describe("when a Gathering is (GATH-002)", () => {
  it("is on a day, with a time only if one was set", () => {
    const day = new Date(2026, 11, 20, 9, 30);
    const allDay = whenFields(day, null);
    expect(allDay.starts_at).toBeNull();
    expect(new Date(allDay.ends_at).getTime()).toBe(endOfDay(day).getTime());

    const timed = whenFields(day, new Date(2001, 0, 1, 17, 0));
    const starts = new Date(timed.starts_at!);
    expect([starts.getFullYear(), starts.getMonth(), starts.getDate(), starts.getHours(), starts.getMinutes()]).toEqual([2026, 11, 20, 17, 0]);
    expect(timed.ends_at).toBe(allDay.ends_at);
  });

  it("says the time only when there is one", () => {
    const allDay = whenFields(new Date(2026, 11, 20), null);
    expect(whenWords(allDay)).not.toMatch(/\d:\d\d/);
    expect(whenWords(whenFields(new Date(2026, 11, 20), new Date(2026, 0, 1, 17, 0)))).toMatch(/5:00/);
  });
});

describe("the list (GATH-001)", () => {
  const now = new Date(2026, 9, 9, 12);
  const on = (y: number, m: number, d: number) => ({ id: `${m}-${d}`, ends_at: endOfDay(new Date(y, m, d)).toISOString() });

  it("splits into this week, later, and recently, soonest first", () => {
    const groups = groupGatherings([on(2026, 10, 1), on(2026, 9, 9), on(2026, 9, 1), on(2026, 9, 12), on(2026, 8, 20)], now);
    expect(groups.thisWeek.map((g) => g.id)).toEqual(["9-9", "9-12"]);
    expect(groups.later.map((g) => g.id)).toEqual(["10-1"]);
    // Most recent first.
    expect(groups.past.map((g) => g.id)).toEqual(["9-1", "8-20"]);
  });
});

describe("guest list (GATH-003, GATH-006)", () => {
  it("counts who's coming, with the guests they bring", () => {
    const guests = [
      { status: "going" as const, extra_guests: 2 },
      { status: "going" as const, extra_guests: 0 },
      { status: "maybe" as const, extra_guests: 1 },
      { status: "no" as const, extra_guests: 3 },
      { status: null, extra_guests: 0 },
    ];
    expect(guestCounts(guests)).toEqual({ invited: 5, going: 4, maybe: 2, no: 1, waiting: 1 });
    expect(guestSummary(guests)).toBe("4 coming · 2 maybe · 1 hasn't answered");
    expect(guestSummary([])).toBe("Nobody invited yet");
    expect(guestSummary([{ status: "no", extra_guests: 0 }])).toBe("1 invited");
  });

  it("invites everyone in picked Burrows plus picked people, once each", () => {
    const members: Record<string, string[]> = { family: ["mom", "dad", "mia"], friends: ["sam", "mom"] };
    const ids = invitedIds(["family", "friends"], ["jo", "mia"], (id) => members[id] ?? []);
    expect([...ids].sort()).toEqual(["dad", "jo", "mia", "mom", "sam"]);
  });

  it("names RSVPs in plain words", () => {
    expect(rsvpLabel("going")).toBe("Going");
    expect(rsvpLabel("no")).toBe("Can't make it");
    expect(rsvpLabel(null)).toBe("Not answered");
  });
});

describe("default names", () => {
  it("names it for who it's for, or its kind", () => {
    expect(defaultTitle("Birthday", ["Mia"])).toBe("Mia's Birthday");
    expect(defaultTitle("Anniversary", ["Mom", "Dad"])).toBe("Mom & Dad's Anniversary");
    expect(defaultTitle("Game night", [])).toBe("Game night");
  });
});
