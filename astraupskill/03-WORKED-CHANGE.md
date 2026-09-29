# 03 - Worked change: from enrollment to completion

Consider a published course whose current version is `version-1`. Its `completionRuleJson` is:

```json
{
  "requireAllLessons": true,
  "requiredLessonIds": ["lesson-1"],
  "requiredQuizIds": ["quiz-1"],
  "minimumQuizScore": 80,
  "requiredAssignmentIds": ["assignment-1"],
  "requireAssignmentsGraded": true
}
```

The enrollment handler first scopes the course and then verifies the pointer:

```ts
const course = await prisma.course.findFirst({
  where: { id: String(request.params.courseId), organizationId, status: "PUBLISHED" }
});
const version = course?.currentVersionId
  ? await prisma.courseVersion.findFirst({
      where: { id: course.currentVersionId, courseId: course.id, status: "PUBLISHED" }
    })
  : null;
```

After that check, the create, lesson seeding, and event are one callback:

```ts
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

For completion, `completionRuleFor` preserves explicit arrays and derives only when a broad flag requires it. The domain helper then checks each required ID against the learner's materialized rows. A learner with `lesson-1` completed, a passed `quiz-1` at 90, and a graded `assignment-1` satisfies the rule. A learner with the same lesson but no quiz row does not; there is no fallback that treats an absent attempt as passing.

The parser also treats stored configuration as input that needs validation. A rule must be an object; boolean fields must actually be boolean; `minimumQuizScore` must be finite and between 0 and 100; and every explicit ID must be nonempty, unique, and present in the enrolled version's lesson, quiz, or assignment relation. An invalid persisted rule produces an internal configuration error before the completion transaction opens. This prevents invalid supported field values from becoming an empty requirement set and keeps IDs from another version out of the predicate. Unknown configuration keys are still ignored; authoring-side validation must catch misspelled field names.

The final transaction updates `Enrollment.status` and `completedAt`, creates a certificate when `completionPercent === 100`, writes an audit record, and records `enrollment.completed`. The existing certificate is returned on a later call:

```ts
if (enrollment.status === "COMPLETED") {
  response.json({ certificate: enrollment.certificate, enrollment });
  return;
}
```

This change is deliberately small at the integration boundary. `recordDomainEvent` and `auditLog` accept an optional `Prisma.TransactionClient`, so other callers can retain their existing default while learner writes pass `tx`. The code does not promise that an outbox worker has delivered anything, nor does the certificate verification code become a global collision service. Those are separate operational concerns.

## Why the error check is narrow

`catch (error) { if ((error as { code?: string }).code === "P2002") ... }` accepted any object with a `code` property, which is duck typing across a trust boundary: a bug that throws `{ code: "P2002" }` from an unrelated helper would be reported to the user as "already enrolled". The route now checks `error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"`, and the test constructs a real `PrismaClientKnownRequestError`. The principle: when you map an error to a status code, match the error's *type* and its code, not the shape of a property.

