import { describe, expect, it } from "vitest";

import { scaledType, textScaleFor } from "../lib/text-size";

describe("textScaleFor", () => {
  it("leaves Normal alone, whatever the phone is set to", () => {
    expect(textScaleFor("normal", 1)).toBe(1);
    expect(textScaleFor("normal", 1.5)).toBe(1);
    expect(textScaleFor(undefined, 1)).toBe(1);
  });

  it("makes Large and Extra large bigger on a standard phone", () => {
    expect(textScaleFor("large", 1)).toBeCloseTo(1.15);
    expect(textScaleFor("xlarge", 1)).toBeCloseTo(1.3);
  });

  it("never stacks on top of the phone's own big text", () => {
    // 1.15 × 1.3 would be ~1.5; instead the total stays at 1.3.
    expect(textScaleFor("xlarge", 1.15) * 1.15).toBeCloseTo(1.3);
    // The phone already goes bigger than Large: add nothing.
    expect(textScaleFor("large", 1.4)).toBe(1);
  });

  it("copes with a nonsense phone scale", () => {
    expect(textScaleFor("large", 0)).toBeCloseTo(1.15);
  });
});

describe("scaledType", () => {
  it("scales the size and the line height together", () => {
    expect(scaledType(20, 28, 1.5)).toEqual({ fontSize: 30, lineHeight: 42 });
  });

  it("treats text with no size as 14, and adds no line height of its own", () => {
    expect(scaledType(undefined, undefined, 2)).toEqual({ fontSize: 28 });
  });
});
