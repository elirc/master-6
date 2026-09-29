import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { Worker } from "bullmq";
import { connection } from "./queues.js";

const prisma = new PrismaClient();

const certificateWorker = new Worker(
  "certificate-generation",
  async (job) => {
    const { certificateId } = job.data as { certificateId: string };
    await prisma.certificate.update({
      data: {
        artifactUrl: `/generated/certificates/${certificateId}.pdf`
      },
      where: { id: certificateId }
    });
  },
  { connection }
);

const notificationWorker = new Worker(
  "notification-delivery",
  async (job) => {
    const { notificationId } = job.data as { notificationId: string };
    await prisma.notification.update({
      data: {
        sentAt: new Date(),
        status: "SENT"
      },
      where: { id: notificationId }
    });
  },
  { connection }
);

const videoWorker = new Worker(
  "video-processing",
  async (job) => {
    const { videoAssetId } = job.data as { videoAssetId: string };
    await prisma.videoAsset.update({
      data: {
        durationSeconds: 420,
        status: "READY"
      },
      where: { id: videoAssetId }
    });
  },
  { connection }
);

const outboxWorker = new Worker(
  "outbox-dispatch",
  async () => {
    const messages = await prisma.outboxMessage.findMany({
      orderBy: { availableAt: "asc" },
      take: 25,
      where: { status: "PENDING" }
    });

    for (const message of messages) {
      await prisma.outboxMessage.update({
        data: {
          attempts: { increment: 1 },
          processedAt: new Date(),
          status: "SENT"
        },
        where: { id: message.id }
      });
    }
  },
  { connection }
);

for (const worker of [certificateWorker, notificationWorker, videoWorker, outboxWorker]) {
  worker.on("failed", (job, error) => {
    console.error(`Worker job failed: ${job?.name ?? "unknown"}`, error);
  });
}

console.log("LMS worker process started");
