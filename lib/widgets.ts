import type { IconName } from "../components/icon";
import type { GatheringKind } from "./gift-nook";
import type { QuoteSource } from "./widget-extras";
import type { Condition, Place, Unit, WindowFrame } from "./weather";

// Hearth widgets (CORE-018): standalone, fully customizable cards on the
// Hearth. Pure data + defaults only (no React), so it's unit-testable. Each
// widget's renderer lives in components/hearth/widgets.tsx and its editor
// in app/widget/[id].tsx.

export type WidgetKind = "countdown" | "gatherings" | "reminders" | "tucks" | "note" | "inbox" | "greeting" | "cards" | "pets" | "rhythms" | "frame" | "clock" | "quote" | "launch" | "streak" | "weather" | "window";

// How a widget card is drawn: soft pastel, bold deep color, or just an outline.
export type WidgetLook = "soft" | "bold" | "outline";

export type ReminderSchedule =
  | { kind: "once"; at: string } // ISO date-time
  | { kind: "daily"; hour: number; minute: number }
  | { kind: "weekly"; weekday: number; hour: number; minute: number }; // weekday 1 = Sunday

export type Reminder = {
  id: string;
  text: string;
  done: boolean;
  schedule?: ReminderSchedule;
  // Phone notification id on the device that scheduled it.
  notificationId?: string;
};

// The frame around a Photo frame widget's pictures (CORE-046).
export type FrameStyle = "wood" | "gold" | "white" | "polaroid" | "none";

export const frameStyles: { key: FrameStyle; label: string }[] = [
  { key: "wood", label: "Wood" },
  { key: "gold", label: "Gold" },
  { key: "white", label: "White mat" },
  { key: "polaroid", label: "Polaroid" },
  { key: "none", label: "No frame" },
];

// How long each picture stays up, in seconds.
export const frameTimings = [
  { seconds: 6, label: "Quick" },
  { seconds: 12, label: "Relaxed" },
  { seconds: 30, label: "Slow" },
];

// At most this many pictures in one frame.
export const MAX_FRAME_PHOTOS = 8;

export type WidgetSettings = {
  countdown: {
    source: "next" | "gathering" | "custom";
    gatheringId?: string;
    customTitle: string;
    customDate?: string; // ISO
    display: "number" | "words";
  };
  gatherings: { burrowId: string | null; kinds: GatheringKind[]; count: number; showCountdown: boolean };
  reminders: { items: Reminder[]; hideDone: boolean };
  tucks: { include: "planning" | "open"; count: number };
  note: { text: string; textSize: "small" | "medium" | "large"; align: "left" | "center" };
  inbox: { count: number };
  greeting: { message: string; showName: boolean; showDate: boolean };
  cards: { count: number };
  pets: { count: number };
  rhythms: { count: number; mineOnly: boolean };
  frame: { photos: string[]; style: FrameStyle; seconds: number; caption: string };
  clock: { face: "digital" | "analog"; hour24: boolean; showDate: boolean };
  quote: { source: QuoteSource; mine: string[] };
  // Keys of where the buttons go (see launchTargets in lib/widget-extras.ts).
  launch: { targets: string[] };
  streak: { name: string; days: string[] };
  // Weather (CORE-056): a place you picked by name, never the phone's location.
  weather: { place: Place | null; unit: Unit; showForecast: boolean };
  // A window (CORE-057): live weather from a place, or a sky you chose.
  window: {
    source: "live" | "pick";
    place: Place | null;
    unit: Unit;
    condition: Condition;
    time: "auto" | "day" | "night";
    frame: WindowFrame;
    curtains: boolean;
    showTemp: boolean;
  };
};

export type WidgetConfig = {
  [K in WidgetKind]: {
    kind: K;
    title: string;
    showTitle: boolean;
    look: WidgetLook;
    settings: WidgetSettings[K];
  };
}[WidgetKind];

export type WidgetOf<K extends WidgetKind> = Extract<WidgetConfig, { kind: K }>;

type Size = { w: number; h: number };

