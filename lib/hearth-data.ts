import { useEffect, useState } from "react";

// What the Hearth's tiles and widgets last loaded, kept for a little while
// (CORE-104). Turning to another Hearth page builds that page's tiles and
// widgets fresh, and each used to go back to the server and show a
// placeholder until it heard. Now each starts from what was loaded last
// time, and only asks again when the Hearth itself refreshes (coming back to
// it, or Try again), or after a few minutes. Two things on a page that need
// the same thing (the Pet Care tile and a Pet Care widget) share one request.

type Entry = { value: unknown; refreshKey: number; at: number };

const cache = new Map<string, Entry>();
const inFlight = new Map<string, { refreshKey: number; promise: Promise<unknown> }>();

// Loaded under this refresh, and recent enough to show without asking again.
export const REUSE_FOR_MS = 3 * 60_000;

export function canReuse(entry: Pick<Entry, "refreshKey" | "at"> | undefined, refreshKey: number, now = Date.now()) {
  return Boolean(entry && entry.refreshKey === refreshKey && now - entry.at < REUSE_FOR_MS);
}

export function cachedValue<T>(key: string | null): T | null {
  return key ? ((cache.get(key)?.value as T | undefined) ?? null) : null;
}

// Loads `key` (or joins a request for it that's already on its way) and
// remembers the answer. A failed load leaves what was there before.
export function loadOnce<T>(key: string, refreshKey: number, load: () => Promise<T>): Promise<T> {
  const pending = inFlight.get(key);
  if (pending && pending.refreshKey === refreshKey) return pending.promise as Promise<T>;
  const promise = load().then((value) => {
    cache.set(key, { value, refreshKey, at: Date.now() });
    return value;
  });
  const entry = { refreshKey, promise };
  inFlight.set(key, entry);
  promise.finally(() => {
    if (inFlight.get(key) === entry) inFlight.delete(key);
  }).catch(() => {});
  return promise;
}

// Every Hearth (yours, a Hollow's, a widget's preview) counts its refreshes
// from this one counter, so two screens never share a number and reuse each
// other's answers by accident.
let lastRefresh = 0;
export function nextHearthRefresh() {
  lastRefresh += 1;
  return lastRefresh;
}

// Just after a page turn, what's already known is shown as it is, without
// each line sliding in, so a page you've seen doesn't twitch as it appears.
// Lines still slide in when their data arrives later than that.
let settleUntil = 0;
export const SETTLE_MS = 700;
export function settleHearth(now = Date.now()) {
  settleUntil = now + SETTLE_MS;
}
export function hearthSettling(now = Date.now()) {
  return now < settleUntil;
}

// For tests, and when someone signs out.
export function forgetHearthData() {
  cache.clear();
  inFlight.clear();
}

// A tile's or widget's data: what was loaded last (straight away, so there's
// no placeholder on a page you've seen), refreshed when `refreshKey` moves
// on. `key` should name everything the load depends on (who's asking, the
// widget's settings); null waits (say, until someone's signed in).
export function useHearthData<T>(key: string | null, refreshKey: number, load: () => Promise<T>): T | null {
  // Which key the value belongs to, so changing a widget's settings never
  // shows the old settings' answer while the new one loads.
  const [state, setState] = useState<{ key: string | null; value: T | null }>(() => ({ key, value: cachedValue<T>(key) }));

  useEffect(() => {
    if (!key) return;
    const entry = cache.get(key);
    // (Unchanged state is handed back as is, so nothing redraws for nothing.)
    if (entry) setState((prev) => (prev.key === key && prev.value === entry.value ? prev : { key, value: entry.value as T }));
    if (canReuse(entry, refreshKey)) return;
    let live = true;
    loadOnce(key, refreshKey, load)
      .then((next) => live && setState({ key, value: next }))
      .catch(() => {});
    return () => {
      live = false;
    };
    // `load` is a fresh function each render; `key` names what it loads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, refreshKey]);

  if (!key) return null;
  return state.key === key ? state.value : cachedValue<T>(key);
}
