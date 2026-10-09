// The Fridge Door (CORE-086): a widget drawn as a fridge door where your
// Home or a Burrow sticks up notes and doodles for each other, each held by
// a magnet, coming down by itself after a day (or three, or a week). Pure
// helpers only (no React or database), so they're unit-testable; loading
// and live updates are in lib/fridge-data.ts and the drawing is in
// components/fridge-door.tsx.

export type FridgePlace = { kind: "home" | "burrow"; id: string };

// One pen line in a doodle: its color, its width (on the 0–1000 square) and
// its points, flattened as x, y, x, y, …
export type Stroke = { c: string; w: number; p: number[] };

export type FridgeNote = {
  id: string;
  home_id: string | null;
  burrow_id: string | null;
  author_id: string;
  kind: "note" | "doodle";
  body: string | null;
  doodle: Stroke[] | null;
  paper: string;
  lasts_days: number;
  created_at: string;
  expires_at: string;
  author?: { display_name: string | null; avatar_icon: string | null; avatar_color: string | null; avatar_path?: string | null } | null;
};

export const NOTE_SELECT =
  "id, home_id, burrow_id, author_id, kind, body, doodle, paper, lasts_days, created_at, expires_at, author:profiles!fridge_notes_author_id_fkey(display_name, avatar_icon, avatar_color, avatar_path)";

export const MAX_NOTE_LENGTH = 200;
// The database refuses more than this many on one fridge at once.
export const MAX_FRIDGE_NOTES = 30;

// How long a note stays up (the database only takes these).
export const lastsChoices = [
  { days: 1, label: "A day" },
  { days: 3, label: "3 days" },
  { days: 7, label: "A week" },
] as const;

// Paper to write on: sticky-note colors and a plain white sheet.
export const papers = [
  { key: "lemon", label: "Lemon", color: "#fff1a6", line: "#e6d27a" },
  { key: "peach", label: "Peach", color: "#ffd8be", line: "#eebc9b" },
  { key: "rose", label: "Rose", color: "#ffd0dc", line: "#efb1c1" },
  { key: "mint", label: "Mint", color: "#cdf1d9", line: "#a9dcba" },
  { key: "sky", label: "Sky", color: "#cfe6ff", line: "#a9cbf0" },
  { key: "plain", label: "Plain", color: "#fdfbf6", line: "#e4ddd0" },
] as const;

export function paperOf(key: string) {
  return papers.find((p) => p.key === key) ?? papers[0];
}

// Magnets: picked for each note from its id, so everyone sees the same one.
export const magnets = ["#d94b3f", "#2f74c0", "#f2b630", "#3e9b5f", "#8a5cc2", "#ee7d2f"];

// Pens for doodling, like a cup of markers by the fridge.
export const pens = ["#2a2420", "#d94b3f", "#2f74c0", "#3e9b5f", "#f2a218", "#8a5cc2"];
export const penWidths = [
  { w: 8, label: "Fine" },
  { w: 16, label: "Marker" },
  { w: 30, label: "Crayon" },
];

// Big alphabet magnets for an empty fridge.
export const letterMagnets = [
  { letter: "H", color: "#d94b3f" },
  { letter: "I", color: "#2f74c0" },
  { letter: "!", color: "#3e9b5f" },
];

// --- Which fridge -------------------------------------------------------------------

// A Fridge door widget on the Home page is always the Home's fridge; on
// your own pages it's whichever you picked (your Home's, or a Burrow's).
export function fridgePlace(
  settings: { place: "home" | "burrow"; burrowId: string | null },
  where: { onHomePage: boolean; homeId: string | null }
): FridgePlace | null {
  if (!where.onHomePage && settings.place === "burrow" && settings.burrowId) return { kind: "burrow", id: settings.burrowId };
  return where.homeId ? { kind: "home", id: where.homeId } : null;
}

export function placeKey(place: FridgePlace) {
  return `${place.kind}:${place.id}`;
}

// `color` paints the big door to match the widget it was opened from.
export function fridgeRoute(place: FridgePlace, color?: string | null) {
  return `/fridge?${place.kind}=${place.id}${isFridgeColor(color) ? `&color=${encodeURIComponent(color)}` : ""}`;
}

export function isFridgeColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
}

// --- Looks ---------------------------------------------------------------------------

// A small, steady number from an id, so a note always hangs the same way.
export function hashOf(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(hash);
}

// Each note hangs a little crooked, between -6 and 6 degrees.
export function noteTilt(id: string) {
  return (hashOf(id) % 13) - 6;
}

export function noteMagnet(id: string) {
  return magnets[hashOf(`${id}m`) % magnets.length];
}

