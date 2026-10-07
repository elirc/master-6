# 05 - Practice

Every exercise has a **Goal** and a **Check**. Record your prediction before
running anything or opening [06](./06-SOLUTIONS-AND-REVIEW.md).

The runnable checks need only Node 22.6+ (for `--experimental-strip-types`)
and **no `npm install`**: they import the pure TypeScript in
`packages/domain/src/` directly. Save each test file in a scratch folder
outside the repo and run it from the repo root, for example:

```
node --experimental-strip-types --test ../scratch/ex04-required-sets.test.mjs
```

Route-level behavior (`apps/api`) needs Express, Zod and Prisma installed, so
those exercises are reading exercises whose Check is a line range or an
existing Vitest case.

## Exercise 1 - Map the trust boundary

**Goal:** a request sends `x-organization-id: org-1`; the actor belongs only
to `org-2`. Name the function that runs before any enrollment query and the
status returned.

**Check:** `apps/api/src/routes/learner.routes.ts` lines 15-21, and the
`"blocks foreign actor and organization enrollment writes"` case in
`learner.routes.test.ts`.

## Exercise 2 - Select a version

**Goal:** a `PUBLISHED` course has `currentVersionId: "version-2"`, which is
`DRAFT`; `version-1` is published. Which version does enrollment use, and
what is the response?

**Check:** lines 65-74 of the route, and the
`"enrolls only against the course current published version"` case.

## Exercise 3 - Scope content to the enrolled version

**Goal:** enrollment `e1` is on `version-1`. A learner posts
`/quizzes/quiz-draft/attempts` for a quiz on `version-2`. Which comparison
rejects it, with what status, and is `quizAttempt.create` called? Do the
lesson and assignment routes answer with the same status?

**Check:** lines 162-168 (quiz), 115-116 (lesson), 219-220 (assignment), and
the `"blocks lesson, quiz, and assignment IDs from another enrolled version"`
case, which expects 404 for all three and zero transactions.

## Exercise 4 - Absent rows never satisfy a required set

**Goal:** predict `isCourseComplete` for a rule requiring `quiz-1` when the
learner has no attempts, and when the only attempt failed.

Save as `ex04-required-sets.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const { isCourseComplete } = await import(pathToFileURL(path.join(process.cwd(), 'packages/domain/src/completion.ts')));
const lessons = [{ lessonId: 'lesson-1', status: 'COMPLETED' }];
const rule = { requireAllLessons: false, requiredLessonIds: ['lesson-1'], requiredQuizIds: ['quiz-1'], minimumQuizScore: 80, requiredAssignmentIds: [] };

test('no attempt for a required quiz -> not complete', () => {
  assert.equal(isCourseComplete({ rule, lessonProgress: lessons, quizAttempts: [], assignmentSubmissions: [] }), false);
});

test('a failed attempt does not count, a passing one at or above the minimum does', () => {
  const failed = { quizId: 'quiz-1', score: 95, passed: false, submittedAt: new Date() };
  const passed = { quizId: 'quiz-1', score: 80, passed: true, submittedAt: new Date() };
  assert.equal(isCourseComplete({ rule, lessonProgress: lessons, quizAttempts: [failed], assignmentSubmissions: [] }), false);
  assert.equal(isCourseComplete({ rule, lessonProgress: lessons, quizAttempts: [failed, passed], assignmentSubmissions: [] }), true);
});

test('passed but below minimumQuizScore -> not complete', () => {
  const low = { quizId: 'quiz-1', score: 79, passed: true, submittedAt: new Date() };
  assert.equal(isCourseComplete({ rule, lessonProgress: lessons, quizAttempts: [low], assignmentSubmissions: [] }), false);
});
```

**Check:** `# pass 3`. Point to the line in `completion.ts` that makes
`passed: false` with a score of 95 insufficient.

## Exercise 5 - Explicit empty list vs omitted list

