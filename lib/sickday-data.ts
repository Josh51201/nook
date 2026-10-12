import { useFocusEffect } from "expo-router";
import * as Notifications from "expo-notifications";
import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";

import { guarded } from "./feedback";
import { displayName } from "./gift-nook";
import { localDay } from "./pets";
import { canRemind, configureReminders } from "./reminders";
import {
  doseTimers,
  latestTemp,
  ruleOf,
  sickHelperActive,
  spellTitle,
  type Dose,
  type DoseTimer,
  type Helper,
  type LogEntry,
  type Medicine,
  type Spell,
} from "./sickday";
import { supabase } from "./supabase";
import { useHearthData } from "./hearth-data";

// Loads the Sick Day Nook (SICK-001..014): your Home's sick spells and
// medicine cabinet, plus any spell you're helping with. Row level security
// means nothing else comes back.

export type Person = { id: string; name: string; isKid: boolean };

export type SickDayData = {
  homeId: string;
  // Everything you can see, newest first: your Home's, and ones you help with.
  spells: Spell[];
  // The cabinet: your Home's, plus the Home of any spell you're helping with.
  medicines: Medicine[];
  helpers: Helper[];
  // Doses in the last 3 days, for the timers (the database has the final say).
  recentDoses: Dose[];
  // Everything logged for spells still going, for the latest temperature.
  openLog: LogEntry[];
  // Who can be sick here: the Home's people and kids, you first.
  homePeople: Person[];
  names: Map<string, Person>;
  allergies: Map<string, string[]>;
  today: string;
};

export async function loadSickDay(userId: string): Promise<SickDayData> {
  const { data: homeId, error: homeError } = await supabase.rpc("my_home");
  if (homeError) throw homeError;

  const since = new Date(Date.now() - 3 * 864e5).toISOString();
  const [spellsResult, medicinesResult, helpersResult, dosesResult, peopleResult, membersResult] = await Promise.all([
    supabase.from("sick_spells").select("*").order("started_on", { ascending: false }).limit(500),
    supabase.from("sick_medicines").select("*").order("name"),
    supabase.from("sick_helpers").select("spell_id, profile_id, until, added_by"),
    supabase.from("sick_doses").select("*").gte("given_at", since).order("given_at", { ascending: false }).limit(1000),
    supabase.rpc("sick_people"),
    supabase.from("home_members").select("profile_id").eq("home_id", homeId),
  ]);
  if (spellsResult.error) throw spellsResult.error;
  if (medicinesResult.error) throw medicinesResult.error;

  const spells = (spellsResult.data ?? []) as Spell[];
  const openIds = spells.filter((s) => !s.ended_on).map((s) => s.id);
  const { data: log } = openIds.length
    ? await supabase.from("sick_log").select("*").in("spell_id", openIds).order("logged_at", { ascending: false }).limit(2000)
    : { data: [] };

  const names = new Map<string, Person>();
  for (const p of (peopleResult.data ?? []) as { id: string; display_name: string | null; is_kid: boolean }[]) {
    names.set(p.id, { id: p.id, name: displayName(p), isKid: p.is_kid });
  }
  const memberIds = new Set(((membersResult.data ?? []) as { profile_id: string }[]).map((m) => m.profile_id));
  memberIds.add(userId);
  const { data: kids } = await supabase.rpc("home_kids");
  const kidIds = new Set(((kids ?? []) as { id: string }[]).map((k) => k.id));
  const homePeople = [...memberIds, ...kidIds]
    .map((id) => names.get(id) ?? { id, name: "Someone", isKid: kidIds.has(id) })
    .sort((a, b) => (a.id === userId ? -1 : b.id === userId ? 1 : Number(b.isKid) - Number(a.isKid) || a.name.localeCompare(b.name)));

  const patientIds = [...new Set([...homePeople.map((p) => p.id), ...spells.map((s) => s.patient_id)])];
  const { data: needs } = patientIds.length
    ? await supabase.from("dietary_needs").select("profile_id, allergies").in("profile_id", patientIds)
    : { data: [] };

  return {
    homeId,
    spells,
    medicines: (medicinesResult.data ?? []).map((m) => ({ ...m, every_hours: m.every_hours == null ? null : Number(m.every_hours) })) as Medicine[],
    helpers: (helpersResult.data ?? []) as Helper[],
    recentDoses: (dosesResult.data ?? []).map(numberDose),
    openLog: ((log ?? []) as LogEntry[]).map(numberLog),
    homePeople,
    names,
    allergies: new Map(((needs ?? []) as { profile_id: string; allergies: string[] | null }[]).map((n) => [n.profile_id, n.allergies ?? []])),
    today: localDay(),
  };
}

