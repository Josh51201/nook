import { supabase } from "./supabase";

// Shared types and config for the Gift Nook screens (app/gift-nook/*).
// Table shapes mirror supabase/migrations — keep them in sync by hand until
// we generate types from the database.

export type Shelf = { id: string; key: string; label: string; sort_order: number };

export type Gift = {
  id: string;
  wishbook_id: string;
  shelf_id: string;
  title: string;
  url: string | null;
  notes: string | null;
  is_repeatable: boolean;
  details: Record<string, string>;
  image_url: string | null; // GIFT-030
  suggested_by: string | null; // GIFT-022: hidden from the owner by RLS
  created_at: string;
  updated_at: string;
  removed_at: string | null; // GIFT-025: only givers who tucked it see these
  received_at: string | null; // GIFT-026
  shelves: { key: string; label: string } | null;
  suggester: { display_name: string | null } | null;
};

// A claim, called a "Tuck" in the UI. GIFT-007: never fetched on the owner's
// own Wishbook screen — RLS would return nothing anyway, but the owner's
// screens don't even ask.
export type TuckStatus = "planning" | "bought" | "given";

export type Tuck = {
  id: string;
  claimed_by: string;
  released_at: string | null;
  status: TuckStatus;
  note: string | null;
  claimed_at: string;
  acknowledged_at: string | null;
  profiles: { display_name: string | null } | null; // the giver (GIFT-024)
};

export const TUCK_SELECT =
  "id, claimed_by, released_at, status, note, claimed_at, acknowledged_at, profiles(display_name)";

// Still counts against the gift: not released and not already given.
export function isActiveTuck(tuck: Pick<Tuck, "released_at" | "status">) {
  return !tuck.released_at && tuck.status !== "given";
}

// GIFT-025: the gift was edited after this giver last looked at it.
export function giftChangedSince(gift: Pick<Gift, "updated_at" | "created_at">, tuck: Tuck) {
  const seen = new Date(tuck.acknowledged_at ?? tuck.claimed_at).getTime();
  return gift.updated_at !== gift.created_at && new Date(gift.updated_at).getTime() > seen;
}

export const tuckStatusLabel: Record<TuckStatus, string> = {
  planning: "Planning to get it",
  bought: "Bought ✓",
  given: "Given 🎉",
};

export type Profile = { id: string; display_name: string | null; is_managed?: boolean };

export type BurrowMember = {
  profile_id: string;
  role: "admin" | "member";
  profiles: Profile | null;
};

export type Gathering = {
  id: string;
  burrow_id: string;
  title: string;
  kind: GatheringKind;
  ends_at: string;
  created_by?: string | null;
};

export const GIFT_SELECT =
  "id, wishbook_id, shelf_id, title, url, notes, is_repeatable, details, image_url, suggested_by, " +
  "created_at, updated_at, removed_at, received_at, shelves(key, label), " +
  "suggester:profiles!gifts_suggested_by_fkey(display_name)";

// GIFT-003: each Shelf asks its own questions; answers go in gifts.details.
// Provisional field list pending Q-004 — add/rename freely, no migration needed.
export type ShelfField = { key: string; label: string; placeholder: string };

export const shelfFields: Record<string, ShelfField[]> = {
  clothes: [
    { key: "size", label: "Size", placeholder: "e.g. M, 10.5, 32x30" },
    { key: "color", label: "Color", placeholder: "e.g. navy, any" },
  ],
  money_gift_card: [
    { key: "store", label: "Store", placeholder: "e.g. Target, any" },
    { key: "amount", label: "Amount", placeholder: "e.g. $25" },
  ],
  books: [{ key: "author", label: "Author", placeholder: "e.g. Tolkien" }],
  toys: [{ key: "age", label: "Age range", placeholder: "e.g. 3+" }],
  experiences: [{ key: "where", label: "Where", placeholder: "e.g. the zoo" }],
};

// GIFT-009 default per Shelf (money/clothes can come from many givers). The
// owner can always flip it.
export const repeatableByDefault = new Set(["clothes", "money_gift_card"]);

// GIFT-010/014.
export type GatheringKind = "christmas" | "birthday" | "anniversary" | "baby_shower" | "other";

export const gatheringKinds: { key: GatheringKind; label: string; emoji: string }[] = [
  { key: "christmas", label: "Christmas", emoji: "🎄" },
  { key: "birthday", label: "Birthday", emoji: "🎂" },
  { key: "anniversary", label: "Anniversary", emoji: "💞" },
  { key: "baby_shower", label: "Baby shower", emoji: "🍼" },
  { key: "other", label: "Other", emoji: "✨" },
];

export function gatheringKindInfo(kind: string) {
  return gatheringKinds.find((k) => k.key === kind) ?? gatheringKinds[gatheringKinds.length - 1];
}

// GIFT-016: a Gathering counts as archived once its end date passes. How
// long until it's deleted is Q-014, so nothing is deleted yet.
export function isArchived(gathering: Pick<Gathering, "ends_at">) {
  return new Date(gathering.ends_at).getTime() < Date.now();
}

export function displayName(profile: { display_name: string | null } | null | undefined) {
  return profile?.display_name?.trim() || "Someone";
}

export function normalizeUrl(url: string) {
  const trimmed = url.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// GIFT-017: which of a Wishbook's gifts show in a given Gathering. An
// explicit per-gift choice wins; otherwise includeNew decides (default true,
// i.e. the whole Wishbook).
export type GiftPicks = { picks: Map<string, boolean>; includeNew: boolean };

export async function loadGiftPicks(gatheringId: string, wishbookId: string): Promise<GiftPicks> {
  const [picksResult, settingsResult] = await Promise.all([
    supabase
      .from("gathering_gifts")
      .select("gift_id, included, gifts!inner(wishbook_id)")
      .eq("gathering_id", gatheringId)
      .eq("gifts.wishbook_id", wishbookId),
    supabase
      .from("gathering_wishbook_settings")
      .select("include_new")
      .eq("gathering_id", gatheringId)
      .eq("wishbook_id", wishbookId)
      .maybeSingle(),
  ]);
  return {
    picks: new Map((picksResult.data ?? []).map((row) => [row.gift_id, row.included])),
    includeNew: settingsResult.data?.include_new ?? true,
  };
}

export function isGiftShown(giftId: string, { picks, includeNew }: GiftPicks) {
  return picks.get(giftId) ?? includeNew;
}
