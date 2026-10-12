// The Kitchen timer widget (CORE-109): one or more named timers that ring
// on the phone. A timer is saved with the widget: running ones keep their
// end time, paused ones what was left, so it keeps time across the app
// closing. Pure (no React or phone alerts), so it's unit-testable; the
// alerts are in lib/timer-alerts.ts.

export type KitchenTimer = {
  id: string;
  name: string;
  // How long it's set for.
  seconds: number;
  // Running: when it's done (ISO).
  endsAt: string | null;
  // Paused: seconds that were left.
  left: number | null;
  // The phone alert scheduled for it, on the phone that started it.
  notificationId?: string;
};

export type TimerState = "idle" | "running" | "paused" | "done";

export const MAX_TIMERS = 4;
export const MAX_TIMER_SECONDS = 24 * 3600;

export const timerPresets: { name: string; minutes: number }[] = [
  { name: "Eggs", minutes: 7 },
  { name: "Tea", minutes: 4 },
  { name: "Pasta", minutes: 10 },
  { name: "Cookies", minutes: 12 },
  { name: "Pizza", minutes: 15 },
  { name: "Rice", minutes: 18 },
  { name: "Nap", minutes: 20 },
  { name: "Bread", minutes: 35 },
];

export function newTimer(name: string, seconds: number): KitchenTimer {
  return { id: `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, name, seconds: clampSeconds(seconds), endsAt: null, left: null };
}

export function clampSeconds(seconds: number) {
  return Math.min(MAX_TIMER_SECONDS, Math.max(1, Math.round(seconds)));
}

export function timerState(timer: KitchenTimer, now = Date.now()): TimerState {
  if (timer.endsAt) return Date.parse(timer.endsAt) <= now ? "done" : "running";
  return timer.left !== null ? "paused" : "idle";
}

// Whole seconds left, rounding up, so it never says 0:00 while still going.
export function timeLeft(timer: KitchenTimer, now = Date.now()) {
  if (timer.endsAt) return Math.max(0, Math.ceil((Date.parse(timer.endsAt) - now) / 1000));
  return timer.left ?? timer.seconds;
}

export function startTimer(timer: KitchenTimer, now = Date.now()): KitchenTimer {
  const seconds = timerState(timer, now) === "paused" ? (timer.left ?? timer.seconds) : timer.seconds;
  return { ...timer, endsAt: new Date(now + seconds * 1000).toISOString(), left: null };
}

export function pauseTimer(timer: KitchenTimer, now = Date.now()): KitchenTimer {
  if (timerState(timer, now) !== "running") return timer;
  return { ...timer, endsAt: null, left: timeLeft(timer, now) };
}

export function resetTimer(timer: KitchenTimer): KitchenTimer {
  return { ...timer, endsAt: null, left: null };
}

// Play, pause, or (once it's rung) set it back.
export function toggleTimer(timer: KitchenTimer, now = Date.now()): KitchenTimer {
  const state = timerState(timer, now);
  if (state === "running") return pauseTimer(timer, now);
  if (state === "done") return resetTimer(timer);
  return startTimer(timer, now);
}

// "4:05", "12:00", "1:05:00".
export function formatTimer(seconds: number) {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
}

// "12 min", "1 hr 5 min", "45 sec".
export function durationWords(seconds: number) {
  if (seconds < 60) return `${seconds} sec`;
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return [h ? `${h} hr` : null, m ? `${m} min` : null].filter(Boolean).join(" ");
}
