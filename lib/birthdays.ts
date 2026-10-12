// Which birthdays are coming up, as Gatherings to plan (GIFT-035). Pure
// functions — no Supabase — so the date maths is unit-tested.

export const BIRTHDAY_LEAD_DAYS = 30;

export type BirthdayPerson = {
  burrowId: string;
  profileId: string;
  name: string;
  birthday: string; // YYYY-MM-DD
};

export type BirthdayPlan = {
  burrowId: string;
  profileId: string;
  year: number;
  title: string;
  endsAt: Date; // the end of the birthday, in the planning phone's local time
};

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

// The birthday's date in `year`. Feb 29 falls back to Feb 28 in other years.
export function birthdayIn(birthday: string, year: number) {
  const [, month, day] = birthday.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getMonth() === month - 1 ? date : new Date(year, month - 1, day - 1);
}

// Everyone whose birthday falls between today and `leadDays` from now, as
// the Gathering that should exist for it. A person can appear twice around
// New Year only if both occurrences were inside the window (they can't be,
// for any window under a year).
export function upcomingBirthdays(
  people: BirthdayPerson[],
  today = new Date(),
  leadDays = BIRTHDAY_LEAD_DAYS
): BirthdayPlan[] {
  const from = startOfDay(today).getTime();
  const to = from + leadDays * 86400000;
  const plans: BirthdayPlan[] = [];

  for (const person of people) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(person.birthday)) continue;
    for (const year of [today.getFullYear(), today.getFullYear() + 1]) {
      const day = birthdayIn(person.birthday, year);
      if (day.getTime() < from || day.getTime() > to) continue;
      plans.push({
        burrowId: person.burrowId,
        profileId: person.profileId,
        year,
        title: `${person.name}'s Birthday`,
        endsAt: new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59),
      });
    }
  }
  return plans.sort((a, b) => a.endsAt.getTime() - b.endsAt.getTime());
}

// Birthdays coming up (CORE-106): each person's next birthday, soonest
// first, one entry per person even if they're in two of your Burrows.
// `turning` is their new age, kept only for kids (under 18), since grown-ups
// may rather it not be on the fridge.
export type NextBirthday = {
  profileId: string;
  name: string;
  burrowIds: string[];
  // YYYY-MM-DD, local.
  day: string;
  year: number;
  daysAway: number;
  turning: number | null;
};

const pad = (n: number) => String(n).padStart(2, "0");
const dayOf = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export function nextBirthdays(people: BirthdayPerson[], today = new Date(), withinDays = 366): NextBirthday[] {
  const from = startOfDay(today);
  const byPerson = new Map<string, NextBirthday>();
  for (const person of people) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(person.birthday)) continue;
    const known = byPerson.get(person.profileId);
    if (known) {
      if (!known.burrowIds.includes(person.burrowId)) known.burrowIds.push(person.burrowId);
      continue;
    }
    let year = from.getFullYear();
    let day = birthdayIn(person.birthday, year);
    if (day.getTime() < from.getTime()) day = birthdayIn(person.birthday, (year += 1));
    const daysAway = Math.round((day.getTime() - from.getTime()) / 86400000);
    if (daysAway > withinDays) continue;
    const born = Number(person.birthday.slice(0, 4));
    const age = year - born;
    byPerson.set(person.profileId, {
      profileId: person.profileId,
      name: person.name,
      burrowIds: [person.burrowId],
      day: dayOf(day),
      year,
      daysAway,
      turning: born > 1900 && age > 0 && age < 18 ? age : null,
    });
  }
  return [...byPerson.values()].sort((a, b) => a.daysAway - b.daysAway || a.name.localeCompare(b.name));
}

// "Today", "Tomorrow", "in 5 days", "in 3 weeks", "Mar 4".
export function birthdayWhen(b: Pick<NextBirthday, "daysAway" | "day">) {
  if (b.daysAway === 0) return "Today";
  if (b.daysAway === 1) return "Tomorrow";
  if (b.daysAway < 14) return `in ${b.daysAway} days`;
  if (b.daysAway < 56) return `in ${Math.round(b.daysAway / 7)} weeks`;
  const [y, m, d] = b.day.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
