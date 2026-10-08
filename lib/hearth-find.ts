import { findNook } from "./nooks";
import { nookLabel, type HearthItem, type HearthLayout } from "./hearth-layout";
import { trinketInfo } from "./trinkets";
import { widgetKindInfo } from "./widgets";

// Find in Edit (CORE-063): look for a widget, Nook, Hollow, text or Trinket
// by name, on any page and inside any Hollow. Pure, no React.

export type FoundItem = {
  item: HearthItem;
  label: string;
  kindLabel: string;
  pageId: string;
  pageName: string;
  hollowId: string | null;
  hollowName: string | null;
};

export function itemName(item: HearthItem): string {
  if (item.kind === "widget") return item.widget.title?.trim() || widgetKindInfo(item.widget.kind).label;
  if (item.kind === "nook") return nookLabel(item);
  if (item.kind === "hollow") return item.name;
  if (item.kind === "trinket") return trinketInfo(item.piece).label;
  return item.text;
}

function kindName(item: HearthItem): string {
  if (item.kind === "widget") return widgetKindInfo(item.widget.kind).label;
  if (item.kind === "nook") return "Nook";
  if (item.kind === "hollow") return "Hollow";
  if (item.kind === "trinket") return "Trinket";
  return "Text";
}

// Everything whose name (or kind) contains what was typed, most direct
// matches first. An empty search finds nothing.
export function findItems(layout: HearthLayout, query: string, limit = 40): FoundItem[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  const found: (FoundItem & { rank: number })[] = [];

  const visit = (item: HearthItem, pageId: string, pageName: string, hollowId: string | null, hollowName: string | null) => {
    const label = itemName(item);
    const kindLabel = kindName(item);
    const nook = item.kind === "nook" ? findNook(item.nookId)?.title ?? "" : "";
    const names = [label, nook].map((n) => n.toLowerCase());
    const rank = names.some((n) => n.startsWith(needle)) ? 0 : names.some((n) => n.includes(needle)) ? 1 : kindLabel.toLowerCase().includes(needle) ? 2 : -1;
    if (rank >= 0) found.push({ item, label, kindLabel, pageId, pageName, hollowId, hollowName, rank });
  };

  const pages = layout.pages.map((page) => ({
    page,
    items: page.id === layout.activePage ? layout.items : layout.otherPages[page.id] ?? [],
  }));
  for (const { page, items } of pages) {
    for (const item of items) {
      visit(item, page.id, page.name, null, null);
      if (item.kind === "hollow") for (const inner of item.items) visit(inner, page.id, page.name, item.id, item.name);
    }
  }
  return found
    .sort((a, b) => a.rank - b.rank)
    .slice(0, limit)
    .map(({ rank: _rank, ...rest }) => rest);
}
