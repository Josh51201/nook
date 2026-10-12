import type { SupabaseClient } from "@supabase/supabase-js";

// New in Wishbooks (CORE-107): what family members have added to their
// Wishbooks lately, so you see it before you go shopping.
//
// GIFT-007: this only ever reads other people's Wishbooks (yours is left
// out in the query and again here), and it never asks for tucks or claims
// or anything that comes from them, so there's nothing it could give away.
// Which gifts you can see at all is the database's rule (RLS), as it is in
// the Gift Nook. tests/new-wishes-rls.test.ts proves both against a real
// database.

// Only the gift itself and whose list it's on.
export const NEW_WISH_SELECT = "id, title, image_url, created_at, wishbooks!inner(owner_id, profiles(display_name))";

export type NewWish = { id: string; title: string; image_url: string | null; created_at: string; ownerId: string; ownerName: string | null };

export type WishPerson = { profileId: string; name: string; count: number; titles: string[]; newest: string };

export const wishWindows = [7, 14, 30] as const;

type Row = {
  id: string;
  title: string;
  image_url: string | null;
  created_at: string;
  wishbooks: { owner_id: string; profiles: { display_name: string | null } | null } | null;
};

export async function loadNewWishes(client: SupabaseClient, userId: string, days: number, now = new Date(), limit = 60): Promise<NewWish[]> {
  const since = new Date(now.getTime() - days * 86400000);
  const { data, error } = await client
    .from("gifts")
    .select(NEW_WISH_SELECT)
    .is("removed_at", null)
    .is("received_at", null)
    .gte("created_at", since.toISOString())
    .neq("wishbooks.owner_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as unknown as Row[]).flatMap((row) => {
    const ownerId = row.wishbooks?.owner_id;
    if (!ownerId || ownerId === userId) return [];
    return [{ id: row.id, title: row.title, image_url: row.image_url, created_at: row.created_at, ownerId, ownerName: row.wishbooks?.profiles?.display_name ?? null }];
  });
}

// One line per person, whoever added most recently first.
export function groupNewWishes(wishes: NewWish[]): WishPerson[] {
  const people = new Map<string, WishPerson>();
  for (const wish of [...wishes].sort((a, b) => b.created_at.localeCompare(a.created_at))) {
    const person = people.get(wish.ownerId);
    if (person) {
      person.count += 1;
      person.titles.push(wish.title);
    } else {
      people.set(wish.ownerId, {
        profileId: wish.ownerId,
        name: wish.ownerName?.trim() || "Someone",
        count: 1,
        titles: [wish.title],
        newest: wish.created_at,
      });
    }
  }
  return [...people.values()];
}

// "Lego set, a scarf and 2 more"
export function wishTitles(titles: string[], show = 2) {
  const shown = titles.slice(0, show);
  const more = titles.length - shown.length;
  if (!more) return shown.length === 2 ? `${shown[0]} and ${shown[1]}` : shown.join("");
  return `${shown.join(", ")} and ${more} more`;
}
