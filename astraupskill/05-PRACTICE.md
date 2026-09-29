# 05 - Practice

Work from the actual router and domain files linked in the [README](./README.md). Each exercise has a concrete input and an observable result. Record the result before opening the answer key; the goal is to reason from scope, version, and requirement sets rather than from route names.

**Exercise 0 - Map the trust boundary.** A request sends `x-organization-id: org-1` and the actor belongs only to `org-2`. Which operation should run before any enrollment query, and what status should the request receive?

**Exercise 1 - Select a version.** A `PUBLISHED` course has `currentVersionId: "version-2"`; `version-2` is `DRAFT`, while `version-1` is published. Should enrollment use either version? Name the response and the invariant being protected.

**Exercise 2 - Scope content.** Enrollment `e1` points to `version-1`. A request posts `/quizzes/quiz-draft/attempts`, and the quiz belongs to `version-2`. Which comparison rejects it, and should `quizAttempt.create` be called?

**Exercise 3 - Detect an absent requirement.** The rule requires `requiredQuizIds: ["quiz-1"]`, but attempts is `[]`. Predict `isCourseComplete` and explain why an empty array must not satisfy the requirement.

**Exercise 4 - Permit no assessments.** The rule contains completed `requiredLessonIds: ["lesson-1"]`, `requiredQuizIds: []`, `requiredAssignmentIds: []`, and `requireAssignmentsGraded: true`. Progress has a completed `lesson-1`, with no attempts or submissions. Is completion valid?

**Exercise 5 - Preserve time semantics.** Existing progress has `startedAt` set and `completedAt` set. The learner posts `IN_PROGRESS`. Which timestamp should remain and which one does this implementation clear?

**Exercise 6 - Group side effects.** During completion, list the writes that must be called with the transaction client: enrollment status, certificate, audit, and what event records? Why is the client argument significant?

**Exercise 7 - Replay.** A completed enrollment already has certificate `certificate-1`. A second completion request arrives. Predict status, certificate identity, transaction count, and event count in the router fixture.

**Exercise 8 - Review the boundary.** Name two claims the mock suite cannot prove. Then identify the actual test file and the two project-relative commands that run the API route suite and domain suite.

Keep answers short but cite the relevant field or predicate. In particular, distinguish an explicit empty requirement list from an omitted list, and distinguish the enrolled version from `course.currentVersionId` after enrollment.

## Implement-it exercises

**Exercise 9 - Guard a route Astra did not cover.** Pick one learner route without the three-scope guard (organization, user, enrolled version). Add it and write the tests: a request naming another organization's enrollment is 404; a request naming another user's enrollment is 404; a quiz from the wrong version is 403 with the enrollment unchanged. Acceptance: the three tests pass and the existing suite is unchanged.

**Exercise 10 - Withdraw transactionally.** Add `POST /enrollments/:id/withdraw` that sets `status: "WITHDRAWN"`, deletes pending lesson progress, and records exactly one `enrollment.withdrawn` domain event and outbox row on the transaction client. Acceptance: a mock test counts one transaction and one event; a repeated withdraw is a 409 with no second event.

**Exercise 11 - Red first.** Write a failing test for the rule "a course with an empty `requiredLessonIds` and no assessments cannot be completed by an empty progress record" in `packages/domain`, then make it pass without breaking the existing completion tests. Acceptance: the test was red before the change (paste the failing output into your notes).

