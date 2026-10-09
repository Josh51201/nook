import type { CustomTheme } from "./custom-theme";
import { MAX_CUSTOM_THEMES, newThemeId, normalizeCustomTheme } from "./custom-theme";
import type { Ambience, Wallpaper } from "./decor";
import { builtInThemes, migrateLayout, type HearthItem, type HearthLayout, type HearthPage } from "./hearth-layout";
import type { SceneSnapshot } from "./hearth-scenes";
import type { WidgetConfig } from "./widgets";

// Share a look (CORE-055): send your theme, or your whole Hearth, to family
// as a short code; they copy it and make it their own. Pure helpers, no
// React or database; the sheet is components/hearth/share-sheet.tsx and the
// codes live in public.shared_looks.
//
// What's shared is how things look and where they are, never what's
// private: checklists, habit days, your photos (they're in your own private
// folder anyway) and your pets stay behind. Widgets only carry their
// settings, and each loads its contents for whoever is looking, so a
// "Gifts to buy" widget shows the new owner their own list (GIFT-007).

export type LookKind = "theme" | "hearth";

export type SharedTheme = {
  // A built-in theme's key, or a custom theme's colors.
  theme: string;
  custom?: Omit<CustomTheme, "id">;
  wallpaper: Wallpaper;
  ambience: Ambience;
};

export type SharedHearth = SharedTheme & {
  pages: HearthPage[];
  activePage: string;
  otherPages: Record<string, HearthItem[]>;
  items: HearthItem[];
};

export type SharedLook = SharedTheme | SharedHearth;

// Codes are 6 letters and numbers with no look-alikes (no 0/O/1/I/L).
export const CODE_LENGTH = 6;

export function cleanCode(typed: string) {
  return typed
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, CODE_LENGTH);
}

export function isFullCode(code: string) {
  return /^[A-HJ-KM-NP-Z2-9]{6}$/.test(code);
}

// --- Packing a look up ------------------------------------------------------------

function themeOf(layout: HearthLayout): SharedTheme {
  const custom = layout.customThemes.find((t) => t.id === layout.theme);
  return {
    theme: custom ? "custom" : layout.theme,
    custom: custom ? { name: custom.name, dark: custom.dark, background: custom.background, accent: custom.accent } : undefined,
    // Your own photo stays yours.
    wallpaper: layout.wallpaper.kind === "photo" ? { kind: "none" } : layout.wallpaper,
    ambience: layout.ambience,
  };
}

export function packLook(layout: HearthLayout, kind: LookKind): SharedLook {
  const theme = themeOf(layout);
  if (kind === "theme") return theme;
  const otherPages: Record<string, HearthItem[]> = {};
  for (const [id, items] of Object.entries(layout.otherPages)) otherPages[id] = items.map(shareable);
  return { ...theme, pages: layout.pages, activePage: layout.activePage, otherPages, items: layout.items.map(shareable) };
}

// One thing on the Hearth, with anything private left behind.
export function shareable(item: HearthItem): HearthItem {
  if (item.kind === "hollow") {
    return {
      ...item,
      wallpaper: item.wallpaper?.kind === "photo" ? undefined : item.wallpaper,
      items: item.items.map(shareable),
    };
  }
  if (item.kind !== "widget") return item;
  return { ...item, widget: shareableWidget(item.widget) };
}

function shareableWidget(widget: WidgetConfig): WidgetConfig {
  switch (widget.kind) {
    case "reminders":
      return { ...widget, settings: { ...widget.settings, items: [] } };
    case "streak":
      return { ...widget, settings: { ...widget.settings, days: [] } };
    case "frame":
      return { ...widget, settings: { ...widget.settings, photos: [] } };
    case "companion":
      // A pet from Pet Care belongs to your Home; a made-up one comes along.
      return { ...widget, settings: { ...widget.settings, petId: null, photo: false } };
    case "fridge":
      return { ...widget, settings: { place: "home", burrowId: null } };
    case "recipe":
      // Shelves are named in your own Recipe Box.
      return { ...widget, settings: { shelf: null } };
    default:
      return widget;
  }
}

// --- Describing one -------------------------------------------------------------------

function countThings(items: HearthItem[]): number {
  return items.reduce((sum, item) => sum + 1 + (item.kind === "hollow" ? countThings(item.items) : 0), 0);
}

export function isHearthLook(look: SharedLook): look is SharedHearth {
  return Array.isArray((look as SharedHearth).pages) && Array.isArray((look as SharedHearth).items);
}

export function lookSummary(look: SharedLook): string {
  const theme = look.custom?.name ?? themeName(look.theme);
  if (!isHearthLook(look)) return `The ${theme} theme, with its wallpaper and ambience`;
  const things = countThings([...look.items, ...Object.values(look.otherPages).flat()]);
  const pages = look.pages.length;
  return `${pages} page${pages === 1 ? "" : "s"}, ${things} thing${things === 1 ? "" : "s"} on them, in the ${theme} theme`;
}

function themeName(key: string) {
  return { hearth: "Hearth", ember: "Ember", sage: "Sage", dusk: "Dusk" }[key] ?? "Hearth";
}

// --- Using one ------------------------------------------------------------------------

// The theme to switch to, and your custom themes after adding theirs (a
// theme you already have with the same colors is reused). Null if it's a
// custom theme and you already have as many as you can.
export function receiveTheme(
  look: SharedTheme,
  mine: CustomTheme[],
  fromName: string
): { theme: string; customThemes: CustomTheme[] } | null {
  if (!look.custom) {
    const known = (builtInThemes as readonly string[]).includes(look.theme);
    return { theme: known ? look.theme : "hearth", customThemes: mine };
  }
  const wanted = normalizeCustomTheme({ id: "", ...look.custom });
  const same = mine.find(
    (t) => t.dark === wanted.dark && t.background.toLowerCase() === wanted.background.toLowerCase() && t.accent.toLowerCase() === wanted.accent.toLowerCase()
  );
  if (same) return { theme: same.id, customThemes: mine };
  if (mine.length >= MAX_CUSTOM_THEMES) return null;
  const taken = new Set(mine.map((t) => t.name));
  const name = taken.has(wanted.name) ? `${wanted.name} (${fromName})`.slice(0, 30) : wanted.name;
  const added = { ...wanted, id: newThemeId(), name };
  return { theme: added.id, customThemes: [...mine, added] };
}

// What a shared whole Hearth becomes in your Scenes, tidied the same way a
// Hearth saved on this phone is.
export function lookAsSnapshot(look: SharedHearth, theme: string): SceneSnapshot {
  const tidy = migrateLayout({
    pages: look.pages,
    activePage: look.activePage,
    otherPages: look.otherPages,
    items: look.items,
  });
  return {
    theme,
    wallpaper: look.wallpaper?.kind === "photo" ? { kind: "none" } : look.wallpaper ?? { kind: "none" },
    ambience: look.ambience ?? "off",
    pages: tidy.pages,
    activePage: tidy.activePage,
    otherPages: tidy.otherPages,
    items: tidy.items,
  };
}

export function sceneNameFor(fromName: string) {
  return `${fromName.trim().split(" ")[0] || "Family"}'s Hearth`.slice(0, 20);
}
