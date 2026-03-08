import IORedis from "ioredis";

let connection: IORedis | null = null;

export function getRedisConnection(): IORedis {
  if (!connection) {
    connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
      maxRetriesPerRequest: null, // required by BullMQ
    });
  }
  return connection;
}

/** Return the raw URL string — use when BullMQ ioredis types don't match top-level ioredis */
export function getRedisUrl(): string {
  return process.env.REDIS_URL || "redis://localhost:6379";
}
