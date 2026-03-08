import { getAnthropicClient } from "../../config/ai";
import prisma from "../../config/database";

export async function analyzeCompany(companyId: string) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: { crawlData: true },
  });
  if (!company) throw new Error("Company not found");

  const crawlContent = company.crawlData?.markdown || company.description || "";

  const client = getAnthropicClient();
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1500,
    messages: [
      {
        role: "user",
        content: `Analyze the following company information and return a JSON object with these fields:
- industry (string)
- product (string - main product/service)
- businessModel (string)
- techStack (array of strings)
- engineeringTools (array of strings)
- hiringSignals (array of strings - any indicators they're hiring)
- relevanceScore (number 0-3: 0=ignore, 1=low, 2=medium, 3=high relevance for a backend/fullstack engineer)
- summary (string - 2-3 sentence summary)

Company: ${company.name}
Website: ${company.website}
Description: ${company.description || "N/A"}

Crawled Content:
${crawlContent.slice(0, 8000)}

Return ONLY valid JSON, no other text.`,
      },
    ],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";
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
