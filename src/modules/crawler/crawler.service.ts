import prisma from "../../config/database";
import * as cheerio from "cheerio";

// ── Config ──────────────────────────────────────────────────────────
const MAX_CONTENT_PER_PAGE = 15_000;
const FETCH_TIMEOUT_MS = 15_000;
const MAX_SUBPAGES = 5;

/** Patterns for links worth crawling (about, careers, products, team, etc.) */
const RELEVANT_PATH_PATTERNS = [
  /\babout\b/i,
  /\bteam\b/i,
  /\bcareer/i,
  /\bjob/i,
  /\bproduct/i,
  /\bservice/i,
  /\bengineering\b/i,
  /\btechnolog/i,
  /\bwhat[\-_]we[\-_]do\b/i,
  /\bwho[\-_]we[\-_]are\b/i,
  /\bour[\-_]story\b/i,
  /\bcompany\b/i,
];

interface CrawlResult {
  markdown: string;
  pages: Record<string, string>;
}

// ── URL Helpers ─────────────────────────────────────────────────────

/** Validate that a URL is well-formed and likely reachable. */
export function isValidWebsiteUrl(url: string): boolean {
  try {
    const parsed = new URL(url.includes("://") ? url : `https://${url}`);
    if (!["http:", "https:"].includes(parsed.protocol)) return false;
    if (!parsed.hostname.includes(".")) return false;
    if (/\s/.test(parsed.href)) return false;
    return true;
  } catch {
    return false;
  }
}

function normalizeUrl(raw: string): string {
  let url = raw.trim();
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  return url.replace(/\/+$/, "");
}

// ── Fetch ───────────────────────────────────────────────────────────

async function fetchPage(url: string): Promise<{ html: string; ok: boolean }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      redirect: "follow",
    });

    if (!res.ok) return { html: "", ok: false };

    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("text/html") && !ct.includes("application/xhtml")) {
      return { html: "", ok: false };
    }

    const html = await res.text();
    return { html, ok: true };
  } catch {
    return { html: "", ok: false };
  } finally {
    clearTimeout(timer);
  }
}

// ── HTML → Text ─────────────────────────────────────────────────────

function extractText(html: string): string {
  const $ = cheerio.load(html);
  $("script, style, nav, footer, header, noscript, svg, iframe").remove();
  return ($("main").length ? $("main") : $("body"))
    .text()
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_CONTENT_PER_PAGE);
}

// ── Link Discovery ──────────────────────────────────────────────────

function discoverRelevantLinks(html: string, baseUrl: string): string[] {
  const $ = cheerio.load(html);
  const baseOrigin = new URL(baseUrl).origin;
  const seen = new Set<string>();
  const links: string[] = [];

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;

    try {
      const resolved = new URL(href, baseUrl);
      if (resolved.origin !== baseOrigin) return; // same-origin only
      if (!["http:", "https:"].includes(resolved.protocol)) return;

      const path = resolved.pathname.toLowerCase();
      if (/\.(pdf|jpg|png|gif|svg|css|js|zip|doc|docx|xlsx|mp4|webp)$/i.test(path)) return;
      if (path === "/" || path === "") return;

      const normalized = `${resolved.origin}${resolved.pathname}`.replace(/\/+$/, "");
      if (seen.has(normalized)) return;
      seen.add(normalized);

      if (RELEVANT_PATH_PATTERNS.some((rx) => rx.test(path))) {
        links.push(normalized);
      }
    } catch {
      // skip malformed hrefs
    }
  });

  return links.slice(0, MAX_SUBPAGES);
}

// ── Main Crawler ────────────────────────────────────────────────────

async function saveEmptyCrawl(companyId: string): Promise<CrawlResult> {
  const empty: CrawlResult = { markdown: "", pages: {} };
  await prisma.crawlData.upsert({
    where: { companyId },
    create: { companyId, markdown: "", pages: {} },
    update: { markdown: "", pages: {}, crawledAt: new Date() },
  });
  return empty;
}

export async function crawlCompanyWebsite(companyId: string): Promise<CrawlResult> {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) throw new Error("Company not found");

  const baseUrl = normalizeUrl(company.website);

  // ── Guard: invalid URL → save empty result, pipeline continues with description
  if (!isValidWebsiteUrl(baseUrl)) {
    console.warn(`[crawler] Invalid URL for ${company.name}: ${company.website}`);
    return saveEmptyCrawl(companyId);
  }

  const pages: Record<string, string> = {};

  // ── Step 1: Fetch homepage — if unreachable, skip entire site
  console.log(`[crawler] ${company.name} → ${baseUrl}`);
  const homepage = await fetchPage(baseUrl);

  if (!homepage.ok) {
    console.warn(`[crawler] Homepage unreachable: ${company.name} (${baseUrl})`);
    return saveEmptyCrawl(companyId);
  }

  const homepageText = extractText(homepage.html);
  if (homepageText.length > 100) {
    pages["homepage"] = homepageText;
  }

  // ── Step 2: Discover relevant subpage links from homepage HTML
  const relevantLinks = discoverRelevantLinks(homepage.html, baseUrl);

  // ── Step 3: Fetch discovered subpages sequentially (polite crawling)
  for (const link of relevantLinks) {
    const result = await fetchPage(link);
    if (result.ok) {
      const text = extractText(result.html);
      if (text.length > 100) {
        const path = new URL(link).pathname;
        pages[path] = text;
      }
    }
  }

  // ── Save results
  const combinedMarkdown = Object.entries(pages)
    .map(([page, content]) => `## ${page}\n\n${content}`)
    .join("\n\n---\n\n");

  await prisma.crawlData.upsert({
    where: { companyId },
    create: { companyId, markdown: combinedMarkdown, pages },
    update: { markdown: combinedMarkdown, pages, crawledAt: new Date() },
  });

  console.log(`[crawler] ${company.name}: crawled ${Object.keys(pages).length} pages (${relevantLinks.length} sublinks found)`);
  return { markdown: combinedMarkdown, pages };
}
