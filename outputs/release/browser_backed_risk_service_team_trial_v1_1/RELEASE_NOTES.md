# Release Notes: v1.1

Date: 2026-06-01

## Highlights

- Packages the current 19-action browser-backed risk service for teammate
  trial.
- Removes service-side business normalization from the packaged service.
- All actions use a passthrough transport envelope.
- Legacy `compat_summary` output is not part of v1.1.
- Raw upstream body is suppressed; the service reports status, content type,
  body presence, truncation, observed bytes, elapsed time, and sanitized errors.
- Controlled batch execution is included:
  - `independent_parallel`
  - `dependency_serial`
  - `large_response_serial`
  - `auth_sensitive_serial`
- Archives landing-flow activation fix is included.

## Included Actions

`action_count=19`.

See `service/ACTION_REGISTRY.md` and
`skill/browser_backed_risk_service/ACTION_REGISTRY.md`.

## Security Boundary

The package does not include profile/state files, `.env`, `node_modules`, raw
HAR, run logs, Chrome storage, localStorage dumps, Playwright storage state, or
credential material.

The service must not output cookies, tokens, sessions, request headers,
authorization values, passwords, Chrome profile contents, or raw upstream body.

## Upgrade Notes From v1

v1.1 is a service-contract cleanup release. The local service is now a pure
fixed-action transport layer. Dennis or another upper-layer Agent must handle
business parsing, normalized observations, source quality, evidence cards, and
risk reasoning outside this service.
