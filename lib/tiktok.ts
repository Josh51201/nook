// TikTok recipes (REC-013/014). TikTok's public oEmbed lookup gives a
// video's caption, creator and thumbnail with no account or key. Its
// thumbnail links stop working after about a day, so Nook never saves one:
// it asks again when it shows the recipe (kept in memory for the session).

export type TikTokInfo = {
  url: string; // the full video link
  videoId: string;
  caption: string;
  author: string | null;
  thumbnailUrl: string | null;
};

export function isTikTok(url: string | null | undefined) {
  if (!url) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "tiktok.com" || host.endsWith(".tiktok.com");
  } catch {
    return false;
  }
}

// ".../@cook/video/7301234567890123456?is_from_webapp=1" → "7301234567890123456"
export function tiktokVideoId(url: string) {
  return /\/video\/(\d{6,25})/.exec(url)?.[1] ?? null;
}

// The official embed player, without the "more videos" and music extras.
export function tiktokPlayerUrl(videoId: string) {
  return `https://www.tiktok.com/player/v1/${videoId}?rel=0&music_info=0&description=0&closed_caption=1`;
}

// A caption like "Easy garlic noodles 🍜 Ingredients: 8oz noodles, 4 cloves
// garlic, 2 tbsp butter. Boil the noodles... #pasta #fyp" → a name, the
// ingredients it lists (if it lists any), and the caption without hashtags
// for the notes so nothing is lost.
export function parseCaption(caption: string) {
  const clean = caption
    .replace(/(^|\s)#[^\s#]+/g, " ")
    .replace(/(^|\s)@[\w.]+/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();

  const marker = /\bingredients?\s*[:\-–]\s*/i.exec(clean);
  let ingredients: string[] = [];
  let lead = clean;
  if (marker) {
    lead = clean.slice(0, marker.index);
    const rest = clean.slice(marker.index + marker[0].length);
    // Ingredients run until the steps start.
    const stop = /\b(?:instructions?|directions?|method|steps?|how to)\s*[:\-–]|\n\s*\n/i.exec(rest);
    const list = stop ? rest.slice(0, stop.index) : rest;
    ingredients = list
      .split(/\n|,|;|•|(?:^|\s)-\s|\s\d+[.)]\s|\.\s+(?=[A-Z0-9])/)
      .map((part) => part.trim().replace(/\.$/, ""))
      .filter((part) => part.length > 1 && part.length <= 80)
      .slice(0, 40);
  }

  const firstLine = lead.split(/\n|[.!?](?:\s|$)|[|•]/)[0] ?? "";
  // Emoji off the ends of the name.
  const title = firstLine.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N})]+$/gu, "").trim().slice(0, 80) || null;
  return { title, ingredients, notes: clean.slice(0, 2000) || null };
}

const cache = new Map<string, Promise<TikTokInfo | null>>();

async function lookUp(link: string): Promise<TikTokInfo | null> {
  let url = link;
  // Share links (vm.tiktok.com/…, tiktok.com/t/…) redirect to the video.
  if (!tiktokVideoId(url)) {
    try {
      const response = await fetch(url, { method: "GET", redirect: "follow" });
      if (response.url) url = response.url;
    } catch {
      return null;
    }
  }
  const videoId = tiktokVideoId(url);
  if (!videoId) return null;
  try {
    const response = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url.split("?")[0])}`);
    if (!response.ok) return null;
    const data = (await response.json()) as { title?: string; author_name?: string; thumbnail_url?: string };
    return {
      url: url.split("?")[0],
      videoId,
      caption: data.title ?? "",
      author: data.author_name ?? null,
      thumbnailUrl: data.thumbnail_url ?? null,
    };
  } catch {
    return null;
  }
}

export function fetchTikTok(link: string): Promise<TikTokInfo | null> {
  const known = cache.get(link);
  if (known) return known;
  const pending = lookUp(link).then((info) => {
    // Don't remember a failure: the next look might work.
    if (!info) cache.delete(link);
    return info;
  });
  cache.set(link, pending);
  return pending;
}
