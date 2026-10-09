import { describe, expect, it } from "vitest";

import {
  findTimers,
  formatAmount,
  formatClock,
  parseDuration,
  parseNumber,
  parseRecipePage,
  recipeOfTheDay,
  scaleFactor,
  scaleIngredient,
  searchRecipes,
  shelvesIn,
  toLines,
} from "../lib/recipes";

describe("amounts (REC-005)", () => {
  it("reads whole numbers, decimals, fractions and mixed numbers", () => {
    expect(parseNumber("2")).toBe(2);
    expect(parseNumber("1.5")).toBe(1.5);
    expect(parseNumber("1/2")).toBe(0.5);
    expect(parseNumber("1 1/2")).toBe(1.5);
    expect(parseNumber("½")).toBe(0.5);
    expect(parseNumber("1½")).toBe(1.5);
    expect(parseNumber("1 ½")).toBe(1.5);
    expect(parseNumber("1/0")).toBeNull();
    expect(parseNumber("some")).toBeNull();
  });

  it("writes amounts the way a cook would", () => {
    expect(formatAmount(3)).toBe("3");
    expect(formatAmount(1.5)).toBe("1 1/2");
    expect(formatAmount(0.75)).toBe("3/4");
    expect(formatAmount(2 / 3)).toBe("2/3");
    expect(formatAmount(0.333)).toBe("1/3");
    expect(formatAmount(12.4)).toBe("12");
    expect(formatAmount(1.97)).toBe("2");
  });
});

describe("scaling ingredients (REC-005)", () => {
  it("scales the leading amount and leaves the rest", () => {
    expect(scaleIngredient("1 1/2 cups flour", 2)).toBe("3 cups flour");
    expect(scaleIngredient("½ tsp salt", 2)).toBe("1 tsp salt");
    expect(scaleIngredient("2 eggs", 1.5)).toBe("3 eggs");
    expect(scaleIngredient("250g butter", 2)).toBe("500g butter");
    expect(scaleIngredient("2-3 cloves garlic", 2)).toBe("4-6 cloves garlic");
    expect(scaleIngredient("3/4 cup sugar", 0.5)).toBe("3/8 cup sugar");
  });

  it("leaves lines without an amount alone", () => {
    expect(scaleIngredient("Salt to taste", 2)).toBe("Salt to taste");
    expect(scaleIngredient("A pinch of nutmeg", 3)).toBe("A pinch of nutmeg");
  });

  it("works out the factor from servings", () => {
    expect(scaleFactor(4, 8)).toBe(2);
    expect(scaleFactor(null, 8)).toBe(1);
    expect(scaleFactor(4, 4)).toBe(1);
  });
});

describe("timers in steps (REC-004)", () => {
  it("finds minutes and hours, taking the short end of a range", () => {
    expect(findTimers("Bake for 25-30 minutes until golden.")).toEqual([{ label: "25-30 minutes", seconds: 1500 }]);
    expect(findTimers("Simmer 1 hour, then rest 10 mins")).toEqual([
      { label: "1 hour", seconds: 3600 },
      { label: "10 mins", seconds: 600 },
    ]);
    expect(findTimers("Chill for an hour")).toEqual([{ label: "an hour", seconds: 3600 }]);
    expect(findTimers("Roast 1½ hours")[0].seconds).toBe(5400);
  });

  it("gives one button for a time said twice in a step", () => {
    expect(findTimers("Cook 5 minutes, stir, then cook 5 minutes more.")).toEqual([{ label: "5 minutes", seconds: 300 }]);
  });

  it("ignores steps without a time, and oven temperatures", () => {
    expect(findTimers("Mix the flour and sugar.")).toEqual([]);
    expect(findTimers("Heat the oven to 350 degrees.")).toEqual([]);
  });

  it("shows a countdown like a kitchen timer", () => {
    expect(formatClock(1500)).toBe("25:00");
    expect(formatClock(3725)).toBe("1:02:05");
  });
});

