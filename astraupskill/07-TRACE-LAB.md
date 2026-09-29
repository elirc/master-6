# 07 - Trace lab

Use these identifiers while reading the trace: actor `learner-1`, organization `org-1`, course `course-1`, published current version `version-1`, enrollment `enrollment-1`, lesson `lesson-1`, quiz `quiz-1`, and assignment `assignment-1`. The actor has a membership for `org-1`, and the request sends `x-organization-id: org-1`.

**1. Enrollment.** `POST /courses/course-1/enroll` calls `organizationFor`, then `course.findFirst` with `course-1`, `org-1`, and `PUBLISHED`. It reads `course.currentVersionId`, then `courseVersion.findFirst` with `id: version-1`, the same course ID, and `PUBLISHED`. The transaction creates the enrollment with `courseVersionId: version-1`, finds lessons through `module.courseVersionId`, seeds one `LessonProgress`, creates `DomainEvent` type `enrollment.created`, and creates its outbox row. A later draft cannot rewrite this enrollment.

**2. Progress.** `POST /lessons/lesson-1/progress` with `{ "enrollmentId": "enrollment-1", "status": "COMPLETED" }` scopes the enrollment, finds lesson-1 under version-1, then opens a transaction. It reads the composite progress key, sets `startedAt` if necessary, sets `completedAt`, updates status, and records `lesson.progressed` through the same transaction client. The response contains the updated progress.

**3. Assessment writes.** A quiz attempt first proves quiz-1 belongs to version-1. Inside its transaction it counts attempts for the enrollment and quiz, selects deterministic question IDs when configured, scores answers, creates `QuizAttempt`, and records `quiz.attempted`. An assignment submission similarly proves `assignment-1` belongs to version-1, upserts by `assignmentId_enrollmentId`, and records `assignment.submitted`. These events describe writes; they do not themselves complete the course.

**4. Completion.** The completion query loads version relations plus learner rows. `completionRuleFor` reads `completionRuleJson`. With all three required IDs present, `isCourseComplete` needs completed lesson-1, a passed quiz-1 at least 80, and a `GRADED` assignment-1. The route calculates lesson percentage, then one transaction updates the enrollment to `COMPLETED`, sets `completedAt`, creates the certificate, writes `AuditLog` action `enrollment.completed`, and writes the domain event and outbox row.

**5. Replay.** The next completion request loads the same completed enrollment and certificate. It returns before the completion transaction. This gives a caller the same certificate identity and avoids duplicate side effects. The trace does not imply that two concurrent first requests are serialized by the mock; that property belongs to database constraints and transaction behavior.

To extend the lab, change only one fact at a time: remove the quiz attempt, change the quiz to `version-2`, use `org-2`, or set the enrollment status to `COMPLETED`. Predict the first failing boundary before running the corresponding test. Compare the result with the thirteen learner route cases in [`../apps/api/src/routes/learner.routes.test.ts`](../apps/api/src/routes/learner.routes.test.ts).

These are router-relative paths. Prefix /learner when sending a real HTTP request through createApp. The trace is a worked sequence, while the recorded fixture tests the individual request boundaries using controlled records; it does not run a database-backed learner journey or execute a real quiz-to-submission-to-certificate flow. A COMPLETED terminal fixture proves guard behavior, with stable stored certificate identity rather than identical relation-rich response shape.

## Step 1, in the route that runs it

`apps/api/src/routes/learner.routes.ts:61` is the enrollment step of the trace. Both lookups are scoped and `PUBLISHED`-filtered before the transaction opens, and the version id is written onto the enrollment row so a later draft cannot rewrite it.

```ts
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
```

