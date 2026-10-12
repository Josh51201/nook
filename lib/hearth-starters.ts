import type { IconName } from "../components/icon";
import { newItemId, type HearthItem, type HearthLayout, type LabelItem } from "./hearth-layout";
import { addPage } from "./hearth-pages";
import { HOME_PAGE } from "./home-hearth";
import type { TrinketKey } from "./trinkets";
import { defaultWidget, newReminderId, widgetTemplates, type WidgetConfig } from "./widgets";

// Starter layouts (CORE-096): a ready-made Hearth to begin from instead of a
// nearly blank page. Everything in one is an ordinary tile, widget or bit of
// text, so it can all be moved, changed or removed afterwards. Pure helpers,
// no React.

export type StarterId = "family" | "home" | "me" | "christmas";

export type Starter = {
  id: StarterId;
  name: string;
  description: string;
  icon: IconName;
  build: () => HearthItem[];
  // A look that comes with it, used only when it starts a fresh Hearth (it
  // would change every page otherwise).
  look?: Partial<Pick<HearthLayout, "ambience">>;
};

// Christmas colors from the tile palette: rose (deep cranberry) and sage (pine).
const CRANBERRY = "#efd9e4";
const PINE = "#dfe8d6";

const widget = (config: WidgetConfig, x: number, y: number, w: number, h: number, extra: Partial<HearthItem> = {}): HearthItem =>
  ({ id: newItemId("w"), kind: "widget", widget: config, x, y, w, h, ...extra }) as HearthItem;
const nook = (nookId: string, x: number, y: number, w = 2, h = 2, extra: Partial<HearthItem> = {}): HearthItem =>
  ({ id: newItemId("n"), kind: "nook", nookId, x, y, w, h, ...extra }) as HearthItem;
const trinket = (piece: TrinketKey, x: number, y: number, w: number, h: number): HearthItem =>
  ({ id: newItemId("t"), kind: "trinket", piece, x, y, w, h }) as HearthItem;
const text = (words: string, x: number, y: number, w: number, h: number, extra: Partial<LabelItem> = {}): HearthItem =>
  ({ id: newItemId("l"), kind: "label", text: words, size: "heading", align: "left", x, y, w, h, ...extra }) as HearthItem;

function greeting(message: string): WidgetConfig {
  const base = defaultWidget("greeting");
  return base.kind === "greeting" ? { ...base, settings: { ...base.settings, message } } : base;
}
function checklist(title: string, items: string[]): WidgetConfig {
  const base = defaultWidget("reminders");
  return base.kind === "reminders"
    ? { ...base, title, settings: { ...base.settings, items: items.map((words) => ({ id: newReminderId(), text: words, done: false })) } }
    : base;
}
const idea = (id: string) => widgetTemplates.find((t) => t.id === id)!.build();

