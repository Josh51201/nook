import type { IconName } from "../components/icon";

// Sitter Sheet Nook (SIT-001..013): the plain helpers, no database.

export type SitterContact = { name: string; phone: string; note?: string };

// One step of the day (SIT-010): "15:15", "School pickup".
export type RoutineStep = { time: string; what: string };

export type SitterSheet = {
  home_id: string;
  address: string | null;
  contacts: SitterContact[];
  doctor_name: string | null;
  doctor_phone: string | null;
  routine: RoutineStep[];
  bedtime: string | null;
  rules: string | null;
  food: string | null;
  wifi_name: string | null;
  wifi_password: string | null;
  places: string | null;
  codes: string | null;
  notes: string | null;
  updated_by: string | null;
  updated_at: string;
};

export type SectionKey = "address" | "contacts" | "doctor" | "routine" | "bedtime" | "rules" | "food" | "wifi" | "places" | "codes" | "notes";

export type SitterLink = {
  id: string;
  token: string;
  label: string;
  starts_on: string;
  ends_on: string;
  expires_at: string;
  sections: SectionKey[];
  kid_ids: string[];
  pet_ids: string[];
  // Sick Day (SICK-010): how the kids on it are doing, while they're sick.
  show_sick?: boolean;
  revoked_at: string | null;
  views: number;
  last_viewed_at: string | null;
  created_by: string | null;
  created_at: string;
};

// The parts you type (SIT-004, SIT-010, SIT-013), in the order the sitter sees them.
export const sections: { key: SectionKey; label: string; icon: IconName; hint: string }[] = [
  { key: "contacts", label: "Emergency numbers", icon: "phone", hint: "You, a neighbor, grandparents, poison control" },
  { key: "address", label: "Address", icon: "place", hint: "So they can give it to 911" },
  { key: "doctor", label: "Doctor", icon: "heart", hint: "Name and number" },
  { key: "routine", label: "Daily routine", icon: "clock", hint: "The day in order: pickup, dinner, bath, bed" },
  { key: "bedtime", label: "Bedtime", icon: "moon", hint: "When, and how it goes" },
  { key: "food", label: "Food", icon: "food", hint: "What's for dinner, snacks that are okay" },
  { key: "rules", label: "House rules", icon: "shield", hint: "Screens, outside, friends over" },
  { key: "wifi", label: "Wi-Fi", icon: "globe", hint: "They get a button to copy the password" },
  { key: "places", label: "Where things are", icon: "search", hint: "First-aid kit, breaker box, spare key, flashlight" },
  { key: "codes", label: "Door & alarm codes", icon: "key", hint: "Never on a link unless you tick it for that link" },
  { key: "notes", label: "Anything else", icon: "doc", hint: "Anything that doesn't fit above" },
];

export const allSections = sections.map((s) => s.key);

// Whether a typed section has anything in it yet.
export function sectionFilled(sheet: SitterSheet | null, key: SectionKey) {
  if (!sheet) return false;
  switch (key) {
    case "contacts":
      return sheet.contacts.length > 0;
    case "routine":
      return (sheet.routine ?? []).length > 0;
    case "doctor":
      return Boolean(sheet.doctor_name?.trim() || sheet.doctor_phone?.trim());
    case "wifi":
      return Boolean(sheet.wifi_name?.trim() || sheet.wifi_password?.trim());
    default:
      return Boolean(sheet[key]?.trim());
  }
}

// --- Quick starts (SIT-012) ----------------------------------------------------------------

export type PresetKey = "babysitter" | "house" | "pets";

// Which parts, kids and pets each kind of sitter usually needs. Codes are
// never in a preset (SIT-013): you tick them yourself, per link.
export const presets: { key: PresetKey; label: string; icon: IconName; sections: SectionKey[]; kids: boolean; pets: boolean }[] = [
  {
    key: "babysitter",
    label: "Babysitter",
    icon: "kid",
    sections: ["contacts", "address", "doctor", "routine", "bedtime", "food", "rules", "wifi", "places", "notes"],
    kids: true,
    pets: true,
  },
  { key: "house", label: "House-sitter", icon: "hearth", sections: ["contacts", "address", "wifi", "places", "notes"], kids: false, pets: true },
  { key: "pets", label: "Pet-sitter", icon: "paw", sections: ["contacts", "address", "places", "notes"], kids: false, pets: true },
];

// A preset's picks, limited to what's actually filled in and who's in the Home.
export function applyPreset(
  key: PresetKey,
  sheet: SitterSheet | null,
  kidIds: string[],
  petIds: string[]
): { sections: SectionKey[]; kidIds: string[]; petIds: string[] } {
  const preset = presets.find((p) => p.key === key)!;
  return {
    sections: preset.sections.filter((s) => s !== "codes" && sectionFilled(sheet, s)),
    kidIds: preset.kids ? kidIds : [],
    petIds: preset.pets ? petIds : [],
  };
}

// "Same as last time": the latest link per name, newest first.
export function pastSitters<T extends Pick<SitterLink, "label" | "created_at">>(links: T[], limit = 5): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const link of [...links].sort((a, b) => b.created_at.localeCompare(a.created_at))) {
    const key = link.label.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(link);
    if (out.length === limit) break;
  }
  return out;
}

