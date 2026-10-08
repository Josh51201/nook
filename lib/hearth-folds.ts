import { rowsUsed, type HearthItem, type LabelItem } from "./hearth-layout";

// Section dividers (CORE-064): a full-width text label marked as a divider
// can be folded shut, hiding everything under it down to the next divider
// (or the end), and the rest of the Hearth slides up to fill the space.
// Folding is just how the Hearth is drawn: nothing moves in what's saved.

export function isDivider(item: HearthItem): item is LabelItem & { divider: true } {
  return item.kind === "label" && Boolean(item.divider);
}

type Band = { divider: string; start: number; end: number };

function bandsOf(items: HearthItem[], folded: string[]): Band[] {
  const dividers = items.filter(isDivider).sort((a, b) => a.y - b.y);
  const bands: Band[] = [];
  dividers.forEach((divider, index) => {
    if (!folded.includes(divider.id)) return;
    const start = divider.y + divider.h;
    const end = dividers[index + 1]?.y ?? rowsUsed(items);
    if (end > start) bands.push({ divider: divider.id, start, end });
  });
  return bands;
}

// What to draw: items under a folded divider are left out, and everything
// below them moves up by the rows that folded away.
export function foldItems(items: HearthItem[], folded: string[]): HearthItem[] {
  if (!folded.length) return items;
  const bands = bandsOf(items, folded);
  if (!bands.length) return items;
  return items
    .filter((item) => !bands.some((band) => item.y >= band.start && item.y < band.end))
    .map((item) => {
      const shift = bands.filter((band) => band.end <= item.y).reduce((sum, band) => sum + (band.end - band.start), 0);
      return shift ? ({ ...item, y: item.y - shift } as HearthItem) : item;
    });
}

// How many things a divider would hide when folded.
export function hiddenBy(items: HearthItem[], dividerId: string): number {
  const band = bandsOf(items, [dividerId])[0];
  return band ? items.filter((item) => item.y >= band.start && item.y < band.end).length : 0;
}