**Goal:** show that `requiredAssignmentIds: []` means "none required" while an
omitted list with `requireAssignmentsGraded: true` and no submissions does not
complete; and that the legacy `requireAllLessons` path refuses an empty
progress list.

Save as `ex05-empty-vs-omitted.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const { isCourseComplete } = await import(pathToFileURL(path.join(process.cwd(), 'packages/domain/src/completion.ts')));
const lessons = [{ lessonId: 'lesson-1', status: 'COMPLETED' }];
const base = { lessonProgress: lessons, quizAttempts: [], assignmentSubmissions: [] };

test('explicit empty assignment list + requireAssignmentsGraded -> complete', () => {
  const rule = { requireAllLessons: true, requiredLessonIds: ['lesson-1'], requiredQuizIds: [], requiredAssignmentIds: [], requireAssignmentsGraded: true };
  assert.equal(isCourseComplete({ rule, ...base }), true);
});

test('omitted assignment list + requireAssignmentsGraded + no submissions -> not complete', () => {
  const rule = { requireAllLessons: true, requiredLessonIds: ['lesson-1'], requireAssignmentsGraded: true };
  assert.equal(isCourseComplete({ rule, ...base }), false);
});

test('legacy requireAllLessons with no progress rows -> not complete', () => {
  const rule = { requireAllLessons: true };
  assert.equal(isCourseComplete({ rule, lessonProgress: [], quizAttempts: [], assignmentSubmissions: [] }), false);
});
```

**Check:** `# pass 3`. Then explain why the *route* would never send the
second rule to the domain unchanged (hint: `completionRuleFor`, line 380).

## Exercise 6 - Completion is not certificate eligibility

**Goal:** a rule requires only `lesson-1`, the version has two lessons, and
only `lesson-1` is complete. Predict: does the course complete, what is the
percent, and is a certificate issued?

Save as `ex06-completion-vs-certificate.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const d = await import(pathToFileURL(path.join(process.cwd(), 'packages/domain/src/completion.ts')));
const progress = [{ lessonId: 'lesson-1', status: 'COMPLETED' }, { lessonId: 'lesson-2', status: 'NOT_STARTED' }];

test('completes, 50 percent, no certificate', () => {
  const rule = { requireAllLessons: false, requiredLessonIds: ['lesson-1'], requiredQuizIds: [], requiredAssignmentIds: [] };
  assert.equal(d.isCourseComplete({ rule, lessonProgress: progress, quizAttempts: [], assignmentSubmissions: [] }), true);
  const completionPercent = d.calculateLessonCompletionPercent(progress);
  assert.equal(completionPercent, 50);
  // The route passes these two flags as literal true (learner.routes.ts:296-297)
  assert.equal(d.canIssueCertificate({ completionPercent, enrollmentStatus: 'COMPLETED', requiredAssignmentsComplete: true, requiredQuizPassed: true }), false);
});

test('a course with zero lessons is 0 percent, so never certificate-eligible', () => {
  assert.equal(d.calculateLessonCompletionPercent([]), 0);
});
```

**Check:** `# pass 2`. Which side effects does the completion transaction
still write in the first case? (Lines 299-328.)

## Exercise 7 - Time semantics of progress

**Goal:** existing progress has `startedAt` and `completedAt` set; the learner
posts `IN_PROGRESS`, then `COMPLETED` again. Which timestamp survives each
step?

**Check:** lines 125-126 of the route; the
`"sets progress timestamps without replacing an existing start"` case covers
only the `COMPLETED` branch, so the `IN_PROGRESS` answer rests on reading
line 125.

## Exercise 8 - Deterministic question selection

**Goal:** the attempt seed is `${enrollmentId}-${attemptCount + 1}`
(route line 177). Predict whether attempt 1 always gets the same questions,
and whether attempt 2 can differ.

