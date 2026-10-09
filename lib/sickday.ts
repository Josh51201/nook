import type { IconName } from "../components/icon";
import { daysToDue, localDay } from "./pets";

// Sick Day Nook (SICK-001..014): pure helpers, no React or database, so
// they're unit-testable. Screens live in app/sickday/, loading in
// lib/sickday-data.ts.
//
// Nook never works out a dose. It only keeps the gaps and limits typed in
// from the label or the doctor, and counts.

export type MissedFrom = "school" | "daycare" | "work";

export type Spell = {
  id: string;
  home_id: string;
  patient_id: string;
  title: string | null;
  started_on: string;
  ended_on: string | null;
  missed_from: MissedFrom | null;
  missed_days: string[];
  notes: string | null;
  tz: string;
  created_by: string | null;
  created_at: string;
};

export type TempWhere = "forehead" | "ear" | "mouth" | "armpit" | "bottom";

export type LogEntry = {
  id: string;
  spell_id: string;
  logged_at: string;
  logged_by: string | null;
  temp_c: number | null;
  temp_where: TempWhere | null;
  symptoms: string[];
  note: string | null;
};

export type Medicine = {
  id: string;
  home_id: string;
  name: string;
  ingredients: string[];
  amount: string | null;
  every_hours: number | null;
  max_per_day: number | null;
  for_profile: string | null;
  notes: string | null;
  created_by: string | null;
};

export type Dose = {
  id: string;
  spell_id: string;
  medicine_id: string | null;
  medicine_name: string;
  ingredients: string[];
  amount: string | null;
  every_hours: number | null;
  max_per_day: number | null;
  given_at: string;
  given_by: string | null;
  early: boolean;
};

export type Helper = { spell_id: string; profile_id: string; until: string | null; added_by: string | null };

// --- What it is (SICK-001) -------------------------------------------------------------

// One tap to name it; anything else can be typed.
export const illnessPicks = ["Cold", "Flu", "Fever", "Stomach bug", "Strep throat", "Ear infection", "COVID", "Pinkeye", "Croup", "RSV"];

export const missedChoices: { key: MissedFrom; label: string; icon: IconName }[] = [
  { key: "school", label: "School", icon: "school" },
  { key: "daycare", label: "Daycare", icon: "kid" },
  { key: "work", label: "Work", icon: "work" },
];

// --- Symptoms (SICK-003) ---------------------------------------------------------------

export const symptomPicks = [
  "Fever",
  "Cough",
  "Runny nose",
  "Stuffy nose",
  "Sore throat",
  "Headache",
  "Earache",
  "Tummy ache",
  "Throwing up",
  "Diarrhea",
  "Rash",
  "Tired",
  "Not eating",
  "Chills",
  "Body aches",
  "Trouble breathing",
];

// Ones worth calling the doctor about straight away are shown in red. This
// isn't advice, just a nudge to look twice.
export const urgentSymptoms = new Set(["Trouble breathing"]);

// Tidy a typed symptom: trimmed, first letter capital, at most 40 letters.
export function cleanSymptom(text: string) {
  const t = text.trim().replace(/\s+/g, " ").slice(0, 40);
  return t ? t[0].toUpperCase() + t.slice(1) : "";
}

// --- Temperatures (SICK-003, SICK-006) -------------------------------------------------

export type TempUnit = "f" | "c";

export const tempWhereChoices: { key: TempWhere; label: string }[] = [
  { key: "forehead", label: "Forehead" },
  { key: "ear", label: "Ear" },
  { key: "mouth", label: "Mouth" },
  { key: "armpit", label: "Armpit" },
  { key: "bottom", label: "Bottom" },
];

// 100.4 °F / 38 °C is where most doctors say a fever starts.
export const FEVER_C = 38;

export function toF(c: number) {
  return (c * 9) / 5 + 32;
}

export function toC(f: number) {
  return ((f - 32) * 5) / 9;
}

export function isFever(c: number | null | undefined) {
  return c != null && c >= FEVER_C - 0.001;
}

export function formatTemp(c: number, unit: TempUnit, withUnit = true) {
  const value = unit === "f" ? toF(c) : c;
  const text = (Math.round(value * 10) / 10).toFixed(1);
  return withUnit ? `${text}°${unit.toUpperCase()}` : text;
}

