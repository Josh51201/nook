import { describe, expect, it } from "vitest";

import { clashesFor, dishWarnings, headcount, isComing, slotRoom, type Person } from "../lib/potluck";

const mia: Person = { id: "mia", name: "Mia", allergies: ["peanuts"], diets: [] };
const sam: Person = { id: "sam", name: "Sam", allergies: [], diets: ["vegetarian"] };
const ana: Person = { id: "ana", name: "Ana", allergies: ["dairy"], diets: ["vegan"] };

describe("clash warnings (POT-005)", () => {
  it("names the person and the allergy", () => {
    expect(clashesFor(["peanuts", "gluten"], mia)).toEqual(["Mia has a peanut allergy"]);
  });

  it("catches diets from what the dish contains", () => {
    expect(clashesFor(["meat"], sam)).toEqual(["Sam eats vegetarian (it has meat)"]);
    expect(clashesFor(["dairy", "gluten"], sam)).toEqual([]);
  });

  it("doesn't warn twice about the same ingredient", () => {
    expect(clashesFor(["dairy", "eggs"], ana)).toEqual(["Ana has a dairy allergy", "Ana eats vegan (it has eggs)"]);
  });

  it("an untagged dish raises nothing — Nook never guesses", () => {
    expect(dishWarnings([], [mia, sam, ana])).toEqual([]);
  });

  it("collects warnings for everyone coming", () => {
    expect(dishWarnings(["peanuts", "meat"], [mia, sam])).toEqual([
      "Mia has a peanut allergy",
      "Sam eats vegetarian (it has meat)",
    ]);
  });
});

describe("headcount (POT-006)", () => {
  it("counts people going plus their guests, and maybes separately", () => {
    expect(
      headcount([
        { profile_id: "a", status: "going", extra_guests: 2 },
        { profile_id: "b", status: "going", extra_guests: 0 },
        { profile_id: "c", status: "maybe", extra_guests: 1 },
        { profile_id: "d", status: "no", extra_guests: 3 },
      ])
    ).toEqual({ going: 4, maybe: 2 });
  });

  it("treats Going and Maybe as coming, for warnings", () => {
    expect([isComing("going"), isComing("maybe"), isComing("no"), isComing(undefined)]).toEqual([true, true, false, false]);
  });
});

describe("slots (POT-003)", () => {
  it("knows how full a slot is", () => {
    const slot = { id: "s", label: "Sides", wanted: 2 };
    expect(slotRoom(slot, [{ slot_id: "s" }, { slot_id: null }])).toEqual({ taken: 1, open: 1, full: false });
    expect(slotRoom(slot, [{ slot_id: "s" }, { slot_id: "s" }])).toEqual({ taken: 2, open: 0, full: true });
  });
});