// Reuse a past link's picks, dropping kids or pets no longer in the Home.
export function reusePicks(link: Pick<SitterLink, "sections" | "kid_ids" | "pet_ids">, kidIds: string[], petIds: string[]) {
  return {
    sections: [...link.sections],
    kidIds: link.kid_ids.filter((id) => kidIds.includes(id)),
    petIds: link.pet_ids.filter((id) => petIds.includes(id)),
  };
}

// --- The routine (SIT-010) -----------------------------------------------------------------

export function sortRoutine(steps: RoutineStep[]) {
  return [...steps].sort((a, b) => a.time.localeCompare(b.time));
}

// Which step is happening now (the latest one that's started) and which is
// next, for a time of day "HH:MM". Before the first step, nothing is "now".
export function routineNow(steps: RoutineStep[], time: string) {
  const sorted = sortRoutine(steps);
  let now = -1;
  sorted.forEach((s, i) => {
    if (s.time <= time) now = i;
  });
  const next = now + 1 < sorted.length ? now + 1 : -1;
  return { steps: sorted, now, next };
}

// Keep steps that say something, tidied and in order.
export function cleanRoutine(steps: RoutineStep[]): RoutineStep[] {
  return sortRoutine(steps.map((s) => ({ time: s.time, what: s.what.trim() })).filter((s) => s.what && /^([01]\d|2[0-3]):[0-5]\d$/.test(s.time)));
}

// The web page the sitter opens. The secret goes after "#", which browsers
// never send to the web host (SIT-007).
export function sitterPageUrl(base = process.env.EXPO_PUBLIC_SITTER_PAGE_URL) {
  const trimmed = base?.trim().replace(/[#?].*$/, "");
  if (!trimmed) return null;
  // "nook-sitter.netlify.app" on its own isn't a link a phone will open.
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function linkUrl(token: string, base = sitterPageUrl()) {
  return base ? `${base}#${token}` : null;
}

export type LinkState = "active" | "upcoming" | "ended" | "off";

// Works from when it's made until the end of its last day (SIT-008);
// "upcoming" only changes the words, not whether it opens.
export function linkState(link: Pick<SitterLink, "revoked_at" | "expires_at" | "starts_on">, now = new Date(), today = localDayOf(now)): LinkState {
  if (link.revoked_at) return "off";
  if (new Date(link.expires_at) <= now) return "ended";
  if (link.starts_on > today) return "upcoming";
  return "active";
}

function localDayOf(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function shortDay(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return `${dayNames[date.getDay()]}, ${monthNames[m - 1]} ${d}`;
}

// "Fri, Oct 10 – Sun, Oct 12", or one day on its own.
export function stayWords(link: Pick<SitterLink, "starts_on" | "ends_on">) {
  return link.starts_on === link.ends_on ? shortDay(link.starts_on) : `${shortDay(link.starts_on)} – ${shortDay(link.ends_on)}`;
}

// Short words for a Hearth tile (SIT-009): "ends today", "ends tmrw",
// "ends Sun", "ends Oct 30"; or when it starts, if it hasn't yet.
export function endsWords(link: { starts_on: string; ends_on: string }, today: string) {
  if (link.starts_on > today) {
    const d = daysBetween(today, link.starts_on);
    return d === 1 ? "starts tmrw" : d < 7 ? `starts ${shortDay(link.starts_on).slice(0, 3)}` : `starts ${shortDay(link.starts_on).slice(5)}`;
  }
  const d = daysBetween(today, link.ends_on);
  if (d <= 0) return "ends today";
  if (d === 1) return "ends tmrw";
  return d < 7 ? `ends ${shortDay(link.ends_on).slice(0, 3)}` : `ends ${shortDay(link.ends_on).slice(5)}`;
}

export function viewsWords(views: number) {
  return views ? `Opened ${views} time${views === 1 ? "" : "s"}` : "Not opened yet";
}

// What gets texted along with the link.
export function shareMessage(link: Pick<SitterLink, "ends_on">, url: string) {
  return `Here's everything you need while you're looking after things: ${url}\n\nIt works until the end of ${shortDay(link.ends_on)}.`;
}

// Days between two YYYY-MM-DD dates.
export function daysBetween(from: string, to: string) {
  const [a, b] = [from, to].map((d) => {
    const [y, m, day] = d.split("-").map(Number);
    return Date.UTC(y, m - 1, day);
  });
  return Math.round((b - a) / 864e5);
}

export const longestStay = 60;

// Plain-words reason a stay can't be saved, or null if it's fine.
export function stayProblem(startsOn: string, endsOn: string, today: string) {
  if (endsOn < startsOn) return "The last day is before the first day.";
  if (endsOn < today) return "That stay has already ended.";
  if (daysBetween(startsOn, endsOn) > longestStay) return `A link can cover up to ${longestStay} days. Make another for longer.`;
  return null;
}

// Keep contacts that have both a name and a number, tidied.
export function cleanContacts(contacts: SitterContact[]): SitterContact[] {
  return contacts
    .map((c) => ({ name: c.name.trim(), phone: c.phone.trim(), note: c.note?.trim() || undefined }))
    .filter((c) => c.name && c.phone)
    .map((c) => (c.note ? c : { name: c.name, phone: c.phone }));
}
