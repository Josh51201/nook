import { describe, expect, it } from "vitest";

import { birthdayWhen, nextBirthdays, type BirthdayPerson } from "../lib/birthdays";
import { newsFor, type NewsNotice } from "../lib/hearth-news";
import type { HearthItem } from "../lib/hearth-layout";
import { groupNewWishes, loadNewWishes, NEW_WISH_SELECT, wishTitles, type NewWish } from "../lib/new-wishes";
import { buildWeek, tripDayWords, weekCount, type WeekEntry } from "../lib/this-week";
import { defaultWidget, widgetCategories, widgetKinds, type WidgetConfig } from "../lib/widgets";

// Phase 2 Hearth widgets: This week (CORE-105), Birthdays coming up
// (CORE-106), New in Wishbooks (CORE-107) and a Getaway (CORE-108).

const entry = (day: string, source: WeekEntry["source"], title: string, extra: Partial<WeekEntry> = {}): WeekEntry => ({
  day,
  source,
  title,
  icon: "calendar",
  route: "/",
  ...extra,
});

describe("This week (CORE-105)", () => {
  const today = "2026-10-12";

  it("groups by day, soonest first, leaving out empty days and anything past the window", () => {
    const week = buildWeek(
      [entry("2026-10-14", "meals", "Tacos"), entry("2026-10-12", "renewals", "Netflix"), entry("2026-10-19", "gatherings", "Too far")],
      today,
      7
    );
    expect(week.map((d) => d.day)).toEqual(["2026-10-12", "2026-10-14"]);
    expect(week[0].label).toBe("Today");
    expect(weekCount(week)).toBe(2);
    expect(weekCount(buildWeek([entry("2026-10-18", "meals", "Pizza")], today, 7))).toBe(1);
  });

  it("puts overdue things on today, first, marked overdue", () => {
    const week = buildWeek([entry("2026-10-12", "meals", "Soup"), entry("2026-10-08", "chores", "Bins")], today, 3);
    expect(week).toHaveLength(1);
    expect(week[0].entries.map((e) => [e.title, Boolean(e.overdue)])).toEqual([
      ["Bins", true],
      ["Soup", false],
    ]);
  });

  it("lists a day's things Gatherings first, and shows a birthday and its Birthday Gathering once", () => {
    const week = buildWeek(
      [entry("2026-10-13", "meals", "Stew"), entry("2026-10-13", "birthdays", "Mia's birthday"), entry("2026-10-13", "gatherings", "Mia's Birthday")],
      today,
      7
    );
    expect(week[0].entries.map((e) => e.source)).toEqual(["gatherings", "meals"]);
  });

  it("leaves out the kinds switched off", () => {
    const week = buildWeek([entry(today, "meals", "Stew"), entry(today, "chores", "Mop")], today, 7, ["meals"]);
    expect(week[0].entries.map((e) => e.title)).toEqual(["Mop"]);
  });

  it("counts a trip's days", () => {
    expect(tripDayWords("2026-10-10", "2026-10-14", today)).toBe("Day 3 of 5");
    expect(tripDayWords("2026-10-12", "2026-10-12", today)).toBe("Day 1 of 1");
  });
});

describe("Birthdays coming up (CORE-106)", () => {
  const person = (profileId: string, name: string, birthday: string, burrowId = "b1"): BirthdayPerson => ({ profileId, name, birthday, burrowId });
  const today = new Date(2026, 9, 12, 9);

  it("gives each person's next birthday, soonest first, wrapping into next year", () => {
    const list = nextBirthdays([person("a", "Ann", "1980-01-05"), person("b", "Bo", "1990-10-12"), person("c", "Cy", "1985-10-20")], today);
    expect(list.map((b) => [b.name, b.day, b.daysAway])).toEqual([
      ["Bo", "2026-10-12", 0],
      ["Cy", "2026-10-20", 8],
      ["Ann", "2027-01-05", 85],
    ]);
  });

  it("lists someone in two Burrows once", () => {
    const list = nextBirthdays([person("a", "Ann", "1980-11-01", "b1"), person("a", "Ann", "1980-11-01", "b2")], today);
    expect(list).toHaveLength(1);
    expect(list[0].burrowIds).toEqual(["b1", "b2"]);
  });

  it("says a new age only for kids", () => {
    const list = nextBirthdays([person("k", "Kit", "2018-11-01"), person("g", "Gran", "1950-11-02")], today);
    expect(list.map((b) => b.turning)).toEqual([8, null]);
  });

  it("handles Feb 29 in other years and says when in words", () => {
    const [leap] = nextBirthdays([person("l", "Lee", "2000-02-29")], today);
    expect(leap.day).toBe("2027-02-28");
    expect(birthdayWhen({ daysAway: 0, day: "2026-10-12" })).toBe("Today");
    expect(birthdayWhen({ daysAway: 1, day: "2026-10-13" })).toBe("Tomorrow");
    expect(birthdayWhen({ daysAway: 5, day: "2026-10-17" })).toBe("in 5 days");
    expect(birthdayWhen({ daysAway: 21, day: "2026-11-02" })).toBe("in 3 weeks");
  });
});

