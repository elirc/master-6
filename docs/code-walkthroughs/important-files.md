# Code Walkthroughs for Important Files

These walkthroughs cover the most architecturally important files in the first codebase. Read them in this order when learning the system.

## `apps/api/prisma/schema.prisma`

### What the File Does

Defines the product database model: organizations, users, memberships, courses, versions, modules, lessons, enrollments, progress, quizzes, assignments, certificates, reporting support, audit logs, events, and operational records.

### Why It Exists

In a business application, the schema is a large part of the architecture. The API and frontend are easier to understand after you understand the nouns and relationships.

### Connections

- Seed data in `apps/api/prisma/seed.ts` creates realistic rows for this schema.
- API routes query and mutate these models.
- Domain helpers assume the same conceptual boundaries: content is separate from progress, definitions are separate from attempts/submissions.

### Important Sections

- `Course` and `CourseVersion`: stable course identity versus published/draft content.
- `Enrollment` and `LessonProgress`: learner state.
- `Quiz`, `QuizQuestion`, `QuizAttempt`: assessment definition versus attempt history.
- `Certificate`: generated artifact and verification record.
- `DomainEvent` and `OutboxMessage`: async integration boundary.

### Senior-Level Concepts

The schema protects historical truth. Learners enroll in a course version, so later authoring changes do not rewrite what they completed.

### How to Read It

Start with `Organization`, `User`, and `Membership`, then follow one course through `CourseVersion`, `Module`, `Lesson`, `Enrollment`, `LessonProgress`, `QuizAttempt`, `AssignmentSubmission`, and `Certificate`.

## `packages/domain/src/authorization.ts`

### What the File Does

Provides shared authorization helpers for role checks and sensitive actions.

### Why It Exists

Permissions are business rules. They should not be scattered across controllers and UI components.

### Connections

- API middleware uses these helpers.
- Tests in `domain.test.ts` protect role behavior.
- Frontend role checks should mirror this only for UX, not security.

### Important Sections

- `roleRank`: defines role hierarchy.
- `canManageCourse`: course authoring policy.
- `canViewLearnerRecord`: transcript/reporting policy.
- `canImpersonate`: support tooling guardrail.

### Senior-Level Concepts

The backend is the source of truth. Frontend navigation can hide buttons, but API middleware must enforce access.

### How to Read It

Read from general helpers to specific policies. Ask, “which product workflow needs this rule?”

## `packages/domain/src/completion.ts`

### What the File Does

Calculates lesson completion and course/certificate eligibility.

### Why It Exists

Completion logic affects certificates, reporting, learner dashboards, and compliance. That makes it too important to bury in one route.

### Connections

- Learner dashboard progress uses the percentage helper.
- Enrollment completion uses certificate eligibility.
- Tests describe the expected behavior.

### Important Sections

- `calculateLessonCompletionPercent`.
- `isCourseComplete`.
- `canIssueCertificate`.

### Senior-Level Concepts

Small pure functions make high-risk business logic easy to test without databases, servers, or browsers.

### How to Read It

Read each function as a policy sentence. Then find the API route that calls it.

## `packages/domain/src/quiz.ts`

### What the File Does

Scores quiz answers, checks retake limits, and deterministically randomizes question selection.

### Why It Exists

Assessment logic needs repeatability and auditability.

### Connections

- `apps/api/src/routes/learner.routes.ts` uses these helpers when creating quiz attempts.
- `domain.test.ts` verifies scoring and deterministic randomization.

### Important Sections

- `scoreQuiz`: exact answer matching.
- `canStartQuizAttempt`: policy helper.
- `selectRandomizedQuestionIds`: seeded randomization.

### Senior-Level Concepts

Randomized assessment systems must store what the learner saw. The route stores `questionOrder` in `QuizAttempt`.

### How to Read It

Trace an attempt from selected answers to score, then read the API route to see persistence.

## `apps/api/src/middleware/auth.ts`

### What the File Does

Authenticates JWTs and enforces organization-scoped roles.

### Why It Exists

Most enterprise SaaS bugs are tenant or permission bugs. Central middleware reduces duplicated checks.

### Connections

- Auth route creates JWTs.
- Catalog, learner, authoring, and admin routes require this middleware.
- Domain authorization helpers provide role logic.

### Important Sections

- `requireAuth`: verifies token and loads memberships.
- `requireOrganizationRole`: checks role against `x-organization-id`.

### Senior-Level Concepts

Tenant context must be explicit. This API uses an organization header so routes do not guess which tenant a user is acting in.

### How to Read It

Follow request headers into `request.user`, then into route-level authorization.

## `apps/api/src/routes/learner.routes.ts`

### What the File Does

Owns learner workflows: dashboard, enrollment, lesson progress, quiz attempts, assignment submissions, and completion.

