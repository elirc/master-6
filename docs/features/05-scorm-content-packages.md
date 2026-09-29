# Feature: SCORM-Like Content Packages

## Goal

Represent imported structured training packages without fully implementing SCORM runtime behavior.

## Impacted Areas of the Codebase

- Prisma model: `ContentPackage`.
- Course version detail include.

## Implementation Approach

The model stores a package name and manifest JSON under a course version.

## Design Considerations

The realistic boundary is storing the manifest and mapping it into lessons later. Full SCORM sequencing is intentionally out of scope.

## Build Journal

Implemented content package storage in the schema. It connects to course versions so imported package content can vary by published version.

A junior developer should learn to create a durable boundary for a complex external standard before implementing every edge case.
