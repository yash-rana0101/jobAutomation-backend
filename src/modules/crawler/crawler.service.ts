import prisma from "../../config/database";

interface CrawlResult {
  markdown: string;
  pages: Record<string, string>;
}

export async function crawlCompanyWebsite(companyId: string): Promise<CrawlResult> {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) throw new Error("Company not found");

  // Use Firecrawl API if available, otherwise use basic fetch
  const markdown = await fetchPageContent(company.website);

  const pages: Record<string, string> = { homepage: markdown };

  // Try common pages
  const paths = ["/about", "/careers", "/products", "/services"];
  for (const path of paths) {
    try {
      const content = await fetchPageContent(`${company.website}${path}`);
      if (content && content.length > 100) {
        pages[path] = content;
      }
    } catch {
      // Page doesn't exist, skip
    }
  }

  const combinedMarkdown = Object.values(pages).join("\n\n---\n\n");

  await prisma.crawlData.upsert({
    where: { companyId },
    create: { companyId, markdown: combinedMarkdown, pages },
    update: { markdown: combinedMarkdown, pages, crawledAt: new Date() },
  });

  await prisma.outreach.update({
    where: { companyId },
    data: { status: "crawling" },
  });

  return { markdown: combinedMarkdown, pages };
}

async function fetchPageContent(url: string): Promise<string> {
  // Check for Firecrawl API key
  if (process.env.FIRECRAWL_API_KEY) {
    return firecrawlFetch(url);
  }
  return basicFetch(url);
}

async function firecrawlFetch(url: string): Promise<string> {
  const resp = await fetch("https://api.firecrawl.dev/v0/scrape", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}`,
    },
    body: JSON.stringify({ url, pageOptions: { onlyMainContent: true } }),
  });
  if (!resp.ok) return basicFetch(url);
  const data = await resp.json();
  return (data as any).data?.markdown || "";
}

async function basicFetch(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "JobAutomation Bot/1.0" },
    });
    clearTimeout(timeout);
    if (!resp.ok) return "";
    const html = await resp.text();
    // Strip HTML tags for a basic text extraction
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 15000);
  } catch {
    clearTimeout(timeout);
    return "";
  }
}