// A typed temperature in the person's unit, kept in °C (2 decimals, so
// 101.3 °F comes back as 101.3 °F). Null if it isn't a believable body
// temperature. A number that only makes sense in the other unit (38.5 typed
// with °F set) is read in that unit instead.
export function parseTemp(text: string, unit: TempUnit): number | null {
  const n = Number(text.replace(",", ".").replace(/[^\d.]/g, ""));
  if (!text.trim() || !Number.isFinite(n) || n <= 0) return null;
  let c: number;
  if (unit === "f") c = n >= 86 ? toC(n) : n;
  else c = n <= 45 ? n : toC(n);
  if (c < 30 || c > 45) return null;
  return Math.round(c * 100) / 100;
}

export type ChartPoint = { at: number; c: number };

// Temperatures oldest first, for the chart.
export function tempPoints(log: Pick<LogEntry, "logged_at" | "temp_c">[]): ChartPoint[] {
  return log
    .filter((e) => e.temp_c != null)
    .map((e) => ({ at: new Date(e.logged_at).getTime(), c: Number(e.temp_c) }))
    .sort((a, b) => a.at - b.at);
}

// The chart's range: always shows the fever line, with a little room.
export function tempRange(points: ChartPoint[]) {
  const values = points.map((p) => p.c);
  const lo = Math.min(36.5, ...values) - 0.3;
  const hi = Math.max(FEVER_C + 0.5, ...values) + 0.3;
  return { lo, hi };
}

export function highest(log: Pick<LogEntry, "temp_c">[]) {
  let best: number | null = null;
  for (const e of log) if (e.temp_c != null && (best == null || Number(e.temp_c) > best)) best = Number(e.temp_c);
  return best;
}

export function latestTemp<T extends Pick<LogEntry, "logged_at" | "temp_c">>(log: T[]): T | null {
  let best: T | null = null;
  for (const e of log) if (e.temp_c != null && (!best || e.logged_at > best.logged_at)) best = e;
  return best;
}

// --- The medicine cabinet (SICK-005) ---------------------------------------------------

// Common things medicines are made of, so two that share one count together.
export const ingredientPicks: { key: string; label: string; brands: string }[] = [
  { key: "acetaminophen", label: "Acetaminophen", brands: "Tylenol, paracetamol, NyQuil" },
  { key: "ibuprofen", label: "Ibuprofen", brands: "Advil, Motrin" },
  { key: "naproxen", label: "Naproxen", brands: "Aleve" },
  { key: "diphenhydramine", label: "Diphenhydramine", brands: "Benadryl" },
  { key: "cetirizine", label: "Cetirizine", brands: "Zyrtec" },
  { key: "loratadine", label: "Loratadine", brands: "Claritin" },
  { key: "dextromethorphan", label: "Dextromethorphan", brands: "cough syrups, “DM”" },
  { key: "guaifenesin", label: "Guaifenesin", brands: "Mucinex" },
  { key: "amoxicillin", label: "Amoxicillin", brands: "antibiotic" },
];

const ingredientAliases: Record<string, string> = {
  paracetamol: "acetaminophen",
  tylenol: "acetaminophen",
  advil: "ibuprofen",
  motrin: "ibuprofen",
  benadryl: "diphenhydramine",
  zyrtec: "cetirizine",
  claritin: "loratadine",
  aleve: "naproxen",
  mucinex: "guaifenesin",
};

// Lower case, one space, and the usual other names folded together.
export function normalizeIngredient(text: string) {
  const t = text.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 40);
  return ingredientAliases[t] ?? t;
}

export function ingredientLabel(key: string) {
  return ingredientPicks.find((i) => i.key === key)?.label ?? key[0].toUpperCase() + key.slice(1);
}

export const gapChoices = [4, 6, 8, 12, 24];
export const perDayChoices = [3, 4, 5, 6];

export function hoursWords(hours: number) {
  if (hours < 1) return `${Math.round(hours * 60)} minutes`;
  const h = Math.round(hours * 10) / 10;
  return `${h} hour${h === 1 ? "" : "s"}`;
}

