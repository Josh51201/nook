import { describe, expect, it } from "vitest";

import { boldened, familyFor, fontFiles, labelFamily, labelSlanted, weightOf } from "../lib/fonts";

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

describe("labelFamily (CORE-076)", () => {
  it("follows the app's font by default", () => {
    expect(labelFamily(undefined, 800, "rounded")).toBe(familyFor("rounded", 800));
    expect(labelFamily("app", 400, "classic")).toBeNull();
  });

  it("uses each chosen font, with the nearest weight it has", () => {
    expect(labelFamily("handwritten", 800, "classic")).toBe("Caveat_700Bold");
    expect(labelFamily("storybook", 400, "classic")).toBe("Fraunces_600SemiBold");
    expect(labelFamily("rounded", 600, "storybook")).toBe("Nunito_600SemiBold");
    expect(labelFamily("classic", 800, "rounded")).toBeNull();
  });

  it("loads the handwriting font at start-up", () => {
    expect(fontFiles).toContain("Caveat_400Regular");
  });
});

describe("italic Hearth text (CORE-082)", () => {
  it("uses the italic font file, and every one it picks gets loaded", () => {
    expect(labelFamily("rounded", 800, "classic", true)).toBe("Nunito_800ExtraBold_Italic");
    expect(labelFamily("storybook", 400, "classic", true)).toBe("Fraunces_600SemiBold_Italic");
    for (const font of ["app", "rounded", "storybook"] as const) {
      for (const weight of [400, 500, 600, 700, 800, 900]) {
        for (const app of ["rounded", "storybook"] as const) expect(fontFiles).toContain(labelFamily(font, weight, app, true));
      }
    }
  });

  it("handwriting has no italic file, so it's slanted instead", () => {
    expect(labelFamily("handwritten", 700, "rounded", true)).toBe("Caveat_700Bold");
    expect(labelSlanted("handwritten", "rounded", true)).toBe(true);
    expect(labelSlanted("handwritten", "rounded", false)).toBe(false);
    expect(labelSlanted("rounded", "rounded", true)).toBe(false);
  });

  it("the phone's own font does italics by itself", () => {
    expect(labelFamily("classic", 700, "rounded", true)).toBeNull();
  });
});
