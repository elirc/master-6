# Interview questions: Master 6 LMS learner slice

Paths are relative to the project root. Difficulty is marked junior or mid.

## Screening

**S1 (junior). Describe the learner data model.**
`Enrollment` (`apps/api/prisma/schema.prisma:192`) joins a `userId`, an `organizationId`, a `courseId` and a `courseVersionId`, with an `EnrollmentStatus` defaulting to `ACTIVE`, an optional `dueAt` and `completedAt`. It owns `lessonProgress`, `quizAttempts`, `submissions` and at most one `certificate`. Two constraints matter: `@@unique([userId, courseVersionId])` at line 213 and `@@index([organizationId, status])` at line 214.

**S2 (junior). What does the unique constraint actually prevent?**
One learner enrolling twice in the same course *version*. It does not prevent a second enrollment in a later version of the same course, which is deliberate: a re-run of an updated course is a legitimate new enrollment with its own progress and its own rule.

**S3 (junior). Which boundary validates input?**
Two separate ones. Zod parses request bodies inline in each handler, for example the progress body at `apps/api/src/routes/learner.routes.ts:110` (`z.object({ enrollmentId: z.string(), status: z.enum(["IN_PROGRESS", "COMPLETED"]) })`). Ownership is a second, database-level boundary: every write first does a scoped `findFirst` such as `apps/api/src/routes/learner.routes.ts:113`, which filters on `id`, `userId` and `organizationId` together.

**S4 (mid). Walk the request path for "learner enrolls in a course".**
`requireAuth` (`apps/api/src/middleware/auth.ts:13`) verifies the bearer JWT and loads the user with memberships. `organizationFor` (`apps/api/src/routes/learner.routes.ts:15`) reads `x-organization-id` and throws 403 unless the user has a membership in it. The handler finds the course scoped to that organization with `status: "PUBLISHED"` (line 66), then finds `course.currentVersionId` also requiring `status: "PUBLISHED"` (line 70), and 404s if either is missing (line 73). Inside one `$transaction` (line 77) it creates the enrollment, finds the version's lessons, bulk-creates `lessonProgress` rows, and records an `enrollment.created` domain event on the transaction client. Response is 201.

**S5 (mid). Why is the organization taken from a header and not from the token?**
Because a user can be a member of several organizations, so the token says who you are and the header says which tenant you are acting in. The critical detail is that the header is a *claim*, not access: `organizationFor` at line 17 rejects it unless `request.user.memberships` actually contains it, so a forged header gets a 403.

**S6 (junior). Where does the error status come from?**
`HttpError` (`apps/api/src/http.ts:18`) carries a status, `asyncHandler` (line 27) forwards rejected promises to `next`, and `errorHandler` (line 35) maps an `HttpError` to its status and anything else to 500.

**S7 (mid). What is the outbox and why is it a table?**
`recordDomainEvent` (`apps/api/src/events.ts:4`) writes a `domainEvent` row and then an `outboxMessage` row referencing it, both on the same client. Because the caller passes the transaction client, the event is committed atomically with the business write instead of being fired over the network mid-transaction, where a rollback would leave a message already sent.

**S8 (junior). What is `@lms/domain` for?**
Pure functions with no Prisma import: `calculateLessonCompletionPercent`, `isCourseComplete` and `canIssueCertificate` in `packages/domain/src/completion.ts`. They take plain summaries, so they are testable without a database, which is why the domain package holds 15 of the 29 tests.

## Deep dive

**D1 (mid). Walk the completion handler and name every branch.**
`apps/api/src/routes/learner.routes.ts:255`. It loads the enrollment by id scoped to user and organization with the full relation graph (line 260) and 404s if absent. If the status is already `COMPLETED` it returns the existing certificate and enrollment without writing anything (line 275), which is the replay branch. It parses the stored rule with `completionRuleFor` (line 280), computes the percent, evaluates `isCourseComplete` and throws 409 "Completion requirements are not met" if false (line 290). Then it computes certificate eligibility and runs a single `$transaction` (line 299) doing four things: update the enrollment, conditionally create the certificate, write the audit row, record the domain event.

**D2 (mid). The bug you fixed: what was wrong with the duplicate-enrollment catch?**
It matched on the shape of the error rather than its type, so any thrown object carrying `code === "P2002"` became a 409. That turns an unrelated failure into "Already enrolled", which is a wrong answer given confidently. The catch now reads `error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"` (`apps/api/src/routes/learner.routes.ts:101`). Two tests pin it: one throws a real `new Prisma.PrismaClientKnownRequestError("duplicate", { code: "P2002", clientVersion: "test" })` and expects 409 (`apps/api/src/routes/learner.routes.test.ts:177`), the other throws the bare object `{ code: "P2002" }` and asserts the result is *not* 409 (line 187).

