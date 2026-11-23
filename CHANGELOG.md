# Changelog

All notable changes to this project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] - 2026-11-23

### Fixed

- Read QStash delivery events from the `/v2/logs` response so scheduled deliveries persist in task logs and refresh dashboard run timestamps.
- Label QStash task and keepalive schedules with their name and cron expression for easier identification.

## [1.0.0] - 2026-11-22

### Added

- Scheduled Discord webhook task management with create, update, duplicate, pause, resume, delete, and manual-run operations.
- Visual Discord embed builder, raw JSON payload editing, starter samples, execution logs, task statistics, and API-key management.
- Account registration, email OTP verification, browser sessions, password recovery, and tenant-scoped data access.
- QStash v2 scheduling with an APScheduler fallback for local and self-hosted operation.
- 55 backend tests and 27 frontend unit tests covering task lifecycle, scheduling, retries, authentication, webhook delivery, tenant authorization, OTP flows, and QStash behavior.

### Security

- Restricted outbound webhook URLs to approved HTTPS Discord hosts to mitigate server-side request forgery.
- Added `HttpOnly` cookies, CSRF validation, refresh-session rotation, session revocation, and reset-token handling.
- Stored API keys as SHA-256 hashes and enforced per-user ownership for tasks and API keys.
- Added database constraints, indexes, and idempotent task-log external IDs for safer concurrent and remote scheduler operation.

### Infrastructure

- Added Docker Compose services for PostgreSQL 16, Flask with Gunicorn, Next.js, and an optional Cloudflare Tunnel profile.
- Added Alembic migrations for the initial task schema, user accounts, refresh rotation, ownership, hardening constraints, and QStash log synchronization.
- Deployed PulseHook to a personal VPS behind Cloudflare DNS and Cloudflare Tunnel at https://pulsehook.bagos.web.id.
