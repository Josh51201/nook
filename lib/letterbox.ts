import type { IconName } from "../components/icon";

// Letterbox Nook (LET-001..011): pure helpers, no React or database, so
// they're unit-testable. Screens live in app/letterbox/, loading in
// lib/letterbox-data.ts.

export type Address = {
  line1: string | null;
  line2: string | null;
  city: string | null;
  region: string | null;
  postal_code: string | null;
  country: string | null;
};

export type Occasion = "holiday" | "birthday" | "thank_you" | "sympathy" | "wedding" | "graduation" | "baby" | "get_well" | "other";

export const occasions: { key: Occasion; label: string; icon: IconName }[] = [
  { key: "holiday", label: "Holiday", icon: "christmas" },
  { key: "birthday", label: "Birthday", icon: "birthday" },
  { key: "thank_you", label: "Thank-you", icon: "heart" },
  { key: "wedding", label: "Wedding", icon: "anniversary" },
  { key: "baby", label: "New baby", icon: "baby" },
  { key: "graduation", label: "Graduation", icon: "school" },
  { key: "get_well", label: "Get well", icon: "pill" },
  { key: "sympathy", label: "Sympathy", icon: "flower" },
  { key: "other", label: "Other", icon: "mail" },
];

export function occasionInfo(key: string) {
  return occasions.find((o) => o.key === key) ?? occasions[occasions.length - 1];
}

// Which holiday season a date belongs to: cards that arrive in January
// still count for last year's (LET-005).
export function cardSeason(date = new Date()) {
  return date.getMonth() === 0 ? date.getFullYear() - 1 : date.getFullYear();
}

// The year a card counts for, given what it was for and when.
export function seasonFor(occasion: Occasion, date: Date) {
  return occasion === "holiday" ? cardSeason(date) : date.getFullYear();
}

export function hasAddress(address: Address | null | undefined): address is Address {
  return Boolean(address?.line1?.trim() && address.city?.trim());
}

// "123 Elm St", "Apt 4", "Springfield, IL 62704", and the country if given.
export function addressLines(address: Address | null | undefined) {
  if (!hasAddress(address)) return [];
  const place = [address.city?.trim(), [address.region?.trim(), address.postal_code?.trim()].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
  return [address.line1?.trim(), address.line2?.trim(), place, address.country?.trim()].filter(Boolean) as string[];
}

export function emptyAddress(): Address {
  return { line1: "", line2: "", city: "", region: "", postal_code: "", country: "" };
}

// Blank fields saved as null.
export function cleanAddress(address: Address): Address {
  const clean = (value: string | null) => (value?.trim() ? value.trim() : null);
  return {
    line1: clean(address.line1),
    line2: clean(address.line2),
    city: clean(address.city),
    region: clean(address.region),
    postal_code: clean(address.postal_code),
    country: clean(address.country),
  };
}

// A household's name from the people in it, e.g. for a new entry:
// "Mia Johnson" → "Mia Johnson"; two people → "Mia & Sam Johnson" if they
// share a last name, otherwise "Mia Johnson & Sam Lee".
export function householdNameFor(names: string[]) {
  const people = names.map((n) => n.trim()).filter(Boolean);
  if (people.length === 0) return "";
  if (people.length === 1) return people[0];
  const last = (name: string) => (name.includes(" ") ? name.slice(name.lastIndexOf(" ") + 1) : null);
  const surname = last(people[0]);
  if (people.length === 2 && surname && last(people[1]) === surname) {
    const first = (name: string) => name.slice(0, name.lastIndexOf(" "));
    return `${first(people[0])} & ${first(people[1])} ${surname}`;
  }
  if (people.length === 2) return `${people[0]} & ${people[1]}`;
  return surname && people.every((p) => last(p) === surname) ? `The ${surname} family` : `${people[0]} & family`;
}

// A received gift you don't plan to write a note for (LET-011).
export const NO_NOTE = "No note needed";

// --- Birthdays (LET-010) ---------------------------------------------------------

// A birthday's next date on or after today, and how many days away it is.
// "YYYY-MM-DD"; Feb 29 falls on Mar 1 in other years.
export function nextBirthday(birthday: string, now = new Date()) {
  const [, month, day] = birthday.split("-").map(Number);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const onYear = (year: number) => {
    const leap = new Date(year, 1, 29).getMonth() === 1;
    return month === 2 && day === 29 && !leap ? new Date(year, 2, 1) : new Date(year, month - 1, day);
  };
  let date = onYear(today.getFullYear());
  if (date < today) date = onYear(today.getFullYear() + 1);
  return { date, days: Math.round((date.getTime() - today.getTime()) / 86400000) };
}

// --- Card season (LET-005, LET-009) ------------------------------------------------

export type SeasonCard = { household_id: string; direction: "sent" | "received"; occasion: string; season: number };
export type SeasonHousehold = { id: string; on_holiday_list: boolean };

// Who's left to send a holiday card to this season, who's done, and who
// sent one. Households that sent you one but aren't on your list are
// "worth adding" — so next year nobody's missed.
export function seasonStatus<H extends SeasonHousehold>(households: H[], cards: SeasonCard[], season: number) {
  const holiday = cards.filter((c) => c.occasion === "holiday" && c.season === season);
  const sentTo = new Set(holiday.filter((c) => c.direction === "sent").map((c) => c.household_id));
  const gotFrom = new Set(holiday.filter((c) => c.direction === "received").map((c) => c.household_id));
  const onList = households.filter((h) => h.on_holiday_list || sentTo.has(h.id));
  return {
    toSend: onList.filter((h) => !sentTo.has(h.id)),
    sent: onList.filter((h) => sentTo.has(h.id)),
    gotFrom: households.filter((h) => gotFrom.has(h.id)),
    worthAdding: households.filter((h) => gotFrom.has(h.id) && !h.on_holiday_list && !sentTo.has(h.id)),
    total: onList.length,
  };
}

// --- Labels and lists (LET-008) ----------------------------------------------------

export type Label = { name: string; lines: string[] };

const escape = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Printable address labels on the common 30-per-sheet size (Avery 5160 and
// its look-alikes: 3 across, 10 down, 2⅝" × 1" on US Letter).
export function labelSheetHtml(labels: Label[]) {
  const pages: Label[][] = [];
  for (let i = 0; i < labels.length; i += 30) pages.push(labels.slice(i, i + 30));
  const label = (l: Label) =>
    `<div class="label"><div class="name">${escape(l.name)}</div>${l.lines.map((line) => `<div>${escape(line)}</div>`).join("")}</div>`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@page { size: 8.5in 11in; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, Helvetica, Arial, sans-serif; }
.page { width: 8.5in; height: 11in; padding: 0.5in 0.1875in 0; display: grid;
  grid-template-columns: repeat(3, 2.625in); grid-auto-rows: 1in; column-gap: 0.125in; page-break-after: always; }
.page:last-child { page-break-after: auto; }
.label { padding: 0.08in 0.15in; display: flex; flex-direction: column; justify-content: center;
  font-size: 10pt; line-height: 1.2; overflow: hidden; }
.name { font-weight: 600; }
</style></head><body>${pages.map((page) => `<div class="page">${page.map(label).join("")}</div>`).join("")}</body></html>`;
}

// The same addresses as plain text, to paste anywhere.
export function addressListText(labels: Label[]) {
  return labels.map((l) => [l.name, ...l.lines].join("\n")).join("\n\n");
}
