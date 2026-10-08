import { displayName, type Profile } from "./gift-nook";
import { addressLines, hasAddress, type Address, type Label, type Occasion } from "./letterbox";
import { supabase } from "./supabase";

// Loads your household's Letterbox (LET-001..011) with everything its
// screens need. Row level security decides what comes back: family
// addresses only arrive if their owner shares them with you (PROF-005).

export type LetterboxPerson = {
  id: string;
  household_id: string;
  name: string;
  birthday: string | null;
  profile_id: string | null;
  position: number;
};

export type Household = Address & {
  id: string;
  letterbox_id: string;
  name: string;
  address_from: string | null;
  on_holiday_list: boolean;
  notes: string | null;
  created_at: string;
  letterbox_people: LetterboxPerson[];
};

export type Card = {
  id: string;
  household_id: string;
  direction: "sent" | "received";
  occasion: Occasion;
  season: number;
  on_date: string;
  note: string | null;
  photo_path: string | null;
  created_by: string | null;
};

export type LinkedProfile = Profile & { birthday?: string | null };

export type LetterboxData = {
  boxId: string;
  signedAs: string | null;
  members: { profile_id: string; profiles: LinkedProfile | null }[];
  households: Household[];
  cards: Card[];
  // Family addresses, by profile id — only the ones shared with you.
  addresses: Map<string, Address>;
  // Everyone linked from a household, by profile id.
  profiles: Map<string, LinkedProfile>;
};

const PROFILE = "id, display_name, avatar_icon, avatar_color, birthday";
const ADDRESS = "profile_id, line1, line2, city, region, postal_code, country";

export async function loadLetterbox(): Promise<LetterboxData> {
  const { data: boxId, error } = await supabase.rpc("my_letterbox");
  if (error) throw error;

  const [boxResult, membersResult, householdsResult, cardsResult] = await Promise.all([
    supabase.from("letterboxes").select("signed_as").eq("id", boxId).maybeSingle(),
    supabase.from("letterbox_members").select(`profile_id, profiles(${PROFILE})`).eq("letterbox_id", boxId),
    supabase.from("letterbox_households").select("*, letterbox_people(*)").eq("letterbox_id", boxId).order("name"),
    supabase.from("letterbox_cards").select("*").eq("letterbox_id", boxId).order("on_date", { ascending: false }),
  ]);
  for (const result of [householdsResult, cardsResult]) if (result.error) throw result.error;

  const households = ((householdsResult.data ?? []) as Household[]).map((h) => ({
    ...h,
    letterbox_people: [...h.letterbox_people].sort((a, b) => a.position - b.position),
  }));
  households.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

  const addressIds = [...new Set(households.map((h) => h.address_from).filter(Boolean))] as string[];
  const profileIds = [
    ...new Set(households.flatMap((h) => h.letterbox_people.map((p) => p.profile_id)).filter(Boolean)),
  ] as string[];
  const [addressResult, profileResult] = await Promise.all([
    addressIds.length ? supabase.from("profile_addresses").select(ADDRESS).in("profile_id", addressIds) : { data: [] },
    profileIds.length ? supabase.from("profiles").select(PROFILE).in("id", profileIds) : { data: [] },
  ]);

  return {
    boxId,
    signedAs: boxResult.data?.signed_as ?? null,
    members: (membersResult.data ?? []) as unknown as LetterboxData["members"],
    households,
    cards: (cardsResult.data ?? []) as Card[],
    addresses: new Map(((addressResult.data ?? []) as (Address & { profile_id: string })[]).map((a) => [a.profile_id, a])),
    profiles: new Map(((profileResult.data ?? []) as LinkedProfile[]).map((p) => [p.id, p])),
  };
}

// Where to mail a household's card: the family member's own address if it
// uses one (and they share it with you), otherwise the one typed in.
export function householdAddress(household: Household, data: Pick<LetterboxData, "addresses">): Address | null {
  if (household.address_from) {
    const shared = data.addresses.get(household.address_from);
    if (hasAddress(shared)) return shared;
  }
  return hasAddress(household) ? household : null;
}

