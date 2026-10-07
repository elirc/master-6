# Code reading drill: Master 6 LMS

Six drills sized for a 45-minute screen share. Read the excerpt out loud, say what it does, then open the answer. Excerpts are copied from this repository; paths are relative to the project root.

## Drill 1: explain this function

`packages/domain/src/completion.ts:18-28`

```ts
export function isCourseComplete(input: {
  rule: CompletionRule;
  lessonProgress: LessonProgressSummary[];
  quizAttempts: QuizAttemptSummary[];
  assignmentSubmissions: AssignmentSubmissionSummary[];
}): boolean {
  const requiredLessons = input.rule.requiredLessonIds;
  const lessonRequirementMet = requiredLessons !== undefined
    ? requiredLessons.every((id) =>
        input.lessonProgress.some((lesson) => lesson.lessonId === id && lesson.status === "COMPLETED"))
    : !input.rule.requireAllLessons || (input.lessonProgress.length > 0 && input.lessonProgress.every((lesson) => lesson.status === "COMPLETED"));
```

Say what the two branches mean, and what an empty array does that `undefined` does not.

<details>
<summary>Answer</summary>

The function is pure: no Prisma import, no dates read from the clock, plain summary objects in and a boolean out. That is why it lives in `@lms/domain` and carries 15 of the 31 tests.

The lesson check is a named-ids branch and a blanket branch. When `requiredLessonIds` is present, every named id must have a `COMPLETED` progress row; ids are matched by value, so a lesson with no row at all fails. When it is `undefined`, the rule falls back to `requireAllLessons`: if that is false the requirement is vacuous, and if it is true then progress must be non-empty and every row `COMPLETED`.

`[]` and `undefined` are genuinely different. `[].every(...)` is `true`, so an explicitly empty array is a deliberate "no lessons required" and completion passes. `undefined` routes to the `requireAllLessons` branch instead. The `input.lessonProgress.length > 0` guard exists so a legacy rule with `requireAllLessons: true` and zero progress rows does not complete by vacuous truth; `apps/api/src/routes/learner.routes.test.ts:124` is the test that pins it, and `:153` covers the explicitly-empty case passing.
</details>

## Drill 2: spot the bug

The excerpt below is a mutated copy of the enroll handler in `apps/api/src/routes/learner.routes.ts:65-74`. One thing is wrong.

```ts
const course = await prisma.course.findFirst({
  where: { id: String(request.params.courseId), organizationId, status: "PUBLISHED" }
});

const version = course?.currentVersionId
  ? await prisma.courseVersion.findFirst({ where: { id: course.currentVersionId } })
  : null;
if (!course || !version) {
  throw new HttpError(404, "Published course version not found");
}
```

<details>
<summary>Answer</summary>

The mutation dropped `courseId: course.id` and `status: "PUBLISHED"` from the version lookup. Real line 70 is:

```ts
? await prisma.courseVersion.findFirst({ where: { id: course.currentVersionId, courseId: course.id, status: "PUBLISHED" } })
```

Two failures follow. Without `status: "PUBLISHED"` a course whose `currentVersionId` still points at a draft or archived version can be enrolled into, so learners attach to content the author has not released, and the completion rule they are graded by is a rule that was never published. Without `courseId` the version is not proven to belong to the course that was just scoped to the organization, so the organization filter on the course no longer constrains the version. The test at `apps/api/src/routes/learner.routes.test.ts:172` asserts the exact `where` object, so this mutation fails the suite rather than slipping through.
</details>

## Drill 3: predict the status code

The enrollment `enrollment-1` is already `COMPLETED` and has a certificate. The client sends a second request:

```
POST /api/learner/enrollments/enrollment-1/complete
Authorization: Bearer <valid learner token>
x-organization-id: org-1
```

What status comes back, what is in the body, how many rows are written, and what would happen if the branch at `apps/api/src/routes/learner.routes.ts:275` did not exist?

<details>
<summary>Answer</summary>

200, not 201 and not 409. The handler loads the enrollment with its relation graph (line 260), sees `enrollment.status === "COMPLETED"` at line 275, and returns `{ certificate, enrollment }` with a plain `response.json` at line 276. Zero rows are written: no transaction is opened, no certificate created, no audit row, no domain event. `apps/api/src/routes/learner.routes.test.ts:68` asserts exactly that, down to `transaction` being 0.

Remove line 275 and the second call falls through to the transaction at line 299 and calls `tx.certificate.create` for an enrollment that already has one. `Certificate.enrollmentId` is unique in `apps/api/prisma/schema.prisma`, so Prisma throws P2002. The complete handler has no catch (the only P2002 catch is in the enroll handler at line 101), so `asyncHandler` forwards it and `errorHandler` at `apps/api/src/http.ts:41` answers 500 with the raw Prisma message. The `verificationCode` at line 311 would collide too, since it is derived from the enrollment id rather than random.
</details>

