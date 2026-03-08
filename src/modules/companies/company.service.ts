import prisma from "../../config/database";

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

export async function createManyCompanies(
  companies: Array<{
    name: string;
    website: string;
    email: string;
    description?: string;
    linkedin?: string;
    twitter?: string;
  }>
) {
  const results = [];
  for (const data of companies) {
    try {
      const existing = await prisma.company.findFirst({
        where: {
          email: data.email.trim().toLowerCase(),
          website: data.website.replace(/\/+$/, ""),
        },
      });
      if (existing) continue;

      const company = await createCompany(data);
      results.push(company);
    } catch {
      // Skip duplicates
    }
  }
  return results;
}

export async function deleteCompany(id: string) {
  return prisma.company.delete({ where: { id } });
}
