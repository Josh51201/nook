import { describe, expect, it } from "vitest";

import {
  absenceNote,
  cleanSymptom,
  doctorSummary,
  doseTimers,
  doseWait,
  formatTemp,
  historyByPerson,
  isFever,
  lastHad,
  medicinesFor,
  missedWords,
  normalizeIngredient,
  parseTemp,
  ruleOf,
  sickHelperActive,
  spellDay,
  spellDays,
  symptomTally,
  tempPoints,
  timerWords,
  toggleDay,
  untilWords,
  type Dose,
  type LogEntry,
  type Medicine,
  type Spell,
} from "../lib/sickday";

const H = 3600_000;
const base = new Date("2026-10-09T12:00:00Z").getTime();
const iso = (offsetHours: number) => new Date(base + offsetHours * H).toISOString();

function med(over: Partial<Medicine> = {}): Medicine {
  return {
    id: "tylenol",
    home_id: "home",
    name: "Children's Tylenol",
    ingredients: ["acetaminophen"],
    amount: "5 mL",
    every_hours: 4,
    max_per_day: 5,
    for_profile: null,
    notes: null,
    created_by: null,
    ...over,
  };
}

function dose(offsetHours: number, over: Partial<Dose> = {}): Dose {
  return {
    id: `d${offsetHours}${over.medicine_name ?? ""}`,
    spell_id: "spell",
    medicine_id: "tylenol",
    medicine_name: "Children's Tylenol",
    ingredients: ["acetaminophen"],
    amount: "5 mL",
    every_hours: 4,
    max_per_day: 5,
    given_at: iso(offsetHours),
    given_by: "josh",
    early: false,
    ...over,
  };
}

function spell(over: Partial<Spell> = {}): Spell {
  return {
    id: "spell",
    home_id: "home",
    patient_id: "mia",
    title: "Flu",
    started_on: "2026-10-07",
    ended_on: null,
    missed_from: "school",
    missed_days: [],
    notes: null,
    tz: "America/Chicago",
    created_by: "josh",
    created_at: iso(-48),
    ...over,
  };
}

function entry(offsetHours: number, over: Partial<LogEntry> = {}): LogEntry {
  return {
    id: `l${offsetHours}`,
    spell_id: "spell",
    logged_at: iso(offsetHours),
    logged_by: "josh",
    temp_c: null,
    temp_where: null,
    symptoms: [],
    note: null,
    ...over,
  };
}

describe("temperatures (SICK-003)", () => {
  it("reads °F and °C and keeps them in °C", () => {
    expect(parseTemp("101.3", "f")).toBe(38.5);
    expect(parseTemp("38.5", "c")).toBe(38.5);
    expect(parseTemp("38,5", "c")).toBe(38.5);
    expect(formatTemp(38.5, "f")).toBe("101.3°F");
    expect(formatTemp(38.5, "c")).toBe("38.5°C");
  });

  it("round-trips a typed °F reading without drifting", () => {
    for (const f of ["98.6", "100.1", "100.4", "102.7", "104.0"]) {
      expect(formatTemp(parseTemp(f, "f")!, "f", false)).toBe(Number(f).toFixed(1));
    }
  });

  it("reads a number in the other unit when only that makes sense", () => {
    expect(parseTemp("38.5", "f")).toBe(38.5);
    expect(formatTemp(parseTemp("99.5", "c")!, "f")).toBe("99.5°F");
  });

  it("refuses what isn't a body temperature", () => {
    expect(parseTemp("", "f")).toBeNull();
    expect(parseTemp("150", "f")).toBeNull();
    expect(parseTemp("20", "c")).toBeNull();
    expect(parseTemp("abc", "f")).toBeNull();
  });

  it("calls 100.4 °F / 38 °C a fever", () => {
    expect(isFever(parseTemp("100.4", "f"))).toBe(true);
    expect(isFever(parseTemp("100.3", "f"))).toBe(false);
    expect(isFever(38)).toBe(true);
    expect(isFever(null)).toBe(false);
  });

  it("charts temperatures oldest first, skipping symptom-only entries", () => {
    const points = tempPoints([entry(2, { temp_c: 39 }), entry(1, { symptoms: ["Cough"] }), entry(0, { temp_c: 38 })]);
    expect(points.map((p) => p.c)).toEqual([38, 39]);
  });
});

