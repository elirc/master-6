import { Router } from "express";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { buildTranscriptSummary } from "@lms/domain";
import { auditLog } from "../audit.js";
import { recordDomainEvent } from "../events.js";
import { asyncHandler, HttpError, type AuthedRequest } from "../http.js";
import { requireAuth, requireOrganizationRole } from "../middleware/auth.js";
import { prisma } from "../prisma.js";

export const adminRouter = Router();

adminRouter.use(requireAuth);

adminRouter.get(
  "/dashboard",
  requireOrganizationRole(["INSTRUCTOR", "ORG_ADMIN", "ADMIN"]),
  asyncHandler(async (request, response) => {
    const organizationId = String(request.headers["x-organization-id"] ?? "");
    const [users, courses, enrollments, completed, certificates, submissions, auditLogs] = await Promise.all([
      prisma.membership.count({ where: { organizationId } }),
      prisma.course.count({ where: { organizationId } }),
      prisma.enrollment.count({ where: { organizationId } }),
      prisma.enrollment.count({ where: { organizationId, status: "COMPLETED" } }),
      prisma.certificate.count({ where: { enrollment: { organizationId }, status: "ISSUED" } }),
      prisma.assignmentSubmission.findMany({
        include: { assignment: true, user: true },
        orderBy: { submittedAt: "desc" },
        take: 8,
        where: { enrollment: { organizationId }, status: "SUBMITTED" }
      }),
      prisma.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
        where: { organizationId }
      })
    ]);

    response.json({
      dashboard: {
        auditLogs,
        certificateCount: certificates,
        completionRate: enrollments === 0 ? 0 : Math.round((completed / enrollments) * 100),
        courseCount: courses,
        enrollmentCount: enrollments,
        pendingSubmissions: submissions,
        userCount: users
      }
    });
  })
);

adminRouter.get(
  "/organization-report",
  requireOrganizationRole(["ORG_ADMIN", "ADMIN"]),
  asyncHandler(async (request, response) => {
    const organizationId = String(request.headers["x-organization-id"] ?? "");
    const courses = await prisma.course.findMany({
      include: {
        enrollments: {
          include: {
            certificate: true,
            lessonProgress: true
          }
        }
      },
      where: { organizationId }
    });

    const report = courses.map((course) => {
      const completed = course.enrollments.filter((enrollment) => enrollment.status === "COMPLETED").length;
      return {
        certificates: course.enrollments.filter((enrollment) => enrollment.certificate).length,
        completionRate: course.enrollments.length === 0 ? 0 : Math.round((completed / course.enrollments.length) * 100),
        enrollments: course.enrollments.length,
        id: course.id,
        title: course.title
      };
    });

    response.json({ report });
  })
);

adminRouter.post(
  "/submissions/:submissionId/grade",
  requireOrganizationRole(["INSTRUCTOR", "ORG_ADMIN", "ADMIN"]),
  asyncHandler(async (request, response) => {
    const input = z.object({ feedback: z.string().optional(), score: z.number().int().min(0).max(100) }).parse(request.body);
    const submission = await prisma.assignmentSubmission.update({
      data: {
        feedback: input.feedback,
        gradedAt: new Date(),
        gradedById: (request as AuthedRequest).user!.id,
        score: input.score,
        status: "GRADED"
      },
      where: { id: String(request.params.submissionId) }
    });

    response.json({ submission });
  })
);

adminRouter.post(
  "/bulk-import",
  requireOrganizationRole(["ORG_ADMIN", "ADMIN"]),
  asyncHandler(async (request, response) => {
    const input = z
      .object({
        learners: z.array(z.object({ email: z.string().email(), name: z.string().min(1) }))
      })
      .parse(request.body);
    const organizationId = String(request.headers["x-organization-id"] ?? "");
    const passwordHash = await bcrypt.hash("Password123!", 10);

    const imported = [];
    for (const learner of input.learners) {
      const user = await prisma.user.upsert({
        create: {
          email: learner.email,
          memberships: { create: { organizationId, role: "LEARNER" } },
          name: learner.name,
          passwordHash
        },
        update: { name: learner.name },
        where: { email: learner.email }
      });
      imported.push(user);
    }

    await auditLog({
      action: "learners.bulk_imported",
      actorUserId: (request as AuthedRequest).user!.id,
      metadata: { count: imported.length },
      organizationId,
      targetType: "User"
    });

    response.status(201).json({ imported });
  })
);

