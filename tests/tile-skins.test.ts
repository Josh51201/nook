import { describe, expect, it } from "vitest";

import { tileMaterialOf, tileMaterials, tileTouchesSummary } from "../lib/tile-skins";
import { materialColors, readsWell } from "../lib/widget-skins";

// What a Nook tile can be made of, and its nameplate and porch light
// (CORE-137, 139).

describe("Nook tile materials", () => {
  it("are a few of the widgets' materials, never paper or tape-ish ones", () => {
    expect(tileMaterials.map((m) => m.key)).toEqual(["plain", "wood", "felt", "chalkboard", "linen", "glass", "tile"]);
    expect(tileMaterials.find((m) => m.key === "glass")!.label).toBe("Frosted glass");
  });

  it("treats anything a tile can't be made of as plain", () => {
    expect(tileMaterialOf(undefined)).toBe("plain");
    expect(tileMaterialOf("kraft")).toBe("plain");
    expect(tileMaterialOf("bogus")).toBe("plain");
    expect(tileMaterialOf("felt")).toBe("felt");
  });

  it("keep a tile's name readable in every material and color", () => {
    const tints = [undefined, "#f3c9b8", "#dfe8d6", "#f3e6b8", "#d6e4f0", "#efd9e4", "#2f3d36", "#ffffff"];
    for (const m of tileMaterials) {
      if (m.key === "plain") continue;
      for (const color of tints) expect(readsWell(materialColors(m.key, color)), `${m.key} ${color}`).toBe(true);
    }
  });

  it("sum up in a few words", () => {
    expect(tileTouchesSummary({})).toBe("");
    expect(tileTouchesSummary({ material: "wood", nameplate: true, porchLight: true })).toBe("Wood · Nameplate · Porch light");
    expect(tileTouchesSummary({ material: "plain", porchLight: true })).toBe("Porch light");
  });
});
