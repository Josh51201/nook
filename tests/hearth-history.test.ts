import { describe, expect, it } from "vitest";

import { emptyHistory, HISTORY_LIMIT, remember, stepBack, stepForward } from "../lib/hearth-history";

// Undo and Redo while editing the Hearth (CORE-095).

describe("Edit history", () => {
  it("steps back through several changes, and forward again", () => {
    let h = emptyHistory<string>();
    h = remember(h, "a"); // a -> b
    h = remember(h, "b"); // b -> c
    const back1 = stepBack(h, "c")!;
    expect(back1.show).toBe("b");
    const back2 = stepBack(back1.history, "b")!;
    expect(back2.show).toBe("a");
    expect(stepBack(back2.history, "a")).toBeNull();
    const fwd1 = stepForward(back2.history, "a")!;
    expect(fwd1.show).toBe("b");
    const fwd2 = stepForward(fwd1.history, "b")!;
    expect(fwd2.show).toBe("c");
    expect(stepForward(fwd2.history, "c")).toBeNull();
  });

  it("a new change after undoing can't be redone past", () => {
    let h = remember(remember(emptyHistory<string>(), "a"), "b");
    const back = stepBack(h, "c")!;
    h = remember(back.history, "b"); // b -> d
    expect(stepForward(h, "d")).toBeNull();
    expect(stepBack(h, "d")!.show).toBe("b");
  });

  it("keeps only so many steps", () => {
    let h = emptyHistory<number>();
    for (let i = 0; i < HISTORY_LIMIT + 10; i++) h = remember(h, i);
    expect(h.past.length).toBe(HISTORY_LIMIT);
    expect(h.past[0]).toBe(10);
  });

  it("doesn't remember the same Hearth twice in a row", () => {
    const h = remember(remember(emptyHistory<string>(), "a"), "a");
    expect(h.past).toEqual(["a"]);
  });
});