// Where notes go on a door `width` by `height`: a grid of roughly square
// spots, as big as they can be while still fitting every note, but never
// narrower than `minCell`. If there are still more notes than spots, the
// last spot says how many more there are.
export function fridgeGrid(width: number, height: number, count: number, minCell = 64) {
  const most = Math.max(1, Math.floor(width / minCell));
  const layout = (cols: number) => {
    const cellW = width / cols;
    const rows = Math.max(1, Math.floor(height / (cellW * 0.95)));
    return { cols, rows, cellW, cellH: height / rows };
  };
  let grid = layout(most);
  for (let cols = 1; cols <= most; cols++) {
    const tried = layout(cols);
    if (tried.cols * tried.rows >= count) {
      grid = tried;
      break;
    }
  }
  const spots = grid.cols * grid.rows;
  const shown = Math.max(0, count > spots ? spots - 1 : count);
  return { ...grid, shown, extra: count - shown };
}

// --- Words --------------------------------------------------------------------------

export function postedWords(createdAt: string, now = new Date()) {
  const minutes = Math.max(0, Math.round((now.getTime() - new Date(createdAt).getTime()) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

// "Comes down in 40 min", "in 5 hours", "tomorrow", "in 3 days".
export function comesDownWords(expiresAt: string, now = new Date()) {
  const minutes = Math.max(0, Math.round((new Date(expiresAt).getTime() - now.getTime()) / 60000));
  if (minutes < 60) return `Comes down in ${Math.max(1, minutes)} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Comes down in ${hours} hour${hours === 1 ? "" : "s"}`;
  const days = Math.round(hours / 24);
  return days === 1 ? "Comes down tomorrow" : `Comes down in ${days} days`;
}

export function stillUp(note: Pick<FridgeNote, "expires_at">, now = new Date()) {
  return new Date(note.expires_at).getTime() > now.getTime();
}

// --- News for the page tabs -----------------------------------------------------------

type FridgeNotice = { data: { home_id?: string; burrow_id?: string; expires_at?: string } };

// Which fridges have a note you haven't seen yet, as placeKey()s, from
// your unread fridge notices. A notice whose note has come down doesn't count.
export function fridgesWithNews(notices: FridgeNotice[], now = new Date()) {
  const keys = new Set<string>();
  for (const { data } of notices) {
    if (data.expires_at && new Date(data.expires_at).getTime() <= now.getTime()) continue;
    if (data.home_id) keys.add(placeKey({ kind: "home", id: data.home_id }));
    else if (data.burrow_id) keys.add(placeKey({ kind: "burrow", id: data.burrow_id }));
  }
  return keys;
}

// --- Doodles -------------------------------------------------------------------------

export const DOODLE_SIZE = 1000;
export const MAX_STROKES = 60;
export const MAX_POINTS = 2400;

// A finger at (x, y) on a canvas `size` wide, as a point on the 0–1000
// square, kept on the canvas.
export function toDoodlePoint(x: number, y: number, size: number): [number, number] {
  const scale = DOODLE_SIZE / Math.max(1, size);
  const clamp = (n: number) => Math.round(Math.min(DOODLE_SIZE, Math.max(0, n * scale)));
  return [clamp(x), clamp(y)];
}

// Adds a point unless it's right on top of the last one (a finger resting
// would otherwise pile up hundreds), and only while there's room.
export function addPoint(stroke: Stroke, point: [number, number], total: number, minGap = 6): Stroke {
  const n = stroke.p.length;
  if (total >= MAX_POINTS) return stroke;
  if (n >= 2 && Math.hypot(point[0] - stroke.p[n - 2], point[1] - stroke.p[n - 1]) < minGap) return stroke;
  return { ...stroke, p: [...stroke.p, point[0], point[1]] };
}

export function pointCount(strokes: Stroke[]) {
  return strokes.reduce((sum, s) => sum + s.p.length / 2, 0);
}

// An SVG path for a stroke drawn `size` wide: smooth curves through the
// midpoints, and a dot for a single tap.
export function strokePath(points: number[], size: number) {
  const k = size / DOODLE_SIZE;
  const at = (i: number) => `${round(points[i] * k)} ${round(points[i + 1] * k)}`;
  if (points.length < 2) return "";
  if (points.length <= 4) {
    const end = points.length === 4 ? at(2) : `${round(points[0] * k + 0.1)} ${round(points[1] * k)}`;
    return `M${at(0)} L${end}`;
  }
  let d = `M${at(0)}`;
  for (let i = 2; i < points.length - 2; i += 2) {
    const mx = ((points[i] + points[i + 2]) / 2) * k;
    const my = ((points[i + 1] + points[i + 3]) / 2) * k;
    d += ` Q${at(i)} ${round(mx)} ${round(my)}`;
  }
  return `${d} L${at(points.length - 2)}`;
}

const round = (n: number) => Math.round(n * 10) / 10;

// Only well-formed strokes are kept, so a doodle from a newer app (or a
// broken one) never crashes the drawing.
export function cleanDoodle(value: unknown): Stroke[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (s): s is Stroke =>
      !!s && typeof s.c === "string" && typeof s.w === "number" && Array.isArray(s.p) && s.p.length >= 2 && s.p.every((n: unknown) => typeof n === "number")
  );
}
