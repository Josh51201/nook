import { describe, expect, it } from "vitest";

import {
  cancelBy,
  cancelByWords,
  cardWords,
  categoryTotals,
  cleanLast4,
  current,
  formatMoney,
  groupSubscriptions,
  lastChangeWords,
  looksLikeCardNumber,
  matchingPicks,
  monthlyCents,
  normalizeLink,
  parsePrice,
  priceHistory,
  renewWords,
  resumeDate,
  savedCents,
  stepRenewal,
  totalSaved,
  totals,
  yearlyCents,
  type PriceEntry,
  type Subscription,
} from "../lib/subscriptions";

const today = "2026-10-09";

function sub(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: overrides.name ?? "s",
    home_id: "h",
    name: "Netflix",
    category: "streaming",
    price_cents: 1549,
    cycle: "monthly",
    renews_on: "2026-10-20",
    on_trial: false,
    remind_days: 3,
    private: false,
    payer: null,
    card_name: null,
    card_last4: null,
    manage_url: null,
    notes: null,
    status: "active",
    stopped_on: null,
    created_by: "me",
    created_at: "2026-10-01T00:00:00Z",
    ...overrides,
  };
}

describe("money", () => {
  it("formats cents as dollars", () => {
    expect(formatMoney(1549)).toBe("$15.49");
    expect(formatMoney(0)).toBe("$0.00");
    expect(formatMoney(129900)).toBe("$1,299.00");
    expect(formatMoney(1549.6)).toBe("$15.50");
  });

  it("reads what people type as a price", () => {
    expect(parsePrice("15.49")).toBe(1549);
    expect(parsePrice("$15.49")).toBe(1549);
    expect(parsePrice("15")).toBe(1500);
    expect(parsePrice(".99")).toBe(99);
    expect(parsePrice("1,299")).toBe(129900);
    expect(parsePrice("0")).toBe(0);
    expect(parsePrice("")).toBeNull();
    expect(parsePrice("abc")).toBeNull();
    expect(parsePrice("15.499")).toBeNull();
  });

  it("evens out any billing into a month and a year (SUB-004)", () => {
    expect(monthlyCents(sub({ price_cents: 1200, cycle: "yearly" }))).toBe(100);
    expect(monthlyCents(sub({ price_cents: 1000, cycle: "weekly" }))).toBeCloseTo(4333.33, 1);
    expect(monthlyCents(sub({ price_cents: 3000, cycle: "quarterly" }))).toBe(1000);
    expect(yearlyCents(sub({ price_cents: 1549, cycle: "monthly" }))).toBe(18588);
    expect(yearlyCents(sub({ price_cents: 6000, cycle: "half_yearly" }))).toBe(12000);
  });
});

