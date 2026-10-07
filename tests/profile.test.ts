import { describe, expect, it, vi } from "vitest";

vi.mock("../lib/supabase", () => ({ supabase: {} }));
vi.mock("../lib/auth-context", () => ({ useAuth: () => ({ session: null }) }));

const { formatBirthday, hasRealName, initialsOf, parseDateString, toDateString } = await import("../lib/profile");

// PROF-001/002: names, initials and birthdays.
describe("profile helpers", () => {
  it("knows a real name from an email or nothing", () => {
    expect(hasRealName("Josh")).toBe(true);
    expect(hasRealName("  ")).toBe(false);
    expect(hasRealName(null)).toBe(false);
    expect(hasRealName("josh@example.com")).toBe(false);
  });

  it("makes initials", () => {
    expect(initialsOf("Josh")).toBe("J");
    expect(initialsOf("Josh Collins")).toBe("JC");
    expect(initialsOf("mary jane van dyke")).toBe("MD");
    expect(initialsOf("josh@example.com")).toBe("?");
    expect(initialsOf(null)).toBe("?");
  });

  it("round-trips birthdays without a time-zone shift", () => {
    const original = "1990-03-04";
    const date = parseDateString(original);
    expect([date.getFullYear(), date.getMonth(), date.getDate()]).toEqual([1990, 2, 4]);
    expect(toDateString(date)).toBe(original);
    expect(toDateString(new Date(2001, 11, 31))).toBe("2001-12-31");
  });

  it("shows a birthday as month and day only", () => {
    const text = formatBirthday("1990-03-04")!;
    expect(text).toMatch(/4/);
    expect(text).not.toMatch(/1990/);
    expect(formatBirthday(null)).toBeNull();
  });
});
