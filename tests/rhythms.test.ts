import { describe, expect, it } from "vitest";

import {
  groupRhythms,
  historyFor,
  lastDoneWords,
  latestEntry,
  repeatWords,
  rhythmDueWords,
  rhythmState,
  sortRhythms,
  startersLeft,
  starterRhythms,
  suggestedDue,
} from "../lib/rhythms";

const today = "2026-10-08";
const r = (title: string, due_on: string | null) => ({ title, due_on, last_done_on: null });

describe("due dates", () => {
  it("knows overdue, today, soon and later", () => {
    expect(rhythmState(r("a", "2026-10-01"), today)).toBe("overdue");
    expect(rhythmState(r("a", today), today)).toBe("today");
    expect(rhythmState(r("a", "2026-10-20"), today)).toBe("soon");
    expect(rhythmState(r("a", "2026-12-01"), today)).toBe("later");
    expect(rhythmState(r("a", null), today)).toBe("none");
  });

  it("says when in plain words", () => {
    expect(rhythmDueWords(r("a", today), today)).toBe("Due today");
    expect(rhythmDueWords(r("a", "2026-10-09"), today)).toBe("Due tomorrow");
    expect(rhythmDueWords(r("a", "2026-10-05"), today)).toBe("Overdue by 3 days");
    expect(rhythmDueWords(r("a", "2026-10-18"), today)).toBe("Due in 10 days");
    expect(rhythmDueWords(r("a", null), today)).toBe("No date set");
    expect(rhythmDueWords({ due_on: null, last_done_on: "2026-10-01" }, today)).toBe("Done");
  });

  it("sorts soonest first with done one-offs last", () => {
    const sorted = sortRhythms([r("b", null), r("c", "2026-11-01"), r("a", "2026-10-02")]);
    expect(sorted.map((x) => x.title)).toEqual(["a", "c", "b"]);
  });

  it("groups into needs doing, this month, later and done", () => {
    const groups = groupRhythms(
      [r("late", "2026-10-01"), r("today", today), r("soon", "2026-10-30"), r("far", "2027-03-01"), r("once", null)],
      today
    );
    expect(groups.now.map((x) => x.title)).toEqual(["late", "today"]);
    expect(groups.month.map((x) => x.title)).toEqual(["soon"]);
    expect(groups.later.map((x) => x.title)).toEqual(["far"]);
    expect(groups.done.map((x) => x.title)).toEqual(["once"]);
  });
});

describe("last done", () => {
  it("is recent in days, older in months", () => {
    expect(lastDoneWords(null, today)).toBe("Not done here yet");
    expect(lastDoneWords(today, today)).toBe("Done today");
    expect(lastDoneWords("2026-10-07", today)).toBe("Done yesterday");
    expect(lastDoneWords("2026-09-28", today)).toBe("Done 10 days ago");
    expect(lastDoneWords("2025-03-15", today)).toMatch(/^Last done /);
  });
});

describe("repeats", () => {
  it("reads naturally", () => {
    expect(repeatWords(12)).toBe("every year");
    expect(repeatWords(6)).toBe("twice a year");
    expect(repeatWords(null)).toBe("just once");
  });
});

describe("starter list (RHY-003)", () => {
  it("leaves out ones the Home already has, ignoring case", () => {
    const left = startersLeft(["clean the GUTTERS ", "Flu shots"]);
    expect(left.length).toBe(starterRhythms.length - 2);
    expect(left.some((s) => s.title === "Clean the gutters")).toBe(false);
  });

  it("suggests the start of a chore's season, or a few weeks out", () => {
    expect(suggestedDue({ months: 12, season: 11 }, today)).toBe("2026-11-01");
    expect(suggestedDue({ months: 12, season: 4 }, today)).toBe("2027-04-01");
    expect(suggestedDue({ months: 12, season: 10 }, today)).toBe("2026-10-15");
    expect(suggestedDue({ months: 3 }, today)).toBe("2026-10-29");
    expect(suggestedDue({ months: 1 }, today)).toBe("2026-10-15");
  });

  it("has no duplicate names", () => {
    const names = starterRhythms.map((s) => s.title.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("history (RHY-006)", () => {
  const entry = (id: string, rhythm_id: string, done_on: string, created_at: string) => ({
    id,
    rhythm_id,
    done_by: "u1",
    done_on,
    note: null,
    created_at,
  });
  const log = [
    entry("a", "r1", "2026-01-10", "2026-01-10T10:00:00Z"),
    entry("b", "r1", "2026-07-02", "2026-07-02T10:00:00Z"),
    // Backdated: logged last, but for an earlier day.
    entry("c", "r1", "2026-04-01", "2026-10-01T10:00:00Z"),
    entry("d", "r2", "2026-09-01", "2026-09-01T10:00:00Z"),
  ];

  it("lists one rhythm's history by the day it was done", () => {
    expect(historyFor(log, "r1").map((e) => e.id)).toEqual(["b", "c", "a"]);
  });

  it("only the most recently logged entry can be undone", () => {
    expect(latestEntry(log, "r1")?.id).toBe("c");
    expect(latestEntry(log, "r3")).toBeNull();
  });
});