describe("when the next dose is OK (SICK-004)", () => {
  const tylenol = ruleOf(med());

  it("is OK with nothing given", () => {
    expect(doseWait([], tylenol, base)).toBeNull();
  });

  it("waits out the hours between doses", () => {
    const wait = doseWait([dose(-1)], tylenol, base);
    expect(wait).toEqual({ safeAt: base + 3 * H, reason: "gap" });
    expect(doseWait([dose(-4)], tylenol, base)).toBeNull();
  });

  it("counts a different medicine with the same thing in it (Tylenol and NyQuil)", () => {
    const nyquil = dose(-2, { medicine_id: "nyquil", medicine_name: "NyQuil", ingredients: ["acetaminophen", "dextromethorphan"], every_hours: 6 });
    // The longer of the two gaps wins.
    expect(doseWait([nyquil], tylenol, base)).toEqual({ safeAt: base + 4 * H, reason: "gap" });
    // Ibuprofen shares nothing, so it's fine to give alongside.
    const motrin = ruleOf(med({ id: "motrin", name: "Motrin", ingredients: ["ibuprofen"], every_hours: 6 }));
    expect(doseWait([nyquil], motrin, base)).toBeNull();
  });

  it("matches typed medicines by name, whatever the capitals", () => {
    const typed = dose(-1, { medicine_id: null, medicine_name: "children's tylenol", ingredients: [], every_hours: null, max_per_day: null });
    expect(doseWait([typed], tylenol, base)?.safeAt).toBe(base + 3 * H);
  });

  it("stops at the most a day, until the oldest is a day old", () => {
    const five = [-20, -16, -12, -8, -4].map((h) => dose(h));
    const wait = doseWait(five, tylenol, base);
    expect(wait).toEqual({ safeAt: base + 4 * H, reason: "day" });
    // With only four in the last day, it's just the gap.
    expect(doseWait(five.slice(1), tylenol, base)).toBeNull();
  });

  it("checks a dose added for earlier against the ones after it", () => {
    expect(doseWait([dose(-1)], tylenol, base - 3 * H)).not.toBeNull();
    expect(doseWait([dose(-1)], tylenol, base - 6 * H)).toBeNull();
  });

  it("keeps no timer when neither has hours or a limit", () => {
    const rule = ruleOf(med({ every_hours: null, max_per_day: null }));
    expect(doseWait([dose(-1, { every_hours: null, max_per_day: null })], rule, base)).toBeNull();
  });

  it("gives one timer per medicine, newest first, counting doses from another spell", () => {
    const motrin = dose(-0.5, { medicine_id: "motrin", medicine_name: "Motrin", ingredients: ["ibuprofen"], every_hours: 6 });
    const yesterday = dose(-2, { spell_id: "older" });
    const timers = doseTimers([motrin], [motrin, yesterday], base);
    expect(timers.map((t) => t.name)).toEqual(["Motrin"]);
    expect(timers[0].wait?.safeAt).toBe(base + 5.5 * H);

    const both = doseTimers([motrin, dose(-5)], [motrin, dose(-5)], base);
    expect(both.map((t) => [t.name, t.wait === null])).toEqual([
      ["Motrin", false],
      ["Children's Tylenol", true],
    ]);
    expect(timerWords(both[1], base)).toBe("OK now");
  });

  it("says how long is left", () => {
    expect(untilWords(80 * 60_000)).toBe("1 h 20 min");
    expect(untilWords(45 * 60_000)).toBe("45 min");
    expect(untilWords(2 * H)).toBe("2 h");
    expect(untilWords(-5)).toBe("now");
  });
});

describe("the medicine cabinet (SICK-005)", () => {
  it("folds the usual other names into one", () => {
    expect(normalizeIngredient("  Paracetamol ")).toBe("acetaminophen");
    expect(normalizeIngredient("Advil")).toBe("ibuprofen");
    expect(normalizeIngredient("Zinc  Oxide")).toBe("zinc oxide");
  });

  it("only offers someone their own medicines and everyone's", () => {
    const list = medicinesFor([med({ id: "a", name: "Tylenol" }), med({ id: "b", name: "Amoxicillin", for_profile: "mia" }), med({ id: "c", name: "Dad's pills", for_profile: "josh" })], "mia");
    expect(list.map((m) => m.id)).toEqual(["b", "a"]);
  });
});

