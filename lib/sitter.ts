import type { IconName } from "../components/icon";

// Sitter Sheet Nook (SIT-001..008): the plain helpers, no database.

export type SitterContact = { name: string; phone: string; note?: string };

export type SitterSheet = {
  home_id: string;
  address: string | null;
  contacts: SitterContact[];
  doctor_name: string | null;
  doctor_phone: string | null;
  bedtime: string | null;
  rules: string | null;
  food: string | null;
  notes: string | null;
  updated_by: string | null;
  updated_at: string;
};

export type SectionKey = "address" | "contacts" | "doctor" | "bedtime" | "rules" | "food" | "notes";

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
  revoked_at: string | null;
  views: number;
  last_viewed_at: string | null;
  created_by: string | null;
  created_at: string;
};

// The parts you type (SIT-004), in the order the sitter sees them.
export const sections: { key: SectionKey; label: string; icon: IconName; hint: string }[] = [
  { key: "contacts", label: "Emergency numbers", icon: "phone", hint: "You, a neighbor, grandparents, poison control" },
  { key: "address", label: "Address", icon: "place", hint: "So they can give it to 911" },
  { key: "doctor", label: "Doctor", icon: "heart", hint: "Name and number" },
  { key: "bedtime", label: "Bedtime", icon: "moon", hint: "When, and how it goes" },
  { key: "food", label: "Food", icon: "food", hint: "What's for dinner, snacks that are okay" },
  { key: "rules", label: "House rules", icon: "shield", hint: "Screens, outside, friends over" },
  { key: "notes", label: "Anything else", icon: "doc", hint: "Wi-Fi, where things are" },
];

export const allSections = sections.map((s) => s.key);

// Whether a typed section has anything in it yet.
export function sectionFilled(sheet: SitterSheet | null, key: SectionKey) {
  if (!sheet) return false;
  switch (key) {
    case "contacts":
      return sheet.contacts.length > 0;
    case "doctor":
      return Boolean(sheet.doctor_name?.trim() || sheet.doctor_phone?.trim());
    default:
      return Boolean(sheet[key]?.trim());
  }
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
