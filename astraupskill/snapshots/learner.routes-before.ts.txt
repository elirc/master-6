import { Router } from "express";
import { z } from "zod";
import { calculateLessonCompletionPercent, canIssueCertificate, scoreQuiz, selectRandomizedQuestionIds } from "@lms/domain";
import { auditLog } from "../audit.js";
import { recordDomainEvent } from "../events.js";
import { asyncHandler, HttpError, type AuthedRequest } from "../http.js";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../prisma.js";

export const learnerRouter = Router();

learnerRouter.use(requireAuth);

learnerRouter.get(
  "/dashboard",
  asyncHandler(async (request, response) => {
    const authed = request as AuthedRequest;
    const organizationId = String(request.headers["x-organization-id"] ?? "");
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
    const organizationId = String(request.headers["x-organization-id"] ?? "");
    const course = await prisma.course.findUnique({
      include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
      where: { id: String(request.params.courseId) }
    });

    const version = course?.versions[0];
    if (!course || !version) {
      throw new HttpError(404, "Published course version not found");
    }

    const enrollment = await prisma.enrollment.create({
      data: {
        courseId: course.id,
        courseVersionId: version.id,
        dueAt: addDays(21),
        organizationId,
        userId: authed.user!.id
      }
    });

    const lessons = await prisma.lesson.findMany({
      where: { module: { courseVersionId: version.id } }
    });

    await prisma.lessonProgress.createMany({
      data: lessons.map((lesson) => ({
        enrollmentId: enrollment.id,
        lessonId: lesson.id
      }))
    });

    await recordDomainEvent({
      organizationId,
      payload: { courseId: course.id, enrollmentId: enrollment.id, userId: authed.user!.id },
      type: "enrollment.created"
    });

    response.status(201).json({ enrollment });
  })
);

learnerRouter.post(
  "/lessons/:lessonId/progress",
  asyncHandler(async (request, response) => {
    const input = z.object({ enrollmentId: z.string(), status: z.enum(["IN_PROGRESS", "COMPLETED"]) }).parse(request.body);
    const progress = await prisma.lessonProgress.update({
      data: {
        completedAt: input.status === "COMPLETED" ? new Date() : undefined,
        startedAt: new Date(),
        status: input.status
      },
      where: {
        enrollmentId_lessonId: {
          enrollmentId: input.enrollmentId,
          lessonId: String(request.params.lessonId)
        }
      }
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

    const quiz = await prisma.quiz.findUnique({
      include: { questions: { include: { options: true } } },
      where: { id: String(request.params.quizId) }
    });
    if (!quiz) {
      throw new HttpError(404, "Quiz not found");
    }

    const attemptCount = await prisma.quizAttempt.count({
      where: { enrollmentId: input.enrollmentId, quizId: quiz.id }
    });
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
    const attempt = await prisma.quizAttempt.create({
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

    response.status(201).json({ attempt });
  })
);

learnerRouter.post(
  "/assignments/:assignmentId/submissions",
  asyncHandler(async (request, response) => {
    const authed = request as AuthedRequest;
    const input = z.object({ content: z.string().min(1), enrollmentId: z.string() }).parse(request.body);
    const submission = await prisma.assignmentSubmission.upsert({
      create: {
        assignmentId: String(request.params.assignmentId),
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
          assignmentId: String(request.params.assignmentId),
          enrollmentId: input.enrollmentId
        }
      }
    });

    response.status(201).json({ submission });
  })
);

learnerRouter.post(
  "/enrollments/:enrollmentId/complete",
  asyncHandler(async (request, response) => {
    const enrollment = await prisma.enrollment.findUnique({
      include: {
        course: true,
        lessonProgress: true,
        quizAttempts: true,
        submissions: true
      },
      where: { id: String(request.params.enrollmentId) }
    });
    if (!enrollment) {
      throw new HttpError(404, "Enrollment not found");
    }

    const completionPercent = calculateLessonCompletionPercent(
      enrollment.lessonProgress.map((progress) => ({ lessonId: progress.lessonId, status: progress.status }))
    );
    const requiredQuizPassed = enrollment.quizAttempts.some((attempt) => attempt.passed);
    const requiredAssignmentsComplete = enrollment.submissions.every((submission) => submission.status === "GRADED");

    const completedEnrollment = await prisma.enrollment.update({
      data: {
        completedAt: new Date(),
        status: "COMPLETED"
      },
      where: { id: enrollment.id }
    });

    let certificate = null;
    if (
      canIssueCertificate({
        completionPercent,
        enrollmentStatus: "COMPLETED",
        requiredAssignmentsComplete,
        requiredQuizPassed
      })
    ) {
      certificate = await prisma.certificate.create({
        data: {
          artifactUrl: `/certificates/${enrollment.id}.pdf`,
          courseId: enrollment.courseId,
          courseVersionId: enrollment.courseVersionId,
          enrollmentId: enrollment.id,
          userId: enrollment.userId,
          verificationCode: `CERT-${enrollment.id.slice(-8).toUpperCase()}`
        }
      });
    }

    await auditLog({
      action: "enrollment.completed",
      actorUserId: (request as AuthedRequest).user!.id,
      metadata: { certificateId: certificate?.id },
      organizationId: enrollment.organizationId,
      targetId: enrollment.id,
      targetType: "Enrollment"
    });

    response.json({ certificate, enrollment: completedEnrollment });
  })
);

function addDays(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}
