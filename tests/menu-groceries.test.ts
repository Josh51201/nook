import { describe, expect, it } from "vitest";

import {
  countWords,
  guessAisle,
  isPotluckWeek,
  itemKey,
  listCounts,
  listParts,
  mergeAmount,
  mergeSource,
  parseTyped,
  potluckShowFrom,
  splitIngredient,
  suggestGroceries,
} from "../lib/groceries";
import {
  addDays,
  copyPlan,
  dishesWithoutRecipe,
  mealHeadline,
  nextMeal,
  plannedCount,
  recipesOnMenu,
  slot,
  slotKind,
  slotWords,
  weekDays,
  weekStart,
  weekWords,
  type MenuMeal,
} from "../lib/menu-board";

const meal = (over: Partial<MenuMeal>): MenuMeal => ({
  id: Math.random().toString(36),
  home_id: "h",
  day: "2026-10-12",
  meal: "dinner",
  kind: "dish",
  title: "Tacos",
  recipe_id: null,
  position: 0,
  created_by: null,
  created_at: "2026-10-01T00:00:00Z",
  ...over,
});

describe("Menu Board weeks (MENU-001)", () => {
  it("starts the week on Sunday or Monday", () => {
    // 2026-10-12 is a Monday.
    expect(weekStart("2026-10-12", 0)).toBe("2026-10-11");
    expect(weekStart("2026-10-12", 1)).toBe("2026-10-12");
    expect(weekStart("2026-10-18", 1)).toBe("2026-10-12");
    expect(weekDays("2026-10-11")).toHaveLength(7);
    expect(weekDays("2026-10-11")[6]).toBe("2026-10-17");
  });

  it("crosses months and years", () => {
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("names this, next and last week", () => {
    expect(weekWords("2026-10-11", "2026-10-12", 0)).toBe("This week");
    expect(weekWords("2026-10-18", "2026-10-12", 0)).toBe("Next week");
    expect(weekWords("2026-10-04", "2026-10-12", 0)).toBe("Last week");
  });
});

describe("Menu Board meals (MENU-003..006)", () => {
  it("reads a meal the way the board shows it", () => {
    expect(slotWords([meal({ title: "Tacos" }), meal({ title: "Rice" })])).toBe("Tacos, Rice");
    expect(slotWords([meal({ kind: "out", title: "Pizza Hut" })])).toBe("Going out · Pizza Hut");
    expect(slotWords([meal({ kind: "out", title: "" })])).toBe("Going out");
    expect(slotWords([meal({ kind: "own", title: "" })])).toBe("On your own");
    expect(slotWords([])).toBe("");
    expect(slotKind([meal({ kind: "own" })])).toBe("own");
    expect(slotKind([])).toBeNull();
  });

  it("keeps a meal's dishes in order", () => {
    const rows = [meal({ title: "B", position: 1 }), meal({ title: "A", position: 0 }), meal({ title: "Lunch", meal: "lunch" })];
    expect(slot(rows, "2026-10-12", "dinner").map((r) => r.title)).toEqual(["A", "B"]);
  });

  it("copies last week only into empty meals", () => {
    const last = [meal({ day: "2026-10-05", title: "Chili" }), meal({ day: "2026-10-06", title: "Soup" })];
    const plan = copyPlan(last, [meal({ day: "2026-10-12", title: "Tacos" })]);
    expect(plan).toEqual([expect.objectContaining({ day: "2026-10-13", title: "Soup" })]);
  });

  it("counts planned meals and finds the week's recipes once", () => {
    const rows = [meal({ recipe_id: "r1" }), meal({ day: "2026-10-13", recipe_id: "r1" }), meal({ day: "2026-10-13", meal: "lunch", recipe_id: "r2" })];
    expect(plannedCount(rows, weekDays("2026-10-11"), ["dinner"])).toBe(2);
    expect(recipesOnMenu(rows)).toEqual(["r1", "r2"]);
    expect(dishesWithoutRecipe([meal({ title: "Leftovers" }), meal({ title: "leftovers" }), meal({ kind: "own", title: "" })])).toEqual(["Leftovers"]);
  });

  it("knows what's next today", () => {
    expect(nextMeal(["breakfast", "lunch", "dinner"], 8)).toBe("breakfast");
    expect(nextMeal(["breakfast", "lunch", "dinner"], 18)).toBe("dinner");
    expect(nextMeal(["dinner"], 8)).toBe("dinner");
    expect(nextMeal(["breakfast"], 18)).toBeNull();
    expect(mealHeadline("dinner", "Tacos")).toBe("Tonight: Tacos");
    expect(mealHeadline("dinner", "")).toBe("Nothing planned for tonight");
  });
});

describe("Grocery items (GROC-003, GROC-005)", () => {
  it("guesses the aisle from the name", () => {
    expect(guessAisle("Bananas")).toBe("produce");
    expect(guessAisle("2 red onions")).toBe("produce");
    expect(guessAisle("Sweet potatoes")).toBe("produce");
    expect(guessAisle("Ice cream")).toBe("frozen");
    expect(guessAisle("Peanut butter")).toBe("pantry");
    expect(guessAisle("Eggs")).toBe("dairy");
    expect(guessAisle("Chicken thighs")).toBe("meat");
    expect(guessAisle("Paper towels")).toBe("household");
    expect(guessAisle("Birthday candles")).toBe("other");
  });

  it("splits an ingredient line into what to buy and how much", () => {
    expect(splitIngredient("2 cups all-purpose flour")).toEqual({ name: "All-purpose flour", amount: "2 cups" });
    expect(splitIngredient("1 onion, diced")).toEqual({ name: "Onion", amount: "1" });
    expect(splitIngredient("1 (14 oz) can black beans")).toEqual({ name: "Black beans", amount: "1 (14 oz) can" });
    expect(splitIngredient("1 1/2 tsp. salt")).toEqual({ name: "Salt", amount: "1 1/2 tsp." });
    expect(splitIngredient("Salt and pepper to taste")).toEqual({ name: "Salt and pepper", amount: null });
    expect(splitIngredient("3 carrots")).toEqual({ name: "Carrots", amount: "3" });
    expect(parseTyped("2 lb chicken")).toEqual({ name: "Chicken", amount: "2 lb", aisle: "meat" });
    expect(parseTyped("milk")).toEqual({ name: "Milk", amount: null, aisle: "dairy" });
  });

  it("treats plurals and case as the same thing", () => {
    expect(itemKey("Eggs")).toBe(itemKey("egg"));
    expect(itemKey("Tomatoes")).toBe(itemKey("tomato"));
  });

  it("adds amounts together where it can", () => {
    expect(mergeAmount("2 cups", "1 cup")).toBe("3 cups");
    expect(mergeAmount("1 cup", "1 cup")).toBe("2 cups");
    expect(mergeAmount("2", "3")).toBe("5");
    expect(mergeAmount("1 lb", "1 lb")).toBe("2 lb");
    expect(mergeAmount("1 lb", "2 cups")).toBe("1 lb + 2 cups");
    expect(mergeAmount(null, "2")).toBe("2");
    expect(mergeSource("Tacos", "tacos")).toBe("Tacos");
    expect(mergeSource("Tacos", "Chili")).toBe("Tacos, Chili");
  });

  it("suggests common groceries that aren't on the list yet", () => {
    expect(suggestGroceries("ban")).toContain("Banana");
    expect(suggestGroceries("ban", ["Bananas"])).not.toContain("Banana");
    expect(suggestGroceries("b")).toEqual([]);
  });
});

describe("The list and Potluck shopping (GROC-004, GROC-006)", () => {
  const item = (over: object) => ({ aisle: "other" as const, checked: false, show_from: null as string | null, created_at: "2026-10-01", ...over });

  it("waits until the week of the Potluck", () => {
    expect(potluckShowFrom("2026-12-20", "2026-12-01")).toBe("2026-12-13");
    expect(potluckShowFrom("2026-12-20", "2026-12-13")).toBeNull();
    expect(potluckShowFrom("2026-12-20", "2026-12-18")).toBeNull();
    expect(isPotluckWeek("2026-12-20", "2026-12-14")).toBe(true);
    expect(isPotluckWeek("2026-12-20", "2026-12-01")).toBe(false);
    expect(isPotluckWeek("2026-12-20", "2026-12-21")).toBe(false);
  });

  it("splits a list into aisles, the cart and coming up", () => {
    const items = [
      item({ aisle: "dairy" }),
      item({ aisle: "produce" }),
      item({ aisle: "produce", checked: true }),
      item({ aisle: "pantry", show_from: "2026-12-13" }),
      item({ aisle: "pantry", show_from: "2026-10-01" }),
    ];
    const parts = listParts(items, "2026-10-12");
    expect(parts.toGet.map((g) => g.aisle)).toEqual(["produce", "dairy", "pantry"]);
    expect(parts.inCart).toHaveLength(1);
    expect(parts.comingUp).toHaveLength(1);
    const counts = listCounts(items, "2026-10-12");
    expect(counts).toEqual({ left: 3, inCart: 1, waiting: 1 });
    expect(countWords(counts)).toBe("3 to get · 1 in the cart · 1 coming up");
  });
});
