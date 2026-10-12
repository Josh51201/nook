import { describe, expect, it } from "vitest";

import { GIVE_UP_MS, markWaiting, onWaitingChange, PILL_SLOW_MS, waitingCount, waitingPill } from "../lib/hearth-waiting";

describe("Hearth loading (CORE-103)", () => {
  it("counts placeholders while they're up, once each", () => {
    let heard = 0;
    const stop = onWaitingChange(() => heard++);
    const a = markWaiting();
    const b = markWaiting();
    expect(waitingCount()).toBe(2);
    a();
    a(); // taking one down twice doesn't count twice
    expect(waitingCount()).toBe(1);
    b();
    expect(waitingCount()).toBe(0);
    expect(heard).toBe(4);
    stop();
  });

  it("says nothing for a quick load, then loading, then slow", () => {
    expect(waitingPill(0, 5000)).toBeNull();
    expect(waitingPill(3, 100)).toBeNull();
    expect(waitingPill(3, 1000)).toBe("loading");
    expect(waitingPill(1, PILL_SLOW_MS)).toBe("slow");
  });

  it("gives up after the slow hint has had time to show", () => {
    expect(GIVE_UP_MS).toBeGreaterThan(PILL_SLOW_MS + 3000);
  });
});