export const starters: Starter[] = [
  {
    id: "family",
    name: "Family & gifts",
    description: "Wish lists, what's coming up, and the gifts you're getting. For keeping up with the people you love.",
    icon: "group",
    build: () => [
      widget(greeting("Welcome home"), 0, 0, 4, 1),
      widget(defaultWidget("gatherings"), 0, 1, 4, 2),
      nook("gift-nook", 0, 3),
      nook("gatherings", 2, 3),
      widget(defaultWidget("countdown"), 0, 5, 2, 2),
      widget(defaultWidget("tucks"), 2, 5, 2, 2),
      nook("potluck", 0, 7, 1, 1),
      nook("letterbox", 1, 7, 1, 1),
      nook("getaways", 2, 7, 1, 1),
      nook("recipes", 3, 7, 1, 1),
    ],
  },
  {
    id: "home",
    name: "Home & chores",
    description: "A to-do list, the chores coming due, and the bills that renew. For running the house.",
    icon: "door",
    build: () => [
      widget(greeting("Home sweet home"), 0, 0, 4, 1),
      widget(checklist("This week", ["Take out the trash", "Water the plants", "Change the sheets"]), 0, 1, 4, 3),
      widget(defaultWidget("rhythms"), 0, 4, 2, 2),
      nook("rhythms", 2, 4),
      widget(defaultWidget("subscriptions"), 0, 6, 2, 2),
      widget(defaultWidget("recipe"), 2, 6, 2, 2),
      nook("pets", 0, 8, 1, 1),
      nook("sitter", 1, 8, 1, 1),
      nook("sickday", 2, 8, 1, 1),
      nook("subscriptions", 3, 8, 1, 1),
    ],
  },
  {
    id: "me",
    name: "Just me",
    description: "A calm corner: the time, a little window, a kind word each day and a habit to keep.",
    icon: "heart",
    build: () => {
      const clock = defaultWidget("clock");
      const streak = defaultWidget("streak");
      const note = defaultWidget("note");
      return [
        widget(greeting("Make yourself at home"), 0, 0, 4, 1),
        widget(clock.kind === "clock" ? { ...clock, settings: { ...clock.settings, face: "analog" } } : clock, 0, 1, 2, 2),
        widget(defaultWidget("window"), 2, 1, 2, 2),
        widget(defaultWidget("quote"), 0, 3, 4, 2),
        widget(streak.kind === "streak" ? { ...streak, settings: { ...streak.settings, name: "Read a little" } } : streak, 0, 5, 2, 2),
        widget(note.kind === "note" ? { ...note, settings: { ...note.settings, text: "Today I want to…" } } : note, 2, 5, 2, 2),
        trinket("rug", 0, 7.3, 4, 1),
        trinket("cat", 1, 7, 2, 1),
      ];
    },
  },
  {
    id: "christmas",
    name: "Christmas",
    description: "Counting down to the 25th, wish lists, cards to send and who's coming. Gentle snow, too, on a fresh Hearth.",
    icon: "christmas",
    look: { ambience: "snow" },
    build: () => [
      widget(greeting("Merry Christmas!"), 0, 0, 4, 1, { color: PINE }),
      widget(idea("christmas-countdown"), 0, 1, 2, 2, { color: CRANBERRY }),
      nook("gift-nook", 2, 1, 2, 2, { color: PINE }),
      text("Gifts & get-togethers", 0, 3, 4, 0.5, { decor: "ribbon" }),
      widget(defaultWidget("tucks"), 0, 3.5, 2, 2, { color: PINE }),
      widget(defaultWidget("cards"), 2, 3.5, 2, 2, { color: CRANBERRY }),
      widget(defaultWidget("gatherings"), 0, 5.5, 4, 2),
      widget(idea("holiday-shopping"), 0, 7.5, 4, 3),
      nook("gatherings", 0, 10.5, 1, 1),
      nook("potluck", 1, 10.5, 1, 1),
      nook("letterbox", 2, 10.5, 1, 1),
      nook("recipes", 3, 10.5, 1, 1),
      trinket("candle", 0.3, 11.6, 1, 1),
      trinket("wreath", 1, 11.5, 2, 2),
      trinket("candle", 2.7, 11.6, 1, 1),
    ],
  },
];

export function starterInfo(id: StarterId) {
  return starters.find((s) => s.id === id)!;
}

// The page you're on is still how a new Hearth begins: nothing on it but the
// welcome (CORE-072), or nothing at all.
export function isFreshPage(layout: Pick<HearthLayout, "items" | "activePage">) {
  if (layout.activePage === HOME_PAGE) return false;
  return layout.items.length === 0 || (layout.items.length === 1 && layout.items[0].kind === "widget" && layout.items[0].widget.kind === "greeting");
}

// Start from a layout: on a fresh page it becomes that page (with its look);
// anywhere else, including the page shared with your Home, it comes in as a
// new page of its own, so nothing you've made is replaced. Null when there's
// no room for another page.
export function startFrom(layout: HearthLayout, id: StarterId): { changes: Partial<HearthLayout>; newPage: boolean } | null {
  const starter = starterInfo(id);
  const items = starter.build();
  if (isFreshPage(layout)) return { changes: { items, ...starter.look }, newPage: false };
  const page = addPage(layout, starter.name);
  if (!page) return null;
  return { changes: { ...page.changes, items }, newPage: true };
}
