# Feature: Admin Impersonation and Feature Flags

## Goal

Add enterprise support tooling and controlled rollout mechanisms.

## Impacted Areas of the Codebase

- Prisma models: `ImpersonationSession`, `FeatureFlag`.
- Admin routes.
- Domain helper: `isFeatureEnabled`.

## Implementation Approach

Impersonation sessions record actor, target, reason, and time. Feature flags store organization-scoped rollout settings.

## Design Considerations

Impersonation is powerful and must be auditable. Feature flags should be deterministic per subject.

## Build Journal

Implemented session storage, feature flag route, and deterministic flag helper.

A junior developer should learn that operational power needs guardrails.
