# Feature: Certificate Verification Page

## Goal

Allow external verification of issued certificates by verification code.

## Impacted Areas of the Codebase

- Prisma model: `Certificate`.
- Certificate route: `GET /certificates/verify/:verificationCode`.
- Next.js verification page.

## Implementation Approach

Certificates store status, artifact URL, issue date, and unique verification code.

## Design Considerations

Certificates are artifacts, not booleans. They can be revoked, verified, and rendered.

## Build Journal

Implemented certificate verification API and frontend page.

A junior developer should learn to model generated documents as first-class records.
