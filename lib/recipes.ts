// Recipe Box Nook (REC-001..012) logic: scaling amounts (REC-005), timers in
// steps (REC-004), reading a recipe off a website (REC-008), search and
// Shelves (REC-006) and the recipe of the day (REC-011). Pure (no
// React/Supabase), so it's unit-testable.

import { parsePreview } from "./link-preview";

export type Recipe = {
  id: string;
  owner_id: string;
  title: string;
  servings: number | null;
  prep_minutes: number | null;
  cook_minutes: number | null;
  ingredients: string[];
  steps: string[];
  notes: string | null;
  source_url: string | null;
  image_url: string | null;
  tags: string[];
  shelves: string[];
  private: boolean;
  from_name: string | null;
  from_recipe_id: string | null;
  made_count: number;
  last_made_at: string | null;
  created_at: string;
};

export const RECIPE_FIELDS =
  "id, owner_id, title, servings, prep_minutes, cook_minutes, ingredients, steps, notes, source_url, image_url, tags, shelves, private, from_name, from_recipe_id, made_count, last_made_at, created_at";

// Quick picks when putting a recipe on a Shelf (proposed).
export const shelfIdeas = ["Dinners", "Breakfast", "Sides", "Soups", "Baking", "Desserts", "Holidays", "Quick"];

export const MAX_SHELVES = 10;
export const SHELF_LENGTH = 24;

// --- Amounts and scaling (REC-005) ----------------------------------------------

const unicodeFractions: Record<string, number> = {
  "¼": 1 / 4, "½": 1 / 2, "¾": 3 / 4, "⅓": 1 / 3, "⅔": 2 / 3,
  "⅛": 1 / 8, "⅜": 3 / 8, "⅝": 5 / 8, "⅞": 7 / 8, "⅕": 1 / 5, "⅙": 1 / 6,
};
const fractionChars = Object.keys(unicodeFractions).join("");

// One number as written: "2", "1.5", "1/2", "1 1/2", "½", "1½", "1 ½".
const NUMBER = `(?:\\d+(?:[.,]\\d+)?(?:\\s*[${fractionChars}]|\\s+\\d+\\/\\d+)?|\\d+\\/\\d+|[${fractionChars}])`;
// A leading amount, optionally a range: "2-3", "1 to 2".
const LEADING = new RegExp(`^\\s*(${NUMBER})(?:\\s*(?:-|–|to)\\s*(${NUMBER}))?(?=\\s|$|[a-zA-Z])`);

export function parseNumber(text: string): number | null {
  const t = text.trim();
  let total = 0;
  let rest = t;
  const uni = new RegExp(`[${fractionChars}]$`).exec(rest);
  if (uni) {
    total += unicodeFractions[uni[0]];
    rest = rest.slice(0, -1).trim();
    if (!rest) return total;
  }
  const mixed = /^(\d+)\s+(\d+)\/(\d+)$/.exec(rest);
  if (mixed) {
    const den = Number(mixed[3]);
    return den ? total + Number(mixed[1]) + Number(mixed[2]) / den : null;
  }
  const frac = /^(\d+)\/(\d+)$/.exec(rest);
  if (frac) {
    const den = Number(frac[2]);
    return den ? total + Number(frac[1]) / den : null;
  }
  if (/^\d+(?:[.,]\d+)?$/.test(rest)) return total + Number(rest.replace(",", "."));
  return null;
}

const niceFractions: [number, string][] = [
  [1 / 8, "1/8"], [1 / 4, "1/4"], [1 / 3, "1/3"], [3 / 8, "3/8"], [1 / 2, "1/2"],
  [5 / 8, "5/8"], [2 / 3, "2/3"], [3 / 4, "3/4"], [7 / 8, "7/8"],
];

