# 06 - Solutions and review

Line numbers refer to `apps/api/src/routes/learner.routes.ts` unless another
file is named.

## Answers

**Exercise 1.** `organizationFor` (lines 15-21) runs first in every handler.
It reads `x-organization-id` and checks it against `request.user.memberships`;
a missing header or a non-member organization throws
`HttpError(403, "Learner is not a member of this organization")`. The header
*selects* a tenant among memberships loaded by `requireAuth`; it is not
authentication.

**Exercise 2.** Neither. The course query (line 66) succeeds, but the version
query (line 70) requires `id: course.currentVersionId`, the same `courseId`
and `status: "PUBLISHED"`; the draft pointer yields
`404 "Published course version not found"` (line 73). New learners only ever
attach to the published current version.

**Exercise 3.** `quiz.courseVersionId !== enrollment.courseVersionId`
(line 166) throws **404** `"Quiz not found"` before the transaction, so
`quizAttempt.create` is never called. The lesson (line 116) and assignment
(line 220) routes scope the lookup itself by `courseVersionId` and also
answer 404. All three deliberately use 404, not 403: the response does not
reveal whether the content exists in another version.

**Exercise 4.** `false`, `false` then `true`, and `false`. In
`packages/domain/src/completion.ts` line 34 every candidate attempt must have
`attempt.passed` *and* (line 35) a score at or above `minimumQuizScore`.
`[].some(...)` is `false`, so an absent attempt can never satisfy a required
ID.

**Exercise 5.** The explicit `[]` makes `every` vacuously true; the omitted
list falls to line 43, which needs at least one submission. The route never
sends that second shape unchanged: `completionRuleFor` (line 380) derives the
enrolled version's assignment IDs whenever `requireAssignmentsGraded === true`
and the list is omitted. The legacy `requireAllLessons` path (line 28) needs
`lessonProgress.length > 0`.

**Exercise 6.** It completes; percent is 50; `canIssueCertificate` is false
because it requires exactly 100. The transaction still writes the enrollment
update, the `enrollment.completed` audit row, and the domain event plus
outbox row, with `certificateId: undefined` in their payloads.

**Exercise 7.** `IN_PROGRESS`: `startedAt` kept (`current.startedAt ?? now`,
line 126), `completedAt` set to `null` (line 125). `COMPLETED` again:
`completedAt` is null, so it becomes the new `now`; the first completion
time is lost. Nothing checks whether the *enrollment* is already
`COMPLETED`.

**Exercise 8.** Same seed, same selection, so attempt 1 always gets the same
questions. A request that failed (for example, its transaction rolled back)
did not create a `QuizAttempt`, so `attemptCount` is unchanged and the retry
reuses the seed: the learner sees the same question set rather than
"rerolling" by forcing errors. `scoreQuiz` ignores answers to questions outside
the scored set and sorts option IDs before comparing.

**Exercise 9.** See Finding 2 for the change.

**Exercise 10.** See Finding 1.

**Exercise 11.** The mocks cannot prove rollback, unique-constraint behavior
under concurrency, generated SQL, or outbox delivery. Commands:
`npm run test --workspace @lms/api` and `npm run test --workspace @lms/domain`
(after `npm ci` and `npm run db:generate`).

## Senior review findings

These were found by reading the code at this commit; none is fixed or covered
by the current suites.

**Finding 1 - Resubmission silently un-grades work.** The upsert's `update`
branch (lines 231-235) sets `content`, `status: "SUBMITTED"` and
`submittedAt` unconditionally. A `GRADED` submission with `score: 92` becomes
`SUBMITTED` while keeping `score`, `feedback`, `gradedAt` and `gradedById`
(schema `AssignmentSubmission`, lines 324-342), a contradictory row. None of
the learner work routes (progress, attempts, submissions) reads
`enrollment.status`, so this also works after the course is `COMPLETED`, and
on `DROPPED`/`EXPIRED` enrollments, which no route in `apps/api/src` refers
to. Fix: refuse resubmission when `status` is `GRADED` (or make the upsert's
`where` conditional), and require `enrollment.status === "ACTIVE"` before any
learner write.

**Finding 2 - Concurrent first completions.** The terminal guard is a
pre-read (line 275); the transaction's `enrollment.update` (lines 300-303)
has no status predicate. Two simultaneous first requests both pass the guard.
If a certificate is issued, `Certificate.enrollmentId @unique` (schema line
346) makes the loser fail with Prisma `P2002`, which no handler maps, so
`errorHandler` (`apps/api/src/http.ts` lines 41-44) returns **500 with the
raw Prisma message**. If no certificate is issued, both commit: two audit
rows, two `enrollment.completed` events and outbox messages, and an
overwritten `completedAt` (Exercise 9 models both). Smallest fix: inside the
transaction use
`tx.enrollment.updateMany({ where: { id, status: { not: "COMPLETED" } }, data })`
and, when `count === 0`, return the replay result before writing anything
else. On PostgreSQL the second update waits for the first row lock and then
re-checks the predicate.

