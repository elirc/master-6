# Stories and resume material: Master 6 LMS

## Story 1: the 409 that was answering for the wrong error

**Situation.** The enroll route in `apps/api/src/routes/learner.routes.ts` wraps its `$transaction` in a try/catch that turns a duplicate enrollment into `HttpError(409, "Already enrolled in this course version")`. I was reviewing the learner slice and checked what the catch actually matched.

**Task.** Decide whether the mapping was sound, and if not, make the narrowing testable rather than just tightening it and hoping.

**Action.** The catch inspected only the error's `code` property, so any thrown value carrying `code === "P2002"` produced a confident, wrong 409. I narrowed it to `error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"` at line 101, and wrote two tests either side of the boundary: one stubs `$transaction` to throw a real `new Prisma.PrismaClientKnownRequestError("duplicate", { code: "P2002", clientVersion: "test" })` and expects a 409, the other throws the bare object `{ code: "P2002" }` and asserts the rejection is *not* a 409.

**Result.** `@lms/api` went from 13 passing cases to 16 in that run, `@lms/domain` stayed at 15, and `tsc --noEmit` exited 0 for both workspaces. A misclassified infrastructure failure can no longer reach the client dressed as a business conflict.

## Story 2: refusing to let a mocked test claim a rollback

**Situation.** The learner-route suite replaces every Prisma delegate, the JWT middleware and the event and audit helpers, then dispatches through the real Express router. It is fast and it proves guard order and transaction grouping. It cannot prove anything about the database.

**Task.** Add coverage for a transaction that fails after its writes have been issued, without implying the test proves rollback.

**Action.** I stubbed `$transaction` to run the callback against the mock transaction client and then throw, asserting the request rejects with "commit failed" rather than answering 201. Inside the test I wrote two comment lines stating that a mock cannot roll anything back and that only an integration test proves the rows are absent, and I added an integration-test recipe plus a section on the mocked transaction to the testing chapter.

**Result.** The regression exists and its label is accurate. The same honesty carried into the verification page, which lists exactly what the fixture does not establish: rollback, unique-constraint behaviour under concurrency, generated SQL, and outbox delivery.

## Story 3: making an LMS course readable by anchoring every term to a symbol

**Situation.** The learner slice has vocabulary that sounds interchangeable but is not: a course's current version, the version an enrollment is frozen to, the completion rule stored on that version, and the requirement evaluation that reads it.

**Task.** Make each term checkable rather than merely defined.

**Action.** I wrote a 12-term glossary where every row names the file and symbol that implements it, and verified each one against the source before citing it: `organizationFor` reading `x-organization-id`, `course.currentVersionId` with `status: "PUBLISHED"`, `courseVersionId` on `model Enrollment`, `completionRuleJson` read by `completionRuleFor`, `isCourseComplete` and `canIssueCertificate` in `packages/domain/src/completion.ts`, the `status === "COMPLETED"` early return for replay, the `prisma.$transaction` for durable effects, and `recordDomainEvent` with `model DomainEvent`.

**Result.** A reader can go from any definition to the line that implements it in one hop, and the three implement-it practice exercises each name the acceptance test they are graded by, rather than ending at "try it yourself".

## Resume bullets

- Hardened a Prisma error mapping in an Express LMS API so only a real `PrismaClientKnownRequestError` with code P2002 becomes a 409, adding paired positive and negative tests and taking the API suite from 13 to 16 passing cases.
- Enforced a three-way ownership invariant (authenticated user, header-selected organization, enrollment's frozen course version) across six learner routes using scoped Prisma `findFirst` lookups, so cross-tenant and cross-version access returns 404 rather than leaking existence.
- Implemented transactional completion that commits an enrollment update, certificate issuance, audit row and domain event plus outbox message in a single `$transaction`, with an idempotent replay path that returns the first result instead of reissuing a certificate.
- Wrote a defensive parser for author-supplied completion rules that rejects non-object, duplicate, out-of-version and out-of-range values before any write, converting a class of silent mis-grading into a fail-fast configuration error.
- Documented the verification boundary for a mock-based route suite (no rollback, no concurrency, no SQL, no outbox delivery) and supplied the integration-test recipe that would close it.

## 60-second spoken summary

Master 6 is a multi-tenant LMS in a Node workspace: an Express and Prisma API, a pure domain package, a web app and a worker. I work on the learner slice. The rule everything hangs off is that three identities have to agree before a write: who you are from the JWT, which organization you selected with the `x-organization-id` header, and which course version your enrollment is frozen to. That freeze is the interesting part, because a course can publish a new version at any time, and a learner already enrolled stays on the version they started, so their quiz attempts and the completion rule that grades them still line up. Completion reads the stored rule for that version, evaluates it with pure functions in the domain package, and then commits four things in one transaction: the enrollment update, the certificate, an audit row and a domain event with an outbox message, so nothing is sent over the network before the commit. The fix I am proudest of is small: the duplicate-enrollment catch was matching on the shape of the error rather than its type, so anything carrying a P2002 code became "already enrolled". I narrowed it and added a test for the look-alike case. And I would tell you upfront that the route tests mock Prisma, so they prove control flow, not rollback.

## What I would do next

- Close the quiz-attempt race. The count and the insert both happen inside the transaction but under read-committed isolation two concurrent attempts can both pass the `maxAttempts` check; a unique constraint on `(enrollmentId, quizId, attemptNumber)` is the right fix, not more application logic.
- Replace the derived `CERT-` plus id-suffix verification code with a random value stored on the row, since today it is guessable and has no collision retry.
- Stop the assignment upsert silently reverting a `GRADED` submission to `SUBMITTED`, which quietly removes a learner from completion eligibility.
- Add the integration suite the testing chapter describes, so rollback and the unique constraint are proven rather than reasoned about.
