import { describe, expect, it } from "vitest";

import {
  cakeCandles,
  chainLinks,
  clockWords,
  slipCount,
  SLIPS_HELD,
  sundialAngle,
  timeFraction,
  wheelAngle,
  wrapsFace,
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

describe("more faces (CORE-131)", () => {
  it("the word clock says the time to the nearest five minutes", () => {
    expect(clockWords(new Date(2026, 9, 12, 16, 10))).toBe("ten past four");
    expect(clockWords(new Date(2026, 9, 12, 16, 44))).toBe("quarter to five");
    expect(clockWords(new Date(2026, 9, 12, 18, 1))).toBe("six o'clock");
    expect(clockWords(new Date(2026, 9, 12, 23, 58))).toBe("twelve o'clock");
    expect(clockWords(new Date(2026, 9, 12, 0, 30))).toBe("half past twelve");
    expect(clockWords(new Date(2026, 9, 12, 9, 35))).toBe("twenty-five to ten");
  });

  it("the sundial's shadow swings left to right through the day and rests at night", () => {
    expect(sundialAngle(new Date(2026, 9, 12, 3))).toBeNull();
    expect(sundialAngle(new Date(2026, 9, 12, 22))).toBeNull();
    expect(sundialAngle(new Date(2026, 9, 12, 9))!).toBeLessThan(0);
    expect(sundialAngle(new Date(2026, 9, 12, 13))).toBe(0);
    expect(sundialAngle(new Date(2026, 9, 12, 19, 30))).toBe(90);
  });

  it("a timer's fraction left stays between 0 and 1", () => {
    expect(timeFraction(600, 300)).toBe(0.5);
    expect(timeFraction(600, 900)).toBe(1);
    expect(timeFraction(0, 10)).toBe(0);
  });

  it("the spinner wheel always turns forward to put the name under the pointer", () => {
    const first = wheelAngle(0, 4);
    expect(((first % 360) + 360) % 360).toBe(315);
    const next = wheelAngle(1, 4, first);
    expect(next).toBeGreaterThanOrEqual(first);
    expect((((next % 360) + 360) % 360)).toBe(225);
    expect(wheelAngle(1, 4, first, 2) - next).toBe(720);
  });

  it("the jar holds up to its fill of slips", () => {
    expect(slipCount(3)).toBe(3);
    expect(slipCount(500)).toBe(SLIPS_HELD);
  });

  it("the cake gets a candle a year up to nine, then number candles", () => {
    expect(cakeCandles(5)).toEqual({ count: 5, digits: null });
    expect(cakeCandles(42)).toEqual({ count: 0, digits: ["4", "2"] });
    expect(cakeCandles(null).count).toBe(3);
  });

  it("lists can be wrapped in paper and keep working", () => {
    expect(wrapsFace({ kind: "reminders", face: "receipt" })).toBe(true);
    expect(wrapsFace({ kind: "groceries", face: "notepad" })).toBe(true);
    expect(wrapsFace({ kind: "recipe", face: "card" })).toBe(true);
    expect(wrapsFace({ kind: "getaway", face: "tag" })).toBe(false);
    expect(ownFrame({ kind: "reminders", face: "receipt" })).toBe(true);
  });
});