adminRouter.post(
  "/exports",
  requireOrganizationRole(["ORG_ADMIN", "ADMIN"]),
  asyncHandler(async (request, response) => {
    const input = z.object({ type: z.enum(["enrollments", "completions", "certificates"]) }).parse(request.body);
    const organizationId = String(request.headers["x-organization-id"] ?? "");
    const csvExport = await prisma.csvExport.create({
      data: {
        organizationId,
        requestedById: (request as AuthedRequest).user!.id,
        status: "QUEUED",
        type: input.type
      }
    });

    await recordDomainEvent({
      organizationId,
      payload: { csvExportId: csvExport.id, type: input.type },
      type: "csv_export.requested"
    });

    response.status(202).json({ csvExport });
  })
);

adminRouter.post(
  "/feature-flags",
  requireOrganizationRole(["ORG_ADMIN", "ADMIN"]),
  asyncHandler(async (request, response) => {
    const input = z
      .object({
        enabled: z.boolean(),
        key: z.string().min(2),
        rolloutPercent: z.number().int().min(0).max(100).optional()
      })
      .parse(request.body);
    const organizationId = String(request.headers["x-organization-id"] ?? "");

    const flag = await prisma.featureFlag.upsert({
      create: { ...input, organizationId },
      update: input,
      where: { organizationId_key: { key: input.key, organizationId } }
    });

    response.json({ flag });
  })
);

adminRouter.post(
  "/impersonation",
  requireOrganizationRole(["ORG_ADMIN", "ADMIN"]),
  asyncHandler(async (request, response) => {
    const input = z.object({ reason: z.string().min(5), targetUserId: z.string() }).parse(request.body);
    const session = await prisma.impersonationSession.create({
      data: {
        actorUserId: (request as AuthedRequest).user!.id,
        reason: input.reason,
        targetUserId: input.targetUserId
      }
    });
    response.status(201).json({ session });
  })
);

adminRouter.get(
  "/learners/:learnerId/transcript",
  requireOrganizationRole(["INSTRUCTOR", "ORG_ADMIN", "ADMIN"]),
  asyncHandler(async (request, response) => {
    const enrollments = await prisma.enrollment.findMany({
      include: { certificate: true, course: true, lessonProgress: true },
      where: { userId: String(request.params.learnerId) }
    });

    const courses = enrollments.map((enrollment) => ({
      certificateCode: enrollment.certificate?.verificationCode,
      completionPercent:
        enrollment.lessonProgress.length === 0
          ? 0
          : Math.round(
              (enrollment.lessonProgress.filter((progress) => progress.status === "COMPLETED").length /
                enrollment.lessonProgress.length) *
                100
            ),
      courseId: enrollment.courseId,
      status: enrollment.status,
      title: enrollment.course.title
    }));

    response.json({ courses, summary: buildTranscriptSummary(courses) });
  })
);

adminRouter.get(
  "/audit-logs",
  requireOrganizationRole(["ORG_ADMIN", "ADMIN"]),
  asyncHandler(async (request, response) => {
    const organizationId = String(request.headers["x-organization-id"] ?? "");
    const auditLogs = await prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      where: { organizationId }
    });
    response.json({ auditLogs });
  })
);

adminRouter.post(
  "/api-keys",
  requireOrganizationRole(["ORG_ADMIN", "ADMIN"]),
  asyncHandler(async (request, response) => {
    const input = z.object({ name: z.string().min(2) }).parse(request.body);
    const organizationId = String(request.headers["x-organization-id"] ?? "");
    const rawKey = `lms_${randomUUID().replaceAll("-", "")}`;
    const apiKey = await prisma.apiKey.create({
      data: {
        hashedKey: await bcrypt.hash(rawKey, 10),
        name: input.name,
        organizationId,
        prefix: rawKey.slice(0, 8)
      }
    });

    response.status(201).json({ apiKey: { ...apiKey, hashedKey: undefined }, rawKey });
  })
);

adminRouter.use((_request, _response, next) => {
  next(new HttpError(404, "Admin route not found"));
});
