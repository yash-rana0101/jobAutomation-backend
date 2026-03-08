/** Centralised AI prompt templates */

export interface CandidateProfileData {
  name: string;
  email: string;
  phone: string;
  location: string;
  website?: string | null;
  linkedin?: string | null;
  summary: string;
  skills: any;
  experience: any[];
  education: any[];
  projects: any[];
  certifications: any[];
}

export function companyAnalysisPrompt(companyName: string, website: string, description: string, crawledContent: string): string {
  return `Analyze the following company.

Company Name: ${companyName}
Website: ${website}

Website Content:
${crawledContent.slice(0, 8000)}

Description:
${description || "N/A"}

Return structured JSON with:

{
  "industry": "string",
  "product": "string — main product or service",
  "businessModel": "string",
  "techStack": ["array", "of", "technologies"],
  "engineeringTools": ["array", "of", "tools"],
  "hiringSignals": ["array", "of", "hiring indicators"],
  "relevanceScore": 0-3,
  "summary": "2-3 sentence summary"
}

Scoring guide for relevanceScore:
- 0 = Completely irrelevant (non-tech, no engineering)
- 1 = Low relevance (minimal tech, no clear hiring)
- 2 = Medium relevance (tech company, possible fit)
- 3 = High relevance (strong tech stack match, active hiring signals)

Return ONLY valid JSON, no other text.`;
}

export function emailDraftPrompt(
  candidate: CandidateProfileData,
  companyName: string,
  industry: string,
  product: string,
  techStack: string[],
  summary: string,
): string {
  return `Write a cold outreach email from ${candidate.name} to ${companyName}.

Candidate:
- Name: ${candidate.name}
- Role: Full Stack / Backend Engineer
- Top Skills: ${Object.values(candidate.skills).flat().slice(0, 10).join(", ")}

Company Info:
- Industry: ${industry || "Tech"}
- Product: ${product || "Unknown"}
- Tech Stack: ${JSON.stringify(techStack || [])}
- Summary: ${summary || ""}

Rules:
- Maximum 120 words for the body
- Human-sounding, not salesy
- Avoid spam trigger words
- Mention the company's product specifically
- Mention candidate's relevant skills matching the company stack
- Professional but warm tone
- Sign off as "${candidate.name}"

Return a JSON object with exactly:
{
  "subject": "email subject line",
  "body": "email body text (plain text, no HTML)"
}

Return ONLY valid JSON.`;
}

export function resumeGenerationPrompt(
  candidate: CandidateProfileData,
  companyName: string,
  industry: string,
  product: string,
  techStack: string[],
  tools: string[],
): string {
  return `Tailor this candidate's resume for ${companyName}.

=== CANDIDATE PROFILE ===
Name: ${candidate.name}
Current Summary: ${candidate.summary}

Experience:
${JSON.stringify(candidate.experience, null, 2)}

Projects:
${JSON.stringify(candidate.projects, null, 2)}

Skills:
${JSON.stringify(candidate.skills, null, 2)}

Education:
${JSON.stringify(candidate.education, null, 2)}

=== TARGET COMPANY ===
Company: ${companyName}
Industry: ${industry || "Tech"}
Product: ${product || "Unknown"}
Tech Stack: ${JSON.stringify(techStack || [])}
Engineering Tools: ${JSON.stringify(tools || [])}

Instructions:
- Tailor the summary (2-3 sentences) to this company's product and stack
- Reorder and filter skills to prioritize company-relevant ones (keep all true skills, just reorder)
- Rewrite 3 experience bullets per role to highlight stack-relevant achievements
- Rewrite 3 project bullets to highlight stack-relevant work
- Keep everything truthful — only tailor framing, not facts

Return ONLY valid JSON:
{
  "tailoredSummary": "string",
  "tailoredSkills": {
    "languages": ["..."],
    "frontend": ["..."],
    "backend": ["..."],
    "databases": ["..."],
    "devops": ["..."]
  },
  "tailoredExperience": [
    { "company": "exact company name from profile", "bullets": ["bullet1", "bullet2", "bullet3"] }
  ],
  "tailoredProjects": [
    { "name": "exact project name from profile", "bullets": ["bullet1", "bullet2", "bullet3"] }
  ]
}`;
}

export function atsAnalysisPrompt(companyName: string, techStack: string[], tools: string[], industry: string, resumeContent: string): string {
  return `Analyze this resume against the company's tech stack for ATS compatibility.

Company: ${companyName}
Tech Stack: ${JSON.stringify(techStack || [])}
Engineering Tools: ${JSON.stringify(tools || [])}
Industry: ${industry || "Tech"}

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

Return ONLY valid JSON.`;
}

export function resumeOptimizeTailoredPrompt(
  candidate: CandidateProfileData,
  companyName: string,
  techStack: string[],
  industry: string,
  suggestions: string[],
): string {
  return `Re-tailor this candidate's resume to improve its ATS score for ${companyName}.

Candidate Profile:
${JSON.stringify({ summary: candidate.summary, skills: candidate.skills, experience: candidate.experience, projects: candidate.projects }, null, 2)}

Company Tech Stack: ${JSON.stringify(techStack || [])}
Company Industry: ${industry || "Tech"}

ATS Improvement Suggestions:
${suggestions.join("\n")}

Rules:
- Improve keyword alignment with company tech stack
- Improve action verbs and technical keyword density
- Keep experience truthful
- Maintain authenticity

Return ONLY valid JSON with the same schema as before:
{
  "tailoredSummary": "string",
  "tailoredSkills": { "languages": [], "frontend": [], "backend": [], "databases": [], "devops": [] },
  "tailoredExperience": [{ "company": "...", "bullets": ["..."] }],
  "tailoredProjects": [{ "name": "...", "bullets": ["..."] }]
}`;
}