Save as `ex08-seeded-selection.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const { selectRandomizedQuestionIds, scoreQuiz } = await import(pathToFileURL(path.join(process.cwd(), 'packages/domain/src/quiz.ts')));
const ids = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6'];

test('same seed -> same selection; next attempt number -> a different selection here', () => {
  const a1 = selectRandomizedQuestionIds(ids, 3, 'enrollment-1-1');
  assert.deepEqual(selectRandomizedQuestionIds(ids, 3, 'enrollment-1-1'), a1);
  assert.notDeepEqual(selectRandomizedQuestionIds(ids, 3, 'enrollment-1-2'), a1);
  assert.equal(a1.length, 3);
});

test('answers for questions outside the selection are ignored; option order does not matter', () => {
  const questions = [{ id: 'q1', points: 1, correctOptionIds: ['a', 'b'] }, { id: 'q2', points: 1, correctOptionIds: ['c'] }];
  const answers = [{ questionId: 'q1', selectedOptionIds: ['b', 'a'] }, { questionId: 'q9', selectedOptionIds: ['x'] }];
  assert.deepEqual(scoreQuiz(questions, answers), { earned: 1, possible: 2, score: 50 });
});
```

**Check:** `# pass 2`. Explain what a learner who retries a *failed request*
for the same attempt number sees, and why that is desirable.

## Exercise 9 - Model the completion race

**Goal:** the route reads `status` (line 275) before its transaction
(line 299). Simulate two first-time completions arriving together, with
`Certificate.enrollmentId` unique (schema line 346), for a course that does
and does not qualify for a certificate.

Save as `ex09-completion-race.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';

// In-memory model of learner.routes.ts:260-328. The awaits mark where the real
// handler yields to the database, which is where another request can interleave.
function makeDb() {
  return { enrollment: { id: 'e1', status: 'ACTIVE' }, certificates: new Set(), audits: 0, events: 0 };
}
async function complete(db, eligibleForCertificate) {
  const snapshot = { ...db.enrollment };            // findUnique (pre-read)
  await null;
  if (snapshot.status === 'COMPLETED') return 'replay';
  await null;                                       // $transaction begins
  const staged = { audits: 0, events: 0 };
  db.enrollment.status = 'COMPLETED';               // enrollment.update (no status predicate)
  if (eligibleForCertificate) {
    if (db.certificates.has('e1')) throw Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
    db.certificates.add('e1');
  }
  staged.audits++; staged.events++;
  db.audits += staged.audits; db.events += staged.events;  // commit
  return 'completed';
}

test('certificate path: the unique key turns the loser into an unmapped error', async () => {
  const db = makeDb();
  const results = await Promise.allSettled([complete(db, true), complete(db, true)]);
  assert.deepEqual(results.map((r) => r.status), ['fulfilled', 'rejected']);
  assert.equal(results[1].reason.code, 'P2002');
  assert.equal(db.events, 1);
});

test('no-certificate path: nothing unique is written, so both commit', async () => {
  const db = makeDb();
  const results = await Promise.all([complete(db, false), complete(db, false)]);
  assert.deepEqual(results, ['completed', 'completed']);
  assert.equal(db.audits, 2);
  assert.equal(db.events, 2);
});
```

**Check:** `# pass 2`. Then propose the smallest route change that makes the
second test produce one `completed` and one `replay` (answer in 06,
Finding 2).

## Exercise 10 - Review a resubmission

**Goal:** an assignment is `GRADED` with `score: 92`. The learner posts a new
submission for it. Read lines 221-242 and write down the row's `status`,
`score` and `gradedById` afterwards, and whether the enrollment's `status`
was consulted.

**Check:** compare with 06, Finding 1. Then write the Vitest case you would
add to `learner.routes.test.ts` (it needs `npm ci` to run): an
`assignmentSubmission.upsert` spy, and an assertion that a `GRADED` row is
not moved back to `SUBMITTED`.

## Exercise 11 - Name the limits

**Goal:** name two claims the mocked router suite cannot prove, and the two
commands that run the API and domain suites.

**Check:** 04's "What the mocked transaction proves" section and the
commands in [VERIFICATION](./VERIFICATION.md).
