# Feature: Public API for Enterprise Customers

## Goal

Prepare for enterprise integrations using organization-scoped API keys.

## Impacted Areas of the Codebase

- Prisma model: `ApiKey`.
- Admin route: `POST /admin/api-keys`.
- Settings UI.

## Implementation Approach

API keys store a prefix and hash, while the raw key is returned only once.

## Design Considerations

Keys are credentials. They should not be stored in plaintext.

## Build Journal

Implemented API key storage and generation route.

A junior developer should learn why secrets are hashed and why prefixes are useful for lookup and support.
