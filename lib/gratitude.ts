// The Gratitude jar widget (CORE-113): one line a day about something good,
// and now and then the jar hands an old one back. Kept with the widget,
// newest first, up to MAX_GRATITUDE lines (the oldest go first). Pure, so
// it's unit-testable.

export type GratitudeLine = { day: string; text: string };

export const MAX_GRATITUDE = 500;
export const MAX_GRATITUDE_LENGTH = 200;

export const gratitudePrompts = [
  "What made today good?",
  "Who are you thankful for today?",
  "What's one small happy thing?",
  "What made you smile today?",
  "What are you glad about today?",
];

const hash = (text: string) => {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h;
};

// Today's question, the same all day.
export function promptFor(today: string) {
  return gratitudePrompts[hash(today) % gratitudePrompts.length];
}

// Writes today's line (or changes it); an empty line takes it back out.
export function writeLine(lines: GratitudeLine[], today: string, text: string): GratitudeLine[] {
  const clean = text.trim().slice(0, MAX_GRATITUDE_LENGTH);
  const others = lines.filter((line) => line.day !== today);
  if (!clean) return others;
  return [{ day: today, text: clean }, ...others].sort((a, b) => b.day.localeCompare(a.day)).slice(0, MAX_GRATITUDE);
}

export function todaysLine(lines: GratitudeLine[], today: string) {
  return lines.find((line) => line.day === today) ?? null;
}

const shift = (day: string, years: number, months: number, days = 0) => {
  const [y, m, d] = day.split("-").map(Number);
  const date = new Date(y + years, m - 1 + months, d + days, 12);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

// An old line to hand back today, or null. A year ago today comes first,
// then a month ago; otherwise every third day or so, one picked by the day
// (so it stays the same all day). Needs a few lines in the jar first.
export function memoryFor(lines: GratitudeLine[], today: string): { line: GratitudeLine; why: "year" | "month" | "jar" } | null {
  const older = lines.filter((line) => line.day < today);
  const yearAgo = older.find((line) => line.day === shift(today, -1, 0));
  if (yearAgo) return { line: yearAgo, why: "year" };
  const monthAgo = older.find((line) => line.day === shift(today, 0, -1));
  if (monthAgo) return { line: monthAgo, why: "month" };
  if (older.length < 3 || hash(`jar${today}`) % 3 !== 0) return null;
  return { line: older[hash(today) % older.length], why: "jar" };
}

// How many days in a row, up to today (or yesterday, if today's not
// written yet).
export function gratitudeStreak(lines: GratitudeLine[], today: string) {
  const days = new Set(lines.map((line) => line.day));
  let day = days.has(today) ? today : shift(today, 0, 0, -1);
  let count = 0;
  while (days.has(day)) {
    count += 1;
    day = shift(day, 0, 0, -1);
  }
  return count;
}
