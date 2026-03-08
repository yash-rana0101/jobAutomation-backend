import { getAnthropicClient } from "../../config/ai";
import prisma from "../../config/database";
import fs from "fs";
import path from "path";

const RESUMES_DIR = path.join(process.cwd(), "uploads", "resumes");

export async function generateResume(companyId: string): Promise<string> {
  if (!fs.existsSync(RESUMES_DIR)) {
    fs.mkdirSync(RESUMES_DIR, { recursive: true });
  }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: { analysis: true },
  });
  if (!company) throw new Error("Company not found");

  const client = getAnthropicClient();
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 3000,
    messages: [
      {
        role: "user",
        content: `Generate an optimized resume for Yash Rana tailored for ${company.name}.

Company Info:
- Industry: ${company.analysis?.industry || "Tech"}
- Product: ${company.analysis?.product || "Unknown"}
- Tech Stack: ${JSON.stringify(company.analysis?.techStack || [])}
- Engineering Tools: ${JSON.stringify(company.analysis?.engineeringTools || [])}

Resume Requirements:
- Yash Rana is a Backend/Fullstack Engineer
- Skills: Node.js, TypeScript, Python, React, PostgreSQL, MongoDB, Redis, Docker, Kubernetes, AWS, CI/CD
- Experience: Building scalable APIs, microservices, automation tools, AI integrations
- Optimize bullet points for the company's tech stack
- Reorder skills based on company stack relevance
- Keep experience truthful
- Format as clean plain text resume (sections: Contact, Summary, Skills, Experience, Projects, Education)

Return the resume as plain text, well-formatted with clear sections.`,
      },
    ],
  });

  const resumeText =
    response.content[0].type === "text" ? response.content[0].text : "";

  const safeName = company.name.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
  const filename = `resume_${safeName}.txt`;
  const filepath = path.join(RESUMES_DIR, filename);
  fs.writeFileSync(filepath, resumeText, "utf-8");

  await prisma.outreach.update({
    where: { companyId },
    data: {
      resumePath: `/uploads/resumes/${filename}`,
      status: "generating_resume",
    },
  });

  return resumeText;
}

export async function optimizeResume(
  companyId: string,
  currentResume: string,
  suggestions: string[]
): Promise<string> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: { analysis: true },
  });
  if (!company) throw new Error("Company not found");

  const client = getAnthropicClient();
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 3000,
    messages: [
      {
        role: "user",
        content: `Optimize this resume to improve its ATS score for ${company.name}.

Company Tech Stack: ${JSON.stringify(company.analysis?.techStack || [])}
Company Industry: ${company.analysis?.industry || "Tech"}

Current Resume:
${currentResume}

ATS Improvement Suggestions:
${suggestions.join("\n")}

Rules:
- Improve keyword alignment with company tech stack
- Improve action verbs
- Improve technical keyword density
- Keep experience truthful
- Maintain authenticity

Return the optimized resume as plain text.`,
      },
    ],
  });

  const optimized =
    response.content[0].type === "text" ? response.content[0].text : "";

  const safeName = company.name.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
  const filename = `resume_${safeName}.txt`;
  const filepath = path.join(RESUMES_DIR, filename);
  fs.writeFileSync(filepath, optimized, "utf-8");

  return optimized;
}
