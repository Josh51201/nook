import { describe, expect, it } from "vitest";

import { noticeIcon, noticeRoute, unreadByNook } from "../lib/inbox";

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
    expect(noticeRoute({ nook: "home", kind: "home_invite", data: { invite_id: "i1" } })).toBe("/home");
    expect(noticeRoute({ nook: "letterbox", kind: "birthday_card", data: { contact_id: "h1" } })).toBe(
      "/letterbox/contact/h1"
    );
    expect(noticeRoute({ nook: "letterbox", kind: "birthday_card", data: {} })).toBe("/letterbox");
    expect(noticeIcon({ nook: "letterbox", kind: "birthday_card" })).toBe("birthday");
  });

  it("sends the newer Gift Nook and Potluck notices where they belong", () => {
    expect(noticeRoute({ nook: "gift-nook", kind: "gathering_new", data: { gathering_id: "g1" } })).toBe("/gift-nook/gathering/g1");
    for (const kind of ["potluck_new", "potluck_changed", "potluck_rsvp", "potluck_dish", "potluck_reminder"]) {
      expect(noticeRoute({ nook: "potluck", kind, data: { potluck_id: "p1" } })).toBe("/potluck/p1");
      expect(noticeRoute({ nook: "potluck", kind, data: {} })).toBe("/potluck");
      expect(noticeIcon({ nook: "potluck", kind })).not.toBe("bell");
    }
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

describe("unreadByNook", () => {
  it("counts unread notices per Nook and keeps the newest title", () => {
    const waiting = unreadByNook([
      { nook: "gift-nook", title: "Christmas is coming" },
      { nook: "potluck", title: "New Potluck" },
      { nook: "gift-nook", title: "Older notice" },
    ]);
    expect(waiting["gift-nook"]).toEqual({ count: 2, latest: "Christmas is coming" });
    expect(waiting.potluck).toEqual({ count: 1, latest: "New Potluck" });
    expect(waiting.pets).toBeUndefined();
  });

  it("is empty when nothing is waiting", () => {
    expect(unreadByNook([])).toEqual({});
  });
});
