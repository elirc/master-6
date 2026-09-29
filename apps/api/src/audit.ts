import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";

export async function auditLog(input: {
  organizationId: string;
  actorUserId?: string | undefined;
  action: string;
  targetType: string;
  targetId?: string | undefined;
  metadata?: unknown;
}, client: Prisma.TransactionClient = prisma) {
  await client.auditLog.create({
    data: {
      action: input.action,
      actorUserId: input.actorUserId,
      metadata: input.metadata ?? {},
      organizationId: input.organizationId,
      targetId: input.targetId,
      targetType: input.targetType
    }
  });
}
