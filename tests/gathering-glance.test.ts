import { describe, expect, it } from "vitest";

import { gatheringGlance, glanceLines, glanceSource, widgetsToTakeOff, type GlanceInput } from "../lib/gathering-glance";
import type { MyTuck } from "../lib/gift-shopping";
import { addItem, defaultHearthLayout, gatheringWidgets, removeEverywhere, type HearthLayout } from "../lib/hearth-layout";
import { shareable } from "../lib/hearth-share";
import { defaultWidget, gatheringWidget, widgetCategories, widgetKinds } from "../lib/widgets";

const now = new Date("2026-12-20T12:00:00Z");
const christmas = { id: "xmas", title: "Christmas", kind: "christmas", ends_at: "2026-12-26T04:59:59Z", starts_at: null, place: "Grandma's", gifts: true };

const guest = (profile_id: string, status: "going" | "maybe" | "no" | null = null, extra_guests = 0) => ({
  profile_id,
  status,
  extra_guests,
  can_see_wishbook: true,
});

const tuck = (id: string, ownerId: string, gatheringId: string | null): MyTuck => ({
  id,
  ownerId,
  giftTitle: `Gift ${id}`,
  status: "planning",
  gatheringId,
  gatheringTitle: null,
});

const base = (changes: Partial<GlanceInput> = {}): GlanceInput => ({
  gathering: christmas,
  userId: "me",
  guests: [guest("me", "going"), guest("mia", "going", 2), guest("sam", "maybe"), guest("jo")],
  honorees: [],
  myTucks: [],
  skipped: new Set(),
  potluck: null,
  now,
  ...changes,
});

describe("a Gathering at a glance (GATH-009)", () => {
  it("shows your answer and who's coming", () => {
    const glance = gatheringGlance(base());
    expect(glance.over).toBe(false);
    expect(glance.myStatus).toBe("going");
    const [rsvp] = glanceLines(glance);
    expect(rsvp.text).toBe("You're going");
    // Mia brings two extra.
    expect(rsvp.sub).toBe("4 coming · 1 maybe");
  });

  it("asks you to answer when you haven't, and just counts for a kid's grown-up", () => {
    const waiting = gatheringGlance(base({ guests: [guest("me"), guest("mia", "going")] }));
    expect(glanceLines(waiting)[0].text).toBe("You haven't answered yet");
    const notInvited = gatheringGlance(base({ guests: [guest("kid", "going")] }));
    expect(notInvited.invited).toBe(false);
    expect(glanceLines(notInvited)[0].text).toBe("1 coming");
  });

  it("counts your gift shopping for everyone else, from your own tucks for this Gathering", () => {
    const glance = gatheringGlance(
      base({ myTucks: [tuck("1", "mia", "xmas"), tuck("2", "sam", "bday")], skipped: new Set(["jo"]) })
    );
    expect(glance.shopping).toEqual({ got: 1, need: 1, skipped: 1, total: 3 });
    const gifts = glanceLines(glance).find((l) => l.key === "gifts")!;
    expect(gifts.text).toBe("Still need a gift for 1");
    expect(gifts.progress).toEqual({ done: 2, total: 3 });
  });

  it("uses who it's for when people were picked", () => {
    const glance = gatheringGlance(base({ honorees: ["mia"], myTucks: [tuck("1", "mia", "xmas")] }));
    expect(glance.shopping).toEqual({ got: 1, need: 0, skipped: 0, total: 1 });
    expect(glanceLines(glance).find((l) => l.key === "gifts")!.text).toBe("Your gift shopping's done");
  });

  it("leaves out gifts when the Gathering has no gift lists", () => {
    const glance = gatheringGlance(base({ gathering: { ...christmas, gifts: false } }));
    expect(glance.shopping).toBeNull();
    expect(glanceLines(glance).some((l) => l.key === "gifts")).toBe(false);
  });

  it("shows what you're bringing and what's still open at the Potluck", () => {
    const glance = gatheringGlance(
      base({
        potluck: {
          id: "p1",
          slots: [
            { id: "mains", label: "Main dish", wanted: 2 },
            { id: "sides", label: "Side", wanted: 2 },
          ],
          dishes: [
            { slot_id: "mains", brought_by: "me", name: "Ham" },
            { slot_id: "sides", brought_by: "mia", name: "Rolls" },
          ],
        },
      })
    );
    const potluck = glanceLines(glance).find((l) => l.key === "potluck")!;
    expect(potluck.text).toBe("You're bringing Ham");
    expect(potluck.sub).toBe("2 dishes · 2 spots open");
  });

  it("once it's over, says how it went instead", () => {
    const glance = gatheringGlance(base({ now: new Date("2026-12-27T12:00:00Z") }));
    expect(glance.over).toBe(true);
    expect(glanceLines(glance).map((l) => l.text)).toEqual(["4 came"]);
  });
});

