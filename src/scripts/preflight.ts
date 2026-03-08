import dotenv from "dotenv";
dotenv.config();

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { HfInference } from "@huggingface/inference";
import { CheerioCrawler, Configuration } from "crawlee";
import nodemailer from "nodemailer";
import IORedis from "ioredis";

const RESET = "\x1b[0m";
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";

function pass(label: string, detail = "") {
  console.log(`  ${GREEN}✔${RESET}  ${label}${detail ? DIM + "  " + detail + RESET : ""}`);
}

function fail(label: string, detail = "") {
  console.log(`  ${RED}✘${RESET}  ${label}${detail ? DIM + "  " + detail + RESET : ""}`);
}

function warn(label: string, detail = "") {
  console.log(`  ${YELLOW}~${RESET}  ${label}${detail ? DIM + "  " + detail + RESET : ""}`);
}

function section(title: string) {
  console.log(`\n${BOLD}${title}${RESET}`);
}

const results: { name: string; ok: boolean }[] = [];

async function checkEnv() {
  section("Environment Variables");
  const required = [
    "DATABASE_URL",
    "REDIS_URL",
    "ZOHO_SMTP_HOST",
    "ZOHO_SMTP_PORT",
    "ZOHO_SMTP_USER",
    "ZOHO_SMTP_PASSWORD",
    "HF_API_KEY",
  ];

  let allOk = true;
  for (const key of required) {
    const val = process.env[key];
    if (!val || val.startsWith("your_")) {
      fail(key, "not set or placeholder");
      allOk = false;
    } else {
      pass(key);
    }
  }
  results.push({ name: "Environment", ok: allOk });
}

async function checkPostgres() {
  section("PostgreSQL (Prisma)");
  try {
    const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
    const prisma = new PrismaClient({ adapter });
    await prisma.$connect();
    // Simple query to verify schema exists
    const count = await prisma.company.count();
    pass("Connection", `localhost:5432 — ${count} companies in DB`);
    await prisma.$disconnect();
    results.push({ name: "PostgreSQL", ok: true });
  } catch (e: any) {
    fail("Connection", e.message);
    results.push({ name: "PostgreSQL", ok: false });
  }
}

async function checkRedis() {
  section("Redis");
  const redis = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
    maxRetriesPerRequest: 1,
    connectTimeout: 5000,
    lazyConnect: true,
  });
  try {
    await redis.connect();
    const pong = await redis.ping();
    if (pong === "PONG") {
      pass("Connection", process.env.REDIS_URL || "redis://localhost:6379");
      results.push({ name: "Redis", ok: true });
    } else {
      fail("Unexpected response", pong);
      results.push({ name: "Redis", ok: false });
    }
  } catch (e: any) {
    fail("Connection", e.message);
    results.push({ name: "Redis", ok: false });
  } finally {
    redis.disconnect();
  }
}

async function checkSMTP() {
  section("Zoho SMTP");
  const transporter = nodemailer.createTransport({
    host: process.env.ZOHO_SMTP_HOST || "smtp.zoho.in",
    port: parseInt(process.env.ZOHO_SMTP_PORT || "587"),
    secure: false,
    auth: {
      user: process.env.ZOHO_SMTP_USER,
      pass: process.env.ZOHO_SMTP_PASSWORD,
    },
  });
  try {
    await transporter.verify();
    pass("Connection", `${process.env.ZOHO_SMTP_HOST}:${process.env.ZOHO_SMTP_PORT}`);
    pass("Auth", `Authenticated as ${process.env.ZOHO_SMTP_USER}`);
    results.push({ name: "SMTP", ok: true });
  } catch (e: any) {
    fail("Connection/Auth", e.message);
    results.push({ name: "SMTP", ok: false });
  }
}

async function checkHuggingFace() {
  section("Hugging Face Inference API");
  const key = process.env.HF_API_KEY;
  if (!key || key.startsWith("your_")) {
    warn("Skipped", "HF_API_KEY not configured");
    results.push({ name: "HuggingFace", ok: false });
    return;
  }
  try {
    const hf = new HfInference(key);
    const result = await hf.chatCompletion({
      model: "openai/gpt-oss-20b",
      messages: [{ role: "user", content: "Reply with: ok" }],
      max_tokens: 10,
    });
    const text = result.choices[0].message.content ?? "";
    pass("API key valid", `Response: "${text.trim()}"`);
    results.push({ name: "HuggingFace", ok: true });
  } catch (e: any) {
    fail("API call failed", e.message);
    results.push({ name: "HuggingFace", ok: false });
  }
}

async function checkCrawlee() {
  section("Crawlee (CheerioCrawler)");
  try {
    let scraped = false;
    const config = new Configuration({ persistStorage: false });
    const crawler = new CheerioCrawler(
      {
        maxRequestsPerCrawl: 1,
        requestHandlerTimeoutSecs: 15,
        async requestHandler({ $ }) {
          const title = $("title").text().trim();
          pass("Crawl succeeded", `example.com title: "${title}"`);
          scraped = true;
        },
        async failedRequestHandler({ request }) {
          fail("Crawl failed", request.url);
        },
      },
      config,
    );
    await crawler.run(["https://trivx.in"]);
    if (!scraped) fail("No content retrieved", "Page returned empty or failed");
    results.push({ name: "Crawlee", ok: scraped });
  } catch (e: any) {
    fail("Crawlee error", e.message);
    results.push({ name: "Crawlee", ok: false });
  }
}

async function main() {
  console.log(`\n${BOLD}━━━ Pre-flight Connection Tests ━━━${RESET}`);
  console.log(DIM + `JobAutomation API — ${new Date().toLocaleString()}` + RESET);

  await checkEnv();
  await checkPostgres();
  await checkRedis();
  await checkSMTP();
  await checkHuggingFace();
  await checkCrawlee();

  // Summary
  console.log(`\n${BOLD}━━━ Summary ━━━${RESET}`);
  for (const r of results) {
    if (r.ok) pass(r.name);
    else fail(r.name);
  }

  const failed = results.filter((r) => !r.ok);

  console.log();
  if (failed.length === 0) {
    console.log(`${GREEN}${BOLD}All required services are ready. You can start the server.${RESET}\n`);
    process.exit(0);
  } else {
    console.log(`${RED}${BOLD}${failed.length} required service(s) failed. Fix them before starting the server.${RESET}\n`);
    process.exit(1);
  }
}

main();
