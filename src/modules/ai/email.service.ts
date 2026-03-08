import { generateText } from "../../config/ai";
import { emailDraftPrompt } from "./prompts";
import prisma from "../../config/database";
import { getProfile } from "../profile/profile.service";

export async function generateEmail(companyId: string) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: { analysis: true },
  });
  if (!company) throw new Error("Company not found");

  const profile = await getProfile();
  const analysis = company.analysis;
  const text = await generateText(
    emailDraftPrompt(
      profile as any,
      company.name,
      analysis?.industry || "Tech",
      analysis?.product || "Unknown",
      (analysis?.techStack as string[]) || [],
      analysis?.summary || "",
    )
  );
  let email;
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    email = JSON.parse(jsonMatch ? jsonMatch[0] : text);
  } catch {
    email = {
      subject: `Backend Engineer Interested in ${company.name}`,
      body: `Hi,\n\nI recently came across ${company.name} and found your work fascinating.\n\nI'm a backend engineer specializing in Node.js, scalable systems, and automation. I'd love to contribute to your engineering team.\n\nI've attached my resume for context.\n\nBest,\n${profile.name}`,
    };
  }

  await prisma.outreach.update({
    where: { companyId },
    data: {
      emailSubject: email.subject,
      emailBody: email.body,
      status: "ready_for_review",
    },
  });

  return email;
}