// True when a household is set to use a family member's address that you
// can't see (they took it down, or left you out).
export function addressUnavailable(household: Household, data: Pick<LetterboxData, "addresses">) {
  return Boolean(household.address_from && !hasAddress(data.addresses.get(household.address_from)) && !hasAddress(household));
}

export function personName(person: LetterboxPerson, data: Pick<LetterboxData, "profiles">) {
  const linked = person.profile_id ? data.profiles.get(person.profile_id) : null;
  return linked?.display_name?.trim() ? displayName(linked) : person.name;
}

export function personBirthday(person: LetterboxPerson, data: Pick<LetterboxData, "profiles">) {
  const linked = person.profile_id ? data.profiles.get(person.profile_id) : null;
  return linked?.birthday ?? person.birthday;
}

export function labelFor(household: Household, data: Pick<LetterboxData, "addresses">): Label | null {
  const address = householdAddress(household, data);
  return address ? { name: household.name, lines: addressLines(address) } : null;
}

// --- Card photos (LET-007) ---------------------------------------------------------

export async function uploadCardPhoto(boxId: string, uri: string, mimeType?: string | null) {
  const type = mimeType && mimeType.startsWith("image/") ? mimeType : "image/jpeg";
  const extension = type === "image/png" ? "png" : type === "image/heic" ? "heic" : "jpg";
  const path = `${boxId}/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
  const body = await (await fetch(uri)).arrayBuffer();
  const { error } = await supabase.storage.from("letterbox").upload(path, body, { contentType: type });
  if (error) throw error;
  return path;
}

export async function removeCardPhoto(path: string | null) {
  if (path) await supabase.storage.from("letterbox").remove([path]);
}

// Private photos: short-lived links, made in one go.
export async function photoUrls(paths: string[]) {
  const unique = [...new Set(paths)];
  if (!unique.length) return new Map<string, string>();
  const { data } = await supabase.storage.from("letterbox").createSignedUrls(unique, 3600);
  return new Map((data ?? []).filter((d) => d.signedUrl && d.path).map((d) => [d.path!, d.signedUrl as string]));
}

// --- Thank-yous (LET-011) ------------------------------------------------------------

export type Thanks = {
  id: string;
  household_id: string | null;
  from_name: string | null;
  what: string;
  gift_id: string | null;
  thanked_at: string | null;
  created_at: string;
};

export type ReceivedGift = { id: string; title: string; received_at: string; ownerName: string | null };

// Gifts you (or a kid you manage) checked off as received in the Gift Nook
// (GIFT-026). Only your own gifts — nothing about who tucked them (GIFT-007).
export async function loadReceivedGifts(userId: string): Promise<ReceivedGift[]> {
  const { data: kids } = await supabase
    .from("profile_managers")
    .select("profile_id, profiles!profile_managers_profile_id_fkey(display_name)")
    .eq("manager_id", userId);
  const kidNames = new Map(
    ((kids ?? []) as unknown as { profile_id: string; profiles: { display_name: string | null } | null }[]).map((k) => [
      k.profile_id,
      displayName(k.profiles),
    ])
  );
  const owners = [userId, ...kidNames.keys()];
  const since = new Date(Date.now() - 365 * 864e5).toISOString();
  const { data, error } = await supabase
    .from("gifts")
    .select("id, title, received_at, wishbooks!inner(owner_id)")
    .not("received_at", "is", null)
    .gte("received_at", since)
    .in("wishbooks.owner_id", owners)
    .order("received_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as { id: string; title: string; received_at: string; wishbooks: { owner_id: string } }[]).map(
    (g) => ({
      id: g.id,
      title: g.title,
      received_at: g.received_at,
      ownerName: g.wishbooks.owner_id === userId ? null : (kidNames.get(g.wishbooks.owner_id) ?? null),
    })
  );
}
