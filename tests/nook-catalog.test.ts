import { describe, expect, it } from "vitest";

import { findNook, nookAisles, nookCatalog, nookMatches, shortNookName } from "../lib/nooks";

// CORE-088: the Market and the Nooks tab group Nooks into sections and have
// a search box.
describe("Nook catalog sections", () => {
  it("puts every Nook in one of the Market's sections", () => {
    const aisles = new Set(nookAisles.map((aisle) => aisle.id));
    for (const nook of nookCatalog) expect(aisles.has(nook.aisle), nook.id).toBe(true);
  });

  it("has no empty sections", () => {
    for (const aisle of nookAisles) expect(nookCatalog.some((nook) => nook.aisle === aisle.id), aisle.id).toBe(true);
  });
});

describe("nookMatches", () => {
  const getaway = findNook("getaways")!;

  it("finds a Nook by its name, tagline or description, any case", () => {
    expect(nookMatches(getaway, "getaway")).toBe(true);
    expect(nookMatches(getaway, "PACKED")).toBe(true);
    expect(nookMatches(getaway, "packed ready")).toBe(true);
    expect(nookMatches(getaway, "  ")).toBe(true);
  });

  it("needs every word to match", () => {
    expect(nookMatches(getaway, "getaway recipe")).toBe(false);
  });
});

describe("shortNookName", () => {
  it("drops the trailing Nook for labels under icons", () => {
    expect(shortNookName(findNook("getaways")!)).toBe("Getaway");
    expect(shortNookName(findNook("to-do")!)).toBe("To-Do List");
  });
});
