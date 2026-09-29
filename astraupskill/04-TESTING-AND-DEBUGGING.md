# Testing the real learner boundary

The API suite runs fourteen cases: thirteen in [learner.routes.test.ts](../apps/api/src/routes/learner.routes.test.ts) and one existing app-construction case. The domain suite runs fifteen separate cases. The focused thirteen-case command is a subset of the fourteen-case API run; do not add it again when reporting the total of twenty-nine distinct tests. Web and worker test commands explicitly permit zero test files and contribute zero tests.

The learner fixture imports the actual Express router. Vitest hoists mocks for Prisma, authentication, events and audit before that import. A small dispatch helper provides method, url, originalUrl, headers, body, query and params, then calls router.handle. Its response recorder resolves a promise on json; the next callback captures errors. This executes actual handler guards and branches without opening a network port or running production JWT parsing. The complete fixture is reproduced in [the solutions](06-SOLUTIONS-AND-REVIEW.md).

The positive completion case supplies a completed lesson, passed quiz and graded assignment, then checks its certificate and side-effect counts. The terminal guard case begins with an already-completed enrollment and proves that no new transaction or event is requested. It does not first execute completion and then reload from a database. Separate absent quiz, absent assignment and absent progress cases stop before a transaction. Other cases cover foreign actor/organization or content version, malformed stored score configuration, timestamp preservation, explicitly empty assessments, published pointer selection and duplicate enrollment conflict.

The transaction argument is a Proxy distinct from the default Prisma object, forwarding the same delegate methods. Assertions verify that completion passes this callback client to audit and event helpers. Those helpers are spies in the router suite: the test does not execute actual DomainEvent/OutboxMessage insertion or prove SQL rollback. The production helper source does use its optional client for those writes; a later database integration test must establish the relational behavior. Scope-aware findUnique checks ID, actor and organization, while the findFirst fixture checks actor and organization and is not a complete database query engine.

Debug a failing request by identifying its first boundary. A 403 means tenant membership failed. A 404 may mean a missing enrollment or a version mismatch. A 409 completion result means the required work did not qualify. A 500 for the deliberately malformed stored score is an internal configuration failure. For a successful mutation, check the transaction and side-effect arguments as well as the response. A no-op or terminal request legitimately has zero transactions; zero is not automatically a failure.

Run from the project root after the installation and generation steps in [verification](VERIFICATION.md):

```powershell
npm run test --workspace @lms/api
npm run test --workspace @lms/domain
```

The domain tests load source directly. API Vitest configuration and TypeScript paths also resolve the domain source, while production runtime imports need its compiled package. The ordered build emits domain output before application packages. Neither a successful compile nor mocked request establishes PostgreSQL availability, Redis delivery, browser interaction or certificate PDF generation. Keep those operational claims separate from this suite's concrete control-flow evidence.

## What the mocked transaction proves, and what it cannot

The route suite drives Express with a fake `prisma` whose `$transaction` simply runs the callback with a `Proxy` over the same object. That proves the route *uses* the transaction client for every write (the assertions count calls on `testState.tx`) and, with the new failing-commit test, that a failed transaction is not reported as success. It cannot prove that PostgreSQL discarded the enrollment, the lesson progress and the domain event together; a fake has nothing to roll back.

To prove the rollback, write one integration test against a disposable database:

```ts
// apps/api/src/routes/enroll.integration.test.ts (runs only when TEST_DATABASE_URL is set)
const prisma = new PrismaClient({ datasources: { db: { url: process.env.TEST_DATABASE_URL } } });
await prisma.$executeRawUnsafe("CREATE OR REPLACE FUNCTION fail_event() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected'; END $$");
await prisma.$executeRawUnsafe("CREATE TRIGGER fail_event BEFORE INSERT ON \"DomainEvent\" FOR EACH ROW EXECUTE FUNCTION fail_event()");
await expect(dispatchAgainst(prisma, "POST", "/courses/course-1/enroll")).rejects.toBeTruthy();
expect(await prisma.enrollment.count()).toBe(0);
expect(await prisma.lessonProgress.count()).toBe(0);
```

Run it with `docker run --rm -d -e POSTGRES_PASSWORD=local-test -p 5432:5432 postgres:18`, `npx prisma migrate deploy` against that URL, then `TEST_DATABASE_URL=... npm test --workspace @lms/api`.

