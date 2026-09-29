# Flashcards: Master 6 LMS learner slice

Cover the right column. All answers are checkable against the repository.

| Question | Answer |
| --- | --- |
| Which three identities must agree before a learner write? | The JWT user, the organization from `x-organization-id`, and the enrollment's `courseVersionId` |
| Which function reads the tenant header? | `organizationFor` in `apps/api/src/routes/learner.routes.ts:15` |
| Status when the header names an organization you are not a member of | 403, "Learner is not a member of this organization" |
| Status when the enrollment exists but belongs to someone else | 404, because the scoped `findFirst` returns null and the handler cannot tell "missing" from "not yours" |
| The unique constraint on `model Enrollment` | `@@unique([userId, courseVersionId])` |
| What that constraint does not prevent | A second enrollment in a later version of the same course |
| Prisma error code mapped to 409 on enroll | P2002, and only when `error instanceof Prisma.PrismaClientKnownRequestError` |
| The bug that was fixed in that catch | It matched on the error's `code` property alone, so any look-alike object became "Already enrolled" |
| Test that pins the look-alike case | "does not map a look-alike error object to conflict", `apps/api/src/routes/learner.routes.test.ts:187` |
| Two filters on the version lookup besides its id | `courseId: course.id` and `status: "PUBLISHED"` |
| Status returned by a successful enroll | 201 |
| Status returned by a successful complete | 200 |
| Status when completion requirements are unmet | 409, "Completion requirements are not met" |
| Status when the stored completion rule is malformed | 500, "Invalid completion rule configuration" |
| Why 500 and not 400 for a malformed rule | The rule is author-stored data, not input on this request, so it is a server configuration fault |
| Where the replay branch lives | `apps/api/src/routes/learner.routes.ts:275`, `if (enrollment.status === "COMPLETED")` |
| What the replay branch writes | Nothing: no transaction, no certificate, no audit row, no event |
| Four writes inside the completion transaction | Enrollment update, conditional certificate, audit row, domain event (which itself writes two rows) |
| Which two rows `recordDomainEvent` writes | `domainEvent` then `outboxMessage` referencing it |
| Signature detail that makes the event transactional | `client: Prisma.TransactionClient = prisma` at `apps/api/src/events.ts:6`, callers pass `tx` |
| What happens if a caller forgets `tx` | The event commits independently and survives a rollback of the business write; nothing type-checks it |
| The three pure predicates in the domain package | `calculateLessonCompletionPercent`, `isCourseComplete`, `canIssueCertificate` |
| What `canIssueCertificate` requires | `enrollmentStatus === "COMPLETED"`, `completionPercent === 100`, required quiz passed, required assignments complete |
| What `calculateLessonCompletionPercent` returns for zero rows | 0 |
| Difference between `requiredLessonIds: []` and `undefined` | `[]` means no requirement and passes; `undefined` falls through to the `requireAllLessons` branch |
| Why `lessonProgress.length > 0` appears in that branch | So a legacy `requireAllLessons` rule with no progress rows cannot complete by vacuous truth |
| Default applied when `requiredQuizIds` is absent | Every quiz in the version, but only when `minimumQuizScore` is set (`learner.routes.ts:379`) |
| Default applied when `requiredAssignmentIds` is absent | Every assignment, but only when `requireAssignmentsGraded` is exactly `true` (`:380`) |
| Valid range enforced on `minimumQuizScore` | A finite number from 0 to 100 inclusive |
| Submission status required for completion | `GRADED` (`packages/domain/src/completion.ts:42`) |
| Status the submission upsert sets | `SUBMITTED`, on create and on update, so resubmitting reverts a graded assignment |
| Status code the submission route returns on an update | 201, which is arguably wrong; 200 would be more honest |
| Race in the quiz attempt handler | `count` then check then `create` at read-committed isolation lets two attempts exceed `maxAttempts` |
| The fix for that race | Unique constraint on `(enrollmentId, quizId, attemptNumber)`, not more application logic |
| How the certificate verification code is built | `` `CERT-${enrollment.id.slice(-8).toUpperCase()}` `` at `learner.routes.ts:311` |
| Two problems with that code | It is derivable from the enrollment id, and there is no collision retry behind its unique constraint |
| What `errorHandler` returns for a non-`HttpError` `Error` | 500 with `error.message` (`apps/api/src/http.ts:41-43`) |
| What `asyncHandler` is for | Forwarding a rejected handler promise to `next` so Express 5 reaches the error handler |
| Suite sizes at the last verification | 16 passing in `@lms/api`, 15 in `@lms/domain`, typecheck exit 0 for both |
| What the route fixture mocks | Every Prisma delegate, the JWT middleware, `recordDomainEvent` and `auditLog`; the real router is dispatched |
| Four things the mocked fixture cannot prove | Rollback, unique behaviour under concurrency, generated SQL, outbox delivery |
| How a refusal test proves nothing was written | It asserts `testState.calls.transaction` is 0 |
| Which workspace has no test files | `@lms/worker`, the outbox consumer |
