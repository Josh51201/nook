import { describe, expect, it } from "vitest";

import { lookSummary, sizeSummary, tagsSummary } from "../lib/summaries";

describe("lookSummary", () => {
  it("names the style, corners and shadow", () => {
    expect(lookSummary({ look: "bold", corners: "round", lift: "raised" })).toBe("Bold · Round corners · Raised shadow");
  });

  it("uses the defaults when nothing's been picked", () => {
    expect(lookSummary({ look: "soft" })).toBe("Soft · Soft corners · Soft shadow");
    expect(lookSummary({ defaultLift: "raised" })).toBe("Soft corners · Raised shadow");
  });

  it("mentions a border", () => {
    expect(lookSummary({ look: "outline", border: true })).toContain("Outlined");
  });
});

describe("sizeSummary", () => {
  const presets = [
    { label: "Small", w: 2, h: 2 },
    { label: "Wide", w: 4, h: 2 },
  ];

  it("uses the preset's name when it matches", () => {
    expect(sizeSummary(presets, 4, 2)).toBe("Wide");
  });

  it("falls back to the grid size, and says when it's locked", () => {
    expect(sizeSummary(presets, 3, 2, true)).toBe("3 × 2 · Locked");
  });
});

describe("tagsSummary", () => {
  it("shows a couple of tags, then how many more", () => {
    expect(tagsSummary(undefined)).toBe("None");
    expect(tagsSummary(["Kids"])).toBe("Kids");
    expect(tagsSummary(["Kids", "Home", "Gifts", "Pets"])).toBe("Kids, Home +2");
  });
});
