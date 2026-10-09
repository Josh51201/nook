import type { IconName } from "../components/icon";
import { guestCounts, type GatheringRow, type Guest } from "./gatherings";
import { listWords, shoppingCounts, shoppingFor, type MyTuck } from "./gift-shopping";
import { slotRoom, type RsvpStatus, type Slot } from "./potluck";
import type { GatheringWhenOver } from "./widgets";

// One Gathering at a glance, for its Hearth widget (GATH-009): when and
// where, your answer and who's coming, your gift shopping, and the Potluck.
// Pure (no React/Supabase), so it's unit-testable.
//
// GIFT-007: the gift part is built only from *your own* tucks and "not
// getting" marks, about the other people it's for. You are never one of
// the people counted, so a Gathering for you shows nothing about tucks on
// your gifts.

export type GatheringGlance = {
  gathering: Pick<GatheringRow, "id" | "title" | "kind" | "ends_at" | "starts_at" | "place" | "gifts">;
  over: boolean;
  // You're on the guest list (a grown-up seeing their kid's Gathering may not be).
  invited: boolean;
  myStatus: RsvpStatus | null;
  counts: ReturnType<typeof guestCounts>;
  // Gift lists are on and there's someone (not you) to shop for.
  shopping: { got: number; need: number; skipped: number; total: number } | null;
  potluck: { id: string; dishes: number; mine: string[]; open: number; hasSlots: boolean } | null;
};

export type GlanceInput = {
  gathering: GatheringGlance["gathering"];
  userId: string;
  guests: Pick<Guest, "profile_id" | "status" | "extra_guests" | "can_see_wishbook">[];
  // Who it's for, if anyone was picked; otherwise everyone whose Wishbook you can see.
  honorees: string[];
  myTucks: MyTuck[];
  skipped: Set<string>;
  potluck: { id: string; slots: Slot[]; dishes: { slot_id: string | null; brought_by: string; name: string }[] } | null;
  now?: Date;
};

export function gatheringGlance(input: GlanceInput): GatheringGlance {
  const { gathering, userId, guests, honorees, myTucks, skipped, potluck } = input;
  const me = guests.find((g) => g.profile_id === userId);

  let shopping: GatheringGlance["shopping"] = null;
  if (gathering.gifts) {
    const forWhom = honorees.length ? honorees : guests.filter((g) => g.can_see_wishbook).map((g) => g.profile_id);
    const others = [...new Set(forWhom)].filter((id) => id !== userId);
    const counts = shoppingCounts(others.map((id) => shoppingFor(id, gathering.id, myTucks, skipped).state));
    shopping = { ...counts, total: others.length };
  }

  return {
    gathering,
    over: new Date(gathering.ends_at) < (input.now ?? new Date()),
    invited: Boolean(me),
    myStatus: me?.status ?? null,
    counts: guestCounts(guests),
    shopping,
    potluck: potluck
      ? {
          id: potluck.id,
          dishes: potluck.dishes.length,
          mine: potluck.dishes.filter((d) => d.brought_by === userId).map((d) => d.name),
          open: potluck.slots.reduce((sum, slot) => sum + slotRoom(slot, potluck.dishes).open, 0),
          hasSlots: potluck.slots.length > 0,
        }
      : null,
  };
}

export type GlanceLine = {
  key: "rsvp" | "gifts" | "potluck";
  icon: IconName;
  text: string;
  sub?: string;
  // Gift shopping: sorted out of everyone.
  progress?: { done: number; total: number };
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// The lines under the Gathering's name, most important first.
export function glanceLines(glance: GatheringGlance): GlanceLine[] {
  const { over, counts, shopping, potluck, gathering } = glance;
  const lines: GlanceLine[] = [];

  if (over) {
    lines.push({ key: "rsvp", icon: "group", text: counts.going ? `${counts.going} came` : "All done" });
    if (potluck?.dishes) lines.push({ key: "potluck", icon: "potluck", text: `${plural(potluck.dishes, "dish", "dishes")} shared` });
    return lines;
  }

  const comingWords = [counts.going ? `${counts.going} coming` : null, counts.maybe ? `${counts.maybe} maybe` : null]
    .filter(Boolean)
    .join(" · ");
  if (glance.invited) {
    const answer =
      glance.myStatus === "going"
        ? "You're going"
        : glance.myStatus === "maybe"
          ? "You're a maybe"
          : glance.myStatus === "no"
            ? "You can't make it"
            : "You haven't answered yet";
    lines.push({ key: "rsvp", icon: "group", text: answer, sub: comingWords || `${counts.invited} invited` });
  } else {
    lines.push({ key: "rsvp", icon: "group", text: comingWords || `${counts.invited} invited` });
  }

  if (gathering.gifts) {
    if (shopping && shopping.total) {
      const done = shopping.got + shopping.skipped;
      lines.push({
        key: "gifts",
        icon: "gift",
        text: shopping.need ? `Still need a gift for ${shopping.need}` : "Your gift shopping's done",
        sub: `Got ${shopping.got} of ${shopping.total}${shopping.skipped ? ` · not getting ${shopping.skipped}` : ""}`,
        progress: { done, total: shopping.total },
      });
    } else {
      lines.push({ key: "gifts", icon: "gift", text: "Gift lists in the Gift Nook" });
    }
  }

  if (potluck) {
    lines.push({
      key: "potluck",
      icon: "potluck",
      text: potluck.mine.length ? `You're bringing ${listWords(potluck.mine)}` : "Nothing from you for the Potluck yet",
      sub: [
        plural(potluck.dishes, "dish", "dishes"),
        potluck.hasSlots ? (potluck.open ? `${plural(potluck.open, "spot")} open` : "every spot's filled") : null,
      ]
        .filter(Boolean)
        .join(" · "),
    });
  }
  return lines;
}

// What a widget picked for one Gathering shows (GATH-010): that Gathering;
// once it's over and it's set to switch, your next one; "gone" if it was
// deleted or you're no longer invited.
export function glanceSource(
  pinned: { ends_at: string } | null,
  whenOver: GatheringWhenOver,
  now = new Date()
): "pinned" | "next" | "gone" {
  if (!pinned) return "gone";
  if (whenOver === "next" && new Date(pinned.ends_at) < now) return "next";
  return "pinned";
}

// Gathering widgets set to take themselves off once it's over (GATH-010):
// the ones whose Gathering has passed, or is gone (deleted, or you're no
// longer invited). `found` is what the database gave back for their ids.
export function widgetsToTakeOff(
  widgets: { id: string; gatheringId: string; whenOver: GatheringWhenOver }[],
  found: { id: string; ends_at: string }[],
  now = new Date()
): string[] {
  const endsAt = new Map(found.map((row) => [row.id, row.ends_at]));
  return widgets
    .filter((w) => w.whenOver === "remove")
    .filter((w) => {
      const ends = endsAt.get(w.gatheringId);
      return !ends || new Date(ends) < now;
    })
    .map((w) => w.id);
}
