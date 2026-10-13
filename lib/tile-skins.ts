import { materials, type Material } from "./widget-skins";

// What a Nook tile can be made of, and its doorway touches (CORE-137, 139).
// Pure data and helpers (no React), so they're unit-testable. Drawn by
// components/hearth/tile-face.tsx with the widgets' own material drawings.
//
// Nook tiles borrow a few of the widgets' materials, the ones that suit a
// part of the house: wood, felt, chalkboard, linen, frosted glass and
// ceramic tile. Never paper, tape or a tilt, so a tile still reads as a way
// in rather than something pinned up. They keep their own shapes.

export type TileMaterial = Extract<Material, "plain" | "wood" | "felt" | "chalkboard" | "linen" | "glass" | "tile">;

const TILE_MATERIALS: TileMaterial[] = ["plain", "wood", "felt", "chalkboard", "linen", "glass", "tile"];

export const tileMaterials: { key: TileMaterial; label: string }[] = TILE_MATERIALS.map((key) => ({
  key,
  label: materials.find((m) => m.key === key)!.label,
}));

// What it's made of; anything a tile can't be made of (an old or pasted
// value) is plain.
export function tileMaterialOf(material: string | undefined): TileMaterial {
  return TILE_MATERIALS.includes(material as TileMaterial) ? (material as TileMaterial) : "plain";
}

// "Wood · Nameplate · Porch light", for the closed section (CORE-074).
export function tileTouchesSummary(item: { material?: string; nameplate?: boolean; porchLight?: boolean }) {
  const words: string[] = [];
  const material = tileMaterialOf(item.material);
  if (material !== "plain") words.push(tileMaterials.find((m) => m.key === material)!.label);
  if (item.nameplate) words.push("Nameplate");
  if (item.porchLight) words.push("Porch light");
  return words.join(" · ");
}