describe("renewal dates (SUB-001, SUB-003)", () => {
  it("steps forward like Postgres does, keeping month ends sensible", () => {
    expect(stepRenewal("2026-10-09", "weekly")).toBe("2026-10-16");
    expect(stepRenewal("2026-01-31", "monthly")).toBe("2026-02-28");
    expect(stepRenewal("2028-01-31", "monthly")).toBe("2028-02-29");
    expect(stepRenewal("2026-11-30", "quarterly")).toBe("2027-02-28");
    expect(stepRenewal("2026-10-09", "half_yearly")).toBe("2027-04-09");
    expect(stepRenewal("2028-02-29", "yearly")).toBe("2029-02-28");
  });

  it("rolls a passed renewal forward, and a passed trial becomes paid", () => {
    expect(current(sub({ renews_on: "2026-10-20" }), today).renews_on).toBe("2026-10-20");
    expect(current(sub({ renews_on: today }), today).renews_on).toBe(today);
    expect(current(sub({ renews_on: "2026-08-05" }), today).renews_on).toBe("2026-11-05");
    const trial = current(sub({ renews_on: "2026-10-01", on_trial: true }), today);
    expect(trial).toMatchObject({ renews_on: "2026-11-01", on_trial: false });
  });

  it("says when in plain words", () => {
    expect(renewWords(sub({ renews_on: today }), today)).toBe("Renews today");
    expect(renewWords(sub({ renews_on: "2026-10-10" }), today)).toBe("Renews tomorrow");
    expect(renewWords(sub({ renews_on: "2026-10-14", on_trial: true }), today)).toBe("Free trial ends in 5 days");
    expect(renewWords(sub({ renews_on: "2026-12-25" }), today)).toMatch(/^Renews on Dec 25$/);
    expect(renewWords(sub({ status: "cancelled", stopped_on: "2026-03-03" }), today)).toMatch(/^Cancelled Mar 3, 2026$/);
    expect(renewWords(sub({ status: "paused", stopped_on: "2026-03-03" }), today)).toMatch(/^Paused/);
  });

  it("the last day to cancel is the day before it charges", () => {
    expect(cancelBy(sub({ renews_on: "2026-10-20" }), today)).toBe("2026-10-19");
    expect(cancelByWords(sub({ renews_on: "2026-10-10" }), today)).toBe("Cancel by the end of today");
    expect(cancelByWords(sub({ renews_on: "2026-10-11" }), today)).toBe("Cancel by the end of tomorrow");
    expect(cancelByWords(sub({ renews_on: today }), today)).toMatch(/^Too late/);
    expect(cancelByWords(sub({ renews_on: "2026-10-20" }), today)).toMatch(/^Cancel by Oct 19$/);
  });

  it("groups into trials, this week, this month, later and stopped (SUB-010)", () => {
    const groups = groupSubscriptions(
      [
        sub({ name: "far", renews_on: "2027-03-01", cycle: "yearly" }),
        sub({ name: "trial", renews_on: "2026-10-12", on_trial: true }),
        sub({ name: "soon", renews_on: "2026-10-12" }),
        sub({ name: "month", renews_on: "2026-11-01" }),
        sub({ name: "old stop", status: "cancelled", stopped_on: "2026-01-01" }),
        sub({ name: "new stop", status: "paused", stopped_on: "2026-09-01" }),
      ],
      today
    );
    expect(groups.trials.map((s) => s.name)).toEqual(["trial"]);
    expect(groups.soon.map((s) => s.name)).toEqual(["soon"]);
    expect(groups.month.map((s) => s.name)).toEqual(["month"]);
    expect(groups.later.map((s) => s.name)).toEqual(["far"]);
    expect(groups.stopped.map((s) => s.name)).toEqual(["new stop", "old stop"]);
  });
});

describe("totals (SUB-004, SUB-007)", () => {
  const subs = [
    sub({ name: "Netflix", price_cents: 1549 }),
    sub({ name: "Spotify", category: "music", price_cents: 1199 }),
    sub({ name: "Prime", category: "memberships", price_cents: 13900, cycle: "yearly" }),
    sub({ name: "Max", price_cents: 999, on_trial: true, renews_on: "2026-10-15" }),
    sub({ name: "Hulu", price_cents: 799, status: "cancelled", stopped_on: "2026-09-09" }),
  ];

  it("adds up what's being charged, and what trials will add", () => {
    const sum = totals(subs, today);
    expect(sum.count).toBe(3);
    expect(Math.round(sum.monthly)).toBe(1549 + 1199 + Math.round(13900 / 12));
    expect(sum.yearly).toBe(1549 * 12 + 1199 * 12 + 13900);
    expect(sum.trials).toBe(1);
    expect(sum.trialsMonthly).toBe(999);
  });

  it("splits the monthly total by category, biggest first", () => {
    const byCategory = categoryTotals(subs, today);
    expect(byCategory.map((c) => c.key)).toEqual(["streaming", "music", "memberships"]);
    expect(byCategory[0]).toMatchObject({ count: 1, monthly: 1549 });
  });
});

