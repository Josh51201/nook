// GIFT-030 (Q-011): best-effort title + picture from a product link, fetched
// straight from the phone. Reads standard Open Graph tags, plus Amazon's own
// markup since Amazon product pages often skip Open Graph. Sites can block
// this (Amazon sometimes serves a robot check), so callers must treat a
// null result as normal and let people type things in themselves.

export type LinkPreview = { title: string | null; imageUrl: string | null };

const MAX_HTML = 1_500_000;

function decodeEntities(text: string) {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_m, code) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, " ")
    .trim();
}

function metaContent(html: string, key: string) {
  // <meta property="og:title" content="..."> in either attribute order.
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]*content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${key}["']`, "i"),
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(html);
    if (match) return decodeEntities(match[1]);
  }
  return null;
}

export function parsePreview(html: string, pageUrl: string): LinkPreview {
  const amazonTitle = /<span[^>]+id=["']productTitle["'][^>]*>([\s\S]*?)<\/span>/i.exec(html)?.[1];
  const amazonImage =
    /data-old-hires=["'](https:[^"']+)["']/i.exec(html)?.[1] ??
    /"hiRes":"(https:[^"]+)"/i.exec(html)?.[1] ??
    /"large":"(https:[^"]+)"/i.exec(html)?.[1];

  const pageTitle = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1];
  const title =
    metaContent(html, "og:title") ??
    (amazonTitle ? decodeEntities(amazonTitle) : null) ??
    metaContent(html, "twitter:title") ??
    metaContent(html, "title") ??
    (pageTitle ? decodeEntities(pageTitle) : null);

  let imageUrl =
    metaContent(html, "og:image") ?? amazonImage ?? metaContent(html, "twitter:image") ?? null;
  if (imageUrl && !/^https?:\/\//i.test(imageUrl)) {
    try {
      imageUrl = new URL(imageUrl, pageUrl).toString();
    } catch {
      imageUrl = null;
    }
  }

  // "Amazon.com: Cozy Socks : Clothing" → "Cozy Socks"
  const isAmazonPageTitle = title ? /^Amazon\.[a-z.]+\s*:/i.test(title) : false;
  const cleanTitle = (
    isAmazonPageTitle
      ? title!.replace(/^Amazon\.[a-z.]+\s*:\s*/i, "").replace(/\s*:\s*[^:]+$/, "")
      : title
  )?.slice(0, 200);

  return { title: cleanTitle || null, imageUrl };
}

export async function fetchLinkPreview(url: string): Promise<LinkPreview | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        // A normal phone browser; some shops send bots an empty page.
        "User-Agent":
          "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
        Accept: "text/html",
      },
    });
    clearTimeout(timeout);
    if (!response.ok) return null;
    const html = (await response.text()).slice(0, MAX_HTML);
    const preview = parsePreview(html, response.url || url);
    return preview.title || preview.imageUrl ? preview : null;
  } catch {
    return null;
  }
}
