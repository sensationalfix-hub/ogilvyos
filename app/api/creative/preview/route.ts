import { NextResponse } from "next/server";
import { requestIdentity } from "@/app/lib/workos-auth";

export const runtime = "nodejs";

type Preview = { image: string; title: string; site: string; kind: "video" | "image" };
const TRUSTED = [
  "vimeo.com", "pinterest.com", "pinterest.es", "pinterest.co.uk", "pinterest.fr",
  "pinterest.de", "pinterest.it", "pin.it", "unsplash.com", "pexels.com",
  "pixabay.com", "flickr.com", "behance.net", "artstation.com", "dribbble.com",
  "500px.com", "deviantart.com",
];
const cache = new Map<string, { value: Preview | null; expires: number }>();
const MAX_HTML_BYTES = 400_000;

function safeUrl(raw: string): URL | null {
  try {
    if (!raw || raw.length > 2000) return null;
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) return null;
    if (!TRUSTED.some(domain => host === domain || host.endsWith("." + domain))) return null;
    return url;
  } catch { return null; }
}

function publicImage(raw: string | undefined, base: URL): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw, base);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || url.username || url.password || url.port && url.port !== "443") return null;
    if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal") ||
        /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":") ||
        !host.includes(".") || url.href.length > 3000) return null;
    return url.href;
  } catch { return null; }
}

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi, (_, code: string) => {
    const names: Record<string, string> = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " " };
    if (code.startsWith("#")) {
      const radix = code[1].toLowerCase() === "x" ? 16 : 10;
      const num = Number.parseInt(code.slice(radix === 16 ? 2 : 1), radix);
      return Number.isFinite(num) && num > 0 && num <= 0x10ffff ? String.fromCodePoint(num) : "";
    }
    return names[code.toLowerCase()] || "";
  });
}

function readMeta(html: string) {
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  const values: Record<string, string> = {};
  for (const tag of tags.slice(0, 450)) {
    const attrs: Record<string, string> = {};
    const regex = /([a-zA-Z:_-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
    for (const match of tag.matchAll(regex)) attrs[match[1].toLowerCase()] = decodeEntities(match[2] ?? match[3] ?? match[4] ?? "");
    const name = (attrs.property || attrs.name || "").toLowerCase();
    if (name && attrs.content && !values[name]) values[name] = attrs.content;
  }
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "";
  return {
    image: values["og:image:secure_url"] || values["og:image"] || values["twitter:image"] || values["twitter:image:src"] || "",
    title: values["og:title"] || values["twitter:title"] || decodeEntities(title.replace(/\s+/g, " ").trim()),
    site: values["og:site_name"] || "",
    description: values["og:description"] || "",
    video: values["og:type"] === "video" || Boolean(values["og:video"]),
  };
}

async function limitedHtml(page: URL): Promise<{ html: string; url: URL } | null> {
  let current = page;
  for (let count = 0; count < 4; count++) {
    const response = await fetch(current, {
      redirect: "manual",
      signal: AbortSignal.timeout(6500),
      headers: { Accept: "text/html,application/xhtml+xml", "User-Agent": "WorkOSCreativeLabPreview/1.0" },
      cache: "no-store",
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) return null;
      const next = safeUrl(new URL(location, current).href);
      if (!next) return null;
      current = next;
      continue;
    }
    if (!response.ok || !(response.headers.get("content-type") || "").includes("text/html")) return null;
    const reader = response.body?.getReader();
    if (!reader) return null;
    const decoder = new TextDecoder();
    let html = "";
    let size = 0;
    while (size < MAX_HTML_BYTES) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > MAX_HTML_BYTES) break;
      html += decoder.decode(part.value, { stream: true });
      if (html.includes("</head>")) break;
    }
    await reader.cancel().catch(() => {});
    return { html, url: current };
  }
  return null;
}

async function resolvePreview(url: URL): Promise<Preview | null> {
  const host = url.hostname.toLowerCase();
  if (host === "vimeo.com" || host.endsWith(".vimeo.com")) {
    try {
      const oembed = new URL("https://vimeo.com/api/oembed.json");
      oembed.searchParams.set("url", url.href);
      oembed.searchParams.set("width", "640");
      const res = await fetch(oembed, { signal: AbortSignal.timeout(6500), redirect: "error", cache: "no-store" });
      if (res.ok) {
        const data: { thumbnail_url?: string; title?: string } = await res.json();
        const image = publicImage(data.thumbnail_url, url);
        if (image) return { image, title: String(data.title || "Vídeo de Vimeo").slice(0, 180), site: "Vimeo", kind: "video" };
      }
    } catch { /* Vimeo may restrict some private/unlisted videos */ }
  }
  const page = await limitedHtml(url).catch(() => null);
  if (!page) return null;
  const info = readMeta(page.html);
  const image = publicImage(info.image, page.url);
  if (!image) return null;
  const currentHost = page.url.hostname.toLowerCase();
  const site = info.site || (currentHost.includes("pinterest") || currentHost === "pin.it" ? "Pinterest" : currentHost.includes("vimeo") ? "Vimeo" : currentHost.replace(/^www\./, ""));
  return { image, title: info.title.slice(0, 180), site: site.slice(0, 60), kind: info.video || currentHost.includes("vimeo") ? "video" : "image" };
}

export async function GET(request: Request) {
  const identity = await requestIdentity(request);
  if (!identity) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const raw = new URL(request.url).searchParams.get("url") || "";
  const target = safeUrl(raw);
  if (!target) return NextResponse.json({ preview: null, supported: false });
  const key = target.href;
  const existing = cache.get(key);
  if (existing && existing.expires > Date.now()) return NextResponse.json({ preview: existing.value, supported: true });
  const preview = await resolvePreview(target);
  if (cache.size > 300) cache.clear();
  cache.set(key, { value: preview, expires: Date.now() + (preview ? 3_600_000 : 300_000) });
  return NextResponse.json({ preview, supported: true }, { headers: { "Cache-Control": "private, max-age=300" } });
}
