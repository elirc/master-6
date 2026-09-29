import { Router } from "express";
import { z } from "zod";
import { auditLog } from "../audit.js";
import { asyncHandler, HttpError, type AuthedRequest } from "../http.js";
import { requireAuth, requireOrganizationRole } from "../middleware/auth.js";
import { prisma } from "../prisma.js";

export const authoringRouter = Router();

authoringRouter.use(requireAuth, requireOrganizationRole(["INSTRUCTOR", "ORG_ADMIN", "ADMIN"]));

const createCourseSchema = z.object({
  slug: z.string().min(3),
  summary: z.string().min(10),
  title: z.string().min(3)
});

authoringRouter.post(
  "/courses",
  asyncHandler(async (request, response) => {
    const input = createCourseSchema.parse(request.body);
    const authed = request as AuthedRequest;
    const organizationId = String(request.headers["x-organization-id"]);

    const course = await prisma.course.create({
      data: {
        createdById: authed.user!.id,
        organizationId,
        slug: input.slug,
        summary: input.summary,
        title: input.title,
        versions: {
          create: {
            completionRuleJson: {
              minimumQuizScore: 80,
              requireAllLessons: true,
              requireAssignmentsGraded: false
            },
            status: "DRAFT",
            summary: input.summary,
            title: input.title,
            versionNumber: 1
          }
        }
      },
      include: { versions: true }
    });

    await auditLog({
      action: "course.created",
      actorUserId: authed.user!.id,
      metadata: { title: input.title },
      organizationId,
      targetId: course.id,
      targetType: "Course"
    });

    response.status(201).json({ course });
  })
);

authoringRouter.post(
  "/courses/:courseId/versions",
  asyncHandler(async (request, response) => {
    const course = await prisma.course.findUnique({
      include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
      where: { id: String(request.params.courseId) }
    });
    if (!course) {
      throw new HttpError(404, "Course not found");
    }

    const latest = course.versions[0];
    const version = await prisma.courseVersion.create({
      data: {
        completionRuleJson: latest?.completionRuleJson ?? {
          minimumQuizScore: 80,
          requireAllLessons: true
        },
        courseId: course.id,
        status: "DRAFT",
        summary: course.summary,
        title: course.title,
        versionNumber: (latest?.versionNumber ?? 0) + 1
      }
    });

    response.status(201).json({ version });
  })
);

authoringRouter.post(
  "/versions/:versionId/modules",
  asyncHandler(async (request, response) => {
    const input = z.object({ position: z.number().int().positive(), title: z.string().min(2) }).parse(request.body);
    const module = await prisma.module.create({
      data: {
        courseVersionId: String(request.params.versionId),
        position: input.position,
        title: input.title
      }
    });
    response.status(201).json({ module });
  })
);

authoringRouter.post(
  "/modules/:moduleId/lessons",
  asyncHandler(async (request, response) => {
    const input = z
      .object({
        content: z.string().min(1),
        durationMinutes: z.number().int().positive().default(15),
        position: z.number().int().positive(),
        title: z.string().min(2)
      })
      .parse(request.body);

    const lesson = await prisma.lesson.create({
      data: {
        content: input.content,
        durationMinutes: input.durationMinutes,
        moduleId: String(request.params.moduleId),
        position: input.position,
        title: input.title
      }
    });

    response.status(201).json({ lesson });
  })
);

authoringRouter.post(
  "/versions/:versionId/publish",
  asyncHandler(async (request, response) => {
    const version = await prisma.courseVersion.update({
      data: {
        publishedAt: new Date(),
        status: "PUBLISHED"
      },
      where: { id: String(request.params.versionId) }
    });

    await prisma.course.update({
      data: {
        currentVersionId: version.id,
        status: "PUBLISHED"
      },
      where: { id: version.courseId }
    });

    response.json({ version });
  })
);
