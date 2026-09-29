# 06 - Solutions and review

**Exercise 0:** `organizationFor` runs first. It checks the selected header against `request.user.memberships` and throws `HttpError(403, "Learner is not a member of this organization")`. A handler uses the caller-selected organization only after that membership check passes.

**Exercise 1:** Enrollment uses neither version. The course query succeeds, but the version query requires the current pointer and `status: "PUBLISHED"`; a draft pointer produces `HttpError(404, "Published course version not found")`. This protects the promise that new learners begin on the course's published current version.

**Exercise 2:** The quiz query returns an object whose `courseVersionId` is `version-2`, then `quiz.courseVersionId !== enrollment.courseVersionId` is true. The route throws 404 before opening its transaction, so `quizAttempt.create` is never called. The lesson and assignment routes use analogous version checks.

**Exercise 3:** `isCourseComplete` returns false. `requiredQuizIds.every(...)` asks for a passing attempt for `quiz-1`; `[].some(...)` is false. The route does not infer a pass from enrollment or from the absence of a failed attempt.

**Exercise 4:** It returns true. Both assessment arrays are explicitly empty, so their `every` predicates have no required IDs. The lesson requirement still requires `lesson-1`; `requireAssignmentsGraded` does not manufacture an assignment ID when `requiredAssignmentIds` is present and empty. This is the documented zero-assessment configuration.

**Exercise 5:** `startedAt` remains unchanged. The update uses `current.startedAt ?? now`; it sets `completedAt` to null for `IN_PROGRESS`. A later `COMPLETED` write uses a fresh time only when `completedAt` is still null.

**Exercise 6:** The transaction client must receive `enrollment.update`, conditional `certificate.create`, `auditLog(..., tx)`, and `recordDomainEvent(..., tx)`. The event helper then uses that client for both `DomainEvent.create` and `OutboxMessage.create`. If a helper silently uses global `prisma`, a later rollback could leave an audit or event behind.

**Exercise 7:** The route returns HTTP 200 and the same `certificate-1`. The fixture observes zero new transaction, certificate, audit, or event calls. This is a stable replay contract, not a distributed idempotency guarantee for two simultaneous requests.

**Exercise 8:** The mock suite cannot prove transaction rollback, database uniqueness under races, generated SQL, or eventual outbox delivery. The actual route tests are in [`../apps/api/src/routes/learner.routes.test.ts`](../apps/api/src/routes/learner.routes.test.ts). From the project root, run `npm run test --workspace @lms/api -- --run src/routes/learner.routes.test.ts` and `npm run test --workspace @lms/domain`.

Review outcome: the implementation now has explicit ownership and version guards, required-set evaluation, transaction-aware event and audit helpers, and stable completion replay. The remaining review questions are operational: certificate verification-code uniqueness is not a global service here, and no worker or live database is part of this bounded change. Those limitations should stay visible in a pull request rather than being hidden by broad test names.

The parser tests are deliberately route-level because malformed `completionRuleJson` is stored data reaching an API boundary. The suite covers an out-of-range score and asserts 500 with no completion transaction. A stronger future database test could exercise malformed JSON loaded from a real row, but it should preserve the same before-write guarantee.

## Implement-it exercise answers

**9.** The guard is one `findFirst` with `where: { id, organizationId, userId }` before any write; a quiz check compares `quiz.courseVersionId` with `enrollment.courseVersionId`. 404 for the first two (do not reveal existence), 403 for the version mismatch (the enrollment exists and is yours, but the content is not part of it).

**10.** Inside `prisma.$transaction`: `enrollment.update` with a `WHERE status <> "WITHDRAWN"` guard (Prisma: `updateMany` and check `count`), `lessonProgress.deleteMany({ where: { enrollmentId, status: "NOT_STARTED" } })`, then `recordDomainEvent(..., tx)`. A `count` of 0 means already withdrawn: throw `HttpError(409)` inside the callback so nothing else runs.

**11.** The failing assertion is `expect(isCourseComplete(rule, emptyProgress)).toBe(false)`; the fix distinguishes "no requirements" (nothing to complete, so not complete) from "all requirements met". Keep the existing tests green: they cover the populated cases.

## Replay and remaining behavior

The terminal test starts from an already-completed fixture. It proves the guard returns its existing certificate and skips new work. The first completion response contains the updated scalar enrollment row, while a later response includes the relations loaded by findUnique. Stable status and certificate identity do not imply byte-identical response bodies. Concurrent first completions can both pass the pre-read guard; database uniqueness may reject one, and no retry/error policy for that race is added here.

Certificate.enrollmentId and verificationCode already have unique constraints. The existing code derives verificationCode from the last eight enrollment-ID characters, so a collision can fail the transaction; uniqueness prevents duplicate codes but does not implement a collision retry. artifactUrl names a PDF without generating it in this command. Existing progress/submission endpoints can still change work after enrollment completion, and completion is not restricted to ACTIVE status. These remain separate lifecycle work. Quiz count-plus-one is not a proven concurrent retake limit. Production JWT verification exists, but the default development secret is unchanged and the existing error middleware can expose unexpected Error.message text; this suite does not validate production identity or error disclosure.

## Complete executed learner fixture

This is the complete current thirteen-case file. Modify the existing file rather than adding a duplicate beside it. The one app-construction test and fifteen domain cases are separate. The actual event/audit helpers are intentionally mocked here; transaction-client argument assertions show the route passes the right object, not that a database committed or rolled back those records.

```ts
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
    testState.prisma.$transaction = vi.fn(async () => { throw { code: "P2002" }; });
    await expect(dispatch("POST", "/courses/course-1/enroll")).rejects.toMatchObject({ status: 409 });
  });
});
```
