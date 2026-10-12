import { describe, expect, it } from "vitest";

import { noticeIcon, noticeRoute } from "../lib/inbox";
import { dishNudgeTargets, nudgeOutcome, rsvpNudgeTargets } from "../lib/nudges";

describe("who gets a Nudge button (CORE-101)", () => {
  const guests = [
    { profile_id: "me", status: null },
    { profile_id: "sam", status: null },
    { profile_id: "ana", status: "going" },
    { profile_id: "my-kid", status: null },
    { profile_id: "their-kid", status: null },
  ];

  it("RSVPs: people who haven't answered, not you or kids you answer for", () => {
    expect(rsvpNudgeTargets(guests, "me", ["my-kid"]).map((g) => g.profile_id)).toEqual(["sam", "their-kid"]);
  });

  it("Potluck: people coming without a dish, not you or kids", () => {
    const coming = [
      { id: "me", profile: { is_managed: false } },
      { id: "sam", profile: { is_managed: false } },
      { id: "ana", profile: { is_managed: false } },
      { id: "kid", profile: { is_managed: true } },
    ];
    expect(dishNudgeTargets(coming, [{ brought_by: "ana" }], "me").map((p) => p.id)).toEqual(["sam"]);
  });

  it("only says something when nothing went", () => {
    expect(nudgeOutcome(1)).toBeNull();
    expect(nudgeOutcome(3, true)).toBeNull();
    expect(nudgeOutcome(0)?.title).toBe("Already nudged today");
    expect(nudgeOutcome(0, true)?.body).toMatch(/Everyone/);
  });
});

describe("nudges in the inbox", () => {
  it("open where the thing is", () => {
    expect(noticeRoute({ nook: "gift-nook", kind: "nudge_wishbook", data: { owner_id: "me" } })).toBe("/gift-nook/wishbook");
    expect(noticeRoute({ nook: "gift-nook", kind: "nudge_wishbook", data: { owner_id: "k1", kid: true } })).toBe("/gift-nook/member/k1");
    expect(noticeRoute({ nook: "gatherings", kind: "nudge_rsvp", data: { gathering_id: "g1" } })).toBe("/gatherings/g1");
    expect(noticeRoute({ nook: "potluck", kind: "nudge_dish", data: { potluck_id: "p1" } })).toBe("/potluck/p1");
    expect(noticeRoute({ nook: "getaways", kind: "nudge_todo", data: { getaway_id: "t1" } })).toBe("/getaways/todos?id=t1");
    expect(noticeRoute({ nook: "rhythms", kind: "nudge_rhythm", data: { rhythm_id: "r1" } })).toBe("/rhythms/r1");
  });

  it("all wear the little wave", () => {
    for (const [nook, kind] of [
      ["gift-nook", "nudge_wishbook"],
      ["gatherings", "nudge_rsvp"],
      ["potluck", "nudge_dish"],
      ["getaways", "nudge_todo"],
      ["rhythms", "nudge_rhythm"],
    ]) {
      expect(noticeIcon({ nook, kind })).toBe("nudge");
    }
  });
});
