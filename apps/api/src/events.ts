import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";

export async function recordDomainEvent(
  input: { organizationId?: string | undefined; type: string; payload: unknown },
  client: Prisma.TransactionClient = prisma
) {
  const event = await client.domainEvent.create({
    data: {
      organizationId: input.organizationId,
      payload: input.payload ?? {},
      type: input.type
    }
  });

  await client.outboxMessage.create({
    data: {
      domainEventId: event.id,
      payload: {
        eventId: event.id,
        payload: (input.payload ?? {}) as Prisma.InputJsonValue,
        type: input.type
      }
    }
  });

  return event;
}
