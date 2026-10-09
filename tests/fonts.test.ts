import { describe, expect, it } from "vitest";

import { boldened, familyFor, fontFiles, weightOf } from "../lib/fonts";

describe("fonts (CORE-035)", () => {
  it("reads any way of writing a weight", () => {
    expect(weightOf(undefined)).toBe(400);
    expect(weightOf("normal")).toBe(400);
    expect(weightOf("bold")).toBe(700);
    expect(weightOf("800")).toBe(800);
    expect(weightOf(650)).toBe(700);
    expect(weightOf("300")).toBe(400); // nothing lighter than regular
  });

  it("classic uses the phone's own font", () => {
    expect(familyFor("classic", 700)).toBeNull();
  });

  it("rounded is Nunito at every weight", () => {
    expect(familyFor("rounded", 400)).toBe("Nunito_400Regular");
    expect(familyFor("rounded", 800)).toBe("Nunito_800ExtraBold");
  });

  it("storybook puts Fraunces on headings and Nunito on everything else", () => {
    expect(familyFor("storybook", 700)).toBe("Fraunces_700Bold");
    expect(familyFor("storybook", 500)).toBe("Nunito_500Medium");
  });

  it("every font it can pick is one that gets loaded", () => {
    for (const font of ["rounded", "storybook"] as const) {
      for (const weight of [400, 500, 600, 700, 800, 900]) {
        expect(fontFiles).toContain(familyFor(font, weight));
      }
    }
  });
});

describe("boldened (CORE-075)", () => {
  it("goes two steps heavier when the phone's Bold Text is on, up to the heaviest", () => {
    expect(boldened(400, true)).toBe(600);
    expect(boldened(800, true)).toBe(900);
    expect(boldened(600, false)).toBe(600);
  });
});
