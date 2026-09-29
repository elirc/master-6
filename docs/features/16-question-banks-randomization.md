# Feature: Quiz Question Banks and Randomized Attempts

## Goal

Support reusable question pools and deterministic randomized attempts.

## Impacted Areas of the Codebase

- Prisma models: `QuestionBank`, `QuizQuestion`, `QuizOption`.
- Domain helper: `selectRandomizedQuestionIds`.
- Quiz attempt route.

## Implementation Approach

Questions can belong to a quiz and question bank. Attempts store selected question order.

## Design Considerations

The attempt must store question order so audits and reviews can reproduce what the learner saw.

## Build Journal

Implemented question banks, option scoring, and randomized attempt order storage.

A junior developer should learn that randomness in assessment systems must become durable historical data.
