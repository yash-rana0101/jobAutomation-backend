import { Queue } from "bullmq";
import { getRedisUrl } from "../src/queues/connection";

const QUEUE_NAMES = ["crawl-company", "analyze-company", "generate-resume", "send-email"];

async function main() {
  const redisOpts = { connection: { url: getRedisUrl() } };
  for (const name of QUEUE_NAMES) {
    const q = new Queue(name, redisOpts);
    await q.obliterate({ force: true });
    await q.close();
    console.log(`Cleared queue: ${name}`);
  }
  console.log("All queues drained.");
  process.exit(0);
}

main();
