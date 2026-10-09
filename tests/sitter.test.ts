import { describe, expect, it } from "vitest";

import {
  applyPreset,
  cleanContacts,
  cleanRoutine,
  endsWords,
  linkState,
  linkUrl,
  pastSitters,
  reusePicks,
  routineNow,
  sectionFilled,
  shareMessage,
  sitterPageUrl,
  stayProblem,
  stayWords,
  viewsWords,
  type SitterSheet,
} from "../lib/sitter";

const sheet = (fields: Partial<SitterSheet>): SitterSheet => ({
  home_id: "h",
  address: null,
  contacts: [],
  doctor_name: null,
  doctor_phone: null,
  routine: [],
  bedtime: null,
  wifi_name: null,
  wifi_password: null,
  places: null,
  codes: null,
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

  it("adds https:// when the page address is missing it", () => {
    expect(sitterPageUrl("nook-sitter.netlify.app")).toBe("https://nook-sitter.netlify.app");
    expect(sitterPageUrl(" https://nook-sitter.netlify.app ")).toBe("https://nook-sitter.netlify.app");
    expect(sitterPageUrl("")).toBeNull();
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

  it("the routine knows what's on now and what's next (SIT-010)", () => {
    const steps = [
      { time: "20:00", what: "Bed" },
      { time: "15:15", what: "Pickup" },
      { time: "17:30", what: "Dinner" },
    ];
    expect(routineNow(steps, "14:00")).toMatchObject({ now: -1, next: 0 });
    expect(routineNow(steps, "15:15")).toMatchObject({ now: 0, next: 1 });
    expect(routineNow(steps, "18:00")).toMatchObject({ now: 1, next: 2 });
    expect(routineNow(steps, "22:00")).toMatchObject({ now: 2, next: -1 });
    expect(routineNow(steps, "18:00").steps.map((s) => s.what)).toEqual(["Pickup", "Dinner", "Bed"]);
    expect(cleanRoutine([{ time: "20:00", what: " Bed " }, { time: "09:00", what: "  " }, { time: "7:00", what: "Bad time" }])).toEqual([
      { time: "20:00", what: "Bed" },
    ]);
  });

  it("presets only pick what's filled in, and never codes (SIT-012, SIT-013)", () => {
    const s = sheet({ contacts: [{ name: "Mom", phone: "1" }], codes: "4321", wifi_name: "Nook", routine: [{ time: "08:00", what: "Up" }] });
    const babysitter = applyPreset("babysitter", s, ["kid"], ["pet"]);
    expect(babysitter.sections).toEqual(["contacts", "routine", "wifi"]);
    expect(babysitter.kidIds).toEqual(["kid"]);
    const house = applyPreset("house", s, ["kid"], ["pet"]);
    expect(house.sections).toEqual(["contacts", "wifi"]);
    expect(house.kidIds).toEqual([]);
    expect(house.petIds).toEqual(["pet"]);
    for (const key of ["babysitter", "house", "pets"] as const) expect(applyPreset(key, s, [], []).sections).not.toContain("codes");
  });

  it("'same as last time' lists each sitter once, newest first, and drops kids or pets who've left", () => {
    const links = [
      { id: "1", label: "Grandma", created_at: "2026-01-01" },
      { id: "2", label: "Babysitter Sam", created_at: "2026-03-01" },
      { id: "3", label: "grandma ", created_at: "2026-05-01" },
    ];
    expect(pastSitters(links).map((l) => l.id)).toEqual(["3", "2"]);
    expect(reusePicks({ sections: ["contacts"], kid_ids: ["a", "gone"], pet_ids: ["p"] }, ["a"], ["p"])).toEqual({
      sections: ["contacts"],
      kidIds: ["a"],
      petIds: ["p"],
    });
  });

  it("says when a link ends in a few words for the Hearth (SIT-009)", () => {
    expect(endsWords({ starts_on: "2026-10-09", ends_on: "2026-10-09" }, "2026-10-09")).toBe("ends today");
    expect(endsWords({ starts_on: "2026-10-09", ends_on: "2026-10-10" }, "2026-10-09")).toBe("ends tmrw");
    expect(endsWords({ starts_on: "2026-10-09", ends_on: "2026-10-11" }, "2026-10-09")).toBe("ends Sun");
    expect(endsWords({ starts_on: "2026-10-09", ends_on: "2026-10-30" }, "2026-10-09")).toBe("ends Oct 30");
    expect(endsWords({ starts_on: "2026-10-10", ends_on: "2026-10-12" }, "2026-10-09")).toBe("starts tmrw");
  });
});