// How a cook would write it: 1 1/2, 3/4, 2, 0.1 for tiny amounts, 13 for big ones.
export function formatAmount(value: number): string {
  if (!isFinite(value) || value <= 0) return "0";
  if (value >= 10) return String(Math.round(value));
  const whole = Math.floor(value);
  const part = value - whole;
  if (part < 0.06) return String(whole || Math.round(value * 100) / 100);
  if (part > 0.94) return String(whole + 1);
  let best = niceFractions[0];
  for (const candidate of niceFractions) {
    if (Math.abs(candidate[0] - part) < Math.abs(best[0] - part)) best = candidate;
  }
  // Too far from any nice fraction (e.g. 0.07 of a cup): say it as a decimal.
  if (Math.abs(best[0] - part) > 0.04) return String(Math.round(value * 100) / 100);
  return whole ? `${whole} ${best[1]}` : best[1];
}

// "1 1/2 cups flour" × 2 → "3 cups flour". Lines without a leading amount
// ("salt to taste") are left as written.
export function scaleIngredient(line: string, factor: number): string {
  if (factor === 1) return line;
  const match = LEADING.exec(line);
  if (!match) return line;
  const first = parseNumber(match[1]);
  if (first === null) return line;
  const second = match[2] ? parseNumber(match[2]) : null;
  const amount = second !== null ? `${formatAmount(first * factor)}-${formatAmount(second * factor)}` : formatAmount(first * factor);
  return amount + line.slice(match[0].trimEnd().length);
}

export function scaleFactor(from: number | null, to: number) {
  return from && from > 0 && to > 0 ? to / from : 1;
}

// --- Timers in steps (REC-004) -----------------------------------------------------

export type StepTimer = { label: string; seconds: number };

const TIME = /(?<![\w.,/])(\d+(?:[.,]\d+)?(?:\s*[½¼¾])?|[½¼¾]|an?|one)(?:\s*(?:-|–|to)\s*(\d+(?:[.,]\d+)?))?\s*(hours?|hrs?|minutes?|mins?|seconds?|secs?)\b/gi;

// "Bake 25-30 minutes, then rest 1 hour" → 25 min (the shorter end, so you
// check early) and 1 hr.
export function findTimers(step: string): StepTimer[] {
  const timers: StepTimer[] = [];
  for (const match of step.matchAll(TIME)) {
    const raw = match[1].toLowerCase();
    const amount = raw === "a" || raw === "an" || raw === "one" ? 1 : parseNumber(raw.replace(/\s+/g, ""));
    if (!amount) continue;
    const unit = match[3].toLowerCase();
    const perUnit = unit.startsWith("h") ? 3600 : unit.startsWith("m") ? 60 : 1;
    const seconds = Math.round(amount * perUnit);
    if (seconds < 10 || seconds > 24 * 3600) continue;
    const label = match[0].trim();
    // "Cook 5 minutes, stir, cook 5 minutes more": one button does for both.
    if (timers.some((t) => t.label.toLowerCase() === label.toLowerCase())) continue;
    timers.push({ label, seconds });
  }
  return timers;
}

