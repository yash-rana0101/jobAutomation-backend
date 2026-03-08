import { getAnthropicClient } from "../../config/ai";
import prisma from "../../config/database";

export async function generateEmail(companyId: string) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: { analysis: true },
  });
  if (!company) throw new Error("Company not found");

  const analysis = company.analysis;
  const client = getAnthropicClient();

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 800,
    messages: [
      {
        role: "user",
        content: `Write a cold outreach email from Yash Rana, a backend/fullstack engineer, to ${company.name}.

Company Info:
- Industry: ${analysis?.industry || "Tech"}
- Product: ${analysis?.product || "Unknown"}
- Tech Stack: ${JSON.stringify(analysis?.techStack || [])}
- Summary: ${analysis?.summary || ""}

Rules:
- Maximum 120 words for the body
- Human-sounding, not salesy
- Avoid spam trigger words
- Mention the company's product specifically
- Mention relevant engineering skills
- Professional but warm tone
- Sign off as "Yash Rana"

Return a JSON object with exactly:
{
  "subject": "email subject line",
  "body": "email body text"
}

Return ONLY valid JSON.`,
      },
    ],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";
  let email;
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    email = JSON.parse(jsonMatch ? jsonMatch[0] : text);
  } catch {
    email = {
      subject: `Backend Engineer Interested in ${company.name}`,
      body: `Hi,\n\nI recently came across ${company.name} and found your work fascinating.\n\nI'm a backend engineer specializing in Node.js, scalable systems, and automation. I'd love to contribute to your engineering team.\n\nI've attached my resume for context.\n\nBest,\nYash Rana`,
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
