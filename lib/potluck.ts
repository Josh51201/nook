// Potluck Nook (POT-001..008) logic: allergies and diets (PROF-004), what a
// dish is tagged with (POT-004), clash warnings (POT-005) and headcounts
// (POT-006). Pure (no React/Supabase), so it's unit-testable.
//
// Dish tags are what's *in* a dish. Each diet lists the tags it can't have,
// so a clash is always something the cook said is in it — Nook never
// guesses that an untagged dish is safe or unsafe.

export const allergens = [
  { key: "peanuts", label: "Peanuts", allergy: "a peanut allergy" },
  { key: "tree_nuts", label: "Tree nuts", allergy: "a tree nut allergy" },
  { key: "dairy", label: "Dairy", allergy: "a dairy allergy" },
  { key: "eggs", label: "Eggs", allergy: "an egg allergy" },
  { key: "gluten", label: "Gluten", allergy: "a gluten allergy" },
  { key: "shellfish", label: "Shellfish", allergy: "a shellfish allergy" },
  { key: "fish", label: "Fish", allergy: "a fish allergy" },
  { key: "soy", label: "Soy", allergy: "a soy allergy" },
  { key: "sesame", label: "Sesame", allergy: "a sesame allergy" },
] as const;

// Other things worth saying a dish contains, for diets.
export const otherContents = [
  { key: "meat", label: "Meat" },
  { key: "pork", label: "Pork" },
  { key: "alcohol", label: "Alcohol" },
] as const;

export const diets = [
  { key: "vegetarian", label: "Vegetarian", avoids: ["meat", "pork", "fish", "shellfish"] },
  { key: "vegan", label: "Vegan", avoids: ["meat", "pork", "fish", "shellfish", "dairy", "eggs"] },
  { key: "gluten_free", label: "Gluten-free", avoids: ["gluten"] },
  { key: "dairy_free", label: "Dairy-free", avoids: ["dairy"] },
  { key: "halal", label: "Halal", avoids: ["pork", "alcohol"] },
  { key: "kosher", label: "Kosher", avoids: ["pork", "shellfish"] },
] as const;

export const dishTags = [...allergens, ...otherContents];

export function tagLabel(key: string) {
  return dishTags.find((tag) => tag.key === key)?.label ?? key;
}

export function dietLabel(key: string) {
  return diets.find((diet) => diet.key === key)?.label ?? key;
}

export type Needs = { allergies: string[]; diets: string[] };
export type Person = { id: string; name: string } & Needs;

// Why a dish is a problem for one person, in plain words — "Mia has a
// peanut allergy", "Sam is vegetarian (it has meat)". Empty if it's fine.
export function clashesFor(tags: string[], person: Person): string[] {
  const has = new Set(tags);
  const reasons: string[] = [];
  for (const allergen of allergens) {
    if (has.has(allergen.key) && person.allergies.includes(allergen.key)) {
      reasons.push(`${person.name} has ${allergen.allergy}`);
    }
  }
  for (const diet of diets) {
    if (!person.diets.includes(diet.key)) continue;
    const hits = diet.avoids.filter((tag) => has.has(tag));
    // Already warned about as an allergy? Don't say it twice.
    const fresh = hits.filter((tag) => !person.allergies.includes(tag));
    if (fresh.length) {
      reasons.push(`${person.name} eats ${diet.label.toLowerCase()} (it has ${fresh.map((t) => tagLabel(t).toLowerCase()).join(", ")})`);
    }
  }
  return reasons;
}

// Everyone a dish is a problem for (POT-005), among the people coming.
export function dishWarnings(tags: string[], coming: Person[]): string[] {
  return coming.flatMap((person) => clashesFor(tags, person));
}

export type RsvpStatus = "going" | "maybe" | "no";
export type Rsvp = { profile_id: string; status: RsvpStatus; extra_guests: number };

// Who counts as coming for warnings: Going or Maybe (POT-006, proposed —
// better a warning too many than one too few).
export function isComing(status: RsvpStatus | undefined) {
  return status === "going" || status === "maybe";
}

// How many mouths to feed (POT-006): people going plus their guests, and
// separately the maybes (with theirs).
export function headcount(rsvps: Rsvp[]) {
  let going = 0;
  let maybe = 0;
  for (const rsvp of rsvps) {
    const people = 1 + Math.max(0, rsvp.extra_guests);
    if (rsvp.status === "going") going += people;
    else if (rsvp.status === "maybe") maybe += people;
  }
  return { going, maybe };
}

export type Slot = { id: string; label: string; wanted: number };

// How full a slot is (POT-003).
export function slotRoom(slot: Slot, dishes: { slot_id: string | null }[]) {
  const taken = dishes.filter((dish) => dish.slot_id === slot.id).length;
  return { taken, open: Math.max(0, slot.wanted - taken), full: taken >= slot.wanted };
}

// Quick picks when a host lists what's needed.
export const slotIdeas = ["Main dish", "Side", "Salad", "Dessert", "Bread", "Drinks", "Appetizer", "Plates & cups"];
