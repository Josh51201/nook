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
