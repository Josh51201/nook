// Loading on the Hearth (CORE-103). A widget or Nook tile still waiting for
// its data shows a placeholder, and each placeholder counts itself here
// while it's up, so the Hearth can say "Bringing in your Nooks…" for as long
// as any is waiting, and nothing once they've all arrived. Pure (no React),
// so it's unit-testable; components/hearth/waiting.tsx wires it to React.

let waiting = 0;
const listeners = new Set<() => void>();

export function waitingCount() {
  return waiting;
}

// A placeholder went up; call the returned function when it comes down.
export function markWaiting(): () => void {
  waiting += 1;
  listeners.forEach((listener) => listener());
  let done = false;
  return () => {
    if (done) return;
    done = true;
    waiting -= 1;
    listeners.forEach((listener) => listener());
  };
}

export function onWaitingChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// What the Hearth's little pill says, given how many things are waiting and
// how long they've been at it: nothing for a quick load (no flicker), then
// "loading", then after a long wait a hint that something's slow.
export const PILL_DELAY_MS = 350;
export const PILL_SLOW_MS = 8_000;
// A placeholder gives up after this long and stops counting, so something
// that can't load (no connection, a Nook not set up yet) never leaves the
// pill up for good.
export const GIVE_UP_MS = 15_000;

export function waitingPill(count: number, waitedMs: number): "loading" | "slow" | null {
  if (count <= 0 || waitedMs < PILL_DELAY_MS) return null;
  return waitedMs >= PILL_SLOW_MS ? "slow" : "loading";
}