## Drill 4: predict the output

Given this stored rule on the enrolled version and this learner state, does `POST /enrollments/:id/complete` return 200 or 409?

```json
{ "requireAllLessons": true, "requiredQuizIds": [], "requiredAssignmentIds": [] }
```

Learner has zero `lessonProgress` rows, zero quiz attempts, zero submissions.

<details>
<summary>Answer</summary>

409, "Completion requirements are not met" (`apps/api/src/routes/learner.routes.ts:290`).

Walk it: `completionRuleFor` sees `requiredLessonIds` absent, so line 378 defaults it to every lesson in the version only because `requireAllLessons` is true. If the version has lessons, those ids are required and there are no `COMPLETED` rows, so the check fails. If the version has no lessons at all the default is an empty array and the lesson branch passes, which is why the `length > 0` guard on the other branch matters more than it looks. `requiredQuizIds: []` and `requiredAssignmentIds: []` are explicit empties, so those two requirements are vacuously satisfied.

Nothing is written: the throw happens before the transaction at line 299. `apps/api/src/routes/learner.routes.test.ts:124` is the regression, asserting both the 409 and `calls.transaction` being 0.
</details>

## Drill 5: review this diff

A teammate proposes this change to the quiz attempt handler. Find the defects.

```diff
   const attempt = await prisma.$transaction(async (tx) => {
-    const attemptCount = await tx.quizAttempt.count({ where: { enrollmentId: input.enrollmentId, quizId: quiz.id } });
+    const attemptCount = await prisma.quizAttempt.count({ where: { enrollmentId: input.enrollmentId } });
     if (quiz.maxAttempts !== null && attemptCount >= quiz.maxAttempts) {
       throw new HttpError(409, "Quiz retake limit reached");
     }
     ...
     const created = await tx.quizAttempt.create({ data: { ... attemptNumber: attemptCount + 1, ... } });
-    await recordDomainEvent({ ... }, tx);
+    await recordDomainEvent({ ... });
     return created;
   });
```

<details>
<summary>Answer</summary>

Three defects.

1. The count switched from `tx` to the global `prisma` client. It now reads outside the transaction, which is a different connection and a different snapshot. Real code is `apps/api/src/routes/learner.routes.ts:171`.
2. The `where` lost `quizId: quiz.id`, so the count is every attempt on the enrollment across every quiz. A learner who passed three other quizzes is now refused their first attempt at this one, and `attemptNumber` becomes a number that has nothing to do with this quiz.
3. `recordDomainEvent` lost its second argument. `apps/api/src/events.ts:6` declares `client: Prisma.TransactionClient = prisma`, so dropping `tx` silently writes the `domainEvent` and `outboxMessage` rows on the global client. The event then survives a rollback of the attempt, which is the exact failure the outbox is supposed to prevent. Nothing in the type system catches this; `apps/api/src/routes/learner.routes.test.ts:64` catches the same mistake in the complete handler by asserting the second argument is the transaction client.

What the diff does not fix is the real problem in this code: the count-then-insert is read-then-write, and at read-committed isolation two concurrent attempts can both pass the `maxAttempts` check. The unique constraint on `(quizId, enrollmentId, attemptNumber)` (`apps/api/prisma/schema.prisma:291`) already rejects the second insert; what is missing is mapping that P2002 to a 409 rather than a 500, not a rearrangement of the read.
</details>

## Drill 6: explain this function

`apps/api/src/events.ts:4-28`, condensed.

```ts
export async function recordDomainEvent(
  input: { organizationId?: string | undefined; type: string; payload: unknown },
  client: Prisma.TransactionClient = prisma
) {
  const event = await client.domainEvent.create({ data: { organizationId: input.organizationId, payload: input.payload ?? {}, type: input.type } });
  await client.outboxMessage.create({ data: { domainEventId: event.id, payload: { eventId: event.id, payload: (input.payload ?? {}), type: input.type } } });
  return event;
}
```

Why two rows rather than one, and why is the client a parameter?

<details>
<summary>Answer</summary>

Two rows because they answer different questions. `domainEvent` is the historical record of what happened, queryable forever. `outboxMessage` is the delivery job: a worker leases it, publishes, and marks it done, so the row is transient state about a send. Keeping them separate means replaying deliveries does not rewrite history and pruning the outbox does not erase the audit trail.

The client parameter with a `prisma` default is what makes the write joinable. Callers inside a unit of work pass `tx` (`learner.routes.ts:95`, `:140`, `:203`, `:247`, `:326`), so the event commits with the business row and nothing is published before commit. Callers outside get the global client for free. The same shape is used by `auditLog` in `apps/api/src/audit.ts`.

The honest addition: this is an outbox, so delivery is at-least-once. The consumer in `@lms/worker` has to deduplicate on `domainEventId`, and that workspace currently has no test files, so nothing here proves delivery happens at all.
</details>
