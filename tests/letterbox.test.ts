import { describe, expect, it } from "vitest";

import {
  addressLines,
  addressListText,
  cardSeason,
  cleanAddress,
  hasAddress,
  contactNameFor,
  labelSheetHtml,
  nextBirthday,
  seasonFor,
  seasonStatus,
} from "../lib/letterbox";

const elm = { line1: "123 Elm St", line2: "Apt 4", city: "Springfield", region: "IL", postal_code: "62704", country: null };

describe("addresses", () => {
  it("needs a street and a city", () => {
    expect(hasAddress(elm)).toBe(true);
    expect(hasAddress({ ...elm, city: " " })).toBe(false);
    expect(hasAddress(null)).toBe(false);
  });

  it("lays out mailing lines", () => {
    expect(addressLines(elm)).toEqual(["123 Elm St", "Apt 4", "Springfield, IL 62704"]);
    expect(addressLines({ ...elm, line2: "", region: "", country: "Canada" })).toEqual(["123 Elm St", "Springfield, 62704", "Canada"]);
    expect(addressLines({ ...elm, line1: null })).toEqual([]);
  });

  it("saves blanks as nothing", () => {
    expect(cleanAddress({ ...elm, line2: "  ", country: "" })).toEqual({ ...elm, line2: null, country: null });
  });
});

describe("contact names", () => {
  it("names a contact from its people", () => {
    expect(contactNameFor(["Mia Johnson"])).toBe("Mia Johnson");
    expect(contactNameFor(["Mia Johnson", "Sam Johnson"])).toBe("Mia & Sam Johnson");
    expect(contactNameFor(["Mia Johnson", "Sam Lee"])).toBe("Mia Johnson & Sam Lee");
    expect(contactNameFor(["Mia Johnson", "Sam Johnson", "Ava Johnson"])).toBe("The Johnson family");
    expect(contactNameFor(["Mia", "Sam", "Ava"])).toBe("Mia & family");
    expect(contactNameFor([" "])).toBe("");
  });
});

describe("seasons", () => {
  it("counts January cards toward last year's holidays", () => {
    expect(cardSeason(new Date(2027, 0, 10))).toBe(2026);
    expect(cardSeason(new Date(2026, 11, 20))).toBe(2026);
    expect(seasonFor("holiday", new Date(2027, 0, 3))).toBe(2026);
    expect(seasonFor("birthday", new Date(2027, 0, 3))).toBe(2027);
  });

  it("splits the holiday list into to-send and sent", () => {
    const contacts = [
      { id: "a", on_holiday_list: true },
      { id: "b", on_holiday_list: true },
      { id: "c", on_holiday_list: false },
      { id: "d", on_holiday_list: false },
    ];
    const cards = [
      { contact_id: "a", direction: "sent" as const, occasion: "holiday", season: 2026 },
      { contact_id: "b", direction: "sent" as const, occasion: "holiday", season: 2025 },
      { contact_id: "b", direction: "sent" as const, occasion: "birthday", season: 2026 },
      { contact_id: "c", direction: "received" as const, occasion: "holiday", season: 2026 },
      { contact_id: "d", direction: "sent" as const, occasion: "holiday", season: 2026 },
    ];
    const status = seasonStatus(contacts, cards, 2026);
    expect(status.toSend.map((h) => h.id)).toEqual(["b"]);
    // d was sent one even though it's off the list, so it counts as done.
    expect(status.sent.map((h) => h.id)).toEqual(["a", "d"]);
    expect(status.gotFrom.map((h) => h.id)).toEqual(["c"]);
    expect(status.worthAdding.map((h) => h.id)).toEqual(["c"]);
    expect(status.total).toBe(3);
  });
});

describe("birthdays", () => {
  const now = new Date(2026, 9, 8, 15, 0);
  it("finds the next one", () => {
    expect(nextBirthday("1990-10-15", now).days).toBe(7);
    expect(nextBirthday("1990-10-08", now).days).toBe(0);
    expect(nextBirthday("1990-10-01", now).date).toEqual(new Date(2027, 9, 1));
  });
  it("puts Feb 29 on Mar 1 in other years", () => {
    expect(nextBirthday("2000-02-29", now).date).toEqual(new Date(2027, 2, 1));
    expect(nextBirthday("2000-02-29", new Date(2027, 5, 1)).date).toEqual(new Date(2028, 1, 29));
  });
});

describe("labels", () => {
  const labels = Array.from({ length: 31 }, (_, i) => ({ name: `Family <${i}>`, lines: ["1 Main St", "Town, ST 00000"] }));
  it("fills 30 to a sheet and escapes names", () => {
    const html = labelSheetHtml(labels);
    expect(html.match(/class="page"/g)).toHaveLength(2);
    expect(html.match(/class="label"/g)).toHaveLength(31);
    expect(html).toContain("Family &lt;0&gt;");
    expect(html).not.toContain("Family <0>");
  });
  it("copies as plain text", () => {
    expect(addressListText(labels.slice(0, 2))).toBe("Family <0>\n1 Main St\nTown, ST 00000\n\nFamily <1>\n1 Main St\nTown, ST 00000");
  });
});
