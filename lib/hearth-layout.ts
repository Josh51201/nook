import { findNook } from "./nooks";

// Pure Hearth layout logic (no React/Supabase, so it's unit-testable). The
// Hearth's layout (CORE-002/003/006-009), saved in nook_settings under
// nook = 'hearth'. Each added Nook is one tile in one section; removing the
// tile takes the Nook off the Hearth but keeps its data (re-adding it from
// the Market brings everything back).

export type TileSize = "small" | "wide" | "large";

export type HearthTile = {
  nookId: string;
  size: TileSize;
  color?: string; // falls back to the Nook's own color
  label?: string; // custom name; falls back to the Nook's title
};

export type HearthSection = { id: string; title: string; tiles: HearthTile[] };

export type HearthLayout = {
  title: string;
  theme: HearthThemeKey;
  sections: HearthSection[];
};

export const tileSizes: { key: TileSize; label: string }[] = [
  { key: "small", label: "Small" },
  { key: "wide", label: "Wide" },
  { key: "large", label: "Large" },
];

// Soft tile colors that all work with dark text.
export const tilePalette = [
  "#f5ece3", // cream
  "#f6d9c4", // peach
  "#f3e6b8", // honey
  "#dfe8d6", // sage
  "#d9e4ef", // sky
  "#e9e1f2", // lavender
  "#efd9e4", // rose
];

export type HearthThemeKey = "hearth" | "ember" | "sage" | "dusk";

export const hearthThemes: Record<
  HearthThemeKey,
  { label: string; background: string; text: string; muted: string; accent: string }
> = {
  hearth: { label: "Hearth", background: "#ffffff", text: "#222222", muted: "#777777", accent: "#8a5a3b" },
  ember: { label: "Ember", background: "#fbefe4", text: "#3a2418", muted: "#8a6a58", accent: "#b0552d" },
  sage: { label: "Sage", background: "#eef3ea", text: "#23301f", muted: "#6b7a64", accent: "#4f6b45" },
  dusk: { label: "Dusk", background: "#2a2330", text: "#f4ece6", muted: "#b9adb4", accent: "#f0b98d" },
};

export const defaultHearthLayout: HearthLayout = {
  title: "The Hearth",
  theme: "hearth",
  sections: [{ id: "main", title: "My Nooks", tiles: [] }],
};

export function newSectionId() {
  return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function hasNook(layout: HearthLayout, nookId: string) {
  return layout.sections.some((section) => section.tiles.some((tile) => tile.nookId === nookId));
}

export function addNook(layout: HearthLayout, nookId: string): HearthSection[] {
  if (hasNook(layout, nookId)) return layout.sections;
  const [first, ...rest] = layout.sections;
  const tile: HearthTile = { nookId, size: "small" };
  return first ? [{ ...first, tiles: [...first.tiles, tile] }, ...rest] : [{ id: newSectionId(), title: "My Nooks", tiles: [tile] }];
}

export function removeNook(layout: HearthLayout, nookId: string): HearthSection[] {
  return layout.sections.map((section) => ({
    ...section,
    tiles: section.tiles.filter((tile) => tile.nookId !== nookId),
  }));
}

export function updateTile(layout: HearthLayout, nookId: string, changes: Partial<HearthTile>) {
  return layout.sections.map((section) => ({
    ...section,
    tiles: section.tiles.map((tile) => (tile.nookId === nookId ? { ...tile, ...changes } : tile)),
  }));
}

// Move a tile to `index` within `sectionId` (index counts tiles other than
// the one being moved).
export function moveTile(layout: HearthLayout, nookId: string, sectionId: string, index: number) {
  const tile = layout.sections.flatMap((s) => s.tiles).find((t) => t.nookId === nookId);
  if (!tile) return layout.sections;
  return layout.sections.map((section) => {
    const tiles = section.tiles.filter((t) => t.nookId !== nookId);
    if (section.id === sectionId) tiles.splice(Math.min(index, tiles.length), 0, tile);
    return { ...section, tiles };
  });
}

export function tileLabel(tile: HearthTile) {
  return tile.label?.trim() || findNook(tile.nookId)?.title || "Nook";
}

export function tileColor(tile: HearthTile) {
  return tile.color ?? findNook(tile.nookId)?.color ?? tilePalette[0];
}
