import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { timerState, type KitchenTimer } from "./kitchen-timer";
import { canRemind, cancelReminders, configureReminders } from "./reminders";
import type { WidgetConfig } from "./widgets";

// Phone alerts for Kitchen timers (CORE-109): a local notification at the
// moment each running timer is done, on the phone that started it (like
// Reminder widgets, CORE-018). Pausing, resetting or removing a timer
// takes its alert back.

let channelReady = false;

function timerChannel() {
  if (Platform.OS !== "android") return undefined;
  if (!channelReady) {
    channelReady = true;
    Notifications.setNotificationChannelAsync("timers", {
      name: "Kitchen timers",
      importance: Notifications.AndroidImportance.HIGH,
      sound: "default",
      vibrationPattern: [0, 400, 200, 400],
    }).catch(() => {});
  }
  return "timers";
}

async function cancel(notificationId: string | undefined) {
  if (!notificationId) return;
  await Notifications.cancelScheduledNotificationAsync(notificationId).catch(() => {});
}

// What this phone has scheduled for each timer. The saved alert id is only
// a fallback (after the app restarts), so quick taps (start, then pause
// straight away) never leave an alert behind that hadn't been saved yet.
const onPhone = new Map<string, { id: string; endsAt: string }>();
// One change at a time, in the order they were made.
let queue: Promise<unknown> = Promise.resolve();

function known(timer: KitchenTimer | undefined) {
  if (!timer) return undefined;
  const here = onPhone.get(timer.id);
  if (here) return here;
  return timer.notificationId && timer.endsAt ? { id: timer.notificationId, endsAt: timer.endsAt } : undefined;
}

// Brings the phone's alerts in line with the timers; returns them with
// alert ids filled in (or cleared).
export function syncTimerAlerts(next: KitchenTimer[], previous: KitchenTimer[]): Promise<KitchenTimer[]> {
  const run = async () => {
    configureReminders();
    const before = new Map(previous.map((t) => [t.id, t]));
    for (const old of previous) {
      if (next.some((t) => t.id === old.id)) continue;
      await cancel(known(old)?.id);
      onPhone.delete(old.id);
    }
    const now = Date.now();
    const wantsAny = next.some((t) => timerState(t, now) === "running");
    const allowed = wantsAny ? await canRemind() : true;
    const result: KitchenTimer[] = [];
    for (const timer of next) {
      const { notificationId: _saved, ...plain } = timer;
      const have = known(timer) ?? known(before.get(timer.id));
      const running = timerState(timer, now) === "running";
      if (running && have && have.endsAt === timer.endsAt) {
        onPhone.set(timer.id, have);
        result.push({ ...plain, notificationId: have.id });
        continue;
      }
      await cancel(have?.id);
      onPhone.delete(timer.id);
      if (!running || !allowed) {
        result.push(plain);
        continue;
      }
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: { title: `${timer.name || "Timer"} is done`, body: "Your kitchen timer just finished.", sound: true },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(timer.endsAt!), channelId: timerChannel() },
      }).catch(() => undefined);
      if (notificationId) onPhone.set(timer.id, { id: notificationId, endsAt: timer.endsAt! });
      result.push(notificationId ? { ...plain, notificationId } : plain);
    }
    return result;
  };
  const result = queue.then(run, run);
  queue = result.catch(() => {});
  return result;
}

export async function cancelTimerAlerts(timers: KitchenTimer[]) {
  for (const timer of timers) {
    await cancel(known(timer)?.id);
    onPhone.delete(timer.id);
  }
}

// The alert ids worked out for `synced`, put onto the newest saved timers
// (which may have changed again meanwhile): only where it's still the same
// run of the same timer.
export function withAlertIds(latest: KitchenTimer[], synced: KitchenTimer[]): KitchenTimer[] {
  return latest.map((timer) => {
    const match = synced.find((s) => s.id === timer.id && s.endsAt === timer.endsAt);
    if (!match) return timer;
    const { notificationId: _old, ...plain } = timer;
    return match.notificationId ? { ...plain, notificationId: match.notificationId } : plain;
  });
}

// A widget (or several) taken off the Hearth: its Reminder and Kitchen timer
// alerts come off the phone too.
export function cancelWidgetAlerts(widgets: WidgetConfig[]) {
  for (const widget of widgets) {
    if (widget.kind === "reminders") void cancelReminders(widget.settings.items);
    if (widget.kind === "timer") void cancelTimerAlerts(widget.settings.timers);
  }
}
