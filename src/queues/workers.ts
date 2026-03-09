import { Worker } from "bullmq";
import { getRedisUrl } from "./connection";
import { QUEUE_NAMES, getAnalyzeQueue } from "./queues";
import { crawlCompanyWebsite } from "../modules/crawler/crawler.service";
import { analyzeCompany } from "../modules/ai/analysis.service";
import { generateResume, optimizeResume } from "../modules/resume/resume.service";
import { analyzeATS } from "../modules/ats/ats.service";
import { generateEmail } from "../modules/ai/email.service";
import { sendEmail } from "../modules/email/email.sending.service";
import prisma from "../config/database";

function workerOpts(concurrency: number) {
  return {
    connection: { url: getRedisUrl(), maxRetriesPerRequest: null },
    concurrency,
  };
}

/** Start all queue workers. Call once on server boot. */
export function startWorkers() {
  // ── Crawl Worker ──────────────────────────────────────────────────
  const crawlWorker = new Worker(
    QUEUE_NAMES.CRAWL,
    async (job) => {
      const { companyId, website } = job.data;
      console.log(`[crawl-worker] Processing ${companyId} → ${website}`);

      await prisma.outreach.update({
        where: { companyId },
        data: { status: "crawling" },
      });
      const result = await crawlCompanyWebsite(companyId);

      // Always chain to analyze — even with empty crawl, analysis can use description
      console.log(`[crawl-worker] ${companyId}: ${Object.keys(result.pages).length} pages crawled`);
      const q = getAnalyzeQueue();
      await q.add("analyze", { companyId }, {
        attempts: 2,
        backoff: { type: "exponential", delay: 3000 },
        removeOnComplete: 100,
        removeOnFail: 200,
      });
    },
    workerOpts(3), // limit concurrent crawls
  );

  crawlWorker.on("failed", (job, err) => {
    console.error(`[crawl-worker] FAILED ${job?.data?.companyId}:`, err.message);
    if (job?.data?.companyId) {
      prisma.outreach.update({
        where: { companyId: job.data.companyId },
        data: { status: "failed", errorMessage: `Crawl failed: ${err.message}` },
      }).catch(() => { });
    }
  });

  // ── Analyze Worker ────────────────────────────────────────────────
  const analyzeWorker = new Worker(
    QUEUE_NAMES.ANALYZE,
    async (job) => {
      const { companyId } = job.data;
      console.log(`[analyze-worker] Processing ${companyId}`);

      await prisma.outreach.update({
        where: { companyId },
        data: { status: "analyzing" },
      });
      const analysis = await analyzeCompany(companyId);

      // Filter: relevance_score < 2 → mark rejected, stop pipeline
      if (analysis.relevanceScore < 2) {
        await prisma.outreach.update({
          where: { companyId },
          data: { status: "rejected", errorMessage: `Low relevance score: ${analysis.relevanceScore}` },
        });
        console.log(`[analyze-worker] ${companyId} rejected (score=${analysis.relevanceScore})`);
        return;
      }

      // Chain: generate resume
      const { getResumeQueue } = await import("./queues");
      const q = getResumeQueue();
      await q.add("resume", { companyId }, {
        attempts: 2,
        backoff: { type: "exponential", delay: 3000 },
        removeOnComplete: 100,
        removeOnFail: 200,
      });
    },
    workerOpts(2),
  );

  analyzeWorker.on("failed", (job, err) => {
    console.error(`[analyze-worker] FAILED ${job?.data?.companyId}:`, err.message);
    if (job?.data?.companyId) {
      prisma.outreach.update({
        where: { companyId: job.data.companyId },
        data: { status: "failed", errorMessage: `Analysis failed: ${err.message}` },
      }).catch(() => { });
    }
  });

  // ── Resume Worker ─────────────────────────────────────────────────
  const resumeWorker = new Worker(
    QUEUE_NAMES.GENERATE_RESUME,
    async (job) => {
      const { companyId } = job.data;
      console.log(`[resume-worker] Processing ${companyId}`);

      await prisma.outreach.update({
        where: { companyId },
        data: { status: "generating_resume" },
      });
      let resumeContent = await generateResume(companyId);

      // ATS check & optimise loop
      await prisma.outreach.update({
        where: { companyId },
        data: { status: "ats_checking" },
      });
      let atsResult = await analyzeATS(companyId, resumeContent);

      if (atsResult.score < 80) {
        resumeContent = await optimizeResume(companyId, resumeContent, atsResult.suggestions);
        atsResult = await analyzeATS(companyId, resumeContent);
      }

      // Email drafting
      await prisma.outreach.update({
        where: { companyId },
        data: { status: "drafting_email" },
      });
      await generateEmail(companyId);

      // Mark ready for human review
      await prisma.outreach.update({
        where: { companyId },
        data: { status: "ready_for_review" },
      });
      console.log(`[resume-worker] ${companyId} ready for review`);
    },
    workerOpts(2),
  );

  resumeWorker.on("failed", (job, err) => {
    console.error(`[resume-worker] FAILED ${job?.data?.companyId}:`, err.message);
    if (job?.data?.companyId) {
      prisma.outreach.update({
        where: { companyId: job.data.companyId },
        data: { status: "failed", errorMessage: `Resume/ATS/Email failed: ${err.message}` },
      }).catch(() => { });
    }
  });

  // ── Email Send Worker ─────────────────────────────────────────────
  const emailWorker = new Worker(
    QUEUE_NAMES.SEND_EMAIL,
    async (job) => {
      const { companyId } = job.data;
      console.log(`[email-worker] Sending for ${companyId}`);
      await sendEmail(companyId);
    },
    workerOpts(1), // send one at a time to avoid SMTP throttle
  );

  emailWorker.on("failed", (job, err) => {
    console.error(`[email-worker] FAILED ${job?.data?.companyId}:`, err.message);
  });

  console.log("[workers] All queue workers started");

  return { crawlWorker, analyzeWorker, resumeWorker, emailWorker };
}
