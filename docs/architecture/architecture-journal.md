# Architecture Journal

## 2026-05-04 - Initial System Start

The repository starts as an empty workspace, so the first decision is to create the architecture and documentation structure before code. This mirrors real product work: before a team creates routes, models, and screens, it should agree on the main boundaries and vocabulary.

The initial architecture uses a TypeScript monorepo with a modular monolith backend. A modular monolith is a good learning shape because it teaches service boundaries, domain ownership, authorization, database modeling, and background jobs without introducing distributed systems complexity too early.

The first code pass will create:

- Shared domain helpers in `packages/domain`.
- An Express API in `apps/api`.
- A Next.js frontend in `apps/web`.
- A BullMQ-ready worker in `apps/worker`.
- Prisma schema and seed data for the LMS domain.
- Documentation and walkthroughs written for a junior developer growing toward mid-level engineering.

## 2026-05-04 - Initial Expanded Build

The first implementation pass now has the major product boundaries in place. The most important design decision was keeping definitions separate from activity:

- Course content lives under `CourseVersion`.
- Learner state lives under `Enrollment`, `LessonProgress`, `QuizAttempt`, and `AssignmentSubmission`.
- Certificates are generated records, not booleans.

This matters because real enterprise training systems need historical accuracy. If an employee completed version 1 of compliance training, version 2 should not silently rewrite their record.

The frontend is intentionally a product workspace, not a landing page. It has learner, instructor, admin, reporting, settings, catalog, course, and verification screens. The backend has matching routes for the real workflows. The worker gives the system a place for slow or retryable operations.

The backlog features were implemented as a mix of complete vertical workflows and realistic extension points. This keeps the codebase learnable while still showing how a larger SaaS system grows.
