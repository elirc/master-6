# Feature: Assignment Rubrics

## Goal

Define scoring criteria for assignments.

## Impacted Areas of the Codebase

- Prisma models: `Rubric`, `RubricCriterion`, `Assignment`.
- Seed data.

## Implementation Approach

Assignments optionally reference rubrics. Rubrics belong to organizations and contain criteria with max points.

## Design Considerations

Rubrics can be reused across assignments and courses.

## Build Journal

Implemented rubric schema and seeded a security scenario rubric.

A junior developer should learn when to normalize reusable grading structure.
