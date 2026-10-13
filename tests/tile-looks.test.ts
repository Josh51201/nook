import { describe, expect, it } from "vitest";

import { pickerColor, pickerGreys, pickerHues, pickerTiers } from "../lib/colors";
import { tileShapes } from "../lib/decor";
import { tilePalette } from "../lib/hearth-layout";
import { buildColors, buildReadsWell, doorwayOf, doorwaySummary, sharesOnlyColor, tileBuilds, wreathShows } from "../lib/tile-looks";

// Nook tile looks (CORE-137..140).

const everyColor = [...tilePalette, ...pickerGreys, ...pickerHues.flatMap((hue) => pickerTiers.map((_, tier) => pickerColor(hue, tier)))];

describe("what a Nook tile is built from", () => {
  it("keeps the Nook's name readable on every build in every color", () => {
    for (const { key } of tileBuilds) {
      if (key === "plain") continue;
      for (const color of everyColor) expect(buildReadsWell(buildColors(key, color)), `${key} in ${color}`).toBe(true);
    }
  });

  it("offers house materials and a few widget ones, but never paper", () => {
    const keys = tileBuilds.map((b) => b.key as string);
    for (const house of ["painted", "brick", "stone", "stainedglass", "tile"]) expect(keys).toContain(house);
    for (const borrowed of ["wood", "felt", "chalkboard"]) expect(keys).toContain(borrowed);
    for (const pinnedUp of ["paper", "kraft", "notebook", "index"]) expect(keys).not.toContain(pinnedUp);
  });

  it("has the new shapes", () => {
    const keys = tileShapes.map((s) => s.key as string);
    for (const shape of ["hobbit", "shutters", "shopfront", "mailbox", "drawer", "birdhouse"]) expect(keys).toContain(shape);
  });
});

describe("doorway touches", () => {
  it("start with nothing added, and the door opening", () => {
    expect(doorwayOf(undefined)).toEqual({ nameplate: false, porchLight: false, below: "none", wreath: "never", opens: true });
    expect(doorwaySummary(undefined)).toBe("Nothing added yet");
    expect(doorwaySummary({ nameplate: true, porchLight: true, below: "flowers", wreath: "december", opens: false })).toBe(
      "Nameplate · Porch light · Flower box · Wreath in December · Door stays shut"
    );
  });

  it("a December wreath only shows in December", () => {
    expect(wreathShows("december", new Date(2026, 11, 3))).toBe(true);
    expect(wreathShows("december", new Date(2026, 10, 30))).toBe(false);
    expect(wreathShows("always", new Date(2026, 5, 1))).toBe(true);
    expect(wreathShows("never", new Date(2026, 11, 25))).toBe(false);
    expect(wreathShows(undefined, new Date(2026, 11, 25))).toBe(false);
  });
});

it("a widget and a Nook tile only share their color", () => {
  expect(sharesOnlyColor("widget", "nook")).toBe(true);
  expect(sharesOnlyColor("nook", "widget")).toBe(true);
  expect(sharesOnlyColor("nook", "nook")).toBe(false);
});
