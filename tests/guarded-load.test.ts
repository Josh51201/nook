import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-haptics", () => ({}));

const { guarded } = await import("../lib/feedback");

// A screen's loader must never leave it spinning forever.
describe("guarded loading", () => {
  afterEach(() => vi.useRealTimers());

  it("always hides the spinner, even when the loader throws", async () => {
    const fail = vi.fn();
    const done = vi.fn();
    await guarded(async () => { throw new Error("boom"); }, fail, done);
    expect(fail).toHaveBeenCalledWith("boom");
    expect(done).toHaveBeenCalledOnce();
  });

  it("turns a request that never answers into a friendly message", async () => {
    vi.useFakeTimers();
    const fail = vi.fn();
    const done = vi.fn();
    const run = guarded(() => new Promise<void>(() => {}), fail, done, 5000);
    await vi.advanceTimersByTimeAsync(5001);
    await run;
    expect(fail).toHaveBeenCalledWith(expect.stringContaining("Couldn't reach Nook"));
    expect(done).toHaveBeenCalledOnce();
  });

  it("stays quiet when loading succeeds", async () => {
    const fail = vi.fn();
    const done = vi.fn();
    await guarded(async () => {}, fail, done);
    expect(fail).not.toHaveBeenCalled();
    expect(done).toHaveBeenCalledOnce();
  });
});
