import prisma from "../../config/database";
import { CheerioCrawler, Configuration } from "crawlee";

interface CrawlResult {
  markdown: string;
  pages: Record<string, string>;
}

const CRAWL_PATHS = ["/about", "/about-us", "/careers", "/jobs", "/products", "/services", "/engineering", "/blog"];
const MAX_CONTENT_PER_PAGE = 15000;

export async function crawlCompanyWebsite(companyId: string): Promise<CrawlResult> {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) throw new Error("Company not found");

  const baseUrl = company.website.replace(/\/+$/, "");
  const pages: Record<string, string> = {};

  // Build the list of URLs to crawl
  const urls = [baseUrl, ...CRAWL_PATHS.map((p) => `${baseUrl}${p}`)];

  // Use a local Crawlee configuration so no global storage/state leaks between runs
  const config = new Configuration({ persistStorage: false });

  const crawler = new CheerioCrawler(
    {
      maxRequestsPerCrawl: urls.length,
      maxConcurrency: 3,
      requestHandlerTimeoutSecs: 15,
      async requestHandler({ request, $ }) {
        // Strip scripts/styles, then grab text
        $("script, style, nav, footer, header, noscript, svg, iframe").remove();
        const text = ($("main").length ? $("main") : $("body"))
          .text()
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, MAX_CONTENT_PER_PAGE);

        if (text.length > 100) {
          const label = request.url === baseUrl
            ? "homepage"
            : new URL(request.url).pathname;
          pages[label] = text;
        }
      },
      async failedRequestHandler({ request }) {
        console.warn(`[crawler] Failed to crawl ${request.url}`);
      },
    },
    config,
  );

  await crawler.run(urls);

  const combinedMarkdown = Object.entries(pages)
    .map(([page, content]) => `## ${page}\n\n${content}`)
    .join("\n\n---\n\n");

  await prisma.crawlData.upsert({
    where: { companyId },
    create: { companyId, markdown: combinedMarkdown, pages },
    update: { markdown: combinedMarkdown, pages, crawledAt: new Date() },
  });

  return { markdown: combinedMarkdown, pages };
}
