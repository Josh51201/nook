// The Whose turn? widget (CORE-111): who does the dishes, picks the movie,
// sits up front. Either it goes round in order ("Done, next!"), or it's a
// spinner that picks someone, never the same person twice running. Made for
// the page shared with your Home (CORE-054), where everyone sees the same
// turn. Pure, so it's unit-testable.

export type TurnMode = "rotate" | "spin";
export type TurnEntry = { name: string; at: string };

export type WhoseTurn = {
  task: string;
  names: string[];
  mode: TurnMode;
  // Whose turn it is now (rotate), or who the last spin picked (spin).
  current: number;
  // Newest first: who did it (rotate) or who was picked (spin), and when.
  history: TurnEntry[];
};

export const MAX_TURN_NAMES = 12;
export const MAX_TURN_HISTORY = 20;

export const taskIdeas = ["Dishes", "Pick the movie", "Front seat", "Feed the pets", "Take out the bins", "Choose dinner", "Bath first"];

export function currentName(turn: Pick<WhoseTurn, "names" | "current">) {
  if (!turn.names.length) return null;
  return turn.names[((turn.current % turn.names.length) + turn.names.length) % turn.names.length];
}

export function nextName(turn: Pick<WhoseTurn, "names" | "current">) {
  if (turn.names.length < 2) return null;
  return turn.names[(turn.current + 1) % turn.names.length];
}

// The current person's done it: it's the next person's turn.
export function passTurn(turn: WhoseTurn, now = new Date()): WhoseTurn {
  const name = currentName(turn);
  if (!name) return turn;
  return {
    ...turn,
    current: (turn.current + 1) % turn.names.length,
    history: [{ name, at: now.toISOString() }, ...turn.history].slice(0, MAX_TURN_HISTORY),
  };
}

// Spin: anyone but the last one picked (when there's a choice).
// `random` is 0 ≤ r < 1.
export function spinTurn(turn: WhoseTurn, random: number, now = new Date()): WhoseTurn {
  const n = turn.names.length;
  if (!n) return turn;
  const last = turn.history.length ? turn.current % n : -1;
  const choices = n > 1 && last >= 0 ? [...Array(n).keys()].filter((i) => i !== last) : [...Array(n).keys()];
  const pick = choices[Math.min(choices.length - 1, Math.floor(random * choices.length))];
  return { ...turn, current: pick, history: [{ name: turn.names[pick], at: now.toISOString() }, ...turn.history].slice(0, MAX_TURN_HISTORY) };
}

// Names changed in the editor: keep it the same person's turn if they're
// still there.
export function withNames(turn: WhoseTurn, names: string[]): WhoseTurn {
  const clean = names.map((n) => n.trim()).filter(Boolean).slice(0, MAX_TURN_NAMES);
  const now = currentName(turn);
  const at = now ? clean.indexOf(now) : -1;
  return { ...turn, names: clean, current: at >= 0 ? at : 0 };
}

// "Mon", "Today", "Yesterday" for history.
export function turnWhen(at: string, now = new Date()) {
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((day(now) - day(new Date(at))) / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return new Date(at).toLocaleDateString(undefined, { weekday: "short" });
  return new Date(at).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
