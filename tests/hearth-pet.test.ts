import { describe, expect, it } from "vitest";

import type { HearthItem } from "../lib/hearth-layout";
import {
  bedLayout,
  critterForSpecies,
  critters,
  homeSpot,
  hopPath,
  hungryMeal,
  isNight,
  perchesFor,
  perchStillThere,
  perchSpot,
  petSays,
  petSizeForBox,
  petSizeForStride,
  pickPerch,
} from "../lib/hearth-pet";
import { speciesList } from "../lib/pets";
import { defaultWidget, widgetCategories } from "../lib/widgets";

const GAP = 12;
const STRIDE = 92;
const GRID = STRIDE * 4 - GAP;
const pet = petSizeForStride(STRIDE);

const bed = { id: "bed", kind: "widget", widget: defaultWidget("companion"), x: 0, y: 2, w: 2, h: 2 } as HearthItem;
const nook = (id: string, x: number, y: number, w = 2, h = 2) => ({ id, kind: "nook", nookId: "gift", x, y, w, h }) as HearthItem;
const label = { id: "l", kind: "label", text: "Hi", size: "heading", align: "left", x: 0, y: 5, w: 4, h: 1 } as HearthItem;
const trinket = { id: "t", kind: "trinket", piece: "plant", x: 1.5, y: 6, w: 1, h: 1 } as HearthItem;
const seq = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length];
};

