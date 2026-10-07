# System design follow-ups: Master 6 LMS

Each answer starts from what the code does today, then names the trade-off. Paths are relative to the project root.

## What exists today

```
  client
    | Authorization: Bearer <jwt>
    | x-organization-id: org-1
    v
  requireAuth ............. loads user + memberships   (apps/api/src/middleware/auth.ts)
    v
  organizationFor ......... header must match a membership, else 403
    v                        (learner.routes.ts:15-21)
  handler
    |- Zod parse of body                       (e.g. learner.routes.ts:110)
    |- scoped findFirst: id + userId + orgId   (learner.routes.ts:113)
    |- domain predicate, pure                  (packages/domain/src/completion.ts)
    v
  prisma.$transaction ------------------------------------------.
    |  business write (enrollment / progress / attempt / cert)   |
    |  auditLog(..., tx)            -> auditLog row              |
    |  recordDomainEvent(..., tx)   -> domainEvent row           |
    |                               -> outboxMessage row         |
    `------------------------------ commit ----------------------'
                                       |
                                       v
                         @lms/worker polls outboxMessage  (no tests in that workspace)
```

## 1. Multi-tenancy: is a header enough at 500 tenants?

Today tenancy is a header claim checked against `request.user.memberships` in `organizationFor` (`apps/api/src/routes/learner.routes.ts:15-21`), and every query repeats `organizationId` in its `where` (for example the dashboard at lines 38-41). That is application-enforced isolation: correct as long as every new query remembers the filter, and one forgotten `where` is a cross-tenant leak with no second net under it.

At scale the options are Postgres row-level security with the tenant set per connection, or a Prisma client extension that injects the filter. RLS is the stronger guarantee because it holds for ad-hoc SQL and for code written by someone who has not read this file, but it costs you a session variable on every checkout from the connection pool and makes some queries harder to reason about. The middle path, and what I would do first, is a repository layer that takes the organization id as a required argument so the filter cannot be forgotten silently.

## 2. Concurrent writers: the quiz retake limit

`tx.quizAttempt.count` at `apps/api/src/routes/learner.routes.ts:171`, the `maxAttempts` check at line 172, and the insert at line 187 are one read-then-write inside a transaction. Read-committed isolation does not serialise that, so two requests at the same instant both count 2, both pass a limit of 3, and both try to insert attempt number 3. `@@unique([quizId, enrollmentId, attemptNumber])` (`apps/api/prisma/schema.prisma:291`) rejects the second, so the limit holds, but the loser sees an unmapped P2002 as a 500.

The right fix is a database constraint, not application logic, and it is already there; what is missing is the handler mapping that P2002 to 409 exactly as the enroll handler does at line 101. The alternative, `SERIALIZABLE` plus a retry loop, works but pays a serialisation-failure tax on every attempt to fix a rare race. Trade-off: the constraint gives the loser of the race a 409 that is honest but slightly confusing ("retake limit reached" when they were told they had one left), which is better than silently allowing a fourth attempt.

## 3. Background jobs: from outbox table to actual delivery

`recordDomainEvent` writes `domainEvent` and then `outboxMessage` on the caller's client (`apps/api/src/events.ts:8` and `:16`), so nothing leaves the process before commit. The only consumer is the `outbox-dispatch` worker in `apps/worker/src/worker.ts:52-73`, which marks up to 25 `PENDING` rows `SENT` without publishing anything and without a lease, and has no tests: delivery does not exist yet.

A production consumer needs three things. A lease, so two workers do not publish the same row: `SELECT ... FOR UPDATE SKIP LOCKED` on a batch, or a `lockedUntil` column. A retry with backoff and a dead-letter state, so a poison message does not stall the queue head. And an acceptance that delivery is at-least-once, which pushes deduplication onto the consumer, keyed on `domainEventId`. The trade-off against publishing inline is latency: the outbox adds a poll interval of delay in exchange for never sending a message for a transaction that rolled back.

## 4. Pagination: the dashboard at 1M enrollments

`GET /dashboard` does a `findMany` with no `take` and an `include` that pulls the certificate, course, full course version with modules, lessons, quizzes and assignments, plus every progress row, quiz attempt and submission (`apps/api/src/routes/learner.routes.ts:28-42`). For one learner in one organization that is bounded by how many courses a person takes, so it is survivable today. It is still an unbounded query and the shape is the problem, not the row count: the version include is a per-enrollment tree.

Cursor pagination on `(createdAt, id)` fits because the order is already `createdAt: "desc"` at line 37, and a cursor is stable under inserts where an offset is not. Then split the response: a list endpoint that returns enrollment, course title, status and `progressPercent` only, and a detail endpoint that loads the version tree for one enrollment. `calculateLessonCompletionPercent` (`packages/domain/src/completion.ts:9`) is computed per request from progress rows, so at real volume the percent becomes a denormalised column updated in the same transaction as the progress write, with the pure function kept as the recomputation source of truth.

## 5. Auth: what the JWT does not carry

The token identifies the user and the middleware loads memberships from the database on every request, so a revoked membership takes effect immediately. That is the right default and it costs a query per request. Putting memberships in the token removes the query and introduces a staleness window equal to the token lifetime, during which a removed member still passes `organizationFor`.

Role is present on the membership but the learner routes do not branch on it; authorization here is ownership, not role. If an admin impersonation feature arrives, the ownership checks that compare `userId` to `request.user.id` are exactly the lines that have to learn about an acting-as identity, and the audit row at line 314 already has `actorUserId` separate from the target, which is the field that makes impersonation auditable.

## 6. Observability: what would you add first

There is an `auditLog` row per completion (`apps/api/src/routes/learner.routes.ts:314`) and a `domainEvent` row per learner action, so the business timeline is already durable and queryable. What is missing is operational signal: no request id correlating a log line to an audit row, no metrics on transaction duration, and an error handler that returns `error.message` on a 500 (`apps/api/src/http.ts:41-43`) while logging nothing.

First change: a request id generated in middleware, attached to the response, and stored on the audit row's metadata, so a support ticket resolves to one request. Second: a counter on 409s by message, because "Completion requirements are not met" trending up is a content bug, not a user problem. Trade-off: the audit table then grows at request rate rather than at business-event rate, so it needs a retention policy.

## 7. Versioning: what happens when a course republishes

An enrollment freezes `courseVersionId` at creation (`apps/api/src/routes/learner.routes.ts:81`) and every later lookup scopes to it: the lesson at line 115, the quiz at line 166, the assignment at line 219. Publishing a new version therefore does not move existing learners, and their attempts and completion rule stay coherent. The unique constraint is `@@unique([userId, courseVersionId])` on `model Enrollment`, so the same learner can enrol again in the next version as a separate enrollment with its own progress.

The cost is that content fixes do not reach learners in flight. A typo correction requires either a new version nobody is on, or an in-place edit of a published version, which quietly changes the rule people are being graded by. The design decision to make explicitly is which edits are allowed in place: copy edits yes, requirement changes no, and that rule belongs in the authoring routes, not here.

## 8. Migrating this to ASP.NET Core

The mapping is almost one to one. `$transaction` becomes a `DbContext` unit of work with `SaveChangesAsync` at the end; Prisma's `findFirst` with a composite `where` becomes a LINQ `FirstOrDefaultAsync` with the same predicate; `HttpError` becomes a middleware-mapped exception or `Results.Problem`; Zod becomes FluentValidation or a validated record type. The outbox pattern is unchanged, and EF Core makes it slightly cleaner because a `SaveChanges` interceptor can append the outbox row automatically instead of every call site remembering to pass `tx`.

The two things that do not transfer for free: the pure domain package stays pure (that is an advantage in either stack, and `packages/domain/src/completion.ts` would become a class library with no EF reference), and the mocked-delegate test style does not have a good equivalent. In .NET the honest version is `WebApplicationFactory` against a real database in a container, which proves the rollback and uniqueness behaviour this repository's mocked fixture explicitly does not.