// "5 mL · every 4 hours · at most 5 a day"
export function medicineRule(m: Pick<Medicine, "amount" | "every_hours" | "max_per_day">) {
  return [
    m.amount,
    m.every_hours ? `every ${hoursWords(Number(m.every_hours))}` : null,
    m.max_per_day ? `at most ${m.max_per_day} a day` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

// Cabinet medicines that can be given to this person: theirs, or anyone's.
export function medicinesFor<T extends Pick<Medicine, "for_profile" | "name">>(medicines: T[], patientId: string) {
  return medicines
    .filter((m) => !m.for_profile || m.for_profile === patientId)
    .sort((a, b) => (a.for_profile ? 0 : 1) - (b.for_profile ? 0 : 1) || a.name.localeCompare(b.name));
}

// --- When the next dose is OK (SICK-004) -----------------------------------------------
// The same rules as public.sick_dose_wait() in the database, which has the
// final say: this one is for showing timers.

export type DoseRule = {
  medicineId: string | null;
  name: string;
  ingredients: string[];
  everyHours: number | null;
  maxPerDay: number | null;
};

export function ruleOf(m: Pick<Medicine, "id" | "name" | "ingredients" | "every_hours" | "max_per_day">): DoseRule {
  return {
    medicineId: m.id,
    name: m.name,
    ingredients: m.ingredients,
    everyHours: m.every_hours == null ? null : Number(m.every_hours),
    maxPerDay: m.max_per_day,
  };
}

export function ruleOfDose(d: Pick<Dose, "medicine_id" | "medicine_name" | "ingredients" | "every_hours" | "max_per_day">): DoseRule {
  return {
    medicineId: d.medicine_id,
    name: d.medicine_name,
    ingredients: d.ingredients,
    everyHours: d.every_hours == null ? null : Number(d.every_hours),
    maxPerDay: d.max_per_day,
  };
}

type DoseLike = Pick<Dose, "medicine_id" | "medicine_name" | "ingredients" | "every_hours" | "max_per_day" | "given_at">;

// Same cabinet medicine, same name, or sharing what's in it.
export function sameMedicine(d: Pick<Dose, "medicine_id" | "medicine_name" | "ingredients">, rule: DoseRule) {
  if (rule.medicineId && d.medicine_id === rule.medicineId) return true;
  if (d.medicine_name.trim().toLowerCase() === rule.name.trim().toLowerCase()) return true;
  return d.ingredients.some((i) => rule.ingredients.includes(i));
}

const HOUR = 3600_000;
const DAY = 24 * HOUR;

export type Wait = { safeAt: number; reason: "gap" | "day" } | null;

// When a dose of `rule` would be OK, judged at `at` (ms). Null = OK now.
// `doses` are this person's doses (any spell in the Home).
export function doseWait(doses: DoseLike[], rule: DoseRule, at: number): Wait {
  let gapUntil: number | null = null;
  for (const d of doses) {
    if (!sameMedicine(d, rule)) continue;
    const given = new Date(d.given_at).getTime();
    const theirs = d.every_hours == null ? null : Number(d.every_hours);
    const gap = theirs == null ? rule.everyHours : rule.everyHours == null ? theirs : Math.max(theirs, rule.everyHours);
    if (gap == null || Math.abs(at - given) > 3 * DAY) continue;
    if (Math.abs(at - given) < gap * HOUR) gapUntil = Math.max(gapUntil ?? 0, given + gap * HOUR);
  }

  let dayUntil: number | null = null;
  const window = doses
    .filter((d) => sameMedicine(d, rule))
    .map((d) => ({ at: new Date(d.given_at).getTime(), max: d.max_per_day }))
    .filter((d) => d.at > at - DAY && d.at <= at)
    .sort((a, b) => a.at - b.at);
  const limits = [rule.maxPerDay, ...window.map((d) => d.max)].filter((n): n is number => n != null);
  if (limits.length) {
    const most = Math.min(...limits);
    if (window.length >= most) dayUntil = window[window.length - most].at + DAY;
  }

  if (gapUntil == null && dayUntil == null) return null;
  if (dayUntil != null && dayUntil >= (gapUntil ?? dayUntil)) return { safeAt: dayUntil, reason: "day" };
  return { safeAt: gapUntil!, reason: "gap" };
}

export type DoseTimer = {
  key: string;
  name: string;
  amount: string | null;
  medicineId: string | null;
  lastGiven: number;
  lastGivenBy: string | null;
  // Null when it's OK now (or there's no gap to wait).
  wait: Wait;
  hasTimer: boolean;
  givenToday: number;
  maxPerDay: number | null;
};

// One timer per medicine given during this spell, latest first: when it was
// last given, and when the next is OK. `allDoses` is everything this person
// has had in the Home, so a dose from yesterday's spell still counts.
export function doseTimers(spellDoses: Dose[], allDoses: Dose[], now: number): DoseTimer[] {
  const latest = new Map<string, Dose>();
  for (const d of spellDoses) {
    const key = d.medicine_name.trim().toLowerCase();
    const seen = latest.get(key);
    if (!seen || d.given_at > seen.given_at) latest.set(key, d);
  }
  return [...latest.entries()]
    .map(([key, d]) => {
      const rule = ruleOfDose(d);
      return {
        key,
        name: d.medicine_name,
        amount: d.amount,
        medicineId: d.medicine_id,
        lastGiven: new Date(d.given_at).getTime(),
        lastGivenBy: d.given_by,
        wait: doseWait(allDoses, rule, now),
        hasTimer: rule.everyHours != null || rule.maxPerDay != null,
        givenToday: allDoses.filter((x) => sameMedicine(x, rule) && new Date(x.given_at).getTime() > now - DAY).length,
        maxPerDay: rule.maxPerDay,
      };
    })
    .sort((a, b) => b.lastGiven - a.lastGiven);
}

// "1 h 20 min", "45 min", "under a minute"
export function untilWords(ms: number) {
  const minutes = Math.ceil(ms / 60000);
  if (minutes <= 0) return "now";
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function clockTime(ms: number) {
  return new Date(ms).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

// "2:40 PM", "Yesterday 9:15 PM", "Tue 8:00 AM"
export function whenWords(ms: number, now = Date.now()) {
  const day = localDay(new Date(ms));
  const today = localDay(new Date(now));
  const diff = daysToDue(day, today);
  const time = clockTime(ms);
  if (diff === 0) return time;
  if (diff === -1) return `Yesterday ${time}`;
  if (diff > -7 && diff < 0) return `${new Date(ms).toLocaleDateString(undefined, { weekday: "short" })} ${time}`;
  return `${new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" })} ${time}`;
}

// "OK now", "OK at 6:40 PM (in 1 h 20 min)", "OK at 2:00 AM: 5 already today"
export function timerWords(t: Pick<DoseTimer, "wait" | "hasTimer" | "maxPerDay">, now: number) {
  if (!t.hasTimer) return "No timer kept";
  if (!t.wait) return "OK now";
  const at = `OK at ${clockTime(t.wait.safeAt)}`;
  return t.wait.reason === "day" ? `${at}: ${t.maxPerDay} already today` : `${at} (in ${untilWords(t.wait.safeAt - now)})`;
}

// --- The spell (SICK-001, SICK-011) ----------------------------------------------------

// "Day 3" (the day it started is day 1).
export function spellDay(spell: Pick<Spell, "started_on" | "ended_on">, today = localDay()) {
  return daysToDue(spell.ended_on && spell.ended_on < today ? spell.ended_on : today, spell.started_on) + 1;
}

// How long it lasted: "1 day", "6 days".
export function spellLength(spell: Pick<Spell, "started_on" | "ended_on">, today = localDay()) {
  const n = spellDay(spell, today);
  return `${n} day${n === 1 ? "" : "s"}`;
}

export function spellTitle(spell: Pick<Spell, "title">) {
  return spell.title?.trim() || "Sick";
}

function dayFromString(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function shortDay(day: string) {
  return dayFromString(day).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export function monthYear(day: string) {
  return dayFromString(day).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

// "Since Tuesday", "Oct 3 – Oct 8"
export function spellDates(spell: Pick<Spell, "started_on" | "ended_on">, today = localDay()) {
  const fmt = (d: string) => dayFromString(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  if (!spell.ended_on) {
    const ago = daysToDue(today, spell.started_on);
    if (ago === 0) return "Since today";
    if (ago === 1) return "Since yesterday";
    if (ago < 7) return `Since ${dayFromString(spell.started_on).toLocaleDateString(undefined, { weekday: "long" })}`;
    return `Since ${fmt(spell.started_on)}`;
  }
  return spell.started_on === spell.ended_on ? fmt(spell.started_on) : `${fmt(spell.started_on)} – ${fmt(spell.ended_on)}`;
}

// --- Missed days (SICK-012) ------------------------------------------------------------

// The days a spell covers, for picking missed ones: weekdays first ticked,
// at most 60.
export function spellDays(spell: Pick<Spell, "started_on" | "ended_on">, today = localDay()) {
  const last = spell.ended_on ?? today;
  const out: string[] = [];
  const d = dayFromString(spell.started_on);
  while (out.length < 60) {
    const day = localDay(d);
    if (day > last) break;
    out.push(day);
    d.setDate(d.getDate() + 1);
  }
  return out;
}

export function isWeekday(day: string) {
  const n = dayFromString(day).getDay();
  return n !== 0 && n !== 6;
}

export function toggleDay(days: string[], day: string) {
  return days.includes(day) ? days.filter((d) => d !== day) : [...days, day].sort();
}

export function missedWord(from: MissedFrom | null) {
  return from === "work" ? "work" : from === "daycare" ? "daycare" : "school";
}

// "Missed 3 days of school"
export function missedWords(spell: Pick<Spell, "missed_from" | "missed_days">) {
  const n = spell.missed_days.length;
  if (!n) return null;
  return `Missed ${n} day${n === 1 ? "" : "s"} of ${missedWord(spell.missed_from)}`;
}

// "Oct 8, Oct 9 and Oct 12": runs of days aren't merged, so a school can
// match them to its own calendar.
export function dayList(days: string[]) {
  const words = [...days].sort().map((d) => dayFromString(d).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }));
  if (words.length <= 1) return words.join("");
  return `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}

// A note for school or work (SICK-012), ready to paste into an email.
export function absenceNote(
  spell: Pick<Spell, "missed_from" | "missed_days" | "title">,
  patientName: string,
  signedBy: string | null
) {
  const first = patientName.split(" ")[0] || patientName;
  const n = spell.missed_days.length;
  const what = missedWord(spell.missed_from);
  const lines = [
    `Hello,`,
    ``,
    `${patientName} was home sick${spell.title?.trim() ? ` (${spell.title.trim().toLowerCase()})` : ""} and missed ${what} on ${dayList(spell.missed_days)}.`,
    n > 1 ? `Thank you for understanding while ${first} recovered.` : `Thank you for understanding.`,
  ];
  if (signedBy) lines.push(``, signedBy);
  return lines.join("\n");
}

// --- Illness history (SICK-011) --------------------------------------------------------

// Each person's past spells, newest first, plus what they've missed in the
// last year.
export function historyByPerson<T extends Pick<Spell, "patient_id" | "started_on" | "ended_on" | "missed_days">>(spells: T[], today = localDay()) {
  const yearAgo = localDay(new Date(dayFromString(today).getTime() - 365 * 864e5));
  const byPerson = new Map<string, { spells: T[]; missedThisYear: number; timesThisYear: number }>();
  for (const s of [...spells].sort((a, b) => b.started_on.localeCompare(a.started_on))) {
    const entry = byPerson.get(s.patient_id) ?? { spells: [], missedThisYear: 0, timesThisYear: 0 };
    entry.spells.push(s);
    if (s.started_on > yearAgo) {
      entry.timesThisYear += 1;
      entry.missedThisYear += s.missed_days.filter((d) => d > yearAgo).length;
    }
    byPerson.set(s.patient_id, entry);
  }
  return byPerson;
}

// "Last had strep throat in March"
export function lastHad<T extends Pick<Spell, "title" | "started_on" | "id">>(spells: T[], title: string | null, exceptId?: string) {
  const t = title?.trim().toLowerCase();
  if (!t) return null;
  const match = spells
    .filter((s) => s.id !== exceptId && s.title?.trim().toLowerCase() === t)
    .sort((a, b) => b.started_on.localeCompare(a.started_on))[0];
  return match ? `Last had ${t} in ${monthYear(match.started_on)}` : null;
}

// --- Timeline (SICK-003, SICK-004) -----------------------------------------------------

export type TimelineItem =
  | { kind: "log"; at: number; entry: LogEntry }
  | { kind: "dose"; at: number; dose: Dose };

export function timeline(log: LogEntry[], doses: Dose[]): TimelineItem[] {
  return [
    ...log.map((entry) => ({ kind: "log" as const, at: new Date(entry.logged_at).getTime(), entry })),
    ...doses.map((dose) => ({ kind: "dose" as const, at: new Date(dose.given_at).getTime(), dose })),
  ].sort((a, b) => b.at - a.at);
}

// Every symptom logged, most often first, with when it was first noticed.
export function symptomTally(log: Pick<LogEntry, "symptoms" | "logged_at">[]) {
  const tally = new Map<string, { count: number; first: string }>();
  for (const e of log) {
    for (const s of e.symptoms) {
      const seen = tally.get(s);
      if (!seen) tally.set(s, { count: 1, first: e.logged_at });
      else {
        seen.count += 1;
        if (e.logged_at < seen.first) seen.first = e.logged_at;
      }
    }
  }
  return [...tally.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.count - a.count || a.first.localeCompare(b.first));
}

// --- The doctor summary (SICK-007) -----------------------------------------------------

// Everything a doctor asks on the phone, in the order they ask it, as plain
// text to read out, copy or send.
export function doctorSummary(opts: {
  spell: Spell;
  patientName: string;
  allergies: string[];
  log: LogEntry[];
  doses: Dose[];
  unit: TempUnit;
  now?: number;
  names?: (id: string | null) => string;
}) {
  const { spell, patientName, allergies, log, doses, unit } = opts;
  const now = opts.now ?? Date.now();
  const today = localDay(new Date(now));
  const lines: string[] = [];
  lines.push(`${patientName}: ${spellTitle(spell).toLowerCase() === "sick" ? "sick" : spellTitle(spell)}`);
  lines.push(`Started ${shortDay(spell.started_on)} (day ${spellDay(spell, today)})${spell.ended_on ? `, better ${shortDay(spell.ended_on)}` : ""}`);
  lines.push(`Allergies: ${allergies.length ? allergies.join(", ") : "none listed"}`);

  const temps = tempPoints(log);
  if (temps.length) {
    const top = highest(log)!;
    const last = temps[temps.length - 1];
    const firstFever = temps.find((p) => isFever(p.c));
    lines.push("");
    lines.push("Temperature");
    lines.push(`  Highest: ${formatTemp(top, unit)}`);
    lines.push(`  Latest: ${formatTemp(last.c, unit)} at ${whenWords(last.at, now)}`);
    if (firstFever) lines.push(`  Fever since: ${whenWords(firstFever.at, now)}`);
  }

  const symptoms = symptomTally(log);
  if (symptoms.length) {
    lines.push("");
    lines.push("Symptoms");
    for (const s of symptoms) lines.push(`  ${s.name} (since ${whenWords(new Date(s.first).getTime(), now)})`);
  }

  if (doses.length) {
    lines.push("");
    lines.push("Medicine given");
    for (const d of [...doses].sort((a, b) => b.given_at.localeCompare(a.given_at))) {
      const who = opts.names ? ` by ${opts.names(d.given_by)}` : "";
      lines.push(`  ${whenWords(new Date(d.given_at).getTime(), now)}: ${d.medicine_name}${d.amount ? ` ${d.amount}` : ""}${who}`);
    }
  }

  const notes = log.filter((e) => e.note?.trim());
  if (notes.length || spell.notes?.trim()) {
    lines.push("");
    lines.push("Notes");
    if (spell.notes?.trim()) lines.push(`  ${spell.notes.trim()}`);
    for (const e of [...notes].sort((a, b) => a.logged_at.localeCompare(b.logged_at))) {
      lines.push(`  ${whenWords(new Date(e.logged_at).getTime(), now)}: ${e.note!.trim()}`);
    }
  }
  if (spell.missed_days.length) {
    lines.push("");
    lines.push(missedWords(spell)!);
  }
  return lines.join("\n");
}

// --- Helpers (SICK-002) ----------------------------------------------------------------

// Same rule as public.sick_helper_active(): until their day, and no longer
// than the day after they're better.
export function sickHelperActive(until: string | null, spell: Pick<Spell, "ended_on">, today = localDay()) {
  if (until && until < today) return false;
  if (spell.ended_on && daysToDue(today, spell.ended_on) > 1) return false;
  return true;
}
