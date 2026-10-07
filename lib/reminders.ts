import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import type { Reminder } from "./widgets";

// Phone reminders for Hearth Reminder widgets (CORE-018). These are *local*
// notifications scheduled on this phone — they work in Expo Go, unlike push
// notifications from a server (GIFT-031, later). A reminder set on one phone
// doesn't ring on another until it's saved again there.

let configured = false;

// Show reminders even while Nook is open.
export function configureReminders() {
  if (configured) return;
  configured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === "android") {
    Notifications.setNotificationChannelAsync("reminders", {
      name: "Reminders",
      importance: Notifications.AndroidImportance.DEFAULT,
    }).catch(() => {});
  }
}

export async function canRemind() {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

async function cancel(notificationId: string | undefined) {
  if (!notificationId) return;
  await Notifications.cancelScheduledNotificationAsync(notificationId).catch(() => {});
}

function trigger(reminder: Reminder): Notifications.SchedulableNotificationTriggerInput | null {
  const schedule = reminder.schedule;
  const channelId = Platform.OS === "android" ? "reminders" : undefined;
  if (!schedule) return null;
  if (schedule.kind === "daily") {
    return { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: schedule.hour, minute: schedule.minute, channelId };
  }
  if (schedule.kind === "weekly") {
    return {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: schedule.weekday,
      hour: schedule.hour,
      minute: schedule.minute,
      channelId,
    };
  }
  const at = new Date(schedule.at);
  if (at.getTime() <= Date.now()) return null;
  return { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId };
}

// Bring the phone's scheduled reminders in line with a widget's list:
// cancel what changed or went away, schedule what's new. Done reminders
// don't ring. Returns the list with notification ids filled in.
export async function syncReminders(widgetTitle: string, next: Reminder[], previous: Reminder[]): Promise<Reminder[]> {
  configureReminders();
  const before = new Map(previous.map((r) => [r.id, r]));
  const wantsAny = next.some((r) => r.schedule && !r.done);
  const allowed = wantsAny ? await canRemind() : true;

  for (const old of previous) {
    if (!next.some((r) => r.id === old.id)) await cancel(old.notificationId);
  }

  const result: Reminder[] = [];
  for (const reminder of next) {
    const old = before.get(reminder.id);
    const unchanged =
      old &&
      old.notificationId &&
      old.text === reminder.text &&
      old.done === reminder.done &&
      JSON.stringify(old.schedule) === JSON.stringify(reminder.schedule);
    if (unchanged) {
      result.push({ ...reminder, notificationId: old!.notificationId });
      continue;
    }
    await cancel(old?.notificationId);
    const when = !reminder.done && allowed ? trigger(reminder) : null;
    if (!when) {
      result.push({ ...reminder, notificationId: undefined });
      continue;
    }
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: { title: widgetTitle || "Reminder", body: reminder.text },
      trigger: when,
    }).catch(() => undefined);
    result.push({ ...reminder, notificationId });
  }
  return result;
}

// When a whole widget is removed.
export async function cancelReminders(reminders: Reminder[]) {
  for (const reminder of reminders) await cancel(reminder.notificationId);
}