export const widgetKinds: {
  kind: WidgetKind;
  label: string;
  description: string;
  icon: IconName;
  size: Size; // default, in Hearth grid cells (4 columns)
  minSize: Size;
}[] = [
  { kind: "countdown", label: "Countdown", description: "Days until your next Gathering, a specific one, or any date you like.", icon: "calendar", size: { w: 2, h: 2 }, minSize: { w: 1, h: 1 } },
  { kind: "gatherings", label: "Coming up", description: "Upcoming Gatherings, filtered by Burrow or kind.", icon: "celebration", size: { w: 4, h: 2 }, minSize: { w: 1, h: 1 } },
  { kind: "reminders", label: "Reminders", description: "A checklist with optional phone reminders — daily, weekly, or once.", icon: "todo", size: { w: 4, h: 3 }, minSize: { w: 1, h: 1 } },
  { kind: "tucks", label: "Gifts to buy", description: "Your shopping list from the gifts you've tucked away.", icon: "tucks", size: { w: 2, h: 2 }, minSize: { w: 1, h: 1 } },
  { kind: "note", label: "Sticky note", description: "Anything you want to see every day.", icon: "edit", size: { w: 2, h: 2 }, minSize: { w: 1, h: 1 } },
  { kind: "inbox", label: "Inbox", description: "Unread notices from your Nooks at a glance.", icon: "bell", size: { w: 2, h: 2 }, minSize: { w: 1, h: 1 } },
  { kind: "cards", label: "Card season", description: "Holiday cards left to send, from your Letterbox Nook.", icon: "mail", size: { w: 2, h: 2 }, minSize: { w: 1, h: 1 } },
  { kind: "pets", label: "Pet care", description: "Who still needs feeding today and what's due at the vet, from your Pet Care Nook.", icon: "paw", size: { w: 2, h: 2 }, minSize: { w: 1, h: 1 } },
  { kind: "rhythms", label: "Due soon", description: "Home chores overdue or coming up, from your Rhythms Nook.", icon: "rhythm", size: { w: 2, h: 2 }, minSize: { w: 1, h: 1 } },
  { kind: "frame", label: "Photo frame", description: "Your own pictures in a frame, one after another.", icon: "camera", size: { w: 2, h: 2 }, minSize: { w: 1, h: 1 } },
  { kind: "clock", label: "Clock", description: "The time and date, as a digital or an analog clock.", icon: "clock", size: { w: 2, h: 2 }, minSize: { w: 1, h: 1 } },
  { kind: "quote", label: "Quote of the day", description: "A warm line a day, from ours or from your own list.", icon: "sparkles", size: { w: 4, h: 2 }, minSize: { w: 1, h: 1 } },
  { kind: "launch", label: "Quick launch", description: "Buttons that jump straight to your Nooks and favorite places.", icon: "widgets", size: { w: 4, h: 2 }, minSize: { w: 1, h: 1 } },
  { kind: "streak", label: "Habit streak", description: "Tap each day you do something and watch the streak grow.", icon: "flame", size: { w: 2, h: 2 }, minSize: { w: 1, h: 1 } },
  { kind: "weather", label: "Weather", description: "The weather now and the next few days, for a town you pick.", icon: "cloud", size: { w: 2, h: 2 }, minSize: { w: 1, h: 1 } },
  { kind: "window", label: "Window", description: "A little window with the weather outside: live from a town, or a sky you choose.", icon: "sun", size: { w: 2, h: 2 }, minSize: { w: 1, h: 1 } },
  { kind: "greeting", label: "Greeting", description: "A warm hello with the date and your own message.", icon: "wave", size: { w: 4, h: 1 }, minSize: { w: 1, h: 1 } },
];

// How the "Add" sheet groups widgets so it isn't one long list (CORE-059).
// Every kind belongs to exactly one category (a test checks this).
export const widgetCategories: { id: string; label: string; blurb: string; icon: IconName; kinds: WidgetKind[] }[] = [
  { id: "nooks", label: "From your Nooks", blurb: "Live info from the Nooks you've added", icon: "widgets", kinds: ["gatherings", "tucks", "inbox", "cards", "pets", "rhythms"] },
  { id: "lists", label: "Lists & routines", blurb: "Things to remember, tick off and jump to", icon: "todo", kinds: ["reminders", "note", "streak", "launch"] },
  { id: "time", label: "Time & weather", blurb: "Dates, the clock and the sky", icon: "clock", kinds: ["countdown", "clock", "weather", "window"] },
  { id: "cozy", label: "Cozy touches", blurb: "Pictures, words and a warm hello", icon: "sparkles", kinds: ["frame", "quote", "greeting"] },
];

