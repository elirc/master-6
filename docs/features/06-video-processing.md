# Feature: Video Processing Mock Pipeline

## Goal

Show how uploaded training videos would move through asynchronous processing.

## Impacted Areas of the Codebase

- Prisma model: `VideoAsset`.
- Worker queue: `video-processing`.
- Lesson model relation.

## Implementation Approach

Videos start as `UPLOADED`, the worker marks them `READY`, and lessons can reference a video asset.

## Design Considerations

Real encoding would involve object storage, callbacks, and multiple renditions. The mock pipeline teaches the boundary.

## Build Journal

Implemented `VideoAsset` and a BullMQ worker processor with retry policy.

A junior developer should learn that slow media work belongs outside request/response paths.
