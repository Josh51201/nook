import { describe, expect, it } from "vitest";

import { birthdayIn, upcomingBirthdays, type BirthdayPerson } from "../lib/birthdays";

// GIFT-035: which birthdays turn into Gatherings, and when.

const person = (name: string, birthday: string, burrowId = "b1"): BirthdayPerson => ({
  burrowId,
  profileId: name.toLowerCase(),
  name,
  birthday,
});

const today = new Date(2026, 9, 7, 15, 30); // Oct 7 2026, mid-afternoon

describe("upcoming birthdays", () => {
  it("plans birthdays within the next 30 days, soonest first", () => {
    const plans = upcomingBirthdays(
      [person("Later", "1990-11-05"), person("Soon", "1985-10-20"), person("TooFar", "1990-12-25")],
      today
    );
    expect(plans.map((p) => p.title)).toEqual(["Soon's Birthday", "Later's Birthday"]);
    expect(plans[0].year).toBe(2026);
  });

  it("includes today's birthday but not yesterday's", () => {
    const plans = upcomingBirthdays([person("Today", "2000-10-07"), person("Yesterday", "2000-10-06")], today);
    expect(plans.map((p) => p.profileId)).toEqual(["today"]);
  });

  it("ends the Gathering at the very end of the birthday, local time", () => {
    const [plan] = upcomingBirthdays([person("Soon", "1985-10-20")], today);
    expect(plan.endsAt.getFullYear()).toBe(2026);
    expect([plan.endsAt.getMonth(), plan.endsAt.getDate(), plan.endsAt.getHours(), plan.endsAt.getMinutes()]).toEqual([9, 20, 23, 59]);
  });

  it("looks across New Year", () => {
    const december = new Date(2026, 11, 20);
    const [plan] = upcomingBirthdays([person("Newyear", "1992-01-05")], december);
    expect(plan.year).toBe(2027);
    expect(plan.endsAt.getMonth()).toBe(0);
  });

  it("handles a Feb 29 birthday in a non-leap year", () => {
    expect(birthdayIn("2000-02-29", 2027).getDate()).toBe(28);
    expect(birthdayIn("2000-02-29", 2028).getDate()).toBe(29);
    const feb = new Date(2027, 1, 10);
    expect(upcomingBirthdays([person("Leap", "2000-02-29")], feb)).toHaveLength(1);
  });

  it("plans one Gathering per Burrow the person is in", () => {
    const plans = upcomingBirthdays([person("Soon", "1985-10-20", "b1"), person("Soon", "1985-10-20", "b2")], today);
    expect(plans.map((p) => p.burrowId).sort()).toEqual(["b1", "b2"]);
  });

  it("ignores birthdays that aren't valid dates", () => {
    expect(upcomingBirthdays([person("Bad", "not-a-date")], today)).toEqual([]);
  });
});
