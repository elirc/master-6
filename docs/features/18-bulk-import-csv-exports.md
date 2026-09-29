# Feature: Bulk Learner Import and CSV Exports

## Goal

Support common admin operations for enterprise training teams.

## Impacted Areas of the Codebase

- Admin routes: `POST /admin/bulk-import`, `POST /admin/exports`.
- Prisma model: `CsvExport`.
- Worker/outbox boundary.

## Implementation Approach

Bulk import upserts learners and memberships. CSV exports create queued records and domain events.

## Design Considerations

Large imports and exports should eventually become background jobs with downloadable artifacts.

## Build Journal

Implemented learner import route, export request route, and dashboard controls.

A junior developer should learn that admin workflows often need audit logs and async processing.
