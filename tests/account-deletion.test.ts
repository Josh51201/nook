import { describe, expect, it } from "vitest";

import { describeDeletion, isConfirmed, type DeletionPreview } from "../lib/account-deletion";

// The words on the Delete account screen (AUTH-003). The database side is in
// account-deletion-rls.test.ts.

const nothingSpecial: DeletionPreview = { kids: [], burrows: [], tucks: 0 };

describe("isConfirmed", () => {
  it("accepts the word however it's typed", () => {
    expect(isConfirmed("DELETE")).toBe(true);
    expect(isConfirmed("  delete ")).toBe(true);
  });

  it("refuses anything else", () => {
    expect(isConfirmed("")).toBe(false);
    expect(isConfirmed("DELET")).toBe(false);
    expect(isConfirmed("delete my account")).toBe(false);
  });
});

describe("describeDeletion", () => {
  it("always says what goes no matter what, and nothing extra when there's nothing else", () => {
    const lines = describeDeletion(nothingSpecial);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(/Wishbook/);
    expect(lines[1]).toMatch(/Burrows that still have other grown-ups stay/);
  });

  it("names Burrows that go with you", () => {
    const one = describeDeletion({ ...nothingSpecial, burrows: ["The Smiths"] }).join(" ");
    expect(one).toContain("This Burrow has no one else in it, so it's deleted too: The Smiths.");
    const three = describeDeletion({ ...nothingSpecial, burrows: ["A", "B", "C"] }).join(" ");
    expect(three).toContain("These Burrows have no one else in them");
    expect(three).toContain("A, B, and C");
  });

  it("warns about kids only you look after, and tells you how to keep them", () => {
    const text = describeDeletion({ ...nothingSpecial, kids: [{ id: "1", name: "Mia" }] }).join(" ");
    expect(text).toContain("Mia is only looked after by you");
    expect(text).toContain("hand their profile to someone first");
    const two = describeDeletion({
      ...nothingSpecial,
      kids: [
        { id: "1", name: "Mia" },
        { id: "2", name: "Leo" },
      ],
    }).join(" ");
    expect(two).toContain("Mia and Leo are only looked after by you");
  });

  it("says how many tucked gifts become available again", () => {
    expect(describeDeletion({ ...nothingSpecial, tucks: 1 }).join(" ")).toContain("The 1 gift you've tucked");
    expect(describeDeletion({ ...nothingSpecial, tucks: 4 }).join(" ")).toContain("The 4 gifts you've tucked");
  });
});
