# Future Feature Backlog

The initial build intentionally includes a broad slice of the LMS product so later features have realistic places to land. The backlog below is organized as product phases. Each item has a companion feature document in `docs/features`.

## Phase 1 - Content Lifecycle

1. Course versioning
2. Scheduled cohorts
3. SCORM-like content packages
4. Video processing mock pipeline
5. Course search/filtering/pagination
6. Prerequisites and learning paths

## Phase 2 - Assessment Depth

1. Grading workflows
2. Assignment rubrics
3. Quiz question banks
4. Randomized quiz attempts
5. Retake policies
6. Due dates and late submissions
7. Completion rules

## Phase 3 - Learner Experience

1. Discussion forums
2. Notifications and reminders
3. Learner transcript
4. Certificate verification page
5. Instructor feedback tools

## Phase 4 - Enterprise Administration

1. Organization-level reporting
2. Public API for enterprise customers
3. Bulk learner import
4. CSV exports
5. Admin impersonation
6. Feature flags

## Phase 5 - Platform Maturity

1. Domain events
2. Outbox pattern
3. Background job retry policies
4. Observability and health checks
5. API contracts
6. End-to-end tests
7. Database migration discipline
8. Final system design documentation

## Implementation Status

All backlog items are represented in the initial expanded codebase. Some are deep product workflows, such as enrollments, grading, quiz attempts, and certificates. Others are production-shaped scaffolds that show where a real implementation would continue, such as SCORM import, video processing, public API keys, and CSV export workers.
