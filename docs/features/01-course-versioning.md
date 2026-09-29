# Feature: Course Versioning

## Goal

Allow course authors to create new versions without rewriting the version learners are already enrolled in.

## Impacted Areas of the Codebase

- Prisma models: `Course`, `CourseVersion`, `Module`, `Lesson`, `Quiz`, `Assignment`.
- API routes: authoring version creation and publishing.
- Learner enrollment: enrollments point to a specific course version.

## Implementation Approach

The schema stores stable course identity in `Course` and versioned content in `CourseVersion`. Modules, lessons, quizzes, assignments, content packages, discussions, and certificates connect to a version. Publishing updates `Course.currentVersionId`.

## Design Considerations

This protects historical learner records. A learner enrolled in version 1 should not see their assignments change when an instructor drafts version 2.

## Build Journal

Implemented course versions in the Prisma schema and authoring routes. This connects to enrollment by storing both `courseId` and `courseVersionId`.

A junior developer should learn that versioning is usually a relationship design problem before it is a UI problem. The tradeoff is more joins and more careful publishing logic.
