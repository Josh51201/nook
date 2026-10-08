import type { GridRect, HearthItem } from "./hearth-layout";
import type { CareEntry, Meal } from "./pets";

// The Hearth pet (CORE-048): a little critter that lives in a bed widget on
// your Hearth and hops out now and then to sit on your other widgets and
// Nooks, then comes home to nap. It can be one of your pets from Pet Care
// (with their name and photo) or one you make up. Pure helpers only (no
// React), so they're unit-testable; the drawings are in
// components/hearth/pet-art.tsx and the wandering in pet-roamer.tsx.

export type CritterKind = "dog" | "cat" | "rabbit" | "bird" | "fish" | "turtle" | "hamster";

export const critters: { key: CritterKind; label: string; fur: string }[] = [
  { key: "cat", label: "Cat", fur: "#e8b98a" },
  { key: "dog", label: "Dog", fur: "#c99a6b" },
  { key: "rabbit", label: "Bunny", fur: "#e9e1d6" },
  { key: "bird", label: "Bird", fur: "#8fc3e0" },
  { key: "fish", label: "Fish", fur: "#f29a54" },
  { key: "turtle", label: "Turtle", fur: "#8fbf7a" },
  { key: "hamster", label: "Hamster", fur: "#e6b47c" },
];

export function critterInfo(key: string) {
  return critters.find((c) => c.key === key) ?? critters[0];
}

// The closest drawing for a Pet Care species (PET-006).
export function critterForSpecies(species: string): CritterKind {
  switch (species) {
    case "dog":
      return "dog";
    case "bird":
      return "bird";
    case "fish":
      return "fish";
    case "rabbit":
      return "rabbit";
    case "reptile":
      return "turtle";
    case "small":
      return "hamster";
    default:
      return "cat";
  }
}

export type BedStyle = "cushion" | "basket" | "house";

export const bedStyles: { key: BedStyle; label: string }[] = [
  { key: "cushion", label: "Cushion" },
  { key: "basket", label: "Basket" },
  { key: "house", label: "Little house" },
];

// --- Sizes and where things sit -------------------------------------------------------

export type PetSize = { w: number; h: number };

// On the Hearth the pet is the same size everywhere (in its bed and out
// visiting), worked out from the grid's cell size.
export function petSizeForStride(stride: number): PetSize {
  const w = Math.round(Math.max(40, Math.min(64, stride * 0.62)));
  return { w, h: Math.round(w * 0.8) };
}

// Away from the Hearth (a preview, the widget's own page) the pet just fits
// its widget.
export function petSizeForBox(width: number, height: number): PetSize {
  const w = Math.round(Math.max(36, Math.min(130, Math.min(width * 0.5, height * 0.62))));
  return { w, h: Math.round(w * 0.8) };
}

type Box = { x: number; y: number; w: number; h: number };

// Inside a pet's widget: the bed, the food bowl beside it, where the pet
// sits in the bed, and room for its name (to the side on a wide widget,
// above on a tall one, none on a tiny one). All in pixels from the
// widget's top-left.
export function bedLayout(width: number, height: number, pet: PetSize) {
  const pad = Math.max(6, Math.min(14, width * 0.06));
  const bedW = Math.min(width - pad * 2, pet.w * 1.5);
  const bedH = bedW * 0.86;
  const sideText = width - bedW - pad * 3 >= 96 && height < bedH + 70;
  const bedX = sideText ? pad : (width - bedW) / 2;
  const bedY = height - bedH - pad * 0.6;
  const bed: Box = { x: bedX, y: bedY, w: bedW, h: bedH };
  // The pet sits on the bed's floor, a little up from its bottom edge.
  const petBox: Box = { x: bedX + (bedW - pet.w) / 2, y: bedY + bedH * 0.86 - pet.h, w: pet.w, h: pet.h };
  const bowlW = Math.max(16, pet.w * 0.38);
  const bowlRoom = sideText ? width - (bedX + bedW) - pad : width - (bedX + bedW) - pad / 2;
  const bowl: Box | null =
    bowlRoom >= bowlW ? { x: bedX + bedW + Math.min(pad, bowlRoom - bowlW), y: height - pad * 0.6 - bowlW * 0.5, w: bowlW, h: bowlW * 0.5 } : null;
  const text: Box | null = sideText
    ? { x: bedX + bedW + pad, y: pad, w: width - bedX - bedW - pad * 2, h: height - pad * 2 }
    : height - bedH - pad >= 40
      ? { x: pad, y: pad, w: width - pad * 2, h: Math.min(44, bedY - pad) }
      : null;
  return { bed, pet: petBox, bowl, text };
}

// --- Wandering --------------------------------------------------------------------------

export type Spot = { x: number; y: number; on: string | null };

const itemBox = (item: GridRect, stride: number, gap: number): Box => ({
  x: item.x * stride,
  y: item.y * stride,
  w: item.w * stride - gap,
  h: item.h * stride - gap,
});

// Where the pet sits when it's home, in grid pixels.
export function homeSpot(home: GridRect, stride: number, gap: number, pet: PetSize): Spot {
  const box = itemBox(home, stride, gap);
  const inBed = bedLayout(box.w, box.h, pet).pet;
  return { x: box.x + inBed.x, y: box.y + inBed.y, on: null };
}

