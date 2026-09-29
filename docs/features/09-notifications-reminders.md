# Feature: Notifications and Reminders

## Goal

Schedule reminders for due training and other learner events.

## Impacted Areas of the Codebase

- Prisma model: `Notification`.
- Worker queue: `notification-delivery`.
- Seed data.

## Implementation Approach

Notifications store channel, payload, schedule, and status. The worker marks a notification sent.

## Design Considerations

Payloads are JSON for flexibility, but production systems often add templates and delivery-provider records.

## Build Journal

Implemented notification persistence and worker processing.

A junior developer should learn that reminders should be retryable and observable.