describe("reading a recipe website (REC-008)", () => {
  it("reads ISO durations", () => {
    expect(parseDuration("PT1H30M")).toBe(90);
    expect(parseDuration("PT45M")).toBe(45);
    expect(parseDuration("P0DT20M")).toBe(20);
    expect(parseDuration("nonsense")).toBeNull();
  });

  const page = `<html><head><title>Best Chili | Site</title>
    <script type="application/ld+json">{"@context":"https://schema.org","@graph":[
      {"@type":"WebPage","name":"Page"},
      {"@type":["Recipe"],"name":"Grandma&#39;s Chili","recipeYield":["6","6 servings"],
       "prepTime":"PT15M","cookTime":"PT1H","image":[{"@type":"ImageObject","url":"/chili.jpg"}],
       "recipeIngredient":["1 lb beef","2 cans <b>beans</b>"],
       "recipeInstructions":[{"@type":"HowToSection","name":"Cook","itemListElement":[
         {"@type":"HowToStep","text":"Brown the beef."},{"@type":"HowToStep","text":"Simmer 1 hour."}]}]}
    ]}</script></head></html>`;

  it("pulls the recipe out of the page's recipe data", () => {
    expect(parseRecipePage(page, "https://example.com/chili")).toEqual({
      title: "Grandma's Chili",
      servings: 6,
      prep_minutes: 15,
      cook_minutes: 60,
      ingredients: ["1 lb beef", "2 cans beans"],
      steps: ["Brown the beef.", "Simmer 1 hour."],
      image_url: "https://example.com/chili.jpg",
    });
  });

  it("falls back to the title and picture when there's no recipe data", () => {
    const plain = `<meta property="og:title" content="Pie"><meta property="og:image" content="https://x.com/pie.jpg">`;
    expect(parseRecipePage(plain, "https://x.com")).toMatchObject({ title: "Pie", image_url: "https://x.com/pie.jpg", ingredients: [] });
    expect(parseRecipePage("<html></html>", "https://x.com")).toBeNull();
  });

  it("copes with broken JSON and steps given as one string", () => {
    const messy = `<script type="application/ld+json">{oops</script>
      <script type="application/ld+json">{"@type":"Recipe","name":"Toast","recipeInstructions":"Toast bread.\\nButter it."}</script>`;
    expect(parseRecipePage(messy, "https://x.com")?.steps).toEqual(["Toast bread.", "Butter it."]);
  });
});

describe("search and Shelves (REC-006)", () => {
  const recipes = [
    { id: "a", title: "Apple pie", ingredients: ["6 apples", "1 cup sugar"], shelves: ["Desserts", "Holidays"] },
    { id: "b", title: "Chicken soup", ingredients: ["1 chicken", "2 carrots"], shelves: ["Soups"] },
    { id: "c", title: "Carrot cake", ingredients: ["3 carrots", "1 cup sugar"], shelves: ["Desserts"] },
  ];

  it("matches titles, ingredients and Shelves, titles first", () => {
    expect(searchRecipes(recipes, "carrot").map((r) => r.id)).toEqual(["c", "b"]);
    expect(searchRecipes(recipes, "sugar holidays").map((r) => r.id)).toEqual(["a"]);
    expect(searchRecipes(recipes, "  ").length).toBe(3);
  });

  it("lists Shelves most-used first", () => {
    expect(shelvesIn(recipes)).toEqual(["Desserts", "Holidays", "Soups"]);
  });

  it("takes bullets and step numbers off typed lines", () => {
    expect(toLines("- 2 eggs\n\n• 1 cup milk\n1. Whisk\n2) Pour", 10)).toEqual(["2 eggs", "1 cup milk", "Whisk", "Pour"]);
  });
});

describe("recipe of the day (REC-011)", () => {
  const recipes = ["r1", "r2", "r3", "r4", "r5"].map((id) => ({ id }));

  it("is the same all day and changes over the days", () => {
    expect(recipeOfTheDay(recipes, "2026-10-09")).toEqual(recipeOfTheDay([...recipes].reverse(), "2026-10-09"));
    const week = new Set(["01", "02", "03", "04", "05", "06", "07"].map((d) => recipeOfTheDay(recipes, `2026-10-${d}`)!.id));
    expect(week.size).toBeGreaterThan(1);
    expect(recipeOfTheDay([], "2026-10-09")).toBeNull();
  });
});