// Every widget can be any size, down to a single icon (CORE-030). Its
// insides are laid out for the shape it's been given, in pixels:
//   icon  — one cell (or a narrow column): an icon with a count
//   strip — one row tall: a single line
//   small — the classic 2×2
//   wide  — a short, wide card
//   tall  — a narrow, tall card
//   large — big in both directions
export type WidgetShape = "icon" | "strip" | "small" | "wide" | "tall" | "large";

export function widgetShape(width: number, height: number): WidgetShape {
  if (width < 120) return "icon";
  if (height < 120) return "strip";
  const wide = width >= 260;
  const tall = height >= 230;
  if (wide && tall) return "large";
  if (wide) return "wide";
  if (tall) return "tall";
  return "small";
}

export function widgetKindInfo(kind: WidgetKind) {
  return widgetKinds.find((k) => k.kind === kind)!;
}

export function defaultWidget(kind: WidgetKind): WidgetConfig {
  const title = widgetKindInfo(kind).label;
  const base = { title, showTitle: true, look: "soft" as WidgetLook };
  switch (kind) {
    case "countdown":
      return { ...base, kind, settings: { source: "next", customTitle: "", display: "number" } };
    case "gatherings":
      return { ...base, kind, settings: { burrowId: null, kinds: [], count: 3, showCountdown: true } };
    case "reminders":
      return { ...base, kind, settings: { items: [], hideDone: false } };
    case "tucks":
      return { ...base, kind, settings: { include: "planning", count: 3 } };
    case "note":
      return { ...base, kind, showTitle: false, settings: { text: "", textSize: "medium", align: "left" } };
    case "inbox":
      return { ...base, kind, settings: { count: 2 } };
    case "greeting":
      return { ...base, kind, showTitle: false, settings: { message: "", showName: true, showDate: true } };
    case "cards":
      return { ...base, kind, settings: { count: 3 } };
    case "pets":
      return { ...base, kind, settings: { count: 3 } };
    case "rhythms":
      return { ...base, kind, settings: { count: 3, mineOnly: false } };
    case "frame":
      return { ...base, kind, showTitle: false, settings: { photos: [], style: "wood", seconds: 12, caption: "" } };
    case "clock":
      return { ...base, kind, showTitle: false, settings: { face: "digital", hour24: false, showDate: true } };
    case "quote":
      return { ...base, kind, showTitle: false, settings: { source: "cozy", mine: [] } };
    case "launch":
      return { ...base, kind, settings: { targets: ["inbox", "market", "home"] } };
    case "streak":
      return { ...base, kind, settings: { name: "My habit", days: [] } };
    case "weather":
      return { ...base, kind, settings: { place: null, unit: "f", showForecast: true } };
    case "window":
      return {
        ...base,
        kind,
        showTitle: false,
        settings: { source: "pick", place: null, unit: "f", condition: "rain", time: "auto", frame: "wood", curtains: true, showTemp: false },
      };
  }
}

