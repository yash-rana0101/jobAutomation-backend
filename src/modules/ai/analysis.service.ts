import { generateText } from "../../config/ai";
import { companyAnalysisPrompt } from "./prompts";
import prisma from "../../config/database";

export async function analyzeCompany(companyId: string) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: { crawlData: true },
  });
  if (!company) throw new Error("Company not found");

  const crawlContent = company.crawlData?.markdown || company.description || "";

  const text = await generateText(
    companyAnalysisPrompt(company.name, company.website, company.description || "", crawlContent)
  );
  let analysis;
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    analysis = JSON.parse(jsonMatch ? jsonMatch[0] : text);
  } catch {
    analysis = {
      industry: "Unknown",
      product: "Unknown",
      businessModel: "Unknown",
      techStack: [],
      engineeringTools: [],
      hiringSignals: [],
      relevanceScore: 1,
      summary: text.slice(0, 500),
    };
  }

  const saved = await prisma.companyAnalysis.upsert({
    where: { companyId },
    create: {
      companyId,
      industry: analysis.industry,
      product: analysis.product,
      businessModel: analysis.businessModel,
      techStack: analysis.techStack,
      engineeringTools: analysis.engineeringTools,
      hiringSignals: analysis.hiringSignals,
      relevanceScore: analysis.relevanceScore,
      summary: analysis.summary,
    },
    update: {
      industry: analysis.industry,
      product: analysis.product,
      businessModel: analysis.businessModel,
      techStack: analysis.techStack,
      engineeringTools: analysis.engineeringTools,
      hiringSignals: analysis.hiringSignals,
      relevanceScore: analysis.relevanceScore,
      summary: analysis.summary,
      analyzedAt: new Date(),
    },
  });

  await prisma.outreach.update({
    where: { companyId },
    data: { status: "analyzing" },
  });

  return saved;
}
