# Final System Design

## Repository Structure

- `apps/api`: Express modular monolith API with Prisma.
- `apps/web`: Next.js SaaS frontend.
- `apps/worker`: BullMQ worker process.
- `packages/domain`: shared business rules and tests.
- `docs/architecture`: architecture planning, journal, and final design.
- `docs/features`: feature plans and build journals.
- `docs/code-walkthroughs`: guided reading for important files.
- `docs/backlog`: phased product backlog.

## Major Modules

### Identity and Authorization

Users belong to organizations through memberships. Membership roles are `LEARNER`, `INSTRUCTOR`, `ORG_ADMIN`, and `ADMIN`. API middleware loads the current user and checks organization-scoped roles.

### Content and Authoring

Courses are stable product records. Course versions hold publishable learning content. Modules and lessons belong to versions. This separation lets instructors draft future versions without changing what learners already enrolled in.

### Learner Activity

Enrollments connect users to course versions. Lesson progress, quiz attempts, assignment submissions, and certificates are separate records so the system can report and audit learning history.

### Assessment

Quizzes have definitions, questions, options, attempt policies, randomized question order, and attempts. Assignments have definitions, submissions, rubrics, grading state, score, and feedback.

### Certification

Certificates are generated artifacts with verification codes and revocation status. They are issued after completion rules are met.

### Reporting and Administration

Admin routes expose dashboards, organization reports, transcripts, audit logs, bulk import, CSV export requests, feature flags, impersonation, and API key management.

### Async Platform

Domain events and outbox messages record asynchronous work. The worker processes certificates, notifications, video assets, and outbox dispatch with retry policies.

## Key Workflows

1. Instructor creates a course and draft course version.
2. Instructor adds modules, lessons, quizzes, assignments, and rubrics.
3. Instructor publishes the course version.
4. Learner enrolls in the published version.
5. System creates lesson progress rows.
6. Learner completes lessons, submits assignments, and attempts quizzes.
7. Instructor grades submissions and provides feedback.
8. Learner completes the enrollment.
9. System issues a certificate if rules are met.
10. Admins report on completion and audit important actions.

## System Design Decisions

- Modular monolith instead of microservices to teach boundaries without distributed complexity.
- Prisma schema as the central domain map.
- Pure domain helpers for high-risk business rules.
- Backend authorization as source of truth.
- Versioned content to preserve learner history.
- Outbox pattern to prepare for reliable async integration.
- Documentation as part of the codebase, not a separate afterthought.

## Tradeoffs

- The frontend uses demo data fallbacks so it can teach the UI without requiring infrastructure first.
- API routes are modular but still intentionally simple; a larger production app might add service classes per module.
- SCORM, video processing, exports, and public API are production-shaped scaffolds, not full external integrations.
- Reporting uses direct Prisma queries rather than materialized analytics tables.

## Improvements

- Add full Playwright workflows against a seeded local database.
- Add generated OpenAPI contracts from route schemas.
- Add real CSV export artifact storage.
- Add full SCORM runtime tracking.
- Add cycle detection for prerequisites.
- Add richer tenant isolation tests.
- Add CI with PostgreSQL and Redis service containers.
- Add migration review checklists and schema-change ADRs.