describe("the sick spell (SICK-001, SICK-011, SICK-012)", () => {
  it("counts days from the day it started", () => {
    expect(spellDay(spell(), "2026-10-09")).toBe(3);
    expect(spellDay(spell({ ended_on: "2026-10-08" }), "2026-10-20")).toBe(2);
  });

  it("lists the days it covers for ticking missed ones", () => {
    expect(spellDays(spell(), "2026-10-09")).toEqual(["2026-10-07", "2026-10-08", "2026-10-09"]);
    expect(toggleDay(["2026-10-08"], "2026-10-07")).toEqual(["2026-10-07", "2026-10-08"]);
    expect(toggleDay(["2026-10-08"], "2026-10-08")).toEqual([]);
  });

  it("words the missed days and writes a note for school", () => {
    const s = spell({ missed_days: ["2026-10-08", "2026-10-07"] });
    expect(missedWords(s)).toBe("Missed 2 days of school");
    const note = absenceNote(s, "Mia Collins", "Josh Collins");
    expect(note).toContain("Mia Collins was home sick (flu) and missed school on");
    expect(note.indexOf("October 7")).toBeLessThan(note.indexOf("October 8"));
    expect(note).toContain("while Mia recovered");
    expect(note.trim().endsWith("Josh Collins")).toBe(true);
  });

  it("keeps history by person, with the last year's count", () => {
    const history = historyByPerson(
      [
        spell({ id: "a", started_on: "2026-03-01", ended_on: "2026-03-04", missed_days: ["2026-03-02", "2026-03-03"] }),
        spell({ id: "b", started_on: "2024-01-01", ended_on: "2024-01-02" }),
        spell({ id: "c", patient_id: "josh", started_on: "2026-09-01", ended_on: "2026-09-02" }),
      ],
      "2026-10-09"
    );
    expect(history.get("mia")!.spells.map((s) => s.id)).toEqual(["a", "b"]);
    expect(history.get("mia")!.timesThisYear).toBe(1);
    expect(history.get("mia")!.missedThisYear).toBe(2);
  });

  it("remembers when they last had the same thing", () => {
    const spells = [spell({ id: "now", title: "Strep throat" }), spell({ id: "march", title: "strep throat", started_on: "2026-03-01" })];
    expect(lastHad(spells, "Strep throat", "now")).toMatch(/^Last had strep throat in March 2026/);
    expect(lastHad(spells, "Flu", "now")).toBeNull();
  });

  it("tidies typed symptoms and tallies them", () => {
    expect(cleanSymptom("  sore   ear ")).toBe("Sore ear");
    const tally = symptomTally([entry(0, { symptoms: ["Cough"] }), entry(1, { symptoms: ["Cough", "Rash"] })]);
    expect(tally[0]).toMatchObject({ name: "Cough", count: 2, first: iso(0) });
  });
});

describe("the doctor summary (SICK-007)", () => {
  it("has the start, allergies, highest temperature, symptoms and every dose", () => {
    const text = doctorSummary({
      spell: spell({ missed_days: ["2026-10-08"] }),
      patientName: "Mia",
      allergies: ["Penicillin"],
      log: [entry(-30, { temp_c: 38.2 }), entry(-2, { temp_c: 39.4, symptoms: ["Cough"] }), entry(-1, { note: "Ate some toast" })],
      doses: [dose(-6), dose(-1, { amount: "7.5 mL" })],
      unit: "f",
      now: base,
      names: (id) => (id === "josh" ? "me" : "someone"),
    });
    expect(text).toContain("Mia: Flu");
    expect(text).toContain("(day 3)");
    expect(text).toContain("Allergies: Penicillin");
    expect(text).toContain("Highest: 102.9°F");
    expect(text).toContain("Cough");
    expect(text).toContain("Children's Tylenol 7.5 mL by me");
    expect(text).toContain("Ate some toast");
    expect(text).toContain("Missed 1 day of school");
    // Newest dose first.
    expect(text.indexOf("7.5 mL")).toBeLessThan(text.indexOf("5 mL by"));
  });
});

describe("helpers (SICK-002)", () => {
  it("lasts until their day, and stops the day after they're better", () => {
    expect(sickHelperActive(null, spell(), "2026-10-09")).toBe(true);
    expect(sickHelperActive("2026-10-08", spell(), "2026-10-09")).toBe(false);
    expect(sickHelperActive(null, spell({ ended_on: "2026-10-08" }), "2026-10-09")).toBe(true);
    expect(sickHelperActive(null, spell({ ended_on: "2026-10-07" }), "2026-10-09")).toBe(false);
  });
});
