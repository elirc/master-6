# Feature: Grading Workflows

## Goal

Let instructors review submitted assignments, assign scores, and provide feedback.

## Impacted Areas of the Codebase

- Prisma model: `AssignmentSubmission`.
- Admin route: `POST /admin/submissions/:submissionId/grade`.
- Instructor UI submissions table.

## Implementation Approach

Submissions move through `DRAFT`, `SUBMITTED`, `RETURNED`, and `GRADED`. Grading stores scorer, score, feedback, and timestamp.

## Design Considerations

Submission state must be separate from assignment definition because every learner has their own lifecycle.

## Build Journal

Implemented grading fields and route. The instructor dashboard highlights pending submissions.

A junior developer should learn to model workflow state explicitly instead of inferring it from nullable timestamps alone.
