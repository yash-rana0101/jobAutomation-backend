import { Router } from "express";
import prisma from "../../config/database";
import { crawlCompanyWebsite } from "../crawler/crawler.service";
import { analyzeCompany } from "../ai/analysis.service";
import { generateResume, optimizeResume } from "../resume/resume.service";
import { analyzeATS } from "../ats/ats.service";
import { generateEmail } from "../ai/email.service";
import { sendEmail } from "../email/email.sending.service";
import fs from "fs";
import path from "path";

export const outreachRouter = Router();

// List all outreach records
outreachRouter.get("/", async (_req, res) => {
  try {
    const outreach = await prisma.outreach.findMany({
      include: { company: { include: { analysis: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json(outreach);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get single outreach with full details
outreachRouter.get("/:companyId", async (req, res) => {
  try {
    const cid = req.params.companyId as string;
    const outreach = await prisma.outreach.findUnique({
      where: { companyId: cid },
      include: { company: { include: { analysis: true, crawlData: true } } },
    });
    if (!outreach) return res.status(404).json({ error: "Not found" });
    res.json(outreach);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Run the full pipeline for a company
outreachRouter.post("/:companyId/process", async (req, res) => {
  const companyId = req.params.companyId as string;
  try {
    // Step 1: Crawl
    await prisma.outreach.update({
      where: { companyId },
      data: { status: "crawling" },
    });
    await crawlCompanyWebsite(companyId);

    // Step 2: Analyze
    await prisma.outreach.update({
      where: { companyId },
      data: { status: "analyzing" },
    });
    const analysis = await analyzeCompany(companyId);

    // Check relevance
    if (analysis.relevanceScore < 2) {
      await prisma.outreach.update({
        where: { companyId },
        data: { status: "rejected", errorMessage: "Low relevance score" },
      });
      return res.json({
        message: "Company has low relevance score",
        relevanceScore: analysis.relevanceScore,
      });
    }

    // Step 3: Generate resume
    await prisma.outreach.update({
      where: { companyId },
      data: { status: "generating_resume" },
    });
    let resumeContent = await generateResume(companyId);

    // Step 4: ATS check
    await prisma.outreach.update({
      where: { companyId },
      data: { status: "ats_checking" },
    });
    let atsResult = await analyzeATS(companyId, resumeContent);

    // Step 5: Optimize if ATS score < 80
    if (atsResult.score < 80) {
      resumeContent = await optimizeResume(
        companyId,
        resumeContent,
        atsResult.suggestions
      );
      atsResult = await analyzeATS(companyId, resumeContent);
    }

    // Step 6: Generate email
    await prisma.outreach.update({
      where: { companyId },
      data: { status: "drafting_email" },
    });
    await generateEmail(companyId);

    // Mark ready for review
    await prisma.outreach.update({
      where: { companyId },
      data: { status: "ready_for_review" },
    });

    const result = await prisma.outreach.findUnique({
      where: { companyId },
      include: { company: { include: { analysis: true } } },
    });

    res.json(result);
  } catch (error: any) {
    await prisma.outreach.update({
      where: { companyId },
      data: { status: "failed", errorMessage: error.message },
    });
    res.status(500).json({ error: error.message });
  }
});

// Approve an outreach
outreachRouter.post("/:companyId/approve", async (req, res) => {
  try {
    const outreach = await prisma.outreach.update({
      where: { companyId: req.params.companyId as string },
      data: { status: "approved" },
    });
    res.json(outreach);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Reject an outreach
outreachRouter.post("/:companyId/reject", async (req, res) => {
  try {
    const outreach = await prisma.outreach.update({
      where: { companyId: req.params.companyId as string },
      data: { status: "rejected" },
    });
    res.json(outreach);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update email draft
outreachRouter.put("/:companyId/email", async (req, res) => {
  try {
    const { subject, body } = req.body;
    const outreach = await prisma.outreach.update({
      where: { companyId: req.params.companyId as string },
      data: { emailSubject: subject, emailBody: body },
    });
    res.json(outreach);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Send approved email
outreachRouter.post("/:companyId/send", async (req, res) => {
  try {
    const result = await sendEmail(req.params.companyId as string);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get resume content
outreachRouter.get("/:companyId/resume", async (req, res) => {
  try {
    const outreach = await prisma.outreach.findUnique({
      where: { companyId: req.params.companyId as string },
    });
    if (!outreach?.resumePath) {
      return res.status(404).json({ error: "No resume generated" });
    }
    const fullPath = path.join(process.cwd(), outreach.resumePath);
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: "Resume file not found" });
    }
    const content = fs.readFileSync(fullPath, "utf-8");
    res.json({ content, path: outreach.resumePath });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
