# Feature: Prerequisites and Learning Paths

## Goal

Support ordered learning journeys and course dependencies.

## Impacted Areas of the Codebase

- Prisma models: `LearningPath`, `LearningPathItem`, `CoursePrerequisite`.
- Catalog course detail includes prerequisites.

## Implementation Approach

Learning paths are ordered collections of courses. Prerequisites connect a course to required prior courses.

## Design Considerations

Prerequisites are graph-like data; future work should detect cycles and enforce completion before enrollment.

## Build Journal

Implemented schema support and API include for prerequisites.

A junior developer should learn to separate roadmap structure from course content itself.
