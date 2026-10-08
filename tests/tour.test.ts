import { describe, expect, it } from "vitest";

import {
  BUBBLE_MARGIN,
  HOLE_PADDING,
  holePath,
  isOnScreen,
  placeBubble,
  resolveSteps,
  tours,
  type TourStep,
} from "../lib/tour";

const phone = { width: 390, height: 844 };

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

  it("never drops a tour down to nothing", () => {
    for (const tour of Object.values(tours)) {
      expect(resolveSteps(tour, new Set()).length).toBeGreaterThan(0);
    }
  });
});

describe("isOnScreen", () => {
  it("accepts a target that's fully visible", () => {
    expect(isOnScreen({ x: 20, y: 700, width: 100, height: 48 }, phone)).toBe(true);
  });

  it("rejects targets scrolled off screen, missing, or collapsed", () => {
    expect(isOnScreen({ x: 20, y: 900, width: 100, height: 48 }, phone)).toBe(false);
    expect(isOnScreen({ x: 20, y: -30, width: 100, height: 48 }, phone)).toBe(false);
    expect(isOnScreen(null, phone)).toBe(false);
    expect(isOnScreen({ x: 20, y: 20, width: 0, height: 0 }, phone)).toBe(false);
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