**D3 (mid). Why is `completionRuleFor` so defensive, and why 500 rather than 400?**
`completionRuleJson` is stored data written by an author, not user input on this request, so a malformed rule is a server-side configuration fault. `completionRuleFor` (line 334) rejects a non-object, a non-array id list, a non-string or blank id, duplicate ids, ids that do not belong to this version's lessons, quizzes or assignments, a non-boolean flag, and a `minimumQuizScore` outside 0 to 100, each with `HttpError(500, "Invalid completion rule configuration")`. Crucially it runs *before* the transaction, so a bad rule never half-completes an enrollment. `apps/api/src/routes/learner.routes.test.ts:132` asserts exactly that.

**D4 (mid). Explain the defaulting in the returned rule object.**
Lines 376-383. `requiredLessonIds` falls back to every lesson in the version only when `requireAllLessons` is true. `requiredQuizIds` falls back to every quiz only when a `minimumQuizScore` is set, because a score threshold with no named quizzes has to apply to something. `requiredAssignmentIds` falls back to every assignment only when `requireAssignmentsGraded` is explicitly `true`. An absent field stays `undefined`, and `isCourseComplete` treats `undefined` differently from an empty array, which is the subtle part.

**D5 (mid). How does `isCourseComplete` treat an empty required-id array?**
`requiredLessons.every(...)` on `[]` is `true`, so an explicitly empty array means "no requirement of this kind" and completion succeeds (`packages/domain/src/completion.ts:25-28`). When the array is `undefined` the code falls to the other branch, which for lessons is `!requireAllLessons || (lessonProgress.length > 0 && every COMPLETED)`. That `length > 0` guard is why `apps/api/src/routes/learner.routes.test.ts:124` expects a legacy all-lessons rule with no progress rows to be rejected: vacuous truth would otherwise complete a course nobody studied. The explicitly-empty case is covered separately at line 153.

**D6 (mid). What breaks if you delete `apps/api/src/routes/learner.routes.ts:275`, the replay early return?**
A second POST to complete would fall through to the transaction and try `tx.certificate.create` again for the same `enrollmentId`. `Certificate.enrollmentId` is unique in the schema, so you get a P2002 out of the complete handler, which has no catch, so `errorHandler` returns a 500 with the raw Prisma message. The `verificationCode` would also collide, since it is derived deterministically from the enrollment id at line 311. `apps/api/src/routes/learner.routes.test.ts:68` is the guard: "returns a stable completed result without another certificate or event".

**D7 (mid). Why does `recordDomainEvent` take the client as a parameter with a default?**
`apps/api/src/events.ts:6` declares `client: Prisma.TransactionClient = prisma`. Callers inside a transaction pass `tx`, so the event joins the unit of work; callers outside get the global client. The same pattern is in `auditLog` (`apps/api/src/audit.ts:11`). Without it you cannot write an event transactionally without duplicating the function, and forgetting to pass `tx` is a silent correctness bug that no type error catches.

**D8 (mid). The quiz attempt counter is inside the transaction. Is that enough?**
`tx.quizAttempt.count` then the limit check then the create (`apps/api/src/routes/learner.routes.ts:171-198`) is read-then-write. At Postgres' default read-committed isolation two concurrent attempts can both read the same count and both insert, so the max-attempts rule can be exceeded by one. The honest answer names the fix: a unique constraint on `(enrollmentId, quizId, attemptNumber)` so the second insert fails, or `SERIALIZABLE` with a retry. VERIFICATION already records that concurrent retake limits are not proven by the mocked fixture.

**D9 (mid). What does the mocked transaction test actually prove?**
`apps/api/src/routes/learner.routes.test.ts:195` stubs `$transaction` to run the callback and then throw, and asserts the request rejects with "commit failed". The comment at line 205 is the point: a mock cannot roll anything back, so the test proves only that the route does not answer 201. Proving the rows are absent requires an integration test against a real database. Saying this unprompted is worth more than the test itself.

**D10 (mid). The assignment submission uses `upsert`. What does that change?**
`apps/api/src/routes/learner.routes.ts:222` upserts on the composite unique `assignmentId_enrollmentId`, so resubmitting overwrites content and resets `status` to `SUBMITTED` with a new `submittedAt`. It returns 201 either way (line 251), which is arguably wrong for an update; 200 would be more honest. It also means a resubmission silently undoes a `GRADED` status, which matters because `isCourseComplete` requires `GRADED` (`packages/domain/src/completion.ts:42`).

## Behavioral (STAR)

