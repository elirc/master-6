# Feature: Retake Policies, Due Dates, Late Submissions, and Completion Rules

## Goal

Represent real assessment policies around attempts, dates, and completion.

## Impacted Areas of the Codebase

- `Quiz.maxAttempts`.
- `Enrollment.dueAt`.
- `Assignment.dueDaysAfterEnrollment`.
- Domain completion helpers.

## Implementation Approach

The quiz attempt route checks max attempts. Enrollments and assignments store due-date inputs. Completion rules live in shared domain helpers.

## Design Considerations

Policy logic belongs in shared helpers so it can be tested without the database.

## Build Journal

Implemented retake enforcement, due-date fields, and domain completion logic.

A junior developer should learn to pull high-risk business rules out of controllers.