export function formatClock(seconds: number) {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

// "1 hr 15 min", "40 min".
export function formatMinutes(minutes: number | null | undefined) {
  if (!minutes) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} min`;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}

// --- Reading a recipe from a website (REC-008) --------------------------------------

export type ImportedRecipe = {
  title: string | null;
  servings: number | null;
  prep_minutes: number | null;
  cook_minutes: number | null;
  ingredients: string[];
  steps: string[];
  image_url: string | null;
};

// ISO 8601 durations, as recipe sites write them: "PT1H30M", "PT45M", "P0DT20M".
export function parseDuration(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = /^P(?:(\d+)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i.exec(value.trim());
  if (!match) return null;
  const minutes =
    Number(match[1] ?? 0) * 1440 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0) + Number(match[4] ?? 0) / 60;
  return minutes > 0 ? Math.round(minutes) : null;
}

function decode(text: string) {
  return text
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_m, code) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, " ")
    .trim();
}

function isRecipe(node: unknown): node is Record<string, unknown> {
  if (!node || typeof node !== "object") return false;
  const type = (node as Record<string, unknown>)["@type"];
  return type === "Recipe" || (Array.isArray(type) && type.includes("Recipe"));
}

// Recipes hide in JSON-LD as the whole thing, in an array, or in "@graph".
function findRecipeNode(data: unknown, depth = 0): Record<string, unknown> | null {
  if (depth > 4 || !data) return null;
  if (isRecipe(data)) return data;
  if (Array.isArray(data)) {
    for (const item of data) {
      const found = findRecipeNode(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (typeof data === "object") {
    const graph = (data as Record<string, unknown>)["@graph"];
    if (graph) return findRecipeNode(graph, depth + 1);
  }
  return null;
}

function stepsFrom(value: unknown, depth = 0): string[] {
  if (depth > 3 || value == null) return [];
  if (typeof value === "string") {
    // Some sites put every step in one string.
    return value
      .split(/\n+|(?<=\.)\s{2,}/)
      .map(decode)
      .filter(Boolean);
  }
  if (Array.isArray(value)) return value.flatMap((item) => stepsFrom(item, depth + 1));
  if (typeof value === "object") {
    const node = value as Record<string, unknown>;
    // HowToSection: its steps are in itemListElement.
    if (node.itemListElement) return stepsFrom(node.itemListElement, depth + 1);
    const text = node.text ?? node.name;
    return typeof text === "string" && decode(text) ? [decode(text)] : [];
  }
  return [];
}

function imageFrom(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return imageFrom(value[0]);
  if (typeof value === "object") {
    const url = (value as Record<string, unknown>).url;
    return typeof url === "string" ? url : null;
  }
  return null;
}

function servingsFrom(value: unknown): number | null {
  const first = Array.isArray(value) ? value[0] : value;
  if (typeof first === "number") return first > 0 && first <= 100 ? Math.round(first) : null;
  if (typeof first !== "string") return null;
  const match = /\d+/.exec(first);
  const n = match ? Number(match[0]) : 0;
  return n > 0 && n <= 100 ? n : null;
}

export function parseRecipePage(html: string, pageUrl: string): ImportedRecipe | null {
  let node: Record<string, unknown> | null = null;
  const scripts = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const script of scripts) {
    try {
      node = findRecipeNode(JSON.parse(script[1].trim()));
    } catch {
      continue;
    }
    if (node) break;
  }

  const preview = parsePreview(html, pageUrl);
  if (!node) {
    return preview.title || preview.imageUrl
      ? { title: preview.title, servings: null, prep_minutes: null, cook_minutes: null, ingredients: [], steps: [], image_url: preview.imageUrl }
      : null;
  }

  const ingredients = (Array.isArray(node.recipeIngredient) ? node.recipeIngredient : [])
    .filter((line): line is string => typeof line === "string")
    .map(decode)
    .filter(Boolean)
    .slice(0, 100);
  let image = imageFrom(node.image) ?? preview.imageUrl;
  if (image && !/^https?:\/\//i.test(image)) {
    try {
      image = new URL(image, pageUrl).toString();
    } catch {
      image = null;
    }
  }
  const title = typeof node.name === "string" ? decode(node.name).slice(0, 120) : preview.title;
  return {
    title: title || null,
    servings: servingsFrom(node.recipeYield),
    prep_minutes: parseDuration(node.prepTime),
    cook_minutes: parseDuration(node.cookTime) ?? (node.prepTime ? null : parseDuration(node.totalTime)),
    ingredients,
    steps: stepsFrom(node.recipeInstructions).slice(0, 60),
    image_url: image,
  };
}

// A quick download from the phone. `blocked` means the site turned us away
// (often Cloudflare's browser check), so it's worth trying again in a real
// browser (components/recipe-page-reader.tsx).
export async function fetchRecipe(url: string): Promise<{ recipe: ImportedRecipe | null; blocked: boolean }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
        Accept: "text/html",
      },
    });
    clearTimeout(timeout);
    if (!response.ok) {
      if (__DEV__) console.log("[recipe import] refused", response.status, url);
      return { recipe: null, blocked: response.status === 403 || response.status === 429 || response.status === 503 };
    }
    const html = (await response.text()).slice(0, 3_000_000);
    if (__DEV__) {
      const ld = html.match(/application\/ld\+json/gi)?.length ?? 0;
      console.log("[recipe import] got", response.status, response.url || url, `${html.length} chars, ${ld} recipe-data blocks`, html.slice(0, 120).replace(/\s+/g, " "));
    }
    if (/<title>\s*Just a moment/i.test(html)) return { recipe: null, blocked: true };
    return { recipe: parseRecipePage(html, response.url || url), blocked: false };
  } catch (error) {
    if (__DEV__) console.log("[recipe import] failed", url, String(error));
    // No connection, or the site didn't answer in time; a browser may still get in.
    return { recipe: null, blocked: true };
  }
}

// --- Search, Shelves and the recipe of the day --------------------------------------

type Searchable = Pick<Recipe, "title" | "ingredients" | "shelves">;

// Every word has to be somewhere in the title, an ingredient or a Shelf;
// title matches come first.
export function searchRecipes<T extends Searchable>(recipes: T[], query: string): T[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return recipes;
  const scored: { recipe: T; score: number }[] = [];
  for (const recipe of recipes) {
    const title = recipe.title.toLowerCase();
    const rest = [...recipe.ingredients, ...recipe.shelves].join(" \n ").toLowerCase();
    if (!words.every((word) => title.includes(word) || rest.includes(word))) continue;
    const score = words.filter((word) => title.includes(word)).length * 2 + (title.startsWith(words[0]) ? 1 : 0);
    scored.push({ recipe, score });
  }
  return scored.sort((a, b) => b.score - a.score).map((s) => s.recipe);
}

// Every Shelf in use, most-used first, then A-Z.
export function shelvesIn(recipes: Pick<Recipe, "shelves">[]): string[] {
  const counts = new Map<string, number>();
  for (const recipe of recipes) for (const shelf of recipe.shelves) counts.set(shelf, (counts.get(shelf) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([shelf]) => shelf);
}

export function cleanShelf(name: string) {
  return name.trim().replace(/\s+/g, " ").slice(0, SHELF_LENGTH);
}

// The same recipe all day, a different one tomorrow, without saving
// anything: it's picked from the day's date (REC-011). Ids are sorted first
// so adding a recipe doesn't reshuffle the order of the others.
export function recipeOfTheDay<T extends Pick<Recipe, "id">>(recipes: T[], day: string): T | null {
  if (!recipes.length) return null;
  const sorted = [...recipes].sort((a, b) => a.id.localeCompare(b.id));
  let hash = 0;
  for (const ch of day) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  // Spread neighbouring days out so it doesn't just step down the list.
  hash = Math.imul(hash ^ (hash >>> 15), 2246822507) >>> 0;
  return sorted[hash % sorted.length];
}

// Lines typed in a box → one entry each, blanks dropped, list bullets and
// "1." step numbers taken off.
export function toLines(text: string, max: number) {
  return text
    .split("\n")
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "").trim())
    .filter(Boolean)
    .slice(0, max);
}

// "Made 3 times · last on Oct 2"
export function madeWords(recipe: Pick<Recipe, "made_count" | "last_made_at">) {
  if (!recipe.made_count || !recipe.last_made_at) return null;
  const when = new Date(recipe.last_made_at).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return recipe.made_count === 1 ? `Made once · ${when}` : `Made ${recipe.made_count} times · last ${when}`;
}

// Warnings are written about a person by name (POT-005); for your own
// allergies the name is "You": "You has" → "You have".
export function youWords(line: string) {
  return line.replace(/^You has /, "You have ").replace(/^You eats /, "You eat ");
}
