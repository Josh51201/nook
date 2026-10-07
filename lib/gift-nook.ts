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
  created_at: string;
  shelves: { key: string; label: string } | null;
};

// A claim, called a "Tuck" in the UI. GIFT-007: never fetched on the owner's
// own Wishbook screen — RLS would return nothing anyway, but the owner's
// screens don't even ask.
export type Tuck = { id: string; claimed_by: string; released_at: string | null };

export type Profile = { id: string; display_name: string | null };

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
};

export const GIFT_SELECT = "id, wishbook_id, shelf_id, title, url, notes, is_repeatable, details, created_at, shelves(key, label)";

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

export function displayName(profile: Profile | null | undefined) {
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
