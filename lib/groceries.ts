import type { IconName } from "../components/icon";
import { addDays } from "./menu-board";
import { localDay } from "./pets";
import { formatAmount, parseNumber } from "./recipes";

// Grocery List Nook (GROC-001..009): several lists, each just yours or
// shared with your Home; items sorted into aisles; added by hand, from a
// recipe, from the Menu Board, or from a Potluck (waiting until the week
// of). Pure (no React/Supabase), so it's unit-testable; loading and saving
// is in groceries-data.ts.

export type Aisle = "produce" | "bakery" | "meat" | "dairy" | "frozen" | "pantry" | "snacks" | "drinks" | "household" | "personal" | "other";

export type GroceryList = {
  id: string;
  owner_id: string;
  name: string;
  shared: boolean;
  created_at: string;
};

export type GroceryItem = {
  id: string;
  list_id: string;
  name: string;
  amount: string | null;
  aisle: Aisle;
  source: string | null;
  potluck_id: string | null;
  show_from: string | null;
  checked: boolean;
  added_by: string | null;
  created_at: string;
};

// In the order you'd walk a store (GROC-003).
export const aisles: { key: Aisle; label: string; icon: IconName }[] = [
  { key: "produce", label: "Produce", icon: "leaf" },
  { key: "bakery", label: "Bakery", icon: "cookie" },
  { key: "meat", label: "Meat & fish", icon: "flame" },
  { key: "dairy", label: "Dairy & eggs", icon: "drop" },
  { key: "frozen", label: "Frozen", icon: "cloud" },
  { key: "pantry", label: "Pantry", icon: "food" },
  { key: "snacks", label: "Snacks", icon: "star" },
  { key: "drinks", label: "Drinks", icon: "coffee" },
  { key: "household", label: "Household", icon: "door" },
  { key: "personal", label: "Personal care", icon: "heart" },
  { key: "other", label: "Other", icon: "cart" },
];

export function aisleLabel(key: string) {
  return aisles.find((a) => a.key === key)?.label ?? "Other";
}

export const MAX_LISTS = 20;
export const LIST_NAME_LENGTH = 40;
export const ITEM_NAME_LENGTH = 80;

