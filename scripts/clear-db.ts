import prisma from "../src/config/database";

async function main() {
  await prisma.outreach.deleteMany();
  await prisma.companyAnalysis.deleteMany();
  await prisma.crawlData.deleteMany();
  await prisma.company.deleteMany();
  console.log("Companies:", await prisma.company.count());
  console.log("Outreach:", await prisma.outreach.count());
  console.log("CrawlData:", await prisma.crawlData.count());
  console.log("CompanyAnalysis:", await prisma.companyAnalysis.count());
  console.log("Done — all company data cleared.");
  await prisma.$disconnect();
}

main();
