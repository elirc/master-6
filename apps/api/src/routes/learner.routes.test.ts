import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

const testState = vi.hoisted(() => {
  const calls = { transaction: 0, enrollmentCreate: 0, progressCreate: 0, progressUpdate: 0, attempts: 0, submissions: 0, events: 0, audits: 0, certificates: 0 };
  const actor = { id: "learner-1", email: "learner@example.com", name: "Learner", memberships: [{ organizationId: "org-1", role: "LEARNER" as const }] };
  const version = { id: "version-1", courseId: "course-1", status: "PUBLISHED", completionRuleJson: { requireAllLessons: true, requiredLessonIds: ["lesson-1"], requiredQuizIds: ["quiz-1"], minimumQuizScore: 80, requiredAssignmentIds: ["assignment-1"], requireAssignmentsGraded: true }, modules: [{ lessons: [{ id: "lesson-1" }] }], quizzes: [{ id: "quiz-1" }], assignments: [{ id: "assignment-1" }] };
  const enrollment = { id: "enrollment-1", userId: actor.id, organizationId: "org-1", courseId: "course-1", courseVersionId: version.id, status: "ACTIVE", course: { id: "course-1", title: "Course" }, courseVersion: version, certificate: null, lessonProgress: [{ lessonId: "lesson-1", status: "COMPLETED" }], quizAttempts: [{ quizId: "quiz-1", score: 90, passed: true, submittedAt: new Date() }], submissions: [{ assignmentId: "assignment-1", status: "GRADED", score: 100, submittedAt: new Date() }] };
  const prisma = { enrollment: {}, course: {}, courseVersion: {}, lesson: {}, lessonProgress: {}, quiz: {}, quizAttempt: {}, assignment: {}, assignmentSubmission: {}, certificate: {}, auditLog: {}, domainEvent: {}, outboxMessage: {}, $transaction: async () => undefined } as Record<string, any>;
  const tx = new Proxy(prisma, { get: (target, property) => target[property as keyof typeof target] });
  const reset = () => { for (const key of Object.keys(calls) as Array<keyof typeof calls>) calls[key] = 0; recordDomainEvent.mockClear(); auditLog.mockClear(); Object.assign(prisma, { enrollment: {}, course: {}, courseVersion: {}, lesson: {}, lessonProgress: {}, quiz: {}, quizAttempt: {}, assignment: {}, assignmentSubmission: {}, certificate: {}, auditLog: {}, domainEvent: {}, outboxMessage: {} }); };
  const recordDomainEvent = vi.fn(async () => { calls.events++; return { id: "event-1" }; });
  const auditLog = vi.fn(async () => { calls.audits++; });
  return { actor, version, enrollment, prisma, tx, calls, reset, recordDomainEvent, auditLog };
});

vi.mock("../prisma.js", () => ({ prisma: testState.prisma }));
vi.mock("../events.js", () => ({ recordDomainEvent: testState.recordDomainEvent }));
vi.mock("../audit.js", () => ({ auditLog: testState.auditLog }));
vi.mock("../middleware/auth.js", () => ({ requireAuth: (request: any, _response: any, next: any) => { request.user = testState.actor; next(); } }));

import { learnerRouter } from "./learner.routes.js";

function response(onJson: () => void) {
  const value: any = { statusCode: 200, body: undefined };
  value.status = (code: number) => { value.statusCode = code; return value; };
  value.json = (body: unknown) => { value.body = body; onJson(); return value; };
  return value;
}

async function dispatch(method: string, url: string, body: unknown = {}, headers: Record<string, string> = { "x-organization-id": "org-1" }) {
  const req: any = { method, url, originalUrl: url, headers, body, query: {}, params: {}, user: undefined };
  let error: unknown;
  let finish!: () => void;
  const done = new Promise<void>((resolve) => { finish = resolve; });
  const res = response(finish);
  (learnerRouter as any).handle(req, res, (nextError: unknown) => { error = nextError; finish(); });
  await done;
  if (error) throw error;
  return res;
}

