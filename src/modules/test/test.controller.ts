import { Router } from "express";
import prisma from "../../config/database";
import { crawlCompanyWebsite } from "../crawler/crawler.service";
import { analyzeCompany } from "../ai/analysis.service";
import { generateResume, optimizeResume } from "../resume/resume.service";
import { analyzeATS } from "../ats/ats.service";
import { generateEmail } from "../ai/email.service";
import { sendEmail } from "../email/email.sending.service";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const testRouter = Router();

/**
 * POST /api/test/pipeline
 * Creates a test company and runs the full pipeline end-to-end,
 * sending the final email to the provided address.
 */
testRouter.post("/pipeline", async (req, res) => {
  const targetEmail = req.body.email || "ranayash812@gmail.com";
  const testWebsite = req.body.website || "https://trivx.in";
  const testCompanyName = req.body.companyName || "Vercel (Test)";

  try {
    console.log(`[test-pipeline] Starting full pipeline test → ${targetEmail}`);

    // Step 0: Create (or reuse) test company + outreach record
    // Delete any prior test run for same email+website so we start fresh
    const existing = await prisma.company.findFirst({
      where: { email: targetEmail, website: testWebsite },
    });
    if (existing) {
      await prisma.outreach.deleteMany({ where: { companyId: existing.id } });
      await prisma.company.delete({ where: { id: existing.id } });
    }

    const company = await prisma.company.create({
      data: {
        name: testCompanyName,
        website: testWebsite,
        email: targetEmail,
      },
    });
    await prisma.outreach.create({
      data: { companyId: company.id, status: "pending" },
    });
    console.log(`[test-pipeline] Created company ${company.id}`);

    // Step 1: Crawl
    console.log("[test-pipeline] Step 1: Crawling...");
    await prisma.outreach.update({
      where: { companyId: company.id },
      data: { status: "crawling" },
    });
    await crawlCompanyWebsite(company.id);

    // Step 2: Analyze
    console.log("[test-pipeline] Step 2: Analyzing...");
    await prisma.outreach.update({
      where: { companyId: company.id },
      data: { status: "analyzing" },
    });
    const analysis = await analyzeCompany(company.id);
    console.log(`[test-pipeline] Relevance score: ${analysis.relevanceScore}`);
    await delay(5000);

    // Step 3: Generate resume
    console.log("[test-pipeline] Step 3: Generating resume...");
    await prisma.outreach.update({
      where: { companyId: company.id },
      data: { status: "generating_resume" },
    });
    let resumeContent = await generateResume(company.id);
    await delay(5000);

    // Step 4: ATS check
    console.log("[test-pipeline] Step 4: ATS checking...");
    await prisma.outreach.update({
      where: { companyId: company.id },
      data: { status: "ats_checking" },
    });
    let atsResult = await analyzeATS(company.id, resumeContent);
    console.log(`[test-pipeline] ATS score: ${atsResult.score}`);
    await delay(5000);

    // Step 5: Optimize if needed
    if (atsResult.score < 80) {
      console.log("[test-pipeline] Step 5: Optimizing resume...");
      resumeContent = await optimizeResume(company.id, resumeContent, atsResult.suggestions);
      await delay(5000);
      atsResult = await analyzeATS(company.id, resumeContent);
      await delay(5000);
      console.log(`[test-pipeline] ATS score after optimization: ${atsResult.score}`);
    }

    // Step 6: Generate email
    console.log("[test-pipeline] Step 6: Drafting email...");
    await prisma.outreach.update({
      where: { companyId: company.id },
      data: { status: "drafting_email" },
    });
    const email = await generateEmail(company.id);
    await delay(2000);

    // Step 7: Auto-approve and send
    console.log("[test-pipeline] Step 7: Approving and sending...");
    await prisma.outreach.update({
      where: { companyId: company.id },
      data: { status: "approved" },
    });
    await sendEmail(company.id);

    const finalOutreach = await prisma.outreach.findUnique({
      where: { companyId: company.id },
      include: { company: { include: { analysis: true } } },
    });

    console.log(`[test-pipeline] SUCCESS — email sent to ${targetEmail}`);
    res.json({
      success: true,
      message: `Pipeline complete! Email sent to ${targetEmail}`,
      companyId: company.id,
      emailSubject: email.subject,
      atsScore: atsResult.score,
      relevanceScore: analysis.relevanceScore,
      outreach: finalOutreach,
    });
  } catch (error: any) {
    console.error("[test-pipeline] FAILED:", error.message);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});
