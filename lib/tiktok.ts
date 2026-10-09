import { useEffect, useState } from "react";

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

// TikTok's own site, and the short domain its Share → Copy link now gives
// (www.tt.site/t/…), which redirects to the video on tiktok.com.
const TIKTOK_HOSTS = ["tiktok.com", "tt.site"];

export function isTikTok(url: string | null | undefined) {
  if (!url) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return TIKTOK_HOSTS.some((domain) => host === domain || host.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

function onTikTokItself(url: string) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "tiktok.com" || host.endsWith(".tiktok.com");
  } catch {
    return false;
  }
}

// ".../@cook/video/7301234567890123456?is_from_webapp=1" → "7301234567890123456"
export function tiktokVideoId(url: string) {
  return /\/(?:video|v)\/(\d{6,25})/.exec(url)?.[1] ?? null;
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

  let firstLine = lead.split(/\n|[.!?](?:\s|$)|[|•]/)[0] ?? "";
  // A long first sentence is usually chatter, not a name: keep up to the
  // first comma, then whole words up to 60 letters.
  if (firstLine.length > 50 && firstLine.includes(",")) firstLine = firstLine.split(",")[0];
  if (firstLine.length > 60) firstLine = firstLine.slice(0, 61).replace(/\s+\S*$/, "");
  // Emoji off the ends of the name.
  const title = firstLine.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N})]+$/gu, "").trim() || null;
  return { title, ingredients, notes: clean.slice(0, 2000) || null };
}

const cache = new Map<string, Promise<TikTokInfo | null>>();

const BROWSER_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

type OEmbed = { title?: string; author_name?: string; author_url?: string; thumbnail_url?: string; embed_product_id?: string };

async function oEmbed(url: string): Promise<OEmbed | null> {
  try {
    const response = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`, {
      headers: { "User-Agent": BROWSER_UA, Accept: "application/json" },
    });
    if (__DEV__) console.log("[tiktok] lookup", response.status, url);
    if (!response.ok) return null;
    return (await response.json()) as OEmbed;
  } catch (error) {
    if (__DEV__) console.log("[tiktok] lookup failed", url, String(error));
    return null;
  }
}

async function lookUp(link: string): Promise<TikTokInfo | null> {
  // TikTok's lookup takes the link as shared, short links (vm.tiktok.com/…,
  // tiktok.com/t/…) included, and says which video it is.
  // (tt.site links it doesn't take, so those are followed first.)
  let data = onTikTokItself(link) ? await oEmbed(link.split("?")[0]) : null;
  let resolved = link;
  if (!data) {
    // Some share links only work once followed to the video itself.
    try {
      const response = await fetch(link, { headers: { "User-Agent": BROWSER_UA } });
      resolved = response.url || link;
      if (__DEV__) console.log("[tiktok] followed", link, "→", resolved);
    } catch {
      return null;
    }
    if (resolved !== link) data = await oEmbed(resolved.split("?")[0]);
  }
  if (!data) return null;
  const videoId = data.embed_product_id ?? tiktokVideoId(resolved);
  if (!videoId) return null;
  return {
    // Saved as the plain video address, whatever kind of link was pasted.
    url: data.author_url ? `${data.author_url}/video/${videoId}` : resolved.split("?")[0],
    videoId,
    caption: data.title ?? "",
    author: data.author_name ?? null,
    thumbnailUrl: data.thumbnail_url ?? null,
  };
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

// The video behind a saved TikTok link (REC-014). Links saved before the
// short tt.site kind was recognized have no video id in them, so those are
// looked up.
export function useTikTokVideo(sourceUrl: string | null | undefined) {
  const direct = sourceUrl && isTikTok(sourceUrl) ? tiktokVideoId(sourceUrl) : null;
  const [found, setFound] = useState<{ videoId: string; url: string } | null>(null);

  useEffect(() => {
    if (!sourceUrl || !isTikTok(sourceUrl) || direct) return;
    let live = true;
    fetchTikTok(sourceUrl).then((info) => live && info && setFound({ videoId: info.videoId, url: info.url }));
    return () => {
      live = false;
    };
  }, [sourceUrl, direct]);

  if (direct && sourceUrl) return { videoId: direct, url: sourceUrl };
  return found;
}
