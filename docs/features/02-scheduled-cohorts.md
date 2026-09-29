# Feature: Scheduled Cohorts

## Goal

Group learners into scheduled course runs with start and end dates.

## Impacted Areas of the Codebase

- Prisma models: `Cohort`, `Enrollment`.
- Seed data: demo cohort.
- Admin and reporting dashboards.

## Implementation Approach

`Cohort` belongs to an organization and course. Enrollments optionally reference a cohort so reporting can group learners by run.

## Design Considerations

Cohorts are not the course itself. They are scheduling and reporting containers around a course.

## Build Journal

Implemented cohort storage and seeded a May 2026 security cohort. This connects to enrollment workflows through `Enrollment.cohortId`.

A junior developer should learn to avoid mixing schedule state into course content tables. Future improvements include cohort-specific announcements and waitlists.
