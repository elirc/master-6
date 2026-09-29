# Feature: Organization-Level Reporting

## Goal

Give organization admins visibility into enrollments, completion, and certificates by course.

## Impacted Areas of the Codebase

- Admin route: `GET /admin/organization-report`.
- Frontend reports page.
- Prisma enrollment and certificate relations.

## Implementation Approach

Reporting queries aggregate course enrollments, completions, and certificate counts.

## Design Considerations

Reporting is a first-class module because enterprise training buyers care about compliance and completion evidence.

## Build Journal

Implemented organization report route and dashboard UI.

A junior developer should learn that reporting should be designed early because it affects schema and indexing decisions.