describe("New in Wishbooks (CORE-107, GIFT-007)", () => {
  const wish = (id: string, ownerId: string, ownerName: string, created_at: string): NewWish => ({ id, title: `Gift ${id}`, image_url: null, created_at, ownerId, ownerName });

  it("groups by person, whoever added most recently first", () => {
    const people = groupNewWishes([
      wish("1", "mia", "Mia", "2026-10-10T10:00:00Z"),
      wish("2", "bo", "Bo", "2026-10-11T10:00:00Z"),
      wish("3", "mia", "Mia", "2026-10-11T12:00:00Z"),
    ]);
    expect(people.map((p) => [p.name, p.count, p.titles])).toEqual([
      ["Mia", 2, ["Gift 3", "Gift 1"]],
      ["Bo", 1, ["Gift 2"]],
    ]);
    expect(wishTitles(["A", "B", "C", "D"])).toBe("A, B and 2 more");
    expect(wishTitles(["A", "B"])).toBe("A and B");
    expect(wishTitles(["A"])).toBe("A");
  });

  it("never asks for tucks or claims, and leaves out your own Wishbook", async () => {
    expect(NEW_WISH_SELECT).not.toMatch(/claim|tuck/i);
    const calls: [string, unknown[]][] = [];
    const rows = [
      { id: "g1", title: "Lego", image_url: null, created_at: "2026-10-11T10:00:00Z", wishbooks: { owner_id: "mia", profiles: { display_name: "Mia" } } },
      // Even if the database handed one back, your own is dropped.
      { id: "g2", title: "Mine", image_url: null, created_at: "2026-10-11T09:00:00Z", wishbooks: { owner_id: "me", profiles: { display_name: "Me" } } },
    ];
    const query: Record<string, unknown> = {};
    for (const method of ["select", "is", "gte", "neq", "order", "limit"]) {
      query[method] = (...args: unknown[]) => {
        calls.push([method, args]);
        return method === "limit" ? Promise.resolve({ data: rows, error: null }) : query;
      };
    }
    const client = { from: (table: string) => (calls.push(["from", [table]]), query) };
    const wishes = await loadNewWishes(client as never, "me", 14, new Date("2026-10-12T12:00:00Z"));
    expect(wishes.map((w) => w.id)).toEqual(["g1"]);
    expect(Object.keys(wishes[0]).sort()).toEqual(["created_at", "id", "image_url", "ownerId", "ownerName", "title"]);
    expect(calls).toContainEqual(["from", ["gifts"]]);
    expect(calls).toContainEqual(["neq", ["wishbooks.owner_id", "me"]]);
    expect(calls).toContainEqual(["gte", ["created_at", "2026-09-28T12:00:00.000Z"]]);
  });
});

describe("Phase 2 widgets on the Hearth", () => {
  it("are in the Add sheet, under From your Nooks", () => {
    const nooks = widgetCategories.find((c) => c.id === "nooks")!;
    for (const kind of ["week", "birthdays", "wishes", "getaway"] as const) {
      expect(widgetKinds.some((k) => k.kind === kind)).toBe(true);
      expect(nooks.kinds).toContain(kind);
      expect(defaultWidget(kind).kind).toBe(kind);
    }
  });

  it("get a dot for the news they're about", () => {
    const notice = (nook: string, kind: string, data: NewsNotice["data"] = {}): NewsNotice => ({ nook, kind, title: kind, data, created_at: "2026-10-12T00:00:00Z" });
    const ctx = { notices: [notice("gift-nook", "new_gifts"), notice("getaways", "getaway_todo", { getaway_id: "t1" })] };
    const item = (widget: WidgetConfig): HearthItem => ({ id: "w", kind: "widget", widget, x: 0, y: 0, w: 2, h: 2 });
    expect(newsFor(item(defaultWidget("wishes")), ctx)?.latest).toBe("new_gifts");
    expect(newsFor(item(defaultWidget("getaway")), ctx)?.latest).toBe("getaway_todo");
    const other = defaultWidget("getaway");
    if (other.kind === "getaway") other.settings.getawayId = "t2";
    expect(newsFor(item(other), ctx)).toBeNull();
    expect(newsFor(item(defaultWidget("week")), ctx)).toBeNull();
  });
});
