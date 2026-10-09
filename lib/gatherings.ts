import type { RsvpStatus } from "./potluck";

// The Gathering Nook (GATH-001..): every get-together you're invited to,
// whatever it's for. A Gathering has its own guest list (whole Burrows
// and/or people picked one by one), hosts and RSVPs; gift lists (the Gift
// Nook) and a Potluck are things it can have. Pure (no React/Supabase), so
// it's unit-testable.

export type GatheringRow = {
  id: string;
  title: string;
  kind: string;
  ends_at: string;
  starts_at: string | null;
  place: string | null;
  notes: string | null;
  gifts: boolean;
  burrow_id: string | null;
  created_by: string | null;
};

// One person on the guest list (public.gathering_guest_list).
export type Guest = {
  profile_id: string;
  display_name: string | null;
  avatar_icon: string | null;
  avatar_color: string | null;
  avatar_path: string | null;
  is_managed: boolean;
  is_host: boolean;
  // Picked one by one, rather than invited with a whole Burrow.
  invited_alone: boolean;
  status: RsvpStatus | null;
  extra_guests: number;
  // Only people you share a Burrow with: GIFT-007's Wishbook rules don't
  // change because you're at the same party.
  can_see_wishbook: boolean;
};

export const rsvpChoices: { key: RsvpStatus; label: string }[] = [
  { key: "going", label: "Going" },
  { key: "maybe", label: "Maybe" },
  { key: "no", label: "Can't make it" },
];

export function rsvpLabel(status: RsvpStatus | null | undefined) {
  return rsvpChoices.find((choice) => choice.key === status)?.label ?? "Not answered";
}

// A Gathering is "on" a day; ends_at is the end of that day on this phone.
export function endOfDay(day: Date) {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59);
}

// The day and (optional) time picked in the form, as the database keeps them.
export function whenFields(day: Date, time: Date | null) {
  const startsAt = time
    ? new Date(day.getFullYear(), day.getMonth(), day.getDate(), time.getHours(), time.getMinutes())
    : null;
  return { ends_at: endOfDay(day).toISOString(), starts_at: startsAt ? startsAt.toISOString() : null };
}

// "Sat, Dec 20" or "Sat, Dec 20 · 5:00 PM".
export function whenWords(gathering: { ends_at: string; starts_at?: string | null }) {
  const day = new Date(gathering.starts_at ?? gathering.ends_at).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  if (!gathering.starts_at) return day;
  const time = new Date(gathering.starts_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${day} · ${time}`;
}

// Today and the next 6 days, later on, and ones that already happened.
export function groupGatherings<T extends { ends_at: string }>(rows: T[], now = new Date()) {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const weekOut = startOfToday + 7 * 864e5;
  const byDay = [...rows].sort((a, b) => a.ends_at.localeCompare(b.ends_at));
  return {
    thisWeek: byDay.filter((g) => {
      const t = new Date(g.ends_at).getTime();
      return t >= startOfToday && t < weekOut;
    }),
    later: byDay.filter((g) => new Date(g.ends_at).getTime() >= weekOut),
    past: byDay.filter((g) => new Date(g.ends_at).getTime() < startOfToday).reverse(),
  };
}

// Counts for the guest list: everyone invited, and who's said what. Extra
// guests someone is bringing count toward "coming".
export function guestCounts(guests: Pick<Guest, "status" | "extra_guests">[]) {
  let going = 0;
  let maybe = 0;
  let no = 0;
  let waiting = 0;
  for (const guest of guests) {
    if (guest.status === "going") going += 1 + Math.max(0, guest.extra_guests);
    else if (guest.status === "maybe") maybe += 1 + Math.max(0, guest.extra_guests);
    else if (guest.status === "no") no += 1;
    else waiting += 1;
  }
  return { invited: guests.length, going, maybe, no, waiting };
}

// "5 coming · 2 maybe · 4 haven't answered".
export function guestSummary(guests: Pick<Guest, "status" | "extra_guests">[]) {
  const { invited, going, maybe, waiting } = guestCounts(guests);
  if (!invited) return "Nobody invited yet";
  const parts = [
    going ? `${going} coming` : null,
    maybe ? `${maybe} maybe` : null,
    waiting ? `${waiting} ${waiting === 1 ? "hasn't" : "haven't"} answered` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : `${invited} invited`;
}

// Who's on the list, from the picker's choices: everyone in the picked
// Burrows plus the people picked one by one, without repeats.
export function invitedIds(
  burrowIds: Iterable<string>,
  personIds: Iterable<string>,
  membersOf: (burrowId: string) => string[]
) {
  const ids = new Set<string>(personIds);
  for (const burrowId of burrowIds) for (const id of membersOf(burrowId)) ids.add(id);
  return ids;
}

// A name for a Gathering when none was typed: "Mia's Birthday", "Game night".
export function defaultTitle(kindLabel: string, honoreeNames: string[]) {
  return honoreeNames.length ? `${honoreeNames.join(" & ")}'s ${kindLabel}` : kindLabel;
}
