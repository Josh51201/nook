import * as Notifications from "expo-notifications";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";

import { guarded } from "./feedback";
import { displayName } from "./gift-nook";
import type { LittleLog, LogEntry } from "./little-log";
import { localDay } from "./pets";
import { canRemind, configureReminders } from "./reminders";
import { supabase } from "./supabase";

// Loads Little Log (LOG-001..010): your logs and the shared ones of people
// you live with (row level security decides which), with their entries.

export type LittleLogData = {
  logs: LittleLog[];
  // Every entry, newest first, by log.
  entries: Map<string, LogEntry[]>;
  // Names for owners and writers of shared logs.
  names: Map<string, string>;
  today: string;
};

const ENTRY_FIELDS = "id, log_id, logged_at, value, value2, note, written_by";

export async function loadLittleLogs(): Promise<LittleLogData> {
  const [logsResult, entriesResult] = await Promise.all([
    supabase.from("little_logs").select("*").order("created_at"),
    supabase.from("little_log_entries").select(ENTRY_FIELDS).order("logged_at", { ascending: false }).limit(5000),
  ]);
  if (logsResult.error) throw logsResult.error;
  if (entriesResult.error) throw entriesResult.error;

  const logs = (logsResult.data ?? []) as LittleLog[];
  const entries = new Map<string, LogEntry[]>(logs.map((log) => [log.id, []]));
  for (const row of (entriesResult.data ?? []) as LogEntry[]) {
    entries.get(row.log_id)?.push({ ...row, value: num(row.value), value2: num(row.value2) });
  }

  const ids = new Set<string>();
  for (const log of logs) if (log.shared) ids.add(log.owner_id);
  for (const list of entries.values()) for (const e of list) if (e.written_by) ids.add(e.written_by);
  const names = new Map<string, string>();
  if (ids.size) {
    const { data } = await supabase.from("profiles").select("id, display_name").in("id", [...ids]);
    for (const p of (data ?? []) as { id: string; display_name: string | null }[]) names.set(p.id, displayName(p));
  }
  return { logs, entries, names, today: localDay() };
}

// Postgres numerics can arrive as strings.
const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

// Little Log for a screen, fresh each time it comes into view.
export function useLittleLogs(userId: string | undefined) {
  const [data, setData] = useState<LittleLogData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const reload = useCallback(
    () =>
      userId
        ? guarded(
            async () => {
              const next = await loadLittleLogs();
              setData(next);
              setError(null);
              syncLogReminders(next.logs, userId);
            },
            setError,
            () => setIsLoading(false)
          )
        : Promise.resolve(),
    [userId]
  );

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  return { data, error, isLoading, reload };
}

// For the Hearth (LOG-007): the same, reloaded when the Hearth refreshes.
export function useLittleLogSummary(userId: string | undefined, refreshKey: number) {
  const [data, setData] = useState<LittleLogData | null>(null);
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    loadLittleLogs()
      .then((next) => {
        if (!cancelled) setData(next);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [userId, refreshKey]);
  return data;
}

// "You" for yourself, otherwise their name.
export function whoName(data: Pick<LittleLogData, "names">, id: string | null, userId: string | undefined) {
  if (!id) return "Someone";
  return id === userId ? "You" : data.names.get(id) ?? "Someone";
}

// --- Daily reminder (LOG-009) -----------------------------------------------------------

// A log's reminder rings on its owner's phone only. Scheduled here (and
// again whenever the Nook opens, so another phone of theirs catches up).
const reminderId = (logId: string) => `little-log-${logId}`;

export async function syncLogReminder(log: Pick<LittleLog, "id" | "name" | "remind_at" | "owner_id">, userId: string | undefined) {
  await Notifications.cancelScheduledNotificationAsync(reminderId(log.id)).catch(() => {});
  if (!log.remind_at || log.owner_id !== userId) return;
  configureReminders();
  if (!(await canRemind())) return;
  const [hour, minute] = log.remind_at.split(":").map(Number);
  await Notifications.scheduleNotificationAsync({
    identifier: reminderId(log.id),
    content: { title: `Time to log: ${log.name}`, body: "Open Little Log to add today's." },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
      channelId: Platform.OS === "android" ? "reminders" : undefined,
    },
  }).catch(() => undefined);
}

async function syncLogReminders(logs: LittleLog[], userId: string) {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync().catch(() => []);
  const have = new Set(scheduled.map((n) => n.identifier));
  for (const log of logs) {
    if (log.owner_id !== userId) continue;
    // Only schedule what's missing; changes go through syncLogReminder.
    if (log.remind_at && !have.has(reminderId(log.id))) await syncLogReminder(log, userId);
  }
  // Reminders for logs that are gone.
  const ids = new Set(logs.map((l) => reminderId(l.id)));
  for (const id of have) {
    if (id.startsWith("little-log-") && !ids.has(id)) await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
  }
}

export async function cancelLogReminder(logId: string) {
  await Notifications.cancelScheduledNotificationAsync(reminderId(logId)).catch(() => {});
}
