import { Router } from "express";
import { asyncHandler } from "../http.js";
import { prisma } from "../prisma.js";

export const platformRouter = Router();

platformRouter.get(
  "/health",
  asyncHandler(async (_request, response) => {
    await prisma.$queryRaw`SELECT 1`;
    response.json({
      checks: {
        database: "ok"
      },
      status: "ok",
      timestamp: new Date().toISOString()
    });
  })
);

platformRouter.get(
  "/openapi-summary",
  (_request, response) => {
    response.json({
      description: "Lightweight API contract summary for the LMS learning project.",
      resources: [
        "auth",
        "catalog",
        "authoring",
        "learner dashboard",
        "quiz attempts",
        "assignment submissions",
        "certificates",
        "reporting",
        "admin operations"
      ],
      version: "0.1.0"
    });
  }
);
