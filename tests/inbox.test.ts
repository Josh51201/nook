import { describe, expect, it } from "vitest";

import { noticeIcon, noticeRoute } from "../lib/inbox";

describe("noticeRoute", () => {
  it("sends each Gift Nook notice to the right place", () => {
    expect(noticeRoute({ nook: "gift-nook", kind: "gathering_soon", data: { gathering_id: "g1" } })).toBe(
      "/gift-nook/gathering/g1"
    );
    expect(noticeRoute({ nook: "gift-nook", kind: "new_gifts", data: { owner_id: "p1" } })).toBe(
      "/gift-nook/member/p1"
    );
    expect(noticeRoute({ nook: "gift-nook", kind: "tuck_changed", data: {} })).toBe("/gift-nook/my-tucks");
    expect(noticeRoute({ nook: "gift-nook", kind: "member_joined", data: { burrow_id: "b1" } })).toBe("/burrow/b1");
  });

  it("sends Letterbox notices to the right place", () => {
    expect(noticeRoute({ nook: "letterbox", kind: "letterbox_invite", data: { invite_id: "i1" } })).toBe("/letterbox/settings");
    expect(noticeRoute({ nook: "letterbox", kind: "birthday_card", data: { household_id: "h1" } })).toBe(
      "/letterbox/household/h1"
    );
    expect(noticeRoute({ nook: "letterbox", kind: "birthday_card", data: {} })).toBe("/letterbox");
    expect(noticeIcon({ nook: "letterbox", kind: "birthday_card" })).toBe("birthday");
  });

  it("goes nowhere when the notice is missing what it needs to point at", () => {
    expect(noticeRoute({ nook: "gift-nook", kind: "gathering_soon", data: {} })).toBeNull();
  });

  it("copes with a Nook or kind it doesn't know (e.g. from a newer app version)", () => {
    expect(noticeRoute({ nook: "potluck", kind: "dish_added", data: {} })).toBeNull();
    expect(noticeRoute({ nook: "gift-nook", kind: "something_new", data: {} })).toBeNull();
    expect(noticeIcon({ nook: "potluck", kind: "dish_added" })).toBe("bell");
  });
});
