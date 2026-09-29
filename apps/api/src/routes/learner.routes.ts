import { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { calculateLessonCompletionPercent, canIssueCertificate, isCourseComplete, scoreQuiz, selectRandomizedQuestionIds, type CompletionRule } from "@lms/domain";
import { auditLog } from "../audit.js";
import { recordDomainEvent } from "../events.js";
import { asyncHandler, HttpError, type AuthedRequest } from "../http.js";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../prisma.js";

export const learnerRouter = Router();

learnerRouter.use(requireAuth);

function organizationFor(request: AuthedRequest): string {
  const organizationId = String(request.headers["x-organization-id"] ?? "");
  if (!organizationId || !request.user?.memberships.some((membership) => membership.organizationId === organizationId)) {
    throw new HttpError(403, "Learner is not a member of this organization");
  }
  return organizationId;
}

learnerRouter.get(
  "/dashboard",
  asyncHandler(async (request, response) => {
    const authed = request as AuthedRequest;
    const organizationId = organizationFor(authed);
    const enrollments = await prisma.enrollment.findMany({
      include: {
        certificate: true,
        course: true,
        courseVersion: { include: { assignments: true, modules: { include: { lessons: true } }, quizzes: true } },
        lessonProgress: true,
        quizAttempts: true,
        submissions: true
      },
      orderBy: { createdAt: "desc" },
      where: {
        organizationId,
        userId: authed.user!.id
      }
    });

    const dashboard = enrollments.map((enrollment) => ({
      certificate: enrollment.certificate,
      course: enrollment.course,
      dueAt: enrollment.dueAt,
      progressPercent: calculateLessonCompletionPercent(
        enrollment.lessonProgress.map((progress) => ({ lessonId: progress.lessonId, status: progress.status }))
      ),
      quizAttempts: enrollment.quizAttempts,
      status: enrollment.status,
      submissions: enrollment.submissions
    }));

    response.json({ dashboard });
  })
);

learnerRouter.post(
  "/courses/:courseId/enroll",
  asyncHandler(async (request, response) => {
    const authed = request as AuthedRequest;
    const organizationId = organizationFor(authed);
    const course = await prisma.course.findFirst({
      where: { id: String(request.params.courseId), organizationId, status: "PUBLISHED" }
    });

    const version = course?.currentVersionId
      ? await prisma.courseVersion.findFirst({ where: { id: course.currentVersionId, courseId: course.id, status: "PUBLISHED" } })
      : null;
    if (!course || !version) {
      throw new HttpError(404, "Published course version not found");
    }

    try {
      const enrollment = await prisma.$transaction(async (tx) => {
        const created = await tx.enrollment.create({
          data: {
            courseId: course.id,
            courseVersionId: version.id,
            dueAt: addDays(21),
            organizationId,
            userId: authed.user!.id
          }
        });
        const lessons = await tx.lesson.findMany({ where: { module: { courseVersionId: version.id } } });
        await tx.lessonProgress.createMany({
          data: lessons.map((lesson) => ({ enrollmentId: created.id, lessonId: lesson.id }))
        });
        await recordDomainEvent({
          organizationId,
          payload: { courseId: course.id, enrollmentId: created.id, userId: authed.user!.id },
          type: "enrollment.created"
        }, tx);
        return created;
      });

      response.status(201).json({ enrollment });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new HttpError(409, "Already enrolled in this course version");
      throw error;
    }
  })
);

learnerRouter.post(
  "/lessons/:lessonId/progress",
  asyncHandler(async (request, response) => {
    const input = z.object({ enrollmentId: z.string(), status: z.enum(["IN_PROGRESS", "COMPLETED"]) }).parse(request.body);
    const authed = request as AuthedRequest;
    const organizationId = organizationFor(authed);
    const enrollment = await prisma.enrollment.findFirst({ where: { id: input.enrollmentId, userId: authed.user!.id, organizationId } });
    if (!enrollment) throw new HttpError(404, "Enrollment not found");
    const lesson = await prisma.lesson.findFirst({ where: { id: String(request.params.lessonId), module: { courseVersionId: enrollment.courseVersionId } } });
    if (!lesson) throw new HttpError(404, "Lesson not found for enrollment version");
    const progress = await prisma.$transaction(async (tx) => {
      const current = await tx.lessonProgress.findUnique({
        where: { enrollmentId_lessonId: { enrollmentId: input.enrollmentId, lessonId: String(request.params.lessonId) } }
      });
      if (!current) throw new HttpError(404, "Lesson progress not found");
      const now = new Date();
      const updated = await tx.lessonProgress.update({
        data: {
          completedAt: input.status === "COMPLETED" ? (current.completedAt ?? now) : null,
          startedAt: current.startedAt ?? now,
          status: input.status
        },
        where: {
          enrollmentId_lessonId: {
            enrollmentId: input.enrollmentId,
            lessonId: String(request.params.lessonId)
          }
        }
      });
      await recordDomainEvent({
        organizationId,
        payload: { enrollmentId: input.enrollmentId, lessonId: String(request.params.lessonId), status: input.status },
        type: "lesson.progressed"
      }, tx);
      return updated;
    });

    response.json({ progress });
  })
);

learnerRouter.post(
  "/quizzes/:quizId/attempts",
  asyncHandler(async (request, response) => {
    const input = z
      .object({
        answers: z.array(z.object({ questionId: z.string(), selectedOptionIds: z.array(z.string()) })),
        enrollmentId: z.string()
      })
      .parse(request.body);
    const authed = request as AuthedRequest;
    const organizationId = organizationFor(authed);
    const enrollment = await prisma.enrollment.findFirst({ where: { id: input.enrollmentId, userId: authed.user!.id, organizationId } });
    if (!enrollment) throw new HttpError(404, "Enrollment not found");

    const quiz = await prisma.quiz.findUnique({
      include: { questions: { include: { options: true } } },
      where: { id: String(request.params.quizId) }
    });
    if (!quiz || quiz.courseVersionId !== enrollment.courseVersionId) {
      throw new HttpError(404, "Quiz not found");
    }

    const attempt = await prisma.$transaction(async (tx) => {
      const attemptCount = await tx.quizAttempt.count({ where: { enrollmentId: input.enrollmentId, quizId: quiz.id } });
      if (quiz.maxAttempts !== null && attemptCount >= quiz.maxAttempts) {
        throw new HttpError(409, "Quiz retake limit reached");
      }
      const questionIds = quiz.questions.map((question) => question.id);
      const orderedIds = quiz.randomizeQuestionOrder
        ? selectRandomizedQuestionIds(questionIds, quiz.questionCount ?? questionIds.length, `${input.enrollmentId}-${attemptCount + 1}`)
        : questionIds;
      const scoringQuestions = quiz.questions
        .filter((question) => orderedIds.includes(question.id))
        .map((question) => ({
          correctOptionIds: question.options.filter((option) => option.isCorrect).map((option) => option.id),
          id: question.id,
          points: question.points
        }));
      const score = scoreQuiz(scoringQuestions, input.answers);
      const created = await tx.quizAttempt.create({
        data: {
          answers: input.answers,
          attemptNumber: attemptCount + 1,
          enrollmentId: input.enrollmentId,
          passed: score.score >= quiz.passingScore,
          questionOrder: orderedIds,
          quizId: quiz.id,
          score: score.score,
          userId: (request as AuthedRequest).user!.id
        }
      });
      await recordDomainEvent({
        organizationId,
        payload: { enrollmentId: input.enrollmentId, quizId: quiz.id, attemptId: created.id },
        type: "quiz.attempted"
      }, tx);
      return created;
    });

    response.status(201).json({ attempt });
  })
);

learnerRouter.post(
  "/assignments/:assignmentId/submissions",
  asyncHandler(async (request, response) => {
    const authed = request as AuthedRequest;
    const input = z.object({ content: z.string().min(1), enrollmentId: z.string() }).parse(request.body);
    const organizationId = organizationFor(authed);
    const enrollment = await prisma.enrollment.findFirst({ where: { id: input.enrollmentId, userId: authed.user!.id, organizationId } });
    if (!enrollment) throw new HttpError(404, "Enrollment not found");
    const assignment = await prisma.assignment.findFirst({ where: { id: String(request.params.assignmentId), courseVersionId: enrollment.courseVersionId } });
    if (!assignment) throw new HttpError(404, "Assignment not found for enrollment version");
    const submission = await prisma.$transaction(async (tx) => {
      const updated = await tx.assignmentSubmission.upsert({
        create: {
          assignmentId: assignment.id,
          content: input.content,
          enrollmentId: input.enrollmentId,
          status: "SUBMITTED",
          submittedAt: new Date(),
          userId: authed.user!.id
        },
        update: {
          content: input.content,
          status: "SUBMITTED",
          submittedAt: new Date()
        },
        where: {
          assignmentId_enrollmentId: {
            assignmentId: assignment.id,
            enrollmentId: input.enrollmentId
          }
        }
      });
      await recordDomainEvent({
        organizationId,
        payload: { enrollmentId: input.enrollmentId, assignmentId: assignment.id, submissionId: updated.id },
        type: "assignment.submitted"
      }, tx);
      return updated;
    });

    response.status(201).json({ submission });
  })
);

learnerRouter.post(
  "/enrollments/:enrollmentId/complete",
  asyncHandler(async (request, response) => {
    const authed = request as AuthedRequest;
    const organizationId = organizationFor(authed);
    const enrollment = await prisma.enrollment.findUnique({
      include: {
        course: true,
        courseVersion: { include: { assignments: true, modules: { include: { lessons: true } }, quizzes: true } },
        certificate: true,
        lessonProgress: true,
        quizAttempts: true,
        submissions: true
      },
      where: { id: String(request.params.enrollmentId), userId: authed.user!.id, organizationId }
    });
    if (!enrollment) {
      throw new HttpError(404, "Enrollment not found");
    }

    if (enrollment.status === "COMPLETED") {
      response.json({ certificate: enrollment.certificate, enrollment });
      return;
    }

    const rule = completionRuleFor(enrollment.courseVersion);
    const completionPercent = calculateLessonCompletionPercent(
      enrollment.lessonProgress.map((progress) => ({ lessonId: progress.lessonId, status: progress.status }))
    );
    const complete = isCourseComplete({
      rule,
      lessonProgress: enrollment.lessonProgress.map((progress) => ({ lessonId: progress.lessonId, status: progress.status })),
      quizAttempts: enrollment.quizAttempts.map((attempt) => ({ quizId: attempt.quizId, score: attempt.score, passed: attempt.passed, submittedAt: attempt.submittedAt })),
      assignmentSubmissions: enrollment.submissions.map((submission) => ({ assignmentId: submission.assignmentId, status: submission.status, score: submission.score ?? undefined, submittedAt: submission.submittedAt ?? undefined }))
    });
    if (!complete) throw new HttpError(409, "Completion requirements are not met");

    const completedAt = new Date();
    const eligibleForCertificate = canIssueCertificate({
      completionPercent,
      enrollmentStatus: "COMPLETED",
      requiredAssignmentsComplete: true,
      requiredQuizPassed: true
    });
    const result = await prisma.$transaction(async (tx) => {
      const completedEnrollment = await tx.enrollment.update({
        data: { completedAt, status: "COMPLETED" },
        where: { id: enrollment.id }
      });
      const certificate = eligibleForCertificate ? await tx.certificate.create({
        data: {
          artifactUrl: `/certificates/${enrollment.id}.pdf`,
          courseId: enrollment.courseId,
          courseVersionId: enrollment.courseVersionId,
          enrollmentId: enrollment.id,
          userId: enrollment.userId,
          verificationCode: `CERT-${enrollment.id.slice(-8).toUpperCase()}`
        }
      }) : null;
      await auditLog({
        action: "enrollment.completed",
        actorUserId: (request as AuthedRequest).user!.id,
        metadata: { certificateId: certificate?.id },
        organizationId: enrollment.organizationId,
        targetId: enrollment.id,
        targetType: "Enrollment"
      }, tx);
      await recordDomainEvent({
        organizationId: enrollment.organizationId,
        payload: { enrollmentId: enrollment.id, certificateId: certificate?.id },
        type: "enrollment.completed"
      }, tx);
      return { certificate, enrollment: completedEnrollment };
    });

    response.json(result);
  })
);

function completionRuleFor(version: {
  completionRuleJson: unknown;
  modules: Array<{ lessons: Array<{ id: string }> }>;
  quizzes: Array<{ id: string }>;
  assignments: Array<{ id: string }>;
}): CompletionRule {
  if (!version.completionRuleJson || typeof version.completionRuleJson !== "object" || Array.isArray(version.completionRuleJson)) {
    throw new HttpError(500, "Invalid completion rule configuration");
  }
  const value = version.completionRuleJson as Record<string, unknown>;
  const lessonIds = new Set(version.modules.flatMap((module) => module.lessons.map((lesson) => lesson.id)));
  const quizIds = new Set(version.quizzes.map((quiz) => quiz.id));
  const assignmentIds = new Set(version.assignments.map((assignment) => assignment.id));
  const parseIds = (field: string, validIds: Set<string>): string[] | undefined => {
    if (!(field in value)) return undefined;
    const raw = value[field];
    if (!Array.isArray(raw) || raw.some((id) => typeof id !== "string" || id.trim().length === 0)) {
      throw new HttpError(500, "Invalid completion rule configuration");
    }
    const ids = raw as string[];
    if (new Set(ids).size !== ids.length || ids.some((id) => !validIds.has(id))) {
      throw new HttpError(500, "Invalid completion rule configuration");
    }
    return ids;
  };
  const parseBoolean = (field: string): boolean | undefined => {
    if (!(field in value)) return undefined;
    if (typeof value[field] !== "boolean") throw new HttpError(500, "Invalid completion rule configuration");
    return value[field] as boolean;
  };
  const requireAllLessons = parseBoolean("requireAllLessons") ?? false;
  const requireAssignmentsGraded = parseBoolean("requireAssignmentsGraded");
  let minimumQuizScore: number | undefined;
  if ("minimumQuizScore" in value) {
    if (typeof value.minimumQuizScore !== "number" || !Number.isFinite(value.minimumQuizScore) || value.minimumQuizScore < 0 || value.minimumQuizScore > 100) {
      throw new HttpError(500, "Invalid completion rule configuration");
    }
    minimumQuizScore = value.minimumQuizScore;
  }
  const requiredLessonIds = parseIds("requiredLessonIds", lessonIds);
  const requiredQuizIds = parseIds("requiredQuizIds", quizIds);
  const requiredAssignmentIds = parseIds("requiredAssignmentIds", assignmentIds);
  return {
    requireAllLessons,
    requiredLessonIds: requiredLessonIds ?? (requireAllLessons ? version.modules.flatMap((module) => module.lessons.map((lesson) => lesson.id)) : undefined),
    requiredQuizIds: requiredQuizIds ?? (minimumQuizScore === undefined ? undefined : version.quizzes.map((quiz) => quiz.id)),
    requiredAssignmentIds: requiredAssignmentIds ?? (requireAssignmentsGraded === true ? version.assignments.map((assignment) => assignment.id) : undefined),
    minimumQuizScore,
    requireAssignmentsGraded
  };
}

function addDays(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}