describe("paused and cancelled (SUB-010)", () => {
  it("counts what stopping has saved since then", () => {
    const stopped = sub({ price_cents: 1200, status: "cancelled", stopped_on: "2025-10-09" });
    // A year at $12 a month, give or take a day's worth.
    expect(Math.abs(savedCents(stopped, today) - 14400)).toBeLessThan(40);
    expect(savedCents(sub(), today)).toBe(0);
    expect(totalSaved([stopped, sub({ price_cents: 1200, status: "paused", stopped_on: today })], today)).toBe(savedCents(stopped, today));
  });

  it("starting again picks the next renewal day", () => {
    expect(resumeDate(sub({ renews_on: "2026-08-20" }), today)).toBe("2026-10-20");
    expect(resumeDate(sub({ renews_on: "2026-11-02" }), today)).toBe("2026-11-02");
    expect(resumeDate(sub({ renews_on: "2026-09-09" }), today)).toBe("2026-11-09");
  });
});

describe("price history (SUB-008)", () => {
  const entry = (id: string, price_cents: number, changed_on: string, cycle = "monthly"): PriceEntry => ({
    id,
    subscription_id: "s",
    price_cents,
    cycle,
    changed_on,
    changed_by: null,
    created_at: `${changed_on}T12:00:00Z`,
  });

  it("lists newest first and says how the last change went", () => {
    const history = priceHistory([entry("a", 1549, "2025-01-10"), entry("b", 1799, "2026-03-04"), { ...entry("c", 1, "2026-01-01"), subscription_id: "other" }], "s");
    expect(history.map((e) => e.id)).toEqual(["b", "a"]);
    expect(lastChangeWords(history)).toMatch(/^Went up from \$15\.49 to \$17\.99 in March 2026$/);
    expect(lastChangeWords(history.slice(1))).toBeNull();
  });

  it("compares a month at a time when the billing changed", () => {
    const history = [entry("b", 13900, "2026-05-01", "yearly"), entry("a", 1499, "2025-01-01")];
    expect(lastChangeWords(history)).toMatch(/^Went down from \$14\.99 a month to \$139\.00 a year/);
  });
});

describe("who pays and which card (SUB-005)", () => {
  it("keeps only the last 4 digits", () => {
    expect(cleanLast4("1234")).toBe("1234");
    expect(cleanLast4("•• 1234")).toBe("1234");
    expect(cleanLast4("123")).toBeNull();
    expect(cleanLast4("4111111111111111")).toBeNull();
  });

  it("won't take a card number as a card's name", () => {
    expect(looksLikeCardNumber("Chase Visa")).toBe(false);
    expect(looksLikeCardNumber("Visa 2024")).toBe(false);
    expect(looksLikeCardNumber("4111 1111 1111 1111")).toBe(true);
    expect(looksLikeCardNumber("4111-1111")).toBe(true);
  });

  it("describes the card", () => {
    expect(cardWords({ card_name: "Chase Visa", card_last4: "1234" })).toBe("Chase Visa ••1234");
    expect(cardWords({ card_name: null, card_last4: "1234" })).toBe("Card ending 1234");
    expect(cardWords({ card_name: "Amex", card_last4: null })).toBe("Amex");
    expect(cardWords({ card_name: " ", card_last4: null })).toBeNull();
  });
});

describe("links and quick picks", () => {
  it("adds https:// when it's left off (SUB-009)", () => {
    expect(normalizeLink("netflix.com/account")).toBe("https://netflix.com/account");
    expect(normalizeLink("http://x.com")).toBe("http://x.com");
    expect(normalizeLink("  ")).toBeNull();
  });

  it("offers matches by word, leaving out ones already added", () => {
    expect(matchingPicks("net", []).map((p) => p.name)).toEqual(["Netflix"]);
    expect(matchingPicks("pass", []).map((p) => p.name)).toContain("Xbox Game Pass");
    expect(matchingPicks("net", ["netflix"])).toEqual([]);
    expect(matchingPicks("Netflix", [])).toEqual([]);
    expect(matchingPicks("", [], 3)).toHaveLength(3);
  });
});