// numeric columns come back as strings.
function numberDose(d: Record<string, unknown>): Dose {
  return { ...(d as Dose), every_hours: d.every_hours == null ? null : Number(d.every_hours) };
}

function numberLog(e: LogEntry): LogEntry {
  return { ...e, temp_c: e.temp_c == null ? null : Number(e.temp_c) };
}

function useLoader<T>(load: () => Promise<T>, enabled: boolean, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const reload = useCallback(
    () =>
      enabled
        ? guarded(
            async () => {
              setData(await load());
              setError(null);
            },
            setError,
            () => setIsLoading(false)
          )
        : Promise.resolve(),
    deps
  );

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  return { data, error, isLoading, reload };
}

// The Nook for a screen, fresh each time it comes into view.
export function useSickDay(userId: string | undefined) {
  return useLoader(() => loadSickDay(userId!), !!userId, [userId]);
}

// --- One sick spell ----------------------------------------------------------------------------

export type SpellData = {
  log: LogEntry[];
  // This spell's doses, newest first.
  doses: Dose[];
  // Everything this person has had in the Home lately, so the timers count
  // a dose from a spell that just ended.
  personDoses: Dose[];
};

export async function loadSpell(spell: Pick<Spell, "id" | "patient_id">, others: Pick<Spell, "id" | "patient_id">[]): Promise<SpellData> {
  const sameperson = others.filter((s) => s.patient_id === spell.patient_id).map((s) => s.id);
  const since = new Date(Date.now() - 3 * 864e5).toISOString();
  const [logResult, dosesResult, personResult] = await Promise.all([
    supabase.from("sick_log").select("*").eq("spell_id", spell.id).order("logged_at", { ascending: false }).limit(2000),
    supabase.from("sick_doses").select("*").eq("spell_id", spell.id).order("given_at", { ascending: false }).limit(2000),
    supabase.from("sick_doses").select("*").in("spell_id", sameperson.length ? sameperson : [spell.id]).gte("given_at", since),
  ]);
  if (logResult.error) throw logResult.error;
  if (dosesResult.error) throw dosesResult.error;
  return {
    log: ((logResult.data ?? []) as LogEntry[]).map(numberLog),
    doses: (dosesResult.data ?? []).map(numberDose),
    personDoses: (personResult.data ?? []).map(numberDose),
  };
}

export function useSpell(spell: Pick<Spell, "id" | "patient_id"> | undefined, others: Pick<Spell, "id" | "patient_id">[]) {
  const key = spell ? `${spell.id}:${others.length}` : null;
  return useLoader(() => loadSpell(spell!, others), !!spell, [key]);
}

// --- Names ----------------------------------------------------------------------------------

export function personName(data: Pick<SickDayData, "names">, id: string | null | undefined, userId?: string) {
  if (!id) return "Someone";
  if (id === userId) return "You";
  return data.names.get(id)?.name ?? "Someone";
}

export function firstName(data: Pick<SickDayData, "names">, id: string | null | undefined) {
  const name = id ? data.names.get(id)?.name : null;
  return name ? name.split(" ")[0] : "Someone";
}

// Spells you can change everything about (your Home's), vs. ones you help with.
export function isHomeSpell(data: Pick<SickDayData, "homeId">, spell: Pick<Spell, "home_id">) {
  return spell.home_id === data.homeId;
}

export function activeHelpers(data: Pick<SickDayData, "helpers" | "today">, spell: Spell) {
  return data.helpers.filter((h) => h.spell_id === spell.id && sickHelperActive(h.until, spell, data.today));
}

// --- Giving a dose (SICK-004) -----------------------------------------------------------------