describe("GIFT-007: a Gathering for you shows nothing about tucks on your gifts", () => {
  it("never counts you, even if a tuck on your gift somehow came along", () => {
    // It's my birthday: I'm the only one it's for.
    const mine = gatheringGlance(
      base({
        gathering: { ...christmas, id: "bday", kind: "birthday", title: "My Birthday" },
        honorees: ["me"],
        // Can't happen (the database never returns these), but if it did, it must not show.
        myTucks: [tuck("x", "me", "bday")],
        skipped: new Set(["me"]),
      })
    );
    expect(mine.shopping).toEqual({ got: 0, need: 0, skipped: 0, total: 0 });
    const gifts = glanceLines(mine).find((l) => l.key === "gifts")!;
    expect(gifts.text).toBe("Gift lists in the Gift Nook");
    expect(gifts.sub).toBeUndefined();
    expect(gifts.progress).toBeUndefined();
    // Nothing in any line hints at a count of gifts.
    expect(JSON.stringify(glanceLines(mine))).not.toMatch(/got|tuck|need a gift/i);
  });

  it("is the same whether or not anyone has tucked your gifts", () => {
    const quiet = gatheringGlance(base({ honorees: ["me"] }));
    const busy = gatheringGlance(base({ honorees: ["me"], myTucks: [tuck("x", "me", "xmas"), tuck("y", "me", null)] }));
    expect(glanceLines(busy)).toEqual(glanceLines(quiet));
    expect(busy.shopping).toEqual(quiet.shopping);
  });
});

describe("when a Gathering widget's day has passed (GATH-010)", () => {
  const over = { ends_at: "2026-12-19T04:59:59Z" };
  const coming = { ends_at: "2026-12-26T04:59:59Z" };

  it("switches to the next one only if it's set to", () => {
    expect(glanceSource(coming, "next", now)).toBe("pinned");
    expect(glanceSource(over, "next", now)).toBe("next");
    expect(glanceSource(over, "keep", now)).toBe("pinned");
    expect(glanceSource(over, "remove", now)).toBe("pinned");
    expect(glanceSource(null, "keep", now)).toBe("gone");
  });

  it("takes off only the ones set to, once it's over or gone", () => {
    const ids = widgetsToTakeOff(
      [
        { id: "w1", gatheringId: "old", whenOver: "remove" },
        { id: "w2", gatheringId: "old", whenOver: "keep" },
        { id: "w3", gatheringId: "soon", whenOver: "remove" },
        { id: "w4", gatheringId: "deleted", whenOver: "remove" },
      ],
      [
        { id: "old", ...over },
        { id: "soon", ...coming },
      ],
      now
    );
    expect(ids).toEqual(["w1", "w4"]);
  });

  it("finds and removes its widgets on every page and in Hollows", () => {
    let layout: HearthLayout = { ...defaultHearthLayout, items: [] };
    layout = { ...layout, items: addItem(layout, { id: "w1", kind: "widget", widget: gatheringWidget("xmas", "Christmas"), w: 4, h: 3 }) };
    layout = {
      ...layout,
      items: [
        ...layout.items,
        {
          id: "h1",
          kind: "hollow",
          name: "Holidays",
          look: "house",
          x: 0,
          y: 6,
          w: 2,
          h: 2,
          items: [{ id: "w2", kind: "widget", widget: gatheringWidget("xmas", "Christmas"), x: 0, y: 0, w: 4, h: 3 }],
        } as HearthLayout["items"][number],
      ],
      otherPages: { p2: [{ id: "w3", kind: "widget", widget: gatheringWidget("bday", "Birthday"), x: 0, y: 0, w: 4, h: 3 }] },
    };
    expect(gatheringWidgets(layout, "xmas").map((w) => w.id).sort()).toEqual(["w1", "w2"]);
    // "Whichever's next" widgets aren't tied to one Gathering.
    const next = { ...layout, items: [...layout.items, { id: "w4", kind: "widget", widget: defaultWidget("gathering"), x: 0, y: 9, w: 4, h: 3 }] } as HearthLayout;
    expect(gatheringWidgets(next).map((w) => w.id).sort()).toEqual(["w1", "w2", "w3"]);

    const after = removeEverywhere(layout, (item) => item.id === "w2" || item.id === "w3");
    expect(gatheringWidgets({ ...layout, ...after }).map((w) => w.id)).toEqual(["w1"]);
  });

  it("is shared as 'whichever's next', never your own Gathering", () => {
    const shared = shareable({ id: "w1", kind: "widget", widget: gatheringWidget("xmas", "Christmas"), x: 0, y: 0, w: 4, h: 3 });
    expect(shared.kind === "widget" && shared.widget.kind === "gathering" && shared.widget.settings.gatheringId).toBeNull();
    expect(shared.kind === "widget" && shared.widget.title).toBe("Next Gathering");
  });

  it("is in the Add sheet with the other Nook widgets", () => {
    expect(widgetKinds.some((k) => k.kind === "gathering")).toBe(true);
    expect(widgetCategories.find((c) => c.id === "nooks")!.kinds).toContain("gathering");
  });
});