// Things the pet can go and sit on top of: Nook tiles, widgets and Hollows
// that are showing, but not its own bed, text or Trinkets.
export function perchesFor(items: HearthItem[], homeId: string) {
  return items.filter((item) => item.id !== homeId && (item.kind === "nook" || item.kind === "widget" || item.kind === "hollow"));
}

// A spot sitting on the top edge of `item`, feet just over the edge. Arched
// Nook tiles are highest in the middle, so the pet sits there; elsewhere
// anywhere along the top, away from the rounded corners.
export function perchSpot(item: HearthItem, stride: number, gap: number, pet: PetSize, rand: () => number, gridWidth: number): Spot {
  const box = itemBox(item, stride, gap);
  const margin = Math.min(22, box.w * 0.18);
  const room = box.w - margin * 2 - pet.w;
  const along = item.kind === "nook" || room <= 0 ? (box.w - pet.w) / 2 : margin + rand() * room;
  const x = Math.max(0, Math.min(gridWidth - pet.w, box.x + along));
  return { x, y: box.y - pet.h + Math.round(pet.h * 0.08), on: item.id };
}

// Somewhere new to visit (never where it already is), or null if there's
// nothing else on the Hearth.
export function pickPerch(
  items: HearthItem[],
  homeId: string,
  stride: number,
  gap: number,
  pet: PetSize,
  gridWidth: number,
  rand: () => number,
  avoid: string | null
): Spot | null {
  // Not on the very top row: there's no room above it, so the pet would be
  // cut off at the top of the screen.
  const all = perchesFor(items, homeId).filter((item) => item.y * stride - pet.h >= -12);
  const choices = all.length > 1 ? all.filter((item) => item.id !== avoid) : all;
  if (!choices.length) return null;
  const item = choices[Math.min(choices.length - 1, Math.floor(rand() * choices.length))];
  return perchSpot(item, stride, gap, pet, rand, gridWidth);
}

// The trip from one spot to another as a few hops, none longer than
// `maxHop` pixels. Returns where each hop lands; the last is `to`.
export function hopPath(from: { x: number; y: number }, to: { x: number; y: number }, maxHop: number) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy);
  const count = Math.max(1, Math.ceil(distance / Math.max(1, maxHop)));
  return Array.from({ length: count }, (_, i) => ({ x: from.x + (dx * (i + 1)) / count, y: from.y + (dy * (i + 1)) / count }));
}

// Is the spot the pet is on still there, in the same place? If its widget
// moved or went away, the pet heads home.
export function perchStillThere(spot: Spot, items: HearthItem[], stride: number, gap: number, pet: PetSize) {
  if (!spot.on) return true;
  const item = items.find((i) => i.id === spot.on);
  if (!item) return false;
  const box = itemBox(item, stride, gap);
  return Math.abs(box.y - pet.h + Math.round(pet.h * 0.08) - spot.y) < 1 && spot.x >= box.x - pet.w && spot.x <= box.x + box.w;
}

// The pet stays tucked in bed through the night.
export function isNight(date = new Date()) {
  const hour = date.getHours();
  return hour >= 22 || hour < 6;
}

// --- Mood from Pet Care (PET-003) ----------------------------------------------------------

// The first meal that hasn't been fed today and whose "nudge me by" time has
// passed. Meals with no time set never make the pet hungry.
export function hungryMeal(meals: Meal[], log: Pick<CareEntry, "kind" | "meal_id" | "day">[], day: string, nowTime: string): string | null {
  const fed = new Set(log.filter((entry) => entry.kind === "meal" && entry.day === day).map((entry) => entry.meal_id));
  const due = [...meals]
    .sort((a, b) => a.position - b.position)
    .find((meal) => !fed.has(meal.id) && meal.remind_at && meal.remind_at.slice(0, 5) <= nowTime.slice(0, 5));
  return due ? due.label : null;
}

export type PetMood = "happy" | "hungry" | "sleepy";

const happyLines: Record<CritterKind, string[]> = {
  cat: ["{name} is purring", "{name} wants a chin scratch", "{name} found a sunny spot"],
  dog: ["{name} wags hello", "{name} wants to play fetch", "{name} is so glad you're here"],
  rabbit: ["{name} does a happy hop", "{name} wiggles a nose at you", "{name} would love a carrot"],
  bird: ["{name} chirps hello", "{name} sings you a little song", "{name} fluffs up happily"],
  fish: ["{name} blows a bubble at you", "{name} does a little loop", "{name} says blub"],
  turtle: ["{name} is taking it slow today", "{name} pokes out to say hi", "{name} is cozy in that shell"],
  hamster: ["{name} stuffs both cheeks", "{name} is ready for a run", "{name} twitches a whisker at you"],
};

// What the pet "says" when you tap it.
export function petSays(name: string, critter: CritterKind, mood: PetMood, rand: () => number, meal?: string | null) {
  const who = name.trim() || "Your pet";
  if (mood === "hungry") return `${who} is waiting for ${meal ? meal.toLowerCase() : "a meal"}`;
  if (mood === "sleepy") return `Shh, ${name.trim() || "your pet"} is fast asleep`;
  const lines = happyLines[critter] ?? happyLines.cat;
  return lines[Math.min(lines.length - 1, Math.floor(rand() * lines.length))].replace("{name}", who);
}
