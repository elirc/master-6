# Feature: Learner Transcript

## Goal

Show a learner's course history, completion status, and certificates.

## Impacted Areas of the Codebase

- Domain helper: `buildTranscriptSummary`.
- Admin route: `GET /admin/learners/:learnerId/transcript`.
- Prisma model: `LearnerTranscriptRow`.

## Implementation Approach

The route builds transcript summaries from enrollments and certificate records.

## Design Considerations

Transcript rows can later become immutable snapshots for compliance.

## Build Journal

Implemented transcript aggregation helper and route.

A junior developer should learn the difference between live reporting and historical records.