**Finding 3 - Cross-tenant catalog read leaks answer keys and password
hashes.** `GET /catalog/courses/:courseId` (`apps/api/src/routes/catalog.routes.ts`
lines 72-102) requires only authentication; it looks the course up by `id`
alone, without an organization filter or membership check. It returns every version
(drafts included), quiz options with `isCorrect` (line 86; schema line 271),
and discussion posts with `author: true` (line 82). `author: true` returns all
`User` scalars, including `email` and `passwordHash` (schema lines 85-90).
Course IDs are easy to get: the list route (lines 20-29) trusts
`x-organization-id` without checking membership and accepts
`?status=DRAFT`. Fix: scope by a verified membership, filter versions to
`PUBLISHED` for learners, and use `select` for `author` and options.

**Finding 4 - Cross-tenant writes in authoring and grading.**
`requireOrganizationRole` checks the role *in the header's organization*, but
the targets are fetched by bare id: `POST /authoring/courses/:courseId/versions`
(`authoring.routes.ts` lines 62-67), `POST /authoring/versions/:versionId/publish`
(lines 133-154, which also repoints `course.currentVersionId`), and
`POST /admin/submissions/:submissionId/grade` (`admin.routes.ts` lines
86-104). An instructor in organization A who learns an ID from organization B
can publish B's draft or grade B's learners. Fix: add `organizationId` (via
`course`) to every `where`, and use `updateMany`/`findFirst` + count so a
foreign ID becomes 404.

**Finding 5 - Retake limit holds, but the loser gets a 500.** The count and
create (lines 171-198) run inside an interactive transaction at PostgreSQL's
default READ COMMITTED isolation, so two concurrent attempts can both read
`attemptCount = n` and both try to create `attemptNumber: n + 1`. The
`@@unique([quizId, enrollmentId, attemptNumber])` (schema line 291) stops the
second one, so `maxAttempts` cannot be exceeded, but the unmapped `P2002`
reaches the user as a 500. Map it to `409 "Quiz retake limit reached"`, or
retry once.

**Finding 6 - Verification code is derived, not secret.** `verificationCode`
is `CERT-` plus the last 8 characters of the enrollment ID (line 311). The
public `GET /certificates/verify/:code` (`certificate.routes.ts` lines 7-32,
no auth) returns learner name and course title. Anyone who sees an enrollment
ID can compute the code. The ID appears in event payloads, URLs and
`artifactUrl` (line 306). Two IDs with the same tail also collide on the
unique code (schema line 351), which aborts a legitimate completion with a
500. Generate an independent random code and retry on collision.

**Finding 7 - The outbox worker does not deliver anything.**
`apps/worker/src/worker.ts` lines 52-73 reads 25 `PENDING` rows and marks each
`SENT`. It publishes nothing and takes no lease or `FOR UPDATE SKIP LOCKED`,
so two workers process the same rows. "Durable side effect" here means "durably
recorded". Nothing is delivered.

**Finding 8 - Operational defaults.** `config.jwtSecret` falls back to
`"development-only-secret"` (`apps/api/src/config.ts` line 5) with no
production guard, so a deployment missing `JWT_SECRET` accepts tokens anyone
can forge. `errorHandler` echoes any `Error.message` with a 500
(`http.ts` lines 41-44), which is how Findings 2 and 5 leak Prisma text.

## The route suite, case by case

`apps/api/src/routes/learner.routes.test.ts` has **15** cases today. The
captured evidence from 2026-09-13 counted 13, because two cases were added
afterwards. Read the file itself rather than a copy.

| # | case | asserts |
|---|---|---|
| 1 | completes required lesson, quiz, assignment | 200, 1 transaction/certificate/audit/event, helpers received `tx` |
| 2 | stable completed result | existing certificate, 0 transactions/events |
| 3 | foreign actor and organization | 404 on progress, attempts, complete; 0 transactions |
| 4 | IDs from another version | 404 for lesson, quiz, assignment |
| 5-7 | absent assessment rows / quiz / assignment | 409, 0 transactions |
| 8 | legacy all-lessons with no progress | 409 |
| 9 | malformed stored rule (`minimumQuizScore: 101`) | 500 before any transaction |
| 10 | progress timestamps | `startedAt` preserved, `completedAt` set |
| 11 | explicitly empty assessments | 200 |
| 12 | enroll against current published version | 201, exact `courseVersion.findFirst` args, 1 event |
| 13 | duplicate enrollment | a real `PrismaClientKnownRequestError` P2002 maps to 409 |
| 14 | look-alike `{ code: "P2002" }` | not mapped to 409 |
| 15 | commit fails after writes | the error surfaces; no 201 |