### Why It Exists

This is the core vertical slice of the product.

### Connections

- Calls domain helpers for progress, scoring, randomization, and certificate eligibility.
- Writes domain events and audit logs.
- Reads and writes Prisma models across the learning workflow.

### Important Sections

- `/dashboard`: read model for learner homepage.
- `/courses/:courseId/enroll`: creates enrollment and lesson progress rows.
- `/quizzes/:quizId/attempts`: scores and stores attempts.
- `/enrollments/:enrollmentId/complete`: issues certificates when eligible.

### Senior-Level Concepts

A route should coordinate workflow, not hide all business logic. Notice how pure policy logic lives in `packages/domain`.

### How to Read It

Pick one workflow and trace database writes in order. Enrollment is the best first example.

## `apps/api/src/routes/authoring.routes.ts`

### What the File Does

Provides instructor/admin course authoring operations.

### Why It Exists

Authoring is intentionally separated from learner consumption.

### Connections

- Uses role middleware.
- Writes `Course`, `CourseVersion`, `Module`, and `Lesson`.
- Publishing updates both version and course status.

### Important Sections

- `POST /courses`: creates draft course and version.
- `POST /courses/:courseId/versions`: starts a new draft version.
- `POST /versions/:versionId/publish`: promotes version to published.

### Senior-Level Concepts

Publishing is a state transition. Treat it differently from ordinary editing.

### How to Read It

Read the publish route after the create route to understand lifecycle.

## `apps/api/src/routes/admin.routes.ts`

### What the File Does

Owns enterprise admin workflows: reporting, grading, imports, exports, feature flags, impersonation, transcripts, audit logs, and API keys.

### Why It Exists

Enterprise LMS products are purchased for administration and compliance as much as learning.

### Connections

- Uses organization role middleware.
- Calls domain transcript helper.
- Writes audit logs and domain events.

### Important Sections

- `/dashboard`: high-level training operations summary.
- `/organization-report`: reporting by course.
- `/bulk-import`: learner import.
- `/exports`: async export request.
- `/impersonation`: support session tracking.

### Senior-Level Concepts

Admin routes often need stricter audit and authorization than learner routes because they can affect many users.

### How to Read It

Read the route list as product capabilities, then inspect which roles are allowed.

## `apps/worker/src/worker.ts`

### What the File Does

Processes background jobs for certificates, notifications, video processing, and outbox dispatch.

### Why It Exists

Slow or retryable work should not block API requests.

### Connections

- Queues are defined in `apps/worker/src/queues.ts`.
- Prisma models store job effects.
- Domain events and outbox messages provide async work records.

### Important Sections

- `certificate-generation`: updates certificate artifact URL.
- `notification-delivery`: marks notifications sent.
- `video-processing`: mock processing state transition.
- `outbox-dispatch`: marks pending outbox messages sent.

### Senior-Level Concepts

Retries and idempotency matter. This mock worker is simple, but the structure teaches where production concerns would live.

### How to Read It

Read each worker as a state transition from queued work to durable database update.

## `apps/web/components/app-shell.tsx`

### What the File Does

Defines the shared application chrome and navigation.

### Why It Exists

Real SaaS apps need consistent navigation across role-focused workflows.

### Connections

- Used by all Next.js pages.
- Imports Lucide icons for recognizable controls.
- Links to learner, catalog, course, instructor, admin, reporting, verification, login, and settings pages.

### Important Sections

- `navItems`: the product map.
- `AppShell`: sidebar, topbar, and main content layout.

### Senior-Level Concepts

Navigation reveals product architecture. The app shell makes role boundaries visible to users.

### How to Read It

Map each nav item to an API module or product workflow.

## `apps/web/app/page.tsx`

### What the File Does

Renders the learner dashboard.

### Why It Exists

The learner dashboard is the first everyday workflow: continue courses, see progress, and track due items.

### Connections

- Uses demo data now; can later call `apps/web/lib/api.ts`.
- Mirrors learner API dashboard structure.
- Links conceptually to progress, assignments, quizzes, and certificates.

### Important Sections

- Metrics grid.
- Enrolled courses list.
- Due items table.

### Senior-Level Concepts

A dashboard is a read model. It should be shaped around user decisions, not raw database tables.

### How to Read It

Compare the page sections to the learner API response and identify which fields would become live data.

## `docs/features/*.md`

### What the Files Do

Each feature document records the goal, impacted areas, implementation approach, design considerations, and build journal.

### Why They Exist

They teach the habit of thinking before coding and summarizing after coding.

### Connections

- The backlog links to feature docs.
- The final design document summarizes their combined result.

### Senior-Level Concepts

Maintainability is partly written memory. Future developers need to know why the system is shaped this way.

### How to Read Them

Pick a feature, read the plan, inspect the files it names, then read the build journal.
