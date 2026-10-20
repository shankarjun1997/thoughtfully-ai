export type InstagramSource = {
  shortcode: string;
  canonicalUrl: string;
  embedUrl: string;
  kind: "p" | "reel" | "tv";
};

export type InstagramEmbed = {
  title: string;
  caption: string;
  images: string[];
};

const INSTAGRAM_HOSTS = new Set(["instagram.com", "www.instagram.com", "m.instagram.com", "instagr.am", "www.instagr.am"]);

export function parseInstagramUrl(raw: string): InstagramSource | null {
  try {
    const url = new URL(raw.trim());
    if (!INSTAGRAM_HOSTS.has(url.hostname.toLowerCase())) return null;
    const match = url.pathname.match(/^\/(reel|reels|p|tv)\/([A-Za-z0-9_-]+)/);
    if (!match) return null;
    const kind = match[1] === "reels" ? "reel" : (match[1] as "p" | "reel" | "tv");
    const shortcode = match[2];
    return {
      shortcode,
      kind,
      canonicalUrl: `https://www.instagram.com/${kind}/${shortcode}/`,
      embedUrl: `https://www.instagram.com/${kind}/${shortcode}/embed/captioned/`,
    };
  } catch {
    return null;
  }
}

function decodeEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\\u0026/g, "&")
    .replace(/\\\//g, "/");
}

function readMeta(html: string, property: string) {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]*content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${escaped}["']`, "i"),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeEntities(match[1]);
  }
  return "";
}

export async function fetchInstagramEmbed(source: InstagramSource): Promise<InstagramEmbed> {
  const response = await fetch(source.embedUrl, {
    headers: {
      "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      "accept-language": "en-US,en;q=0.9",
      accept: "text/html,application/xhtml+xml",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) throw new Error(`Instagram returned ${response.status}.`);

  const html = await response.text();
  const caption = [readMeta(html, "og:description"), readMeta(html, "twitter:description")].filter(Boolean).join("\n").trim();
  const title = readMeta(html, "og:title") || readMeta(html, "twitter:title");
  const fallbackImage = readMeta(html, "og:image");

  const images = new Set<string>();
  const decoded = decodeEntities(html);
  for (const match of decoded.matchAll(/https?:\/\/[^"'\\\s]+?\.(?:jpg|jpeg|webp|png)(?:\?[^"'\\\s]*)?/gi)) {
    const image = match[0];
    if (!image.includes("cdninstagram") && !image.includes("fbcdn")) continue;
    images.add(image);
    if (images.size >= 10) break;
  }
  if (fallbackImage) images.add(fallbackImage);

  return { title, caption, images: [...images] };
}
