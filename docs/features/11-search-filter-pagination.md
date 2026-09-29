# Feature: Course Search, Filtering, and Pagination

## Goal

Make the catalog usable for growing course libraries.

## Impacted Areas of the Codebase

- Catalog route: `GET /catalog/courses`.
- Catalog page controls.

## Implementation Approach

The API accepts `q`, `status`, `page`, and `pageSize`, returning pagination metadata.

## Design Considerations

Search is intentionally simple at first. PostgreSQL full-text search or an external index could be added later.

## Build Journal

Implemented query parameters and catalog UI controls.

A junior developer should learn to include pagination before tables become large.
