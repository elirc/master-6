import "dotenv/config";
import { Queue } from "bullmq";
import { Redis } from "ioredis";

export const connection = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null
});

export const certificateQueue = new Queue("certificate-generation", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { delay: 10_000, type: "exponential" },
    removeOnComplete: 100,
    removeOnFail: 500
  }
});

export const notificationQueue = new Queue("notification-delivery", {
  connection,
  defaultJobOptions: {
    attempts: 5,
    backoff: { delay: 30_000, type: "exponential" }
  }
});

export const videoQueue = new Queue("video-processing", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { delay: 15_000, type: "exponential" }
  }
});

export const outboxQueue = new Queue("outbox-dispatch", {
  connection,
  defaultJobOptions: {
    attempts: 5,
    backoff: { delay: 5_000, type: "exponential" }
  }
});