// Common groceries by aisle: they guess an item's aisle and are offered as
// you type. Written singular; plurals and longer names still match
// ("2 red onions" is Produce).
const aisleWords: Record<Exclude<Aisle, "other">, string[]> = {
  produce: [
    "apple", "banana", "orange", "lemon", "lime", "grape", "strawberry", "blueberry", "raspberry", "berries", "avocado",
    "tomato", "potato", "sweet potato", "onion", "garlic", "ginger", "carrot", "celery", "lettuce", "spinach", "kale",
    "cucumber", "zucchini", "broccoli", "cauliflower", "bell pepper", "jalapeño", "jalapeno", "mushroom", "corn", "green bean",
    "cabbage", "cilantro", "parsley", "basil", "mint", "green onion", "scallion", "peach", "pear", "watermelon", "cantaloupe",
    "pineapple", "mango", "salad", "squash", "asparagus", "peas", "fruit", "herbs",
  ],
  bakery: ["bread", "bun", "roll", "bagel", "tortilla", "pita", "croissant", "muffin", "english muffin", "baguette", "naan", "cake", "pie crust", "donut"],
  meat: [
    "chicken", "beef", "ground beef", "steak", "pork", "pork chop", "bacon", "sausage", "ham", "turkey", "ground turkey",
    "salmon", "tuna steak", "shrimp", "fish", "tilapia", "cod", "lamb", "hot dog", "deli meat", "pepperoni", "meatball", "ribs", "roast",
  ],
  dairy: [
    "milk", "egg", "butter", "cheese", "cheddar", "mozzarella", "parmesan", "cream cheese", "sour cream", "yogurt", "cream",
    "heavy cream", "half and half", "cottage cheese", "whipped cream", "creamer",
  ],
  frozen: ["ice cream", "frozen pizza", "frozen vegetables", "frozen fruit", "frozen", "waffle", "popsicle", "tater tot", "fries", "ice"],
  pantry: [
    "flour", "sugar", "brown sugar", "salt", "pepper", "black pepper", "rice", "pasta", "spaghetti", "noodle", "macaroni", "cereal",
    "oatmeal", "oats", "peanut butter", "jelly", "jam", "honey", "syrup", "maple syrup", "olive oil", "vegetable oil", "oil",
    "vinegar", "soy sauce", "ketchup", "mustard", "mayo", "mayonnaise", "salsa", "hot sauce", "barbecue sauce", "bbq sauce",
    "pasta sauce", "tomato sauce", "tomato paste", "diced tomatoes", "broth", "stock", "soup", "beans", "black beans", "chickpeas",
    "canned", "tuna", "baking soda", "baking powder", "yeast", "vanilla", "cinnamon", "spice", "seasoning", "taco seasoning",
    "chili powder", "paprika", "cumin", "oregano", "garlic powder", "onion powder", "chocolate chips", "cornstarch", "breadcrumbs",
    "coconut milk", "lentils", "quinoa", "stuffing", "gravy", "ranch",
  ],
  snacks: ["chips", "crackers", "cookies", "pretzels", "popcorn", "granola bar", "nuts", "almonds", "trail mix", "candy", "chocolate", "fruit snacks", "goldfish", "dip"],
  drinks: ["water", "sparkling water", "soda", "juice", "orange juice", "apple juice", "coffee", "tea", "beer", "wine", "lemonade", "sports drink", "kombucha"],
  household: [
    "paper towels", "toilet paper", "napkins", "trash bags", "dish soap", "dishwasher pods", "laundry detergent", "dryer sheets",
    "sponges", "aluminum foil", "foil", "plastic wrap", "zip bags", "ziploc", "batteries", "light bulb", "cleaner", "bleach",
    "paper plates", "plates", "cups", "forks", "tissues", "lightbulbs",
  ],
  personal: [
    "shampoo", "conditioner", "soap", "body wash", "toothpaste", "toothbrush", "floss", "deodorant", "lotion", "sunscreen",
    "razor", "diapers", "wipes", "baby wipes", "vitamins", "medicine", "bandaids", "band-aids", "cotton balls",
  ],
};

const normal = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// Ends of words that make a plural: "tomatoes", "berries", "eggs".
const singular = (word: string) =>
  word.endsWith("ies") && word.length > 4 ? `${word.slice(0, -3)}y` : word.endsWith("oes") ? word.slice(0, -2) : word.endsWith("s") && !word.endsWith("ss") ? word.slice(0, -1) : word;

const singularPhrase = (text: string) => normal(text).split(" ").map(singular).join(" ");

const known: { phrase: string; aisle: Aisle }[] = Object.entries(aisleWords)
  .flatMap(([aisle, words]) => words.map((w) => ({ phrase: singularPhrase(w), aisle: aisle as Aisle })))
  // Longest first, so "sweet potato" beats "potato" and "ice cream" beats "cream".
  .sort((a, b) => b.phrase.length - a.phrase.length);

// The aisle an item's in, from the words in its name. "Other" when nothing
// fits; it can always be changed.
export function guessAisle(name: string): Aisle {
  const words = ` ${singularPhrase(name)} `;
  for (const { phrase, aisle } of known) if (words.includes(` ${phrase} `)) return aisle;
  return "other";
}

// Common groceries, nicely written, for suggestions as you type.
const suggestionWords = [...new Set(Object.values(aisleWords).flat())]
  .filter((w) => !["frozen", "canned", "oil", "spice", "ice", "cups", "plates", "forks", "stock"].includes(w))
  .map((w) => w[0].toUpperCase() + w.slice(1));

// Up to `max` things that start with (or then contain) what's typed, not
// already on the list.
export function suggestGroceries(query: string, onList: string[] = [], max = 6) {
  const q = normal(query);
  if (q.length < 2) return [];
  const taken = new Set(onList.map(itemKey));
  const fresh = suggestionWords.filter((w) => !taken.has(itemKey(w)));
  const starts = fresh.filter((w) => normal(w).startsWith(q));
  const contains = fresh.filter((w) => !normal(w).startsWith(q) && normal(w).includes(q));
  return [...starts, ...contains].slice(0, max);
}

