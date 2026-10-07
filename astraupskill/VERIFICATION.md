# Verification and reproducible setup

Run from the Master6 project root using Node22.16 or a compatible Node22 environment. The npm workspace lockfile was installed successfully. Prisma client generation uses a placeholder PostgreSQL URL; generation and compilation do not connect to or initialize that database.

```powershell
npm ci
$env:DATABASE_URL = 'postgresql://astra:astra@127.0.0.1:5432/astra_validation'
npm run db:generate
npm run typecheck
npm test
npm run build
```

Do not run db:migrate or db:seed as part of this reproduction. A learner starting the live application must deliberately configure a separate local database and any required Redis service. The recorded checks used neither. The root build now emits the domain package before API, web and worker builds. Typechecking uses the TypeScript source-path mapping and does not itself emit declarations. A source alias in the API Vitest configuration also points tests at the current domain implementation.

**Frozen record (2026-09-13).** The recorded run executed twenty-nine distinct cases: [fifteen domain tests](evidence/root-luna-master6-domain-tests-final-02.json) and [fourteen API tests](evidence/root-luna-master6-api-tests-full-final-01.json), i.e. thirteen learner-route cases plus one app-construction case. Since then two learner cases (look-alike P2002 object, failed commit) were added, so the current files hold 15 + 1 API and 15 domain cases (31); that larger set has not been re-recorded here. Each `evidence/*.json` file is command metadata only: the `.log` files it names were never committed, and its `cwd` and `cmd.exe` command reflect the authoring machine, not a path you should expect to exist. Web and worker commands completed with passWithNoTests and found zero test files. They contribute zero cases and provide no UI/worker behavioral coverage.

The [workspace typecheck](evidence/root-luna-master6-typecheck-full-final-01.json) and [ordered production build](evidence/root-build-final-01.json) exited 0 in that run. [results.json](evidence/results.json) holds the recorded labels, counts and scope. Generated tsbuildinfo content was restored to the original baseline after checks, and build output is not delivered. The source change includes the ordered root build script, learner guards/rule evaluation, transaction-aware event/audit helpers and actual route fixtures.

The router fixture replaces Prisma delegates, JWT middleware and event/audit helpers. It verifies expected branches and the transaction client passed to helper spies; it does not establish real PostgreSQL rollback, unique constraint behavior, concurrent completion/retake limits or eventual outbox delivery. The terminal replay case starts from an already-completed record. Stable certificate identity does not imply an identical relation-rich response or serialized concurrent requests. The actual schema already makes enrollmentId and verificationCode unique, but the ID-suffix code generator has no collision retry.

No certificate PDF, payment, external message, browser session or Redis worker was generated/exercised. Existing post-completion progress edits, permissive completion source statuses, development JWT fallback and unexpected error-message disclosure remain outside this increment. These limits are expanded into file:line findings in [solutions](06-SOLUTIONS-AND-REVIEW.md). Original snapshots are available for each changed baseline source file, so compare the before and after code when practicing without relying on this explanation alone.
