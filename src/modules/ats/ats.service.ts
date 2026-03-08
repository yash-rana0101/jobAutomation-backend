import { generateText } from "../../config/ai";
import { atsAnalysisPrompt } from "../ai/prompts";
import prisma from "../../config/database";

export interface ATSResult {
  score: number;
  keywordMatch: number;
  formattingCompatibility: string;
  skillRelevance: string;
  suggestions: string[];
}

export async function analyzeATS(
  companyId: string,
  resumeContent: string
): Promise<ATSResult> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: { analysis: true },
  });
  if (!company) throw new Error("Company not found");

  const text = await generateText(
    atsAnalysisPrompt(
      company.name,
      (company.analysis?.techStack as string[]) || [],
      (company.analysis?.engineeringTools as string[]) || [],
      company.analysis?.industry || "Tech",
      resumeContent,
    )
  );
  let result: ATSResult;
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    result = JSON.parse(jsonMatch ? jsonMatch[0] : text);
  } catch {
    result = {
      score: 70,
      keywordMatch: 65,
      formattingCompatibility: "Medium",
      skillRelevance: "Medium",
      suggestions: ["Unable to analyze - using default score"],
    };
  }

  await prisma.outreach.update({
    where: { companyId },
    data: { atsScore: result.score, atsDetails: result as any },
  });

  return result;
}
