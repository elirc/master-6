# Take-home: enrollment withdrawal

Budget 3 to 4 hours. Work in this repository, in `apps/api` and `packages/domain`. Do not add dependencies and do not run a database; the existing Vitest fixture is the target.

## The brief

Learners currently have no way out of a course. Support has to delete rows by hand, which loses the audit trail and silently removes the learner's quiz attempts from anyone's view. Add a withdrawal endpoint.

`POST /api/learner/enrollments/:enrollmentId/withdraw`

Body: `{ "reason": string }` where reason is 1 to 280 characters after trimming.

Behaviour:

1. Ownership is the same three-way check every other learner write uses: the authenticated user, the organization from `x-organization-id`, and the enrollment row. Model it on the scoped `findFirst` at `apps/api/src/routes/learner.routes.ts:113`. A foreign user or a foreign organization gets 404, not 403.
2. A `COMPLETED` enrollment cannot be withdrawn: 409 with the message `Completed enrollment cannot be withdrawn`. A certificate has already been issued and withdrawal must not invalidate it.
3. A withdrawal on an enrollment that is already `WITHDRAWN` is a replay: 200 with the current enrollment, no writes, no event. This mirrors the completion replay at `apps/api/src/routes/learner.routes.ts:275`.
4. The successful path writes in one `prisma.$transaction`: update the enrollment to `status: "WITHDRAWN"`, write an audit row with action `enrollment.withdrawn` via `auditLog`, and record a domain event of type `enrollment.withdrawn` whose payload carries `enrollmentId` and the trimmed reason. Both helpers must receive the transaction client as their second argument, exactly as the complete handler does at lines 321 and 326.
5. Respond 200 with `{ enrollment }`.
6. `EnrollmentStatus` today is `ACTIVE`, `COMPLETED`, `DROPPED`, `EXPIRED` (`apps/api/prisma/schema.prisma:24-29`). Add `WITHDRAWN` and write the migration folder for it; do not run it. In your notes, argue for or against reusing `DROPPED` instead of adding a value, since nothing in the learner slice currently writes either one.
7. In `packages/domain/src/completion.ts`, make `canIssueCertificate` unreachable for a withdrawn enrollment by keeping its `enrollmentStatus === "COMPLETED"` guard honest: add a domain test proving a withdrawn status cannot produce a certificate.

## Acceptance criteria

- `POST` with a valid body on an `ACTIVE` enrollment returns 200, opens exactly one transaction, calls `auditLog` once and `recordDomainEvent` once, and both receive the transaction client.
- A missing or blank `reason`, or one longer than 280 characters, is rejected by Zod before any database call. State in your notes which status Express 5 plus the existing `errorHandler` produces for a `ZodError` here, and whether you think that is the right answer.
- Foreign user and foreign organization both reject with status 404 and open zero transactions.
- Withdrawing a `COMPLETED` enrollment rejects with 409 and opens zero transactions.
- Withdrawing an already `WITHDRAWN` enrollment returns 200 and opens zero transactions.
- Existing tests still pass unchanged. If you have to change an existing test, say why in your notes.

## Where the code goes

- Handler: `apps/api/src/routes/learner.routes.ts`, next to the complete handler.
- Tests: add cases to the existing `describe` in `apps/api/src/routes/learner.routes.test.ts`. Reuse `setupEnrollment` (line 43) and `dispatch` (line 31); do not build a new fixture.
- Domain test: `packages/domain/src/domain.test.ts`.
- Schema: `apps/api/prisma/schema.prisma`, plus a new folder under `apps/api/prisma/migrations/`.

## How to run it

```
npm test --workspace @lms/api
npm test --workspace @lms/domain
npm run typecheck --workspace @lms/api
```

`npm test` in `apps/api` is `vitest run` (see `apps/api/package.json`). The baseline before your change is 16 passing in `@lms/api` and 15 in `@lms/domain`, with `tsc --noEmit` exiting 0 for both.

## What to submit

A branch with your commits, plus a `NOTES.md` of at most one page covering: the Zod failure status you observed and your opinion of it; why 404 rather than 403 for a foreign enrollment; what your tests do not prove; and what you would do about learners who withdraw and re-enrol, given `@@unique([userId, courseVersionId])` on `model Enrollment` in `apps/api/prisma/schema.prisma`.

## Grading rubric

| Criterion | Strong | Weak |
| --- | --- | --- |
| Ownership scoping | One `findFirst` filtering `id`, `userId` and `organizationId` together; 404 for both foreign cases; tests for each | Looks up by id then compares fields in JavaScript, or returns 403 and leaks existence |
| Transaction discipline | One `$transaction`; `auditLog` and `recordDomainEvent` both passed `tx`; a test asserting the second argument is the transaction client | Helpers called without `tx`, so the event survives a rollback; no test on the argument |
| Guard order | Status checks and validation happen before the transaction opens; tests assert `calls.transaction` is 0 on every refusal | Transaction opened first and rolled back on refusal, or refusals untested |
| Replay semantics | Already-withdrawn returns the current row with zero writes, matching the completion replay | Second withdrawal writes another audit row or throws 409 |
| Test quality | New cases reuse `setupEnrollment` and `dispatch`, assert status and call counts, and the domain case covers the withdrawn status | One happy-path test, no refusal coverage, or a test whose name promises more than it checks |
| Migration safety | Enum value added, migration folder written, and the notes say why adding a value is safe while removing one is not | Schema edited with no migration, or an existing enum value renamed |
| Honesty in notes | Names what the mocked fixture cannot prove (rollback, uniqueness under concurrency, generated SQL) and the re-enrolment collision | Claims the tests prove rollback, or ignores the unique constraint question |

## Reviewer's notes

First thing checked: the tests. Specifically whether every refusal path asserts that no transaction was opened, because that is the difference between a handler that refuses and a handler that refuses after starting work. The fixture already counts transactions in `testState.calls.transaction`, so there is no excuse for not asserting it.

Second: whether `auditLog` and `recordDomainEvent` got the transaction client. The signature defaults to the global client (`apps/api/src/events.ts:6`), so forgetting the argument compiles, passes a careless test, and breaks atomicity. `apps/api/src/routes/learner.routes.test.ts:64` shows the assertion that catches it.

Third: the error paths. A `ZodError` escaping into `errorHandler` at `apps/api/src/http.ts:41` becomes a 500 carrying `error.message`, which for Zod is a JSON blob of the validation issues. A strong submission notices this, says so, and either maps `ZodError` to 400 in the error handler or explains why that belongs in a separate change.

Fourth: the migration. Adding a value to an enum is additive and safe on a live table; the weak version of this submission renames or reorders values. The notes should also reach the re-enrolment problem: withdrawal does not free the `@@unique([userId, courseVersionId])` slot, so a learner cannot re-enrol in the same version afterwards. Saying "I noticed and here are the two options" beats silently shipping the collision.

Not required, and not penalised if absent: an integration test against a real database. If you write one, be clear that it, and not the mocked suite, is what proves rollback.