export function newReminderId() {
  return `r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

// Ready-made starting points shown in "Add to your Hearth" → Ideas.
export const widgetTemplates: { id: string; label: string; description: string; icon: IconName; build: () => WidgetConfig; size?: Size }[] = [
  {
    id: "food-log",
    label: "Food log reminders",
    description: "Nudges to log lunch and dinner every day.",
    icon: "food",
    build: () => ({
      ...defaultWidget("reminders"),
      kind: "reminders",
      title: "Log your food",
      settings: {
        hideDone: false,
        items: [
          { id: newReminderId(), text: "Log lunch", done: false, schedule: { kind: "daily", hour: 12, minute: 30 } },
          { id: newReminderId(), text: "Log dinner", done: false, schedule: { kind: "daily", hour: 18, minute: 30 } },
        ],
      },
    }),
  },
  {
    id: "holiday-shopping",
    label: "Holiday shopping list",
    description: "Wrapping, cards and the little things.",
    icon: "tucks",
    build: () => ({
      ...defaultWidget("reminders"),
      kind: "reminders",
      title: "Holiday shopping",
      settings: {
        hideDone: false,
        items: ["Wrapping paper", "Tape & bows", "Cards", "Stocking stuffers"].map((text) => ({
          id: newReminderId(),
          text,
          done: false,
        })),
      },
    }),
  },
  {
    id: "christmas-countdown",
    label: "Christmas countdown",
    description: "Days until December 25th.",
    icon: "christmas",
    build: () => {
      const now = new Date();
      const year = now > new Date(now.getFullYear(), 11, 25, 23, 59) ? now.getFullYear() + 1 : now.getFullYear();
      return {
        ...defaultWidget("countdown"),
        kind: "countdown",
        title: "Christmas",
        look: "bold",
        settings: {
          source: "custom",
          customTitle: "Christmas",
          customDate: new Date(year, 11, 25).toISOString(),
          display: "number",
        },
      };
    },
  },
  {
    id: "event-reminders",
    label: "Event reminders",
    description: "Weekly nudge to check what's coming up and who needs a gift.",
    icon: "bell",
    build: () => ({
      ...defaultWidget("reminders"),
      kind: "reminders",
      title: "Gift check-in",
      settings: {
        hideDone: false,
        items: [
          {
            id: newReminderId(),
            text: "Check upcoming Gatherings",
            done: false,
            schedule: { kind: "weekly", weekday: 1, hour: 18, minute: 0 },
          },
        ],
      },
    }),
  },
];

export function describeSchedule(schedule: ReminderSchedule | undefined) {
  if (!schedule) return null;
  const time = (hour: number, minute: number) =>
    new Date(2000, 0, 1, hour, minute).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (schedule.kind === "daily") return `Every day at ${time(schedule.hour, schedule.minute)}`;
  if (schedule.kind === "weekly") {
    const day = new Date(2000, 0, 1 + ((schedule.weekday - 1 - new Date(2000, 0, 1).getDay() + 7) % 7));
    return `Every ${day.toLocaleDateString(undefined, { weekday: "long" })} at ${time(schedule.hour, schedule.minute)}`;
  }
  const at = new Date(schedule.at);
  return at.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

// --- Countdown math (for a countdown's open page) ---------------------------------

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

// Whole calendar days from today to the day itself (negative once it's passed).
export function daysUntil(target: Date, now = new Date()) {
  return Math.round((startOfDay(target).getTime() - startOfDay(now).getTime()) / 86400000);
}

// Ticks down to the moment the big day begins.
export function timeUntil(target: Date, now = new Date()) {
  const ms = Math.max(0, startOfDay(target).getTime() - now.getTime());
  return {
    days: Math.floor(ms / 86400000),
    hours: Math.floor(ms / 3600000) % 24,
    minutes: Math.floor(ms / 60000) % 60,
    seconds: Math.floor(ms / 1000) % 60,
  };
}

// Saturdays still to come before the day (not counting today or the day).
export function weekendsUntil(target: Date, now = new Date()) {
  const days = daysUntil(target, now);
  let count = 0;
  for (let i = 1; i < Math.min(days, 3660); i++) {
    const day = startOfDay(now);
    day.setDate(day.getDate() + i);
    if (day.getDay() === 6) count++;
  }
  return count;
}

// "2 weeks and 3 days", "5 days", "3 weeks".
export function weeksAndDays(days: number) {
  const weeks = Math.floor(days / 7);
  const rest = days % 7;
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  if (!weeks) return plural(rest, "day");
  return rest ? `${plural(weeks, "week")} and ${plural(rest, "day")}` : plural(weeks, "week");
}

// --- Fitting lines into a tile ------------------------------------------------------

// How many lines, in order, fit in `space` points with `gap` between them.
// Used so tiles show as much as their size allows and never spill over.
export function fitCount(heights: number[], space: number, gap: number) {
  let used = 0;
  let count = 0;
  for (const height of heights) {
    const need = (count ? gap : 0) + height;
    if (used + need > space) break;
    used += need;
    count++;
  }
  return count;
}