**B1 (mid). Tell me about a bug you found in error handling.**
Situation: the enroll route mapped duplicate enrollments to a 409. Task: I was reviewing whether the mapping was actually safe. Action: the catch tested only the error's `code` property, so any thrown object shaped like a Prisma error became "Already enrolled in this course version". I narrowed it to `error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"` and added a test that throws the bare object `{ code: "P2002" }` and asserts the response is not a 409, alongside the existing test that constructs a real `PrismaClientKnownRequestError`. Result: `@lms/api` went from 13 to 16 passing cases in that verification run, `@lms/domain` stayed at 15, and typecheck exited 0 for both workspaces.

**B2 (mid). Tell me about a time you wrote a test that proved less than it looked like it proved.**
Situation: I wanted coverage for a transaction failing after its writes were issued. Task: the route fixture mocks every Prisma delegate, so there is no real transaction to roll back. Action: I wrote the test anyway, stubbing `$transaction` to run the callback against the mock transaction client and then throw, asserting the request rejects rather than answering 201. Then I wrote two comment lines inside the test saying explicitly what it does not prove, and put an integration-test recipe in the testing chapter. Result: the suite has the regression, and nobody reading it can mistake it for evidence of rollback. I would rather ship a test with an honest label than one that quietly overclaims.

**B3 (junior). Tell me about designing for the reader rather than the writer.**
Situation: the course material used terms like "enrolled version" and "durable effects together" that had no single definition. Task: make each term checkable against code. Action: I added a 12-term glossary where every row names the exact symbol or file it lives in: `organizationFor` reading `x-organization-id`, `course.currentVersionId` with `status: "PUBLISHED"`, `completionRuleJson` read by `completionRuleFor`, `recordDomainEvent` and `model DomainEvent`. Result: every term was verified against the source before it was cited, so a reader can jump from a definition to the line that implements it rather than trusting prose.

**B4 (mid). Tell me about a design decision you can defend but would flag in review.**
The complete handler evaluates the rule outside the transaction and then commits. That means a lesson could in principle be marked complete between the evaluation and the commit, so the decision is made on a slightly stale read. I can defend it: the work is idempotent in the direction that matters (completing an already-complete course replays), and holding the transaction open across the whole relation-rich load would be worse for lock duration. But I would flag it, because the correct fix is to re-check inside the transaction or take a row lock on the enrollment, and I would not pretend the current code does that.

**B5 (junior). How do you decide what to write down as a known limit?**
Anything a future reader could reasonably assume is covered but is not. For this slice that list is explicit: mocked tests do not prove rollback, unique behaviour under concurrency, generated SQL or outbox delivery; the certificate `verificationCode` generator derives from an id suffix with no collision retry; post-completion progress edits are still allowed; the default error handler returns `error.message` on a 500 (`apps/api/src/http.ts:42`), which can disclose internals. Writing these down cost me nothing and it stops the next person shipping on a false assumption.

## Follow-ups an interviewer asks next

**F1. "You said the header is a claim. Show me where that is enforced for reads, not just writes."**
The dashboard query at `apps/api/src/routes/learner.routes.ts:38-41` filters on `organizationId` and `userId` together, so a cross-tenant read returns an empty list rather than someone else's enrollments. Every other handler uses `findFirst` with the same pair, which is why a foreign actor gets 404 rather than 403 (`apps/api/src/routes/learner.routes.test.ts:80`).

**F2. "Why 404 rather than 403 for someone else's enrollment?"**
Because 403 confirms the id exists. The scoped `findFirst` returns null for both "does not exist" and "not yours", and the handler cannot tell them apart, so the response is the same. That is the safe default; the cost is that support cannot distinguish the two from the response alone.

**F3. "The certificate verification code is `CERT-` plus the last 8 characters of a cuid, uppercased. Problem?"**
Two. It is derived, so it is guessable from the enrollment id, and the id suffix is not guaranteed unique across the table, and there is no collision retry. The schema makes `verificationCode` unique, so a collision is a 500 at issuance rather than a duplicate certificate, which is the safer of the two failure modes but still a user-visible failure. A random 128-bit code stored on the row fixes both.

**F4. "Completion requires assignments to be `GRADED`, but submitting sets `SUBMITTED`. Who moves it?"**
An instructor route outside this slice. Worth naming the consequence: the upsert at line 222 sets `status: "SUBMITTED"` on every resubmission, so a learner resubmitting after grading silently reverts their own assignment out of `GRADED` and back out of completion eligibility. That is a real behaviour, not a hypothetical.

**F5. "You have an outbox table. Where is the consumer?"**
In `@lms/worker`, and the honest part of the answer is that the worker workspace has zero test files, so it contributes no behavioural coverage. The contract a consumer must honour is lease the row, retry on failure, and expect at-least-once delivery, which means the consumer has to deduplicate on `domainEventId`.

**F6. "What would you fix first if this were production?"**
The quiz-attempt race, because it is the one place where the read-then-write window lets a learner exceed a stated limit, and the fix is a database constraint rather than application logic. Second, the 500 handler returning `error.message`.
