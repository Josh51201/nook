import type { TuckStatus } from "./gift-nook";

// Shopping for a Gathering (GIFT-038..040): for each person it's for, have
// *you* tucked a gift for them for this Gathering, or said you're not getting
// them one? Only your own tucks and your own "not getting" marks go in here —
// both are invisible to the person they're about (GIFT-007). Pure (no
// React/Supabase), so it's unit-testable.

export type MyTuck = {
  id: string;
  ownerId: string;
  giftTitle: string;
  status: TuckStatus;
  // Which Gathering it's for (null = none), and that Gathering's name if you
  // can still see it.
  gatheringId: string | null;
  gatheringTitle: string | null;
};

export type ShoppingState = "got" | "need" | "skipped";

export type PersonShopping = {
  state: ShoppingState;
  // Tucked for this Gathering.
  here: MyTuck[];
  // Tucked for them, but for another Gathering (or none) — maybe meant for
  // this one.
  elsewhere: MyTuck[];
};

// A gift tucked for this Gathering wins over "not getting them one", so
// changing your mind never needs undoing first.
export function shoppingFor(personId: string, gatheringId: string, tucks: MyTuck[], skipped: Set<string>): PersonShopping {
  const theirs = tucks.filter((t) => t.ownerId === personId);
  const here = theirs.filter((t) => t.gatheringId === gatheringId);
  const elsewhere = theirs.filter((t) => t.gatheringId !== gatheringId && t.status !== "given");
  return { state: here.length ? "got" : skipped.has(personId) ? "skipped" : "need", here, elsewhere };
}

export function shoppingCounts(states: ShoppingState[]) {
  return {
    got: states.filter((s) => s === "got").length,
    need: states.filter((s) => s === "need").length,
    skipped: states.filter((s) => s === "skipped").length,
  };
}

// The line under someone's name in the list.
export function shoppingLine(shopping: PersonShopping) {
  if (shopping.state === "got") return `You're giving ${listWords(shopping.here.map((t) => t.giftTitle))}`;
  if (shopping.state === "skipped") return "Not getting them a gift this time";
  const other = shopping.elsewhere[0];
  if (!other) return "Nothing tucked for this yet";
  const where = other.gatheringTitle ? `for ${other.gatheringTitle}` : "for no Gathering";
  const more = shopping.elsewhere.length > 1 ? ` (+${shopping.elsewhere.length - 1} more)` : "";
  return `Nothing for this yet — ${other.giftTitle} is tucked ${where}${more}`;
}

// "Kite", "Kite and Socks", "Kite, Socks and 2 more".
export function listWords(items: string[]) {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items[0]}, ${items[1]} and ${items.length - 2} more`;
}
