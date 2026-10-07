# 01 - Codebase map

Start with the learner router at [`../apps/api/src/routes/learner.routes.ts`](../apps/api/src/routes/learner.routes.ts). `learnerRouter` installs `requireAuth` once, then each handler calls `organizationFor`. That helper reads `x-organization-id` and checks the authenticated user's `memberships`. A missing header, an unknown organization, or a membership outside the actor's identity produces `HttpError(403)`. This is the first boundary; a route should not query learner data before it has an organization scope.

The enrollment route is `POST /courses/:courseId/enroll`. It finds a `PUBLISHED` course in the selected organization, then finds the course's `currentVersionId` with both the matching `courseId` and `status: "PUBLISHED"`. The transaction creates `Enrollment`, materializes `LessonProgress` rows for that version's lessons, and records `enrollment.created` through the event helper. The unique constraint is translated from Prisma error code `P2002` to HTTP 409. The important join is `Enrollment.courseVersionId`; the latest published row is not inferred later.

The three learner work routes are `POST /lessons/:lessonId/progress`, `POST /quizzes/:quizId/attempts`, and `POST /assignments/:assignmentId/submissions`. Each first scopes `Enrollment` by `id`, `userId`, and `organizationId`. It then proves the lesson, quiz, or assignment belongs to `enrollment.courseVersionId`. Progress updates and submissions run with their event in one transaction. Quiz attempt counting and creation run in the same transaction as `quiz.attempted`; this keeps the max-attempt check beside the write, although the mock suite cannot simulate database concurrency.

The completion route loads the enrollment with `courseVersion` relations, including modules and lessons, quizzes, assignments, progress, attempts, submissions, and certificate. `completionRuleFor` parses that version's `completionRuleJson` and fills omitted required IDs from the enrolled version only. [`packages/domain/src/completion.ts`](../packages/domain/src/completion.ts) evaluates the resulting `CompletionRule`. If complete, one transaction updates the enrollment, creates a certificate when lesson completion is 100 percent, writes `AuditLog`, and records `enrollment.completed` plus an `OutboxMessage` through [`events.ts`](../apps/api/src/events.ts). A completed enrollment returns its existing certificate and skips all new side effects.

The schema source is [`../apps/api/prisma/schema.prisma`](../apps/api/prisma/schema.prisma). Its relations explain why the route includes `courseVersion`, why progress is keyed by enrollment and lesson, and why `Certificate.enrollmentId` is unique. The domain tests at [`../packages/domain/src/domain.test.ts`](../packages/domain/src/domain.test.ts) are the small, database-free contract for required IDs, empty assessment sets, percentages, and certificate eligibility. Read the map alongside the schema before changing a handler; most bugs here are an incorrect scope or an accidental query against the current draft.

All route paths in this chapter are relative to learnerRouter. The actual app mounts it at /learner in apps/api/src/app.ts, so the HTTP enrollment path is POST /learner/courses/:courseId/enroll. Production requireAuth verifies a bearer JWT and loads current memberships from Prisma; the route test replaces that middleware. The organization header selects a tenant within those memberships and is not itself authentication.

## Line index for `learner.routes.ts`

| lines | what |
|---|---|
| 15-21 | `organizationFor`: header must match a loaded membership, else 403 |
| 23-58 | `GET /dashboard`: enrollments scoped by `organizationId` + `userId` |
| 60-105 | enroll: published course + published current version, one transaction, P2002 to 409 (line 101) |
| 107-146 | lesson progress: scoped enrollment, lesson under enrolled version, timestamp rules at 125-126 |
| 148-209 | quiz attempt: version check at 166, count + create + event in one transaction (170-205) |
| 211-253 | assignment submission: version-scoped lookup at 219, upsert at 222-242 |
| 255-332 | completion: scoped `findUnique` (260-270), replay guard (275-278), rule + checks (280-290), transaction (299-328) |
| 334-384 | `completionRuleFor`: validates stored JSON, derives omitted ID lists from the enrolled version |

## The four workspaces, and what to ignore for now

| workspace | owns | files this course touches |
|---|---|---|
| `packages/domain` | pure rules: `isCourseComplete`, requirement lists, status transitions | `src/completion.ts` and its tests |
| `apps/api` | Express routes, Prisma, transactions, events | `src/routes/learner.routes.ts`, `src/events.ts`, `src/routes/learner.routes.test.ts` |
| `apps/web` | the Next.js UI | none: ignore for now |
| `apps/worker` | BullMQ workers, including a placeholder outbox dispatcher (no tests) | none: read chapter 2's outbox section only |

Terms used before they are defined elsewhere: **IDOR** (insecure direct object reference: a request names an id it should not be allowed to touch; the three-scope guard organization/user/version is the defense); **transaction client** (`tx` inside `prisma.$transaction(async (tx) => ...)`: every write that must commit together goes through it, not through `prisma`); **outbox** (a row written in the same transaction as the change, delivered later by a worker); **P2002** (Prisma's unique-constraint violation code, mapped to 409 in the enroll route).

