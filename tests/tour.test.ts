import { describe, expect, it } from "vitest";

import {
  BUBBLE_MARGIN,
  HOLE_PADDING,
  holePath,
  isWithin,
  placeBubble,
  resolveSteps,
  revealOffset,
  firstTour,
  type TourStep,
} from "../lib/tour";

const phone = { width: 390, height: 844 };
const phoneBounds = { x: 0, y: 0, ...phone };

describe("resolveSteps", () => {
  const steps: TourStep[] = [
    { icon: "hearth", title: "Welcome", body: "" },
    { icon: "add", target: "add", title: "Add", body: "" },
    { icon: "drag", target: "edit", optional: true, title: "Edit", body: "" },
  ];

  it("keeps every step when every target is on screen", () => {
    expect(resolveSteps(steps, new Set(["add", "edit"]))).toEqual(steps);
  });

  it("skips optional steps whose target isn't there (e.g. Edit on an empty Hearth)", () => {
    expect(resolveSteps(steps, new Set(["add"])).map((s) => s.title)).toEqual(["Welcome", "Add"]);
  });

  it("still shows required steps without a target, just in the middle of the screen", () => {
    const resolved = resolveSteps(steps, new Set());
    expect(resolved.map((s) => s.title)).toEqual(["Welcome", "Add"]);
    expect(resolved[1].target).toBeUndefined();
  });

  it("never drops the tour down to nothing", () => {
    expect(resolveSteps(firstTour, new Set()).length).toBeGreaterThan(0);
  });

  it("keeps steps on another tab as they are, to be found once the tour gets there", () => {
    // Starting on the Hearth, the Burrows tab's targets don't exist yet.
    const resolved = resolveSteps(firstTour, new Set(["hearth-inbox", "hearth-add", "tab-burrows", "tab-settings"]));
    const onBurrows = resolved.filter((step) => step.screen === "burrows");
    expect(onBurrows.map((step) => step.target)).toEqual(["burrows-home", "burrows-start", "burrows-code"]);
    const onNooks = resolved.filter((step) => step.screen === "nooks");
    expect(onNooks.map((step) => step.target)).toEqual(["nooks-first"]);
  });

  it("is one tour: it visits the Nooks and Burrows tabs, and ends on a step that works from any tab", () => {
    expect(firstTour.some((step) => step.screen === "nooks")).toBe(true);
    expect(firstTour.some((step) => step.screen === "burrows")).toBe(true);
    expect(firstTour.at(-1)?.screen).toBeUndefined();
  });
});

describe("isWithin", () => {
  it("accepts a target that's fully visible", () => {
    expect(isWithin({ x: 20, y: 700, width: 100, height: 48 }, phoneBounds)).toBe(true);
  });

  it("rejects targets scrolled off screen, missing, or collapsed", () => {
    expect(isWithin({ x: 20, y: 900, width: 100, height: 48 }, phoneBounds)).toBe(false);
    expect(isWithin({ x: 20, y: -30, width: 100, height: 48 }, phoneBounds)).toBe(false);
    expect(isWithin(null, phoneBounds)).toBe(false);
    expect(isWithin({ x: 20, y: 20, width: 0, height: 0 }, phoneBounds)).toBe(false);
  });

  it("treats a target hidden behind the tab bar as out of view", () => {
    // The Hearth's list ends at the tab bar (y = 760); the Add button is under it.
    const list = { x: 0, y: 60, width: 390, height: 700 };
    expect(isWithin({ x: 20, y: 740, width: 170, height: 50 }, list)).toBe(false);
  });
});

describe("revealOffset", () => {
  const list = { x: 0, y: 60, width: 390, height: 700 };

  it("leaves the list alone when the target is already comfortably in view", () => {
    expect(revealOffset({ x: 20, y: 300, width: 170, height: 50 }, list, 0, 2000)).toBeNull();
  });

  it("scrolls down to an Add button below a full Hearth, bringing it to the middle", () => {
    const addButton = { x: 20, y: 1500, width: 170, height: 50 };
    const next = revealOffset(addButton, list, 0, 2000);
    expect(next).toBe(1500 + 25 - (60 + 350));
    // ...after which it's in view.
    const moved = { ...addButton, y: addButton.y - next! };
    expect(isWithin(moved, list)).toBe(true);
  });

  it("never scrolls past the end of the list", () => {
    const next = revealOffset({ x: 20, y: 1900, width: 170, height: 50 }, list, 0, 2000);
    expect(next).toBe(2000 - 700);
  });

  it("scrolls back up to something above the view, but never past the top", () => {
    expect(revealOffset({ x: 300, y: 20, width: 60, height: 30 }, list, 900, 2000)).toBe(900 + 35 - 410);
    expect(revealOffset({ x: 300, y: -200, width: 60, height: 30 }, list, 100, 2000)).toBe(0);
  });

  it("gives up (null) when the list can't move any closer", () => {
    expect(revealOffset({ x: 20, y: 740, width: 170, height: 50 }, list, 1300, 2000)).toBeNull();
  });
});

describe("placeBubble", () => {
  it("goes in the middle when there's nothing to point at", () => {
    expect(placeBubble(null, phone)).toEqual({ side: "center" });
  });

  it("goes below a target near the top, clear of the spotlight", () => {
    const rect = { x: 300, y: 60, width: 60, height: 30 };
    const placement = placeBubble(rect, phone);
    expect(placement.side).toBe("below");
    if (placement.side !== "below") return;
    expect(placement.top).toBeGreaterThan(rect.y + rect.height + HOLE_PADDING);
  });

  it("goes above a target near the bottom (like the tab bar)", () => {
    const rect = { x: 160, y: 780, width: 70, height: 50 };
    const placement = placeBubble(rect, phone);
    expect(placement.side).toBe("above");
    if (placement.side !== "above") return;
    expect(phone.height - placement.bottom).toBeLessThan(rect.y - HOLE_PADDING);
  });

  it("points its arrow at the target's middle, but never off the bubble's rounded corners", () => {
    const middle = placeBubble({ x: 160, y: 780, width: 70, height: 50 }, phone);
    if (middle.side === "center") throw new Error("expected an arrow");
    expect(middle.arrowX + BUBBLE_MARGIN).toBe(195);

    const farRight = placeBubble({ x: 370, y: 60, width: 20, height: 20 }, phone);
    if (farRight.side === "center") throw new Error("expected an arrow");
    expect(farRight.arrowX).toBeLessThanOrEqual(phone.width - BUBBLE_MARGIN * 2 - 28);
  });
});

describe("holePath", () => {
  it("is just the dim screen when there's no hole", () => {
    expect(holePath(390, 844, 195, 422, 0, 0, 18)).toBe("M0 0H390V844H0Z");
  });

  it("cuts a rounded hole, never rounder than the hole itself", () => {
    const path = holePath(390, 844, 10, 20, 30, 12, 18);
    expect(path.startsWith("M0 0H390V844H0Z M16 20")).toBe(true);
    expect(path).toContain("A6 6 0 0 1");
  });
});
