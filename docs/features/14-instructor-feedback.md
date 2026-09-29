# Feature: Instructor Feedback Tools

## Goal

Let instructors provide feedback during grading.

## Impacted Areas of the Codebase

- `AssignmentSubmission.feedback`.
- Grading route.
- Instructor submissions UI.

## Implementation Approach

Feedback is stored with graded submissions and returned in assignment workflows.

## Design Considerations

Feedback should be part of the assessment record because it explains the score.

## Build Journal

Implemented feedback fields in grading.

A junior developer should learn that scores without feedback are often poor product experiences.