// --- Reading an ingredient line (GROC-005) ---------------------------------------

const fractions = "½¼¾⅓⅔⅛⅜⅝⅞⅕⅙";
const NUM = `(?:\\d+(?:[.,]\\d+)?(?:\\s*[${fractions}]|\\s+\\d+\\/\\d+)?|\\d+\\/\\d+|[${fractions}])`;
const UNITS = [
  "cups?", "c\\.?", "tablespoons?", "tbsps?\\.?", "tbs\\.?", "teaspoons?", "tsps?\\.?", "ounces?", "oz\\.?", "fl\\.? oz\\.?", "pounds?",
  "lbs?\\.?", "grams?", "g", "kilograms?", "kg", "millilit(?:er|re)s?", "ml", "lit(?:er|re)s?", "l", "pinch(?:es)?", "dash(?:es)?",
  "cloves?", "cans?", "packages?", "pkgs?\\.?", "packets?", "sticks?", "slices?", "bunch(?:es)?", "heads?", "jars?", "bottles?",
  "bags?", "box(?:es)?", "dozen", "quarts?", "qts?\\.?", "pints?", "pts?\\.?", "gallons?", "gals?\\.?", "sprigs?", "handfuls?", "pieces?",
  "containers?", "cartons?", "loaf", "loaves", "large", "medium", "small", "whole",
].join("|");
const LINE = new RegExp(
  `^\\s*(${NUM}(?:\\s*(?:-|–|to)\\s*${NUM})?)\\s*(\\([^)]*\\)\\s*)?((?:(?:${UNITS})\\s+)*)(?:of\\s+)?(.*)$`,
  "i"
);

// "2 cups all-purpose flour" → { amount: "2 cups", name: "All-purpose flour" }.
// "1 onion, diced" → { amount: "1", name: "Onion" }. "Salt and pepper to
// taste" → { amount: null, name: "Salt and pepper" }.
export function splitIngredient(line: string): { name: string; amount: string | null } {
  let text = line.replace(/\s+/g, " ").trim();
  let amount: string | null = null;
  const match = LINE.exec(text);
  if (match && match[4].trim()) {
    amount = [match[1], match[2]?.trim(), match[3].trim()].filter(Boolean).join(" ").trim() || null;
    text = match[4];
  }
  // How it's cut or used isn't something you buy: "onion, diced",
  // "butter (softened)", "salt to taste", "cilantro, for garnish".
  text = text
    .replace(/\([^)]*\)/g, " ")
    .replace(/,.*$/, "")
    .replace(/\b(?:to taste|as needed|for garnish|for serving|optional|divided)\b.*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  const name = text ? text[0].toUpperCase() + text.slice(1) : line.trim();
  return { name: name.slice(0, ITEM_NAME_LENGTH), amount: amount ? amount.slice(0, 60) : null };
}

// What makes two items "the same thing" on a list: case, plurals and
// punctuation don't count ("Eggs" and "egg").
export function itemKey(name: string) {
  return singularPhrase(name);
}

// Units that take an "s" when there's more than one ("2 cups", but "2 lb").
const countable = new Set([
  "cup", "can", "clove", "package", "packet", "jar", "bottle", "bag", "slice", "stick", "pound", "ounce", "head", "quart",
  "pint", "gallon", "carton", "container", "piece", "sprig", "tablespoon", "teaspoon", "gram", "liter", "litre",
]);

// Two amounts of the same thing, added together where they can be
// ("2 cups" + "1 cup" → "3 cups"; "2" + "3" → "5"), else written side by
// side ("1 lb + 2 cups").
export function mergeAmount(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  const split = (s: string) => {
    const m = new RegExp(`^\\s*(${NUM})\\s*(.*)$`).exec(s);
    const value = m ? parseNumber(m[1]) : null;
    return value === null ? null : { value, unit: m![2].trim().toLowerCase() };
  };
  const x = split(a);
  const y = split(b);
  if (x && y && singular(x.unit) === singular(y.unit)) {
    const total = x.value + y.value;
    const unit = total > 1 && countable.has(x.unit) ? `${x.unit}s` : x.unit;
    return `${formatAmount(total)}${unit ? ` ${unit}` : ""}`.slice(0, 60);
  }
  return `${a} + ${b}`.slice(0, 60);
}