function setupEnrollment(overrides: Record<string, unknown> = {}) {
  const enrollment = { ...testState.enrollment, ...overrides };
  testState.prisma.enrollment.findFirst = vi.fn(async ({ where }: any) => enrollment.userId === where.userId && enrollment.organizationId === where.organizationId ? enrollment : null);
  testState.prisma.enrollment.findUnique = vi.fn(async ({ where }: any) => enrollment.id === where.id && enrollment.userId === where.userId && enrollment.organizationId === where.organizationId ? enrollment : null);
  testState.prisma.enrollment.update = vi.fn(async ({ data }: any) => ({ ...enrollment, ...data }));
  testState.prisma.$transaction = vi.fn(async (callback: any) => { testState.calls.transaction++; return callback(testState.tx); });
  return enrollment;
}

describe("learner route ownership and completion", () => {
  it("allows an enrolled learner to complete required lesson, quiz, and assignment work", async () => {
    testState.reset();
    setupEnrollment();
    testState.prisma.certificate.create = vi.fn(async ({ data }: any) => { testState.calls.certificates++; return { id: "certificate-1", ...data }; });
    const result = await dispatch("POST", "/enrollments/enrollment-1/complete");
    expect(result.statusCode).toBe(200);
    expect(result.body.certificate.id).toBe("certificate-1");
    expect(testState.calls.transaction).toBe(1);
    expect(testState.calls.certificates).toBe(1);
    expect(testState.calls.audits).toBe(1);
    expect(testState.calls.events).toBe(1);
    expect((testState.recordDomainEvent as any).mock.calls[0][1]).toBe(testState.tx);
    expect((testState.auditLog as any).mock.calls[0][1]).toBe(testState.tx);
  });

  it("returns a stable completed result without another certificate or event", async () => {
    testState.reset();
    const certificate = { id: "certificate-1", verificationCode: "CERT-1" };
    setupEnrollment({ status: "COMPLETED", certificate });
    const result = await dispatch("POST", "/enrollments/enrollment-1/complete");
    expect(result.statusCode).toBe(200);
    expect(result.body.certificate).toEqual(certificate);
    expect(testState.calls.transaction).toBe(0);
    expect(testState.calls.certificates).toBe(0);
    expect(testState.calls.events).toBe(0);
  });

  it("blocks foreign actor and organization enrollment writes", async () => {
    testState.reset();
    setupEnrollment({ userId: "other-user" });
    await expect(dispatch("POST", "/lessons/lesson-1/progress", { enrollmentId: "enrollment-1", status: "COMPLETED" })).rejects.toMatchObject({ status: 404 });
    testState.reset();
    setupEnrollment({ organizationId: "org-2" });
    await expect(dispatch("POST", "/quizzes/quiz-1/attempts", { enrollmentId: "enrollment-1", answers: [] })).rejects.toMatchObject({ status: 404 });
    await expect(dispatch("POST", "/enrollments/enrollment-1/complete")).rejects.toMatchObject({ status: 404 });
    expect(testState.calls.transaction).toBe(0);
  });

  it("blocks lesson, quiz, and assignment IDs from another enrolled version", async () => {
    testState.reset();
    setupEnrollment();
    testState.prisma.lesson.findFirst = vi.fn(async () => null);
    await expect(dispatch("POST", "/lessons/foreign/progress", { enrollmentId: "enrollment-1", status: "IN_PROGRESS" })).rejects.toMatchObject({ status: 404 });
    testState.prisma.quiz.findUnique = vi.fn(async () => ({ id: "quiz-foreign", courseVersionId: "version-foreign", questions: [] }));
    await expect(dispatch("POST", "/quizzes/quiz-foreign/attempts", { enrollmentId: "enrollment-1", answers: [] })).rejects.toMatchObject({ status: 404 });
    testState.prisma.assignment.findFirst = vi.fn(async () => null);
    await expect(dispatch("POST", "/assignments/assignment-foreign/submissions", { enrollmentId: "enrollment-1", content: "work" })).rejects.toMatchObject({ status: 404 });
    expect(testState.calls.transaction).toBe(0);
  });

  it("does not complete when a required assessment row is absent", async () => {
    testState.reset();
    setupEnrollment({ quizAttempts: [], submissions: [] });
    await expect(dispatch("POST", "/enrollments/enrollment-1/complete")).rejects.toMatchObject({ status: 409 });
    expect(testState.calls.transaction).toBe(0);
  });

  it("does not complete when the required quiz attempt is absent", async () => {
    testState.reset();
    setupEnrollment({ quizAttempts: [], submissions: testState.enrollment.submissions });
    await expect(dispatch("POST", "/enrollments/enrollment-1/complete")).rejects.toMatchObject({ status: 409 });
    expect(testState.calls.transaction).toBe(0);
  });

  it("does not complete when the required assignment submission is absent", async () => {
    testState.reset();
    setupEnrollment({ quizAttempts: testState.enrollment.quizAttempts, submissions: [] });
    await expect(dispatch("POST", "/enrollments/enrollment-1/complete")).rejects.toMatchObject({ status: 409 });
    expect(testState.calls.transaction).toBe(0);
  });

  it("rejects legacy all-lessons rules with no progress rows", async () => {
    testState.reset();
    const version = { ...testState.version, completionRuleJson: { requireAllLessons: true, requiredQuizIds: [], requiredAssignmentIds: [] } };
    setupEnrollment({ courseVersion: version, lessonProgress: [], quizAttempts: [], submissions: [] });
    await expect(dispatch("POST", "/enrollments/enrollment-1/complete")).rejects.toMatchObject({ status: 409 });
    expect(testState.calls.transaction).toBe(0);
  });

  it("rejects malformed stored completion rules before completion writes", async () => {
    testState.reset();
    const version = { ...testState.version, completionRuleJson: { minimumQuizScore: 101 } };
    setupEnrollment({ courseVersion: version });
    await expect(dispatch("POST", "/enrollments/enrollment-1/complete")).rejects.toMatchObject({ status: 500 });
    expect(testState.calls.transaction).toBe(0);
  });

  it("sets progress timestamps without replacing an existing start", async () => {
    testState.reset();
    setupEnrollment();
    const startedAt = new Date("2026-01-01T00:00:00.000Z");
    testState.prisma.lesson.findFirst = vi.fn(async () => ({ id: "lesson-1" }));
    testState.prisma.lessonProgress.findUnique = vi.fn(async () => ({ enrollmentId: "enrollment-1", lessonId: "lesson-1", startedAt, completedAt: null }));
    testState.prisma.lessonProgress.update = vi.fn(async ({ data }: any) => ({ ...data }));
    const result = await dispatch("POST", "/lessons/lesson-1/progress", { enrollmentId: "enrollment-1", status: "COMPLETED" });
    expect(result.statusCode).toBe(200);
    expect(testState.prisma.lessonProgress.update.mock.calls[0][0].data.startedAt).toBe(startedAt);
    expect(testState.prisma.lessonProgress.update.mock.calls[0][0].data.completedAt).toBeInstanceOf(Date);
  });

  it("allows a published version with explicitly empty assessment requirements", async () => {
    testState.reset();
    const version = { ...testState.version, completionRuleJson: { requireAllLessons: true, requiredLessonIds: ["lesson-1"], requiredQuizIds: [], requiredAssignmentIds: [], requireAssignmentsGraded: true }, quizzes: [], assignments: [] };
    setupEnrollment({ courseVersion: version, quizAttempts: [], submissions: [] });
    testState.prisma.certificate.create = vi.fn(async ({ data }: any) => ({ id: "certificate-1", ...data }));
    const result = await dispatch("POST", "/enrollments/enrollment-1/complete");
    expect(result.statusCode).toBe(200);
  });

  it("enrolls only against the course current published version", async () => {
    testState.reset();
    testState.prisma.course.findFirst = vi.fn(async () => ({ id: "course-1", organizationId: "org-1", status: "PUBLISHED", currentVersionId: "version-1" }));
    testState.prisma.courseVersion.findFirst = vi.fn(async ({ where }: any) => where.id === "version-1" ? testState.version : null);
    testState.prisma.$transaction = vi.fn(async (callback: any) => { testState.calls.transaction++; return callback(testState.prisma); });
    testState.prisma.enrollment.create = vi.fn(async () => { testState.calls.enrollmentCreate++; return { ...testState.enrollment }; });
    testState.prisma.lesson.findMany = vi.fn(async () => [{ id: "lesson-1" }]);
    testState.prisma.lessonProgress.createMany = vi.fn(async () => { testState.calls.progressCreate++; });
    const result = await dispatch("POST", "/courses/course-1/enroll");
    expect(result.statusCode).toBe(201);
    expect(testState.prisma.courseVersion.findFirst).toHaveBeenCalledWith({ where: { id: "version-1", courseId: "course-1", status: "PUBLISHED" } });
    expect(testState.calls.transaction).toBe(1);
    expect(testState.calls.events).toBe(1);
  });

  it("maps a duplicate enrollment transaction to conflict", async () => {
    testState.reset();
    testState.prisma.course.findFirst = vi.fn(async () => ({ id: "course-1", organizationId: "org-1", status: "PUBLISHED", currentVersionId: "version-1" }));
    testState.prisma.courseVersion.findFirst = vi.fn(async () => testState.version);
    testState.prisma.$transaction = vi.fn(async () => {
      throw new Prisma.PrismaClientKnownRequestError("duplicate", { code: "P2002", clientVersion: "test" });
    });
    await expect(dispatch("POST", "/courses/course-1/enroll")).rejects.toMatchObject({ status: 409 });
  });

  it("does not map a look-alike error object to conflict", async () => {
    testState.reset();
    testState.prisma.course.findFirst = vi.fn(async () => ({ id: "course-1", organizationId: "org-1", status: "PUBLISHED", currentVersionId: "version-1" }));
    testState.prisma.courseVersion.findFirst = vi.fn(async () => testState.version);
    testState.prisma.$transaction = vi.fn(async () => { throw { code: "P2002" }; });
    await expect(dispatch("POST", "/courses/course-1/enroll")).rejects.not.toMatchObject({ status: 409 });
  });

  it("surfaces a transaction that fails after its writes, and the client is told nothing succeeded", async () => {
    testState.reset();
    testState.prisma.course.findFirst = vi.fn(async () => ({ id: "course-1", organizationId: "org-1", status: "PUBLISHED", currentVersionId: "version-1" }));
    testState.prisma.courseVersion.findFirst = vi.fn(async () => testState.version);
    testState.prisma.enrollment.create = vi.fn(async () => { testState.calls.enrollmentCreate++; return { ...testState.enrollment }; });
    testState.prisma.lesson.findMany = vi.fn(async () => [{ id: "lesson-1" }]);
    testState.prisma.lessonProgress.createMany = vi.fn(async () => { testState.calls.progressCreate++; });
    // The callback runs (writes are issued on the transaction client) and then the commit fails.
    testState.prisma.$transaction = vi.fn(async (callback: any) => { await callback(testState.tx); throw new Error("commit failed"); });
    await expect(dispatch("POST", "/courses/course-1/enroll")).rejects.toThrow("commit failed");
    // A mock cannot roll anything back; what this proves is only that the route does not answer 201.
    // The integration test in 04-TESTING-AND-DEBUGGING.md is what proves the rows are absent.
  });
});
