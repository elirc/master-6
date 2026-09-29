# Master 6: learner enrollment, completion, and durable side effects

This course explains the learner workflow in the LMS API in this project. The code is an Express router backed by Prisma, with completion predicates in the domain package. The main lesson is that a learner action is valid only when three identities agree: the authenticated user, the organization selected by `x-organization-id`, and the course version stored on the enrollment. Completion then evaluates the rule belonging to that enrolled version and records its durable effects together.

The course has seven reading chapters and one verification page. Read them in order when you are new to the feature, or jump directly to the file that matches a review question.

1. [01 - Codebase map](./01-CODEBASE-MAP.md) locates the schema, router, domain helper, event, audit, and test seams.
2. [02 - Concepts](./02-CONCEPTS.md) defines ownership, published version selection, requirement sets, timestamps, and replay.
3. [03 - Worked change](./03-WORKED-CHANGE.md) walks through the actual enrollment and completion code with small excerpts.
4. [04 - Testing and debugging](./04-TESTING-AND-DEBUGGING.md) shows the real Vitest router fixture and how to diagnose a failed request.
5. [05 - Practice](./05-PRACTICE.md) gives nine exercises against the routes and domain rule.
6. [06 - Solutions and review](./06-SOLUTIONS-AND-REVIEW.md) answers Exercises 0 through 8 and identifies remaining boundaries.
7. [07 - Trace lab](./07-TRACE-LAB.md) traces one learner from enrollment through a stable completion replay.
8. [VERIFICATION](./VERIFICATION.md) lists the project-relative checks and evidence links.

The implementation files referenced throughout are [`apps/api/src/routes/learner.routes.ts`](../apps/api/src/routes/learner.routes.ts), [`packages/domain/src/completion.ts`](../packages/domain/src/completion.ts), [`apps/api/src/events.ts`](../apps/api/src/events.ts), and [`apps/api/src/audit.ts`](../apps/api/src/audit.ts). The primary route fixture is [`apps/api/src/routes/learner.routes.test.ts`](../apps/api/src/routes/learner.routes.test.ts); domain behavior is covered in [`packages/domain/src/domain.test.ts`](../packages/domain/src/domain.test.ts). Examples use the actual field names `courseVersionId`, `completionRuleJson`, `lessonProgress`, `quizAttempts`, and `submissions`.

The test setup uses mocked Prisma delegates and invokes the actual Express router with request and response objects. It proves query shape, guards, transaction grouping, and response behavior without a database, Redis, browser, or HTTP server. A passing mock test therefore demonstrates control flow and call grouping; it does not prove rollback, concurrent uniqueness, generated SQL, or production delivery of an outbox message.

Keep the distinction between an enrollment and a course current version in mind while reading. A later draft may exist, but an existing learner remains attached to the published `courseVersionId` selected at enrollment. That stable association is what makes old attempts, progress, and completion rules explainable.

## Prerequisites and glossary

**Prerequisites:** TypeScript and Express handlers; enough Prisma for a `where`, an `include` and a `$transaction`; 403, 404 and 409; Vitest basics. The `master3` course here is a natural predecessor for organization scope, audit and outbox.

| term | meaning | where in this project |
| --- | --- | --- |
| organization scope | the selected organization filtering every query; a header claim, not access | `organizationFor` reading `x-organization-id` in `apps/api/src/routes/learner.routes.ts` |
| three identities agree | user, organization and enrolled version must all match | the scoped `findFirst` lookups in `learner.routes.ts` |
| published version selection | the version a new learner attaches to, not the newest draft | `course.currentVersionId` with `status: "PUBLISHED"` in `learner.routes.ts` |
| enrolled version | the frozen version an existing learner stays on | `courseVersionId` on `model Enrollment` in `apps/api/prisma/schema.prisma` |
| completion rule | the stored requirement set of that version, read rather than assumed | `completionRuleJson` in `schema.prisma`, read by `completionRuleFor` |
| requirement evaluation | the pure check of progress, attempts and submissions against the rule | `isCourseComplete` in `packages/domain/src/completion.ts` |
| completion percent | the dashboard number, computed rather than stored | `calculateLessonCompletionPercent` in `packages/domain/src/completion.ts` |
| certificate eligibility | the separate predicate deciding whether a certificate issues | `canIssueCertificate` in `packages/domain/src/completion.ts` |
| requirements not met | the refusal when evaluation fails, returned as 409 with nothing written | the `HttpError(409, ...)` throw in `learner.routes.ts` |
| replay | a second completion returning the first result rather than repeating it | the `status === "COMPLETED"` early return in `learner.routes.ts` |
| durable effects together | enrollment, certificate, audit and event commit in one unit of work | the `prisma.$transaction` in the complete handler in `learner.routes.ts` |
| domain event | the recorded intent to notify, stored as a row rather than sent | `recordDomainEvent` in `apps/api/src/events.ts`, `model DomainEvent` in `schema.prisma` |

## Pacing

map 45 min, concepts 75 min, worked change 90 min, testing 60 min, practice 4-6 h (the implement-it exercises), solutions 45 min, trace lab 45 min. Do the practice exercises in order; each names its acceptance test.