// "Tacos" + "Chili" → "Tacos, Chili", without repeats.
export function mergeSource(a: string | null, b: string | null): string | null {
  const parts = [...(a ? a.split(", ") : []), ...(b ? b.split(", ") : [])].filter(Boolean);
  const unique = parts.filter((p, i) => parts.findIndex((q) => q.toLowerCase() === p.toLowerCase()) === i);
  return unique.length ? unique.join(", ").slice(0, 80) : null;
}

// --- Potluck shopping waits until the week of (GROC-006) -------------------------

export const POTLUCK_LEAD_DAYS = 7;

// The day Potluck shopping joins the list: a week before. Null when that's
// today or already past, so it goes straight on.
export function potluckShowFrom(potluckDay: string, today = localDay()): string | null {
  const from = addDays(potluckDay, -POTLUCK_LEAD_DAYS);
  return from > today ? from : null;
}

// Is it the week of the Potluck (or the day itself)?
export function isPotluckWeek(potluckDay: string, today = localDay()) {
  return today <= potluckDay && addDays(potluckDay, -POTLUCK_LEAD_DAYS) <= today;
}

export function isWaiting(item: Pick<GroceryItem, "show_from">, today = localDay()) {
  return !!item.show_from && item.show_from > today;
}

// --- The list ----------------------------------------------------------------------

export type ListParts<T> = {
  // Still to get, grouped by aisle in store order.
  toGet: { aisle: Aisle; items: T[] }[];
  inCart: T[];
  comingUp: T[];
};

export function listParts<T extends Pick<GroceryItem, "aisle" | "checked" | "show_from" | "created_at">>(items: T[], today = localDay()): ListParts<T> {
  const byAge = [...items].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const now = byAge.filter((i) => !isWaiting(i, today));
  const open = now.filter((i) => !i.checked);
  return {
    toGet: aisles.map((a) => ({ aisle: a.key, items: open.filter((i) => (aisles.some((x) => x.key === i.aisle) ? i.aisle : "other") === a.key) })).filter((g) => g.items.length),
    inCart: now.filter((i) => i.checked),
    comingUp: byAge.filter((i) => isWaiting(i, today)).sort((a, b) => (a.show_from ?? "").localeCompare(b.show_from ?? "")),
  };
}

export function listCounts(items: Pick<GroceryItem, "checked" | "show_from">[], today = localDay()) {
  let left = 0;
  let inCart = 0;
  let waiting = 0;
  for (const item of items) {
    if (isWaiting(item, today)) waiting++;
    else if (item.checked) inCart++;
    else left++;
  }
  return { left, inCart, waiting };
}

// "3 to get · 2 in the cart"
export function countWords(counts: ReturnType<typeof listCounts>) {
  const parts = [counts.left ? `${counts.left} to get` : "Nothing to get", counts.inCart ? `${counts.inCart} in the cart` : null, counts.waiting ? `${counts.waiting} coming up` : null];
  return parts.filter(Boolean).join(" · ");
}

// "2 cups · for Tacos"
export function itemDetail(item: Pick<GroceryItem, "amount" | "source">) {
  return [item.amount, item.source ? `for ${item.source}` : null].filter(Boolean).join(" · ");
}

// What someone typed in the add box: "2 lb chicken" → amount and name.
export function parseTyped(text: string) {
  const { name, amount } = splitIngredient(text);
  return { name, amount, aisle: guessAisle(name) };
}

// Your own lists first (oldest first, so the first one stays first), then
// ones shared with you.
export function sortLists<T extends Pick<GroceryList, "owner_id" | "created_at">>(lists: T[], userId: string | undefined) {
  return [...lists].sort((a, b) => Number(b.owner_id === userId) - Number(a.owner_id === userId) || a.created_at.localeCompare(b.created_at));
}
