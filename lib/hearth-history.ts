// Undo and Redo while editing the Hearth (CORE-095): every change made in
// Edit keeps the Hearth as it was just before, so you can step back through
// several changes, and forward again. It only lasts while you're editing.

export type History<T> = { past: T[]; future: T[] };

// Enough to undo a good while of rearranging without holding on to too much.
export const HISTORY_LIMIT = 40;

export function emptyHistory<T>(): History<T> {
  return { past: [], future: [] };
}

// A change is about to be made to `before`: remember it. Anything that was
// undone can't be redone after a new change.
export function remember<T>(history: History<T>, before: T, limit = HISTORY_LIMIT): History<T> {
  if (history.past[history.past.length - 1] === before) return { past: history.past, future: [] };
  return { past: [...history.past, before].slice(-limit), future: [] };
}

// Step back: what to show, and the history after. Null if there's nothing.
export function stepBack<T>(history: History<T>, now: T): { show: T; history: History<T> } | null {
  if (!history.past.length) return null;
  const show = history.past[history.past.length - 1];
  return { show, history: { past: history.past.slice(0, -1), future: [now, ...history.future] } };
}

// Step forward again after stepping back.
export function stepForward<T>(history: History<T>, now: T): { show: T; history: History<T> } | null {
  if (!history.future.length) return null;
  const [show, ...rest] = history.future;
  return { show, history: { past: [...history.past, now].slice(-HISTORY_LIMIT), future: rest } };
}
