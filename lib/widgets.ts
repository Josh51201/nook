import type { IconName } from "../components/icon";
import type { GatheringKind } from "./gift-nook";

// Hearth widgets (CORE-018): standalone, fully customizable cards on the
// Hearth. Pure data + defaults only (no React), so it's unit-testable. Each
// widget's renderer lives in components/hearth/widgets.tsx and its editor
// in app/widget/[id].tsx.

export type WidgetKind = "countdown" | "gatherings" | "reminders" | "tucks" | "note" | "inbox" | "greeting";

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
  { kind: "greeting", label: "Greeting", description: "A warm hello with the date and your own message.", icon: "wave", size: { w: 4, h: 1 }, minSize: { w: 1, h: 1 } },
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
