import { describe, expect, it } from "vitest";

import { cleanContacts, linkState, linkUrl, sectionFilled, shareMessage, stayProblem, stayWords, viewsWords, type SitterSheet } from "../lib/sitter";

const sheet = (fields: Partial<SitterSheet>): SitterSheet => ({
  home_id: "h",
  address: null,
  contacts: [],
  doctor_name: null,
  doctor_phone: null,
  bedtime: null,
  rules: null,
  food: null,
  notes: null,
  updated_by: null,
  updated_at: "",
  ...fields,
});

describe("Sitter Sheet helpers", () => {
  it("puts the secret after #, so the web host never sees it (SIT-007)", () => {
    expect(linkUrl("abc123", "https://sitter.example.com/")).toBe("https://sitter.example.com/#abc123");
    expect(linkUrl("abc123", null)).toBeNull();
  });

  it("a link works until it ends or is switched off (SIT-008)", () => {
    const now = new Date("2026-10-10T12:00:00Z");
    const base = { starts_on: "2026-10-10", expires_at: "2026-10-13T05:00:00Z", revoked_at: null };
    expect(linkState(base, now, "2026-10-10")).toBe("active");
    expect(linkState({ ...base, starts_on: "2026-10-11" }, now, "2026-10-10")).toBe("upcoming");
    expect(linkState({ ...base, expires_at: "2026-10-10T11:59:59Z" }, now, "2026-10-10")).toBe("ended");
    expect(linkState({ ...base, revoked_at: "2026-10-10T01:00:00Z" }, now, "2026-10-10")).toBe("off");
  });

  it("checks a stay's dates in plain words", () => {
    expect(stayProblem("2026-10-10", "2026-10-12", "2026-10-10")).toBeNull();
    expect(stayProblem("2026-10-12", "2026-10-10", "2026-10-10")).toMatch(/before/);
    expect(stayProblem("2026-10-01", "2026-10-05", "2026-10-10")).toMatch(/ended/);
    expect(stayProblem("2026-10-10", "2026-12-10", "2026-10-10")).toMatch(/60 days/);
    expect(stayProblem("2026-10-10", "2026-12-09", "2026-10-10")).toBeNull();
  });

  it("says the dates the way people do", () => {
    expect(stayWords({ starts_on: "2026-10-09", ends_on: "2026-10-11" })).toBe("Fri, Oct 9 – Sun, Oct 11");
    expect(stayWords({ starts_on: "2026-10-09", ends_on: "2026-10-09" })).toBe("Fri, Oct 9");
    expect(shareMessage({ ends_on: "2026-10-11" }, "https://x/#t")).toContain("until the end of Sun, Oct 11");
    expect(viewsWords(0)).toBe("Not opened yet");
    expect(viewsWords(1)).toBe("Opened 1 time");
  });

  it("knows which parts of the sheet are filled in", () => {
    const s = sheet({ bedtime: "  ", doctor_phone: "555", contacts: [{ name: "Mom", phone: "1" }] });
    expect(sectionFilled(s, "bedtime")).toBe(false);
    expect(sectionFilled(s, "doctor")).toBe(true);
    expect(sectionFilled(s, "contacts")).toBe(true);
    expect(sectionFilled(null, "contacts")).toBe(false);
  });

  it("keeps only whole contacts, tidied", () => {
    expect(
      cleanContacts([
        { name: " Mom ", phone: " 555 ", note: " " },
        { name: "", phone: "" },
        { name: "Nana", phone: "556", note: "Next door" },
      ])
    ).toEqual([
      { name: "Mom", phone: "555" },
      { name: "Nana", phone: "556", note: "Next door" },
    ]);
  });
});
