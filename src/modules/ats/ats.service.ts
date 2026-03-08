import { getAnthropicClient } from "../../config/ai";
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

  const client = getAnthropicClient();
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1000,
    messages: [
      {
        role: "user",
        content: `Analyze this resume against the company's tech stack for ATS compatibility.

Company: ${company.name}
Tech Stack: ${JSON.stringify(company.analysis?.techStack || [])}
Engineering Tools: ${JSON.stringify(company.analysis?.engineeringTools || [])}
Industry: ${company.analysis?.industry || "Tech"}

Resume Content:
${resumeContent.slice(0, 5000)}

Return a JSON object:
{
  "score": <number 0-100>,
  "keywordMatch": <number 0-100>,
  "formattingCompatibility": "High" | "Medium" | "Low",
  "skillRelevance": "High" | "Medium" | "Low",
  "suggestions": [<array of improvement suggestions>]
}

Return ONLY valid JSON.`,
      },
    ],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";
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
