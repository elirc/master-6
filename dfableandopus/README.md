# Master 6 LMS interview kit

Master 6 is a multi-tenant LMS: an npm workspace with `@lms/api` (Express + Prisma + PostgreSQL), `@lms/domain` (pure completion and scoring predicates), `@lms/web` and `@lms/worker`. The astraupskill course teaches the learner slice; this folder turns it into hiring material for CRUD backend roles.

## The pitch

"I own the learner slice of an LMS API: enroll, record lesson progress, take quizzes, submit assignments, complete and issue a certificate. The invariant I care about is that three identities have to agree before any write happens. The authenticated user from the JWT, the organization selected by the `x-organization-id` header, and the `courseVersionId` frozen on the enrollment. A learner stays on the version they enrolled against even after the course publishes a new draft, so their old quiz attempts and the completion rule they were graded by still make sense. Completion evaluates the stored rule for that version and then commits four durable effects in one `prisma.$transaction`: the enrollment update, the certificate, the audit row and the domain event plus its outbox message. I also narrowed a duplicate-enrollment catch that was mapping any object with a `code` of `P2002` to a 409."

## Target stack

Node + TypeScript + Express + Prisma + PostgreSQL, tested with Vitest against mocked Prisma delegates. The transaction, outbox and version-freeze patterns transfer directly to ASP.NET Core with EF Core if a panel asks; say "unit of work" where this code says `$transaction`.

## Two-week plan

- Days 1-2: [01-INTERVIEW-QUESTIONS.md](01-INTERVIEW-QUESTIONS.md) screening group. You should be able to draw the enroll path from header to `outboxMessage` row without looking.
- Days 3-5: deep-dive group with `apps/api/src/routes/learner.routes.ts` open. The completion handler is the whole interview.
- Days 6-7: [03-CODE-READING-DRILL.md](03-CODE-READING-DRILL.md), timed.
- Days 8-9: [02-STORIES-AND-RESUME.md](02-STORIES-AND-RESUME.md); the P2002 narrowing story is the one that separates you from candidates who only describe features.
- Days 10-12: [04-TAKE-HOME.md](04-TAKE-HOME.md) against the real Vitest fixture.
- Day 13: [05-SYSTEM-DESIGN-FOLLOWUPS.md](05-SYSTEM-DESIGN-FOLLOWUPS.md).
- Day 14: [06-FLASHCARDS.md](06-FLASHCARDS.md).

## What the tests do and do not prove

The suite is 29 cases: 15 in `@lms/domain`, 14 in `@lms/api` (13 learner-route cases plus one app-construction case). The route fixture replaces the Prisma delegates, the JWT middleware and the event and audit helpers, then dispatches through the real Express router. It proves query shape, guard order, transaction grouping and response bodies. It does not prove rollback, unique-constraint behaviour under concurrency, generated SQL or outbox delivery. Every answer in this folder that touches those says so, because claiming a mock proves rollback is the fastest way to lose a backend interview.
