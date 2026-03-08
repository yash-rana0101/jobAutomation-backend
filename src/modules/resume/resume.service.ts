import { generateText } from "../../config/ai";
import { resumeGenerationPrompt, resumeOptimizeTailoredPrompt } from "../ai/prompts";
import prisma from "../../config/database";
import fs from "fs";
import path from "path";
import { getProfile } from "../profile/profile.service";
import { buildResumePdf, buildResumeText, ResumeData } from "../../utils/pdf";

const RESUMES_DIR = path.join(process.cwd(), "uploads", "resumes");

function mergeProfileWithTailored(profile: any, tailored: any): ResumeData {
  return {
    name: profile.name,
    email: profile.email,
    phone: profile.phone,
    location: profile.location,
    website: profile.website,
    linkedin: profile.linkedin,
    summary: tailored.tailoredSummary || profile.summary,
    skills: tailored.tailoredSkills || profile.skills,
    experience: (profile.experience as any[]).map((exp) => ({
      ...exp,
      bullets:
        tailored.tailoredExperience?.find(
          (te: any) => te.company === exp.company,
        )?.bullets || exp.bullets,
    })),
    projects: (profile.projects as any[]).map((proj) => ({
      ...proj,
      bullets:
        tailored.tailoredProjects?.find(
          (tp: any) => tp.name === proj.name,
        )?.bullets || proj.bullets,
    })),
    education: profile.education as any[],
    certifications: profile.certifications as any[],
  };
}

export async function generateResume(companyId: string): Promise<string> {
  if (!fs.existsSync(RESUMES_DIR)) {
    fs.mkdirSync(RESUMES_DIR, { recursive: true });
  }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: { analysis: true },
  });
  if (!company) throw new Error("Company not found");

  const profile = await getProfile();

  const text = await generateText(
    resumeGenerationPrompt(
      profile as any,
      company.name,
      company.analysis?.industry || "Tech",
      company.analysis?.product || "Unknown",
      (company.analysis?.techStack as string[]) || [],
      (company.analysis?.engineeringTools as string[]) || [],
    ),
    3000,
  );

  let tailored: any;
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    tailored = JSON.parse(jsonMatch ? jsonMatch[0] : text);
  } catch {
    tailored = {};
  }

  const resumeData = mergeProfileWithTailored(profile, tailored);

  // Generate PDF
  const pdfBuffer = await buildResumePdf(resumeData);
  const safeName = company.name.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
  const filename = `resume_${safeName}.pdf`;
  const filepath = path.join(RESUMES_DIR, filename);
  fs.writeFileSync(filepath, pdfBuffer);

  await prisma.outreach.update({
    where: { companyId },
    data: {
      resumePath: `/uploads/resumes/${filename}`,
      status: "generating_resume",
    },
  });

  // Return plain text for ATS analysis
  return buildResumeText(resumeData);
}

export async function optimizeResume(
  companyId: string,
  _currentResume: string,
  suggestions: string[],
): Promise<string> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: { analysis: true },
  });
  if (!company) throw new Error("Company not found");

  const profile = await getProfile();

  const text = await generateText(
    resumeOptimizeTailoredPrompt(
      profile as any,
      company.name,
      (company.analysis?.techStack as string[]) || [],
      company.analysis?.industry || "Tech",
      suggestions,
    ),
    3000,
  );

  let tailored: any;
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    tailored = JSON.parse(jsonMatch ? jsonMatch[0] : text);
  } catch {
    tailored = {};
  }

  const resumeData = mergeProfileWithTailored(profile, tailored);

  // Overwrite PDF
  const pdfBuffer = await buildResumePdf(resumeData);
  const safeName = company.name.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
  const filename = `resume_${safeName}.pdf`;
  const filepath = path.join(RESUMES_DIR, filename);
  fs.writeFileSync(filepath, pdfBuffer);

  return buildResumeText(resumeData);
}
