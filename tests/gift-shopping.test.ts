import { describe, expect, it } from "vitest";

import { listWords, shoppingCounts, shoppingFor, shoppingLine, type MyTuck } from "../lib/gift-shopping";

const tuck = (id: string, ownerId: string, giftTitle: string, gatheringId: string | null, gatheringTitle: string | null = null): MyTuck => ({
  id,
  ownerId,
  giftTitle,
  status: "planning",
  gatheringId,
  gatheringTitle,
});

describe("shopping for a Gathering (GIFT-038..040)", () => {
  const tucks = [
    tuck("1", "mia", "Kite", "xmas"),
    tuck("2", "sam", "Socks", "bday", "Sam's Birthday"),
    tuck("3", "jo", "Book", null),
  ];

  it("only counts gifts tucked for this Gathering", () => {
    expect(shoppingFor("mia", "xmas", tucks, new Set()).state).toBe("got");
    // Sam's socks are for his birthday, not Christmas.
    const sam = shoppingFor("sam", "xmas", tucks, new Set());
    expect(sam.state).toBe("need");
    expect(sam.elsewhere.map((t) => t.giftTitle)).toEqual(["Socks"]);
    expect(shoppingLine(sam)).toBe("Nothing for this yet — Socks is tucked for Sam's Birthday");
    expect(shoppingLine(shoppingFor("jo", "xmas", tucks, new Set()))).toBe("Nothing for this yet — Book is tucked for no Gathering");
    expect(shoppingLine(shoppingFor("ana", "xmas", tucks, new Set()))).toBe("Nothing tucked for this yet");
  });

  it("not getting someone a gift takes them off Still need, until you tuck one anyway", () => {
    expect(shoppingFor("ana", "xmas", tucks, new Set(["ana"])).state).toBe("skipped");
    expect(shoppingFor("mia", "xmas", tucks, new Set(["mia"])).state).toBe("got");
  });

  it("counts and says what you're giving", () => {
    const states = ["mia", "sam", "jo", "ana"].map((p) => shoppingFor(p, "xmas", tucks, new Set(["ana"])).state);
    expect(shoppingCounts(states)).toEqual({ got: 1, need: 2, skipped: 1 });
    expect(shoppingLine(shoppingFor("mia", "xmas", [...tucks, tuck("4", "mia", "Gloves", "xmas")], new Set()))).toBe(
      "You're giving Kite and Gloves"
    );
  });

  it("leaves a gift already given out of 'tucked elsewhere'", () => {
    const given = { ...tuck("5", "sam", "Old scarf", "last-xmas", "Christmas 2025"), status: "given" as const };
    expect(shoppingFor("sam", "xmas", [given], new Set()).elsewhere).toEqual([]);
  });

  it("lists things in plain words", () => {
    expect(listWords(["Kite"])).toBe("Kite");
    expect(listWords(["Kite", "Socks", "Book", "Lego"])).toBe("Kite, Socks and 2 more");
  });
});