describe("Hearth pet (CORE-048)", () => {
  it("has a drawing for every Pet Care species", () => {
    const keys = critters.map((c) => c.key);
    for (const species of speciesList) expect(keys).toContain(critterForSpecies(species.key));
    expect(critterForSpecies("dog")).toBe("dog");
    expect(critterForSpecies("reptile")).toBe("turtle");
    expect(critterForSpecies("small")).toBe("hamster");
  });

  it("is a cozy widget with a made-up pet to start", () => {
    const widget = defaultWidget("companion");
    expect(widget.kind).toBe("companion");
    if (widget.kind !== "companion") return;
    expect(widget.settings.petId).toBeNull();
    expect(widget.settings.wanders).toBe(true);
    expect(widgetCategories.find((c) => c.id === "cozy")?.kinds).toContain("companion");
  });

  it("stays a sensible size", () => {
    expect(petSizeForStride(40).w).toBe(40);
    expect(petSizeForStride(400).w).toBe(64);
    expect(petSizeForBox(20, 20).w).toBeGreaterThanOrEqual(36);
  });

  it("keeps the bed and the pet inside the widget at every size", () => {
    for (const [w, h] of [
      [80, 80],
      [172, 80],
      [172, 172],
      [356, 172],
      [356, 356],
      [80, 356],
    ]) {
      const { bed: box, pet: sits, bowl, text } = bedLayout(w, h, pet);
      for (const b of [box, sits, ...(bowl ? [bowl] : []), ...(text ? [text] : [])]) {
        expect(b.x).toBeGreaterThanOrEqual(-0.5);
        expect(b.x + b.w).toBeLessThanOrEqual(w + 0.5);
        expect(b.y + b.h).toBeLessThanOrEqual(h + 0.5);
      }
      // The pet sits in its bed.
      expect(sits.x).toBeGreaterThanOrEqual(box.x - 0.5);
      expect(sits.x + sits.w).toBeLessThanOrEqual(box.x + box.w + 0.5);
    }
    // A wide widget puts the name beside the bed; a tiny one has no room.
    expect(bedLayout(356, 80, pet).text?.x).toBeGreaterThan(bedLayout(356, 80, pet).bed.x);
    expect(bedLayout(80, 80, pet).text).toBeNull();
  });

  it("goes home to its own bed", () => {
    const at = homeSpot(bed, STRIDE, GAP, pet);
    expect(at.on).toBeNull();
    expect(at.x).toBeGreaterThanOrEqual(0);
    expect(at.y).toBeGreaterThan(2 * STRIDE);
  });

  it("only visits Nooks, widgets and Hollows, never its own bed, text or Trinkets", () => {
    const items = [bed, nook("a", 2, 2), label, trinket];
    expect(perchesFor(items, "bed").map((i) => i.id)).toEqual(["a"]);
    const spot = pickPerch(items, "bed", STRIDE, GAP, pet, GRID, () => 0.5, null);
    expect(spot?.on).toBe("a");
    // Sits on top of it, feet on its top edge.
    expect(spot!.y + pet.h).toBeGreaterThan(2 * STRIDE);
    expect(spot!.y).toBeLessThan(2 * STRIDE);
  });

  it("skips the top row, where it would be cut off", () => {
    expect(pickPerch([bed, nook("top", 2, 0)], "bed", STRIDE, GAP, pet, GRID, () => 0.5, null)).toBeNull();
  });

  it("goes somewhere new each time when it can", () => {
    const items = [bed, nook("a", 2, 2), nook("b", 0, 4)];
    for (const r of [0, 0.3, 0.6, 0.99]) {
      expect(pickPerch(items, "bed", STRIDE, GAP, pet, GRID, () => r, "a")?.on).toBe("b");
    }
  });

  it("sits in the middle of an arched Nook and stays on the grid", () => {
    const item = nook("a", 2, 2);
    const spot = perchSpot(item, STRIDE, GAP, pet, () => 0.99, GRID);
    expect(spot.x + pet.w / 2).toBeCloseTo(2 * STRIDE + (2 * STRIDE - GAP) / 2);
    const wide = { ...defaultWidgetItem("w", 0, 3), w: 4 } as HearthItem;
    for (const r of [0, 0.5, 1]) {
      const s = perchSpot(wide, STRIDE, GAP, pet, () => r, GRID);
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.x + pet.w).toBeLessThanOrEqual(GRID);
    }
  });

  it("notices when what it's sitting on moves or goes away", () => {
    const item = nook("a", 2, 2);
    const spot = perchSpot(item, STRIDE, GAP, pet, () => 0.5, GRID);
    expect(perchStillThere(spot, [item], STRIDE, GAP, pet)).toBe(true);
    expect(perchStillThere(spot, [{ ...item, y: 4 }], STRIDE, GAP, pet)).toBe(false);
    expect(perchStillThere(spot, [], STRIDE, GAP, pet)).toBe(false);
    expect(perchStillThere({ x: 0, y: 0, on: null }, [], STRIDE, GAP, pet)).toBe(true);
  });

  it("hops in short bounds and lands exactly where it was going", () => {
    const hops = hopPath({ x: 0, y: 0 }, { x: 300, y: 400 }, 120);
    expect(hops.length).toBe(5);
    expect(hops[hops.length - 1]).toEqual({ x: 300, y: 400 });
    expect(hopPath({ x: 5, y: 5 }, { x: 5, y: 5 }, 120)).toHaveLength(1);
  });

  it("sleeps at night", () => {
    expect(isNight(new Date(2026, 9, 8, 23, 0))).toBe(true);
    expect(isNight(new Date(2026, 9, 8, 3, 0))).toBe(true);
    expect(isNight(new Date(2026, 9, 8, 14, 0))).toBe(false);
  });

  it("is hungry only for a meal that's late and not yet fed (PET-003)", () => {
    const meals = [
      { id: "b", label: "Breakfast", remind_at: "08:00:00", position: 0 },
      { id: "d", label: "Dinner", remind_at: "18:00:00", position: 1 },
      { id: "s", label: "Snack", remind_at: null, position: 2 },
    ];
    const day = "2026-10-08";
    expect(hungryMeal(meals, [], day, "07:30:00")).toBeNull();
    expect(hungryMeal(meals, [], day, "08:00:00")).toBe("Breakfast");
    const fedBreakfast = [{ kind: "meal", meal_id: "b", day }];
    expect(hungryMeal(meals, fedBreakfast, day, "12:00:00")).toBeNull();
    expect(hungryMeal(meals, fedBreakfast, day, "19:00:00")).toBe("Dinner");
    // Yesterday's breakfast doesn't count for today.
    expect(hungryMeal(meals, [{ kind: "meal", meal_id: "b", day: "2026-10-07" }], day, "09:00:00")).toBe("Breakfast");
  });

  it("says something with its name", () => {
    expect(petSays("Biscuit", "cat", "happy", seq(0))).toContain("Biscuit");
    expect(petSays("Rex", "dog", "hungry", seq(0), "Dinner")).toBe("Rex is waiting for dinner");
    expect(petSays("  ", "fish", "sleepy", seq(0))).toBe("Shh, your pet is fast asleep");
  });
});

function defaultWidgetItem(id: string, x: number, y: number) {
  return { id, kind: "widget", widget: defaultWidget("note"), x, y, w: 2, h: 2 };
}
