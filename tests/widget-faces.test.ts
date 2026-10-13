import { describe, expect, it } from "vitest";

import {
  chainLinks,
  faceLabel,
  faceOf,
  facesFor,
  flameSize,
  flipDigits,
  JAR_HOLDS,
  jarMarbles,
  luckyNumbers,
  naturalFace,
  ownFrame,
  plantStage,
  surpriseFace,
  widgetFaces,
} from "../lib/widget-faces";
import { defaultWidget, widgetKinds } from "../lib/widgets";

// Widget faces (CORE-127).

describe("faces", () => {
  it("every kind with faces starts its list with the classic look", () => {
    for (const faces of Object.values(widgetFaces)) {
      expect(faces![0].key).toBe("classic");
      expect(new Set(faces!.map((f) => f.key)).size).toBe(faces!.length);
    }
  });

  it("an unknown or missing face shows the classic one", () => {
    expect(faceOf({ kind: "countdown" })).toBe("classic");
    expect(faceOf({ kind: "countdown", face: "hoop" })).toBe("classic");
    expect(faceOf({ kind: "note", face: "flip" })).toBe("classic");
    expect(faceOf({ kind: "countdown", face: "flip" })).toBe("flip");
    expect(faceLabel({ kind: "countdown", face: "chain" })).toBe("Paper chain");
  });

  it("only the hoop, letter board and carved sign are their own frame", () => {
    expect(ownFrame({ kind: "quote", face: "hoop" })).toBe(true);
    expect(ownFrame({ kind: "menu", face: "letterboard" })).toBe(true);
    expect(ownFrame({ kind: "greeting", face: "sign" })).toBe(true);
    expect(ownFrame({ kind: "quote", face: "typewriter" })).toBe(false);
    expect(ownFrame({ kind: "greeting", face: "bunting" })).toBe(false);
  });

  it("a new quote starts in its embroidery hoop; others start classic", () => {
    expect(defaultWidget("quote").face).toBe("hoop");
    for (const { kind } of widgetKinds) {
      const face = defaultWidget(kind).face;
      if (face) expect(facesFor(kind).some((f) => f.key === face)).toBe(true);
      expect(face).toBe(naturalFace(kind));
    }
  });

  it("Surprise me picks a different face, and leaves kinds without faces alone", () => {
    for (let i = 0; i < 10; i++) expect(surpriseFace({ kind: "streak", face: "candle" }, i / 10)).not.toBe("candle");
    expect(surpriseFace({ kind: "note" }, 0.5)).toBeUndefined();
  });
});

describe("countdown faces", () => {
  it("a paper chain draws what fits and counts the rest", () => {
    expect(chainLinks(23, 30)).toEqual({ shown: 23, more: 0 });
    expect(chainLinks(40, 23)).toEqual({ shown: 23, more: 17 });
    expect(chainLinks(-3, 10)).toEqual({ shown: 0, more: 0 });
  });

  it("a flip clock shows at least two digits", () => {
    expect(flipDigits(7)).toEqual(["0", "7"]);
    expect(flipDigits(123)).toEqual(["1", "2", "3"]);
    expect(flipDigits(-4)).toEqual(["0", "4"]);
  });
});

describe("streak faces", () => {
  it("the plant grows leaves and flowers at a week", () => {
    expect(plantStage(0)).toMatchObject({ pairs: 0, flower: false });
    expect(plantStage(3)).toMatchObject({ pairs: 2, flower: false });
    expect(plantStage(7).flower).toBe(true);
    expect(plantStage(100).pairs).toBe(6);
    expect(plantStage(100).height).toBe(1);
  });

  it("the candle is out with no streak and burns bigger as it grows", () => {
    expect(flameSize(0, false)).toBe(0);
    expect(flameSize(10, true)).toBeGreaterThan(flameSize(2, true));
    expect(flameSize(5, false)).toBeLessThan(flameSize(5, true));
    expect(flameSize(1000, true)).toBe(1);
  });

  it("the jar holds a marble a day, up to full", () => {
    expect(jarMarbles(5)).toBe(5);
    expect(jarMarbles(500)).toBe(JAR_HOLDS);
  });
});

it("lucky numbers are six different ones, the same all day", () => {
  const a = luckyNumbers(new Date(2026, 9, 12, 8));
  expect(a).toHaveLength(6);
  expect(new Set(a).size).toBe(6);
  expect(luckyNumbers(new Date(2026, 9, 12, 22))).toEqual(a);
  expect(a.every((n) => n >= 1 && n <= 49)).toBe(true);
});
