# Feature: Discussion Forums

## Goal

Provide course and lesson discussion threads for learner and instructor collaboration.

## Impacted Areas of the Codebase

- Prisma models: `DiscussionThread`, `DiscussionPost`.
- Course detail API.
- Course workspace UI.

## Implementation Approach

Threads attach to course versions and optionally lessons. Posts attach to threads and authors.

## Design Considerations

Versioned discussions let a changed course keep separate conversation context.

## Build Journal

Implemented discussion models, seeded a thread, exposed discussions in the catalog detail include, and rendered them in the course workspace.

A junior developer should learn that collaboration features often need moderation, permissions, and pagination later.