export type GiveResult =
  | { ok: true; id: string }
  | { ok: false; tooSoon: { safeAt: number; reason: "gap" | "day" } }
  | { ok: false; error: { message: string; code?: string } };

export async function giveDose(opts: {
  spellId: string;
  medicineId: string | null;
  name: string | null;
  amount: string | null;
  givenAt: Date | null;
  anyway?: boolean;
}): Promise<GiveResult> {
  const { data, error } = await supabase.rpc("give_sick_dose", {
    target_spell: opts.spellId,
    medicine: opts.medicineId,
    medicine_name: opts.name,
    amount: opts.amount,
    given_at: opts.givenAt ? opts.givenAt.toISOString() : null,
    anyway: !!opts.anyway,
  });
  if (error) {
    if (error.message === "too_soon" && error.details) {
      return { ok: false, tooSoon: { safeAt: new Date(error.details).getTime(), reason: error.hint === "day" ? "day" : "gap" } };
    }
    return { ok: false, error };
  }
  return { ok: true, id: data as string };
}

export async function undoDose(id: string) {
  const { error } = await supabase.from("sick_doses").delete().eq("id", id);
  if (!error) await cancelDoseAlert(id);
  return { error };
}

// The phone alert (SICK-009): on the phone that gave the dose, when the gap
// is up. The inbox notice comes from the database as well, for any phone.
export async function scheduleDoseAlert(doseId: string, title: string, at: number) {
  if (at <= Date.now() + 60_000) return;
  configureReminders();
  if (!(await canRemind())) return;
  await Notifications.scheduleNotificationAsync({
    identifier: `sick-dose-${doseId}`,
    content: { title, body: "The gap since the last dose is up. Check before giving it." },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(at),
      channelId: Platform.OS === "android" ? "reminders" : undefined,
    },
  }).catch(() => undefined);
}

export async function cancelDoseAlert(doseId: string) {
  await Notifications.cancelScheduledNotificationAsync(`sick-dose-${doseId}`).catch(() => {});
}

// When it's OK again after a dose given now: the medicine's gap from the
// moment it was given (the day's limit is left to the inbox notice).
export function alertTime(medicine: Pick<Medicine, "id" | "name" | "ingredients" | "every_hours" | "max_per_day">, givenAt: number) {
  const rule = ruleOf(medicine);
  return rule.everyHours ? givenAt + rule.everyHours * 3600_000 : null;
}

// --- What the Hearth shows (SICK-008) ---------------------------------------------------------

export type SickSummary = {
  // Who's sick now (in your Home or that you're helping with), longest first.
  sick: {
    spellId: string;
    name: string;
    title: string;
    startedOn: string;
    tempC: number | null;
    timers: DoseTimer[];
  }[];
  // Whether anything's been set up at all.
  started: boolean;
  today: string;
};

export async function loadSickSummary(userId: string): Promise<SickSummary> {
  const data = await loadSickDay(userId);
  const now = Date.now();
  const open = data.spells.filter((s) => !s.ended_on).sort((a, b) => a.started_on.localeCompare(b.started_on));
  return {
    sick: open.map((s) => {
      const samePerson = data.spells.filter((x) => x.patient_id === s.patient_id).map((x) => x.id);
      const personDoses = data.recentDoses.filter((d) => samePerson.includes(d.spell_id));
      const temp = latestTemp(data.openLog.filter((e) => e.spell_id === s.id));
      return {
        spellId: s.id,
        name: firstName(data, s.patient_id),
        title: spellTitle(s),
        startedOn: s.started_on,
        tempC: temp?.temp_c ?? null,
        timers: doseTimers(
          personDoses.filter((d) => d.spell_id === s.id),
          personDoses,
          now
        ),
      };
    }),
    started: data.spells.length > 0 || data.medicines.length > 0,
    today: data.today,
  };
}

export function useSickSummary(userId: string | undefined, refreshKey: number) {
  // Remembered between Hearth pages, so a page you've seen shows at once (CORE-104).
  return useHearthData(userId ? `sickday:${userId}` : null, refreshKey, () => loadSickSummary(userId!));
}

// A clock that ticks every `ms`, so timers count down on screen.
export function useNow(ms = 30_000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}
