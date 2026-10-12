import { beforeEach, describe, expect, it } from "vitest";

import { cachedValue, canReuse, forgetHearthData, hearthSettling, loadOnce, nextHearthRefresh, REUSE_FOR_MS, SETTLE_MS, settleHearth } from "../lib/hearth-data";

// What the Hearth's tiles and widgets remember between pages (CORE-104).
describe("remembered Hearth data", () => {
  beforeEach(() => forgetHearthData());

  it("reuses an answer from the same refresh while it's recent, and asks again otherwise", () => {
    const now = 1_000_000;
    expect(canReuse(undefined, 3, now)).toBe(false);
    expect(canReuse({ refreshKey: 3, at: now - 1000 }, 3, now)).toBe(true);
    expect(canReuse({ refreshKey: 2, at: now - 1000 }, 3, now)).toBe(false); // the Hearth refreshed
    expect(canReuse({ refreshKey: 3, at: now - REUSE_FOR_MS }, 3, now)).toBe(false); // too old
  });

  it("two things asking for the same data at once share one request", async () => {
    let calls = 0;
    const load = () => {
      calls += 1;
      return new Promise<string>((resolve) => setTimeout(() => resolve("fed"), 5));
    };
    const [a, b] = await Promise.all([loadOnce("pets:me", 1, load), loadOnce("pets:me", 1, load)]);
    expect([a, b]).toEqual(["fed", "fed"]);
    expect(calls).toBe(1);
    expect(cachedValue("pets:me")).toBe("fed");
  });

  it("a failed load keeps what was there before", async () => {
    await loadOnce("notes:me", 1, async () => ["Wi-Fi"]);
    await expect(loadOnce("notes:me", 2, async () => Promise.reject(new Error("offline")))).rejects.toThrow("offline");
    expect(cachedValue("notes:me")).toEqual(["Wi-Fi"]);
  });

  it("keeps each person's data apart, and forgets it all on sign-out", async () => {
    await loadOnce("pets:sam", 1, async () => "Sam's");
    expect(cachedValue("pets:ana")).toBeNull();
    forgetHearthData();
    expect(cachedValue("pets:sam")).toBeNull();
  });

  it("hands every Hearth screen its own refresh numbers", () => {
    const first = nextHearthRefresh();
    expect(nextHearthRefresh()).toBe(first + 1);
    expect(first).toBeGreaterThan(0); // 0 is the widget editor's preview
  });

  it("keeps a freshly turned page still for a moment, then lets late arrivals slide in", () => {
    settleHearth(1000);
    expect(hearthSettling(1000 + SETTLE_MS - 1)).toBe(true);
    expect(hearthSettling(1000 + SETTLE_MS)).toBe(false);
  });
});
