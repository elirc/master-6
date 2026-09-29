import { Router } from "express";
import { z } from "zod";
import { asyncHandler, HttpError } from "../http.js";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../prisma.js";

export const catalogRouter = Router();

catalogRouter.use(requireAuth);

const catalogQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(50).default(10),
  q: z.string().optional(),
  status: z.enum(["DRAFT", "IN_REVIEW", "PUBLISHED", "ARCHIVED"]).optional()
});

catalogRouter.get(
  "/courses",
  asyncHandler(async (request, response) => {
    const query = catalogQuerySchema.parse(request.query);
    const organizationId = String(request.headers["x-organization-id"] ?? "");
    if (!organizationId) {
      throw new HttpError(400, "x-organization-id header is required");
    }

    const where = {
      organizationId,
      status: query.status ?? "PUBLISHED",
      ...(query.q
        ? {
            OR: [
              { title: { contains: query.q, mode: "insensitive" as const } },
              { summary: { contains: query.q, mode: "insensitive" as const } }
            ]
          }
        : {})
    };

    const [courses, total] = await Promise.all([
      prisma.course.findMany({
        include: {
          versions: {
            include: {
              modules: { include: { lessons: true } },
              quizzes: true,
              assignments: true
            },
            orderBy: { versionNumber: "desc" },
            take: 1
          }
        },
        orderBy: { updatedAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        where
      }),
      prisma.course.count({ where })
    ]);

    response.json({
      courses,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total
      }
    });
  })
);

catalogRouter.get(
  "/courses/:courseId",
  asyncHandler(async (request, response) => {
    const course = await prisma.course.findUnique({
      include: {
        prerequisites: { include: { prerequisite: true } },
        versions: {
          include: {
            assignments: { include: { rubric: { include: { criteria: true } } } },
            contentPackages: true,
            discussionThreads: { include: { posts: { include: { author: true } } } },
            modules: { include: { lessons: { include: { videoAsset: true } } }, orderBy: { position: "asc" } },
            quizzes: {
              include: {
                questions: { include: { options: true }, orderBy: { position: "asc" } }
              }
            }
          },
          orderBy: { versionNumber: "desc" }
        }
      },
      where: { id: String(request.params.courseId) }
    });

    if (!course) {
      throw new HttpError(404, "Course not found");
    }

    response.json({ course });
  })
);
