import { Queue } from "bullmq";
import { getRedisUrl } from "./connection";

export const QUEUE_NAMES = {
  CRAWL: "crawl-company",
  ANALYZE: "analyze-company",
  GENERATE_RESUME: "generate-resume",
  SEND_EMAIL: "send-email",
} as const;

let crawlQueue: Queue | null = null;
let analyzeQueue: Queue | null = null;
let resumeQueue: Queue | null = null;
let emailQueue: Queue | null = null;

function redisOpts() {
  return { connection: { url: getRedisUrl(), maxRetriesPerRequest: null } };
}

export function getCrawlQueue(): Queue {
  if (!crawlQueue) crawlQueue = new Queue(QUEUE_NAMES.CRAWL, redisOpts());
  return crawlQueue;
}

export function getAnalyzeQueue(): Queue {
  if (!analyzeQueue) analyzeQueue = new Queue(QUEUE_NAMES.ANALYZE, redisOpts());
  return analyzeQueue;
}

export function getResumeQueue(): Queue {
  if (!resumeQueue) resumeQueue = new Queue(QUEUE_NAMES.GENERATE_RESUME, redisOpts());
  return resumeQueue;
}

export function getEmailQueue(): Queue {
  if (!emailQueue) emailQueue = new Queue(QUEUE_NAMES.SEND_EMAIL, redisOpts());
  return emailQueue;
}

/** Add a company to the crawl queue (entrypoint after CSV import) */
export async function queueCompanyForCrawl(companyId: string, website: string) {
  const q = getCrawlQueue();
  await q.add("crawl", { companyId, website }, {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 200,
  });
}
