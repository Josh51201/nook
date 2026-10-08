import { describe, expect, it } from "vitest";

import {
  careVerb,
  dueState,
  dueWords,
  formatTimeOfDay,
  healthNeedingAttention,
  helperActive,
  helperUntilWords,
  localDay,
  mealStatus,
  mealsLeft,
  quickCareFor,
  sortHealth,
  toTimeOfDay,
} from "../lib/pets";

const meals = [
  { id: "m2", label: "Dinner", remind_at: "18:00:00", position: 1 },
  { id: "m1", label: "Breakfast", remind_at: null, position: 0 },
];
const entry = (id: string, mealId: string | null, day: string, kind = "meal") => ({
  id,
  kind,
  meal_id: mealId,
  done_by: "u1",
  done_at: `${day}T08:00:00Z`,
  day,
  note: null,
});

describe("meals", () => {
  it("shows each set meal in order, fed or not, for today only", () => {
    const log = [entry("a", "m1", "2026-10-08"), entry("b", "m2", "2026-10-07")];
    const status = mealStatus(meals, log, "2026-10-08");
    expect(status.map((s) => s.meal.label)).toEqual(["Breakfast", "Dinner"]);
    expect(status.map((s) => Boolean(s.fed))).toEqual([true, false]);
    expect(mealsLeft(meals, log, "2026-10-08")).toBe(1);
  });

  it("walks and treats don't count as feeding a meal", () => {
    expect(mealsLeft(meals, [entry("w", null, "2026-10-08", "walk")], "2026-10-08")).toBe(2);
  });

  it("formats times of day", () => {
    expect(formatTimeOfDay(null)).toBeNull();
    expect(formatTimeOfDay("07:30:00")).toMatch(/7:30/);
    expect(toTimeOfDay(new Date(2000, 0, 1, 7, 5))).toBe("07:05:00");
  });

  it("describes what was done", () => {
    expect(careVerb("meal", "Breakfast")).toBe("gave breakfast to");
    expect(careVerb("walk")).toBe("took a walk with");
  });
});

describe("days", () => {
  it("writes the local day", () => {
    expect(localDay(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  });
});

describe("vet, vaccines and meds", () => {
  const today = "2026-10-08";
  it("says how due something is", () => {
    expect(dueState({ due_on: "2026-10-01" }, today)).toBe("overdue");
    expect(dueState({ due_on: "2026-10-08" }, today)).toBe("today");
    expect(dueState({ due_on: "2026-10-20" }, today)).toBe("soon");
    expect(dueState({ due_on: "2027-03-01" }, today)).toBe("later");
    expect(dueState({ due_on: null }, today)).toBe("none");
    expect(dueWords({ due_on: "2026-10-09" }, today)).toBe("Due tomorrow");
    expect(dueWords({ due_on: "2026-10-03" }, today)).toBe("Overdue by 5 days");
    expect(dueWords({ due_on: "2026-10-18" }, today)).toBe("Due in 10 days");
  });

  it("sorts soonest first with undated last, and picks what needs attention", () => {
    const items = [{ due_on: null }, { due_on: "2027-01-01" }, { due_on: "2026-10-02" }, { due_on: "2026-10-12" }];
    expect(sortHealth(items).map((i) => i.due_on)).toEqual(["2026-10-02", "2026-10-12", "2027-01-01", null]);
    expect(healthNeedingAttention(items, today).map((i) => i.due_on)).toEqual(["2026-10-02", "2026-10-12"]);
  });
});

describe("helpers", () => {
  it("have access through their end day", () => {
    expect(helperActive(null, "2026-10-08")).toBe(true);
    expect(helperActive("2026-10-08", "2026-10-08")).toBe(true);
    expect(helperActive("2026-10-07", "2026-10-08")).toBe(false);
    expect(helperUntilWords(null, "2026-10-08")).toBe("Until you remove them");
    expect(helperUntilWords("2026-10-07", "2026-10-08")).toBe("Access ended");
  });
});

describe("quick care", () => {
  it("offers what suits the pet", () => {
    expect(quickCareFor("dog").map((q) => q.kind)).toEqual(["walk", "potty", "treat"]);
    expect(quickCareFor("cat").map((q) => q.kind)).toEqual(["litter", "treat"]);
    expect(quickCareFor("fish").map((q) => q.kind)).toEqual(["treat"]);
  });
});
