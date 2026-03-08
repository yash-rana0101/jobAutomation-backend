import prisma from "../../config/database";
import { queueCompanyForCrawl } from "../../queues/queues";

export async function getAllCompanies() {
  return prisma.company.findMany({
    include: { analysis: true, outreach: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getCompanyById(id: string) {
  return prisma.company.findUnique({
    where: { id },
    include: { crawlData: true, analysis: true, outreach: true },
  });
}

export async function createCompany(data: {
  name: string;
  website: string;
  email: string;
  description?: string;
  linkedin?: string;
  twitter?: string;
  phone?: string;
}) {
  const normalized = {
    ...data,
    website: data.website.replace(/\/+$/, ""),
    email: data.email.trim().toLowerCase(),
  };

  return prisma.company.create({
    data: {
      ...normalized,
      outreach: { create: { status: "pending" } },
    },
    include: { outreach: true },
  });
}

/** Extract root domain from URL for dedup */
function extractDomain(url: string): string {
  try {
    const parsed = new URL(url.includes("://") ? url : `https://${url}`);
    return parsed.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return url.replace(/^https?:\/\//i, "").replace(/^www\./, "").split("/")[0].toLowerCase();
  }
}

export async function createManyCompanies(
  companies: Array<{
    name: string;
    website: string;
    email: string;
    description?: string;
    linkedin?: string;
    twitter?: string;
    phone?: string;
  }>,
  options?: { queueCrawl?: boolean }
) {
  const results = [];
  const seenDomains = new Set<string>();

  for (const data of companies) {
    try {
      // Domain dedup within this batch
      const domain = extractDomain(data.website);
      if (seenDomains.has(domain)) continue;
      seenDomains.add(domain);

      // Check DB for existing
      const existing = await prisma.company.findFirst({
        where: {
          OR: [
            { email: data.email.trim().toLowerCase() },
            { website: data.website.replace(/\/+$/, "") },
          ],
        },
      });
      if (existing) continue;

      const company = await createCompany(data);
      results.push(company);

      // Queue for crawling if requested
      if (options?.queueCrawl) {
        await queueCompanyForCrawl(company.id, company.website);
      }
    } catch (err: any) {
      console.warn(`[company-service] Skipped ${data.name}: ${err.message}`);
    }
  }
  return results;
}

export async function deleteCompany(id: string) {
  return prisma.company.delete({ where: { id } });
}
