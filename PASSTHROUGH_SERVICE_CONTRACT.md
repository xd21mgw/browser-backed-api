# Passthrough Service Contract

This document defines the current service-layer contract for the browser-backed
risk platform access service.

## Positioning

The service is a local controlled platform interface service. It receives a
fixed action name and typed params, maps them to a fixed platform origin/path,
uses the browser-managed login state in the teammate's local Chrome profile,
performs a same-origin fetch, and returns a safe transport envelope.

The service does not parse business meaning. Dennis or another upper layer owns
all business parsing, observations, quality scoring, evidence cards, and risk
reasoning.

## Responsibilities

The service is responsible for:

- fixed action allowlist
- typed params validation
- fixed origin/path/body construction
- browser session startup and prewarm
- same-origin fetch
- timeout handling
- response-size guard
- raw upstream body suppression
- credential-material output protection
- controlled parallel batch scheduling
- per-source transport status

The service is not responsible for:

- business summaries
- observations
- source quality scoring
- evidence cards
- no-data interpretation
- strategy-hit interpretation
- final risk judgment
- next-step recommendation
- DataAgent/Hive calls
- automatic disposal or upstream write actions
- permission bypass or account escalation

## Single Action Envelope

The action response is passthrough-only and transport-only. Raw upstream body is
not returned.

```json
{
  "ok": true,
  "action": "login_logs_search",
  "action_name": "login_logs_search",
  "request_id": "local_xxx",
  "request_mode": "fixed_action",
  "response_mode": "passthrough",
  "platform": "login_logs",
  "http_status": 200,
  "content_type": "application/json",
  "body_present": true,
  "body_truncated": false,
  "observed_bytes": 1234,
  "elapsed_ms": 42,
  "transport_error": null,
  "platform_error": null,
  "invalid_params": false,
  "timeout": false,
  "auth_redirect_detected": false,
  "raw_body_handling": "suppressed",
  "upstream": {
    "status": 200,
    "content_type": "application/json",
    "body_present": true,
    "body_omitted": true,
    "body_truncated": false,
    "response_too_large": false,
    "observed_bytes": 1234,
    "raw_body_handling": "suppressed"
  },
  "meta": {
    "origin": "login_logs",
    "latency_ms": 42,
    "fetched_at": "2026-06-01T00:00:00.000Z"
  },
  "safety": {
    "credential_material_output": false,
    "request_headers_output": false,
    "browser_profile_material_output": false
  }
}
```

Too-large response example:

```json
{
  "ok": false,
  "action": "rcp_event_feature_list",
  "response_mode": "passthrough",
  "error_type": "response_too_large",
  "body_present": true,
  "body_truncated": true,
  "raw_body_handling": "suppressed",
  "upstream": {
    "status": 200,
    "content_type": "application/json",
    "body_present": true,
    "body_omitted": true,
    "body_truncated": true,
    "response_too_large": true,
    "raw_body_handling": "suppressed",
    "error_type": "response_too_large"
  },
  "safety": {
    "credential_material_output": false,
    "request_headers_output": false,
    "browser_profile_material_output": false
  }
}
```

## Input Boundary

Allowed:

- fixed action names from the action allowlist
- typed params accepted by each action contract
- fixed enum or mode fields that are part of the action contract
- optional `response_mode=passthrough`

Forbidden:

- arbitrary URL
- caller-provided origin
- caller-provided path or endpoint
- caller-provided headers
- caller-provided cookies
- caller-provided tokens
- caller-provided sessions
- caller-provided authorization strings
- raw request body passthrough
- raw query passthrough
- Agent-built platform URLs

The service listens only on `127.0.0.1`.

## Output Boundary

Allowed:

- envelope metadata
- upstream HTTP status
- content type
- body presence boolean
- body truncation boolean
- observed byte count
- elapsed time
- sanitized transport/platform/auth error type
- safety booleans

Forbidden:

- raw upstream response body
- request headers
- response `set-cookie` headers
- cookies, tokens, sessions, authorization values, passwords
- Chrome profile file contents
- localStorage / browser storage dumps
- Playwright storage state
- caller-provided auth material

If the upstream body appears to contain authentication material, the service
fails closed or suppresses it. `safety.credential_material_output` must remain
`false`.

## Controlled Batch Execution

Batch endpoints:

- `POST /actions/batch`
- `POST /actions/multi_source_plan`

Each source must contain:

- `source_id`
- allowlisted `action`
- typed `params`
- optional `timeout_ms`

Each group must use one execution mode:

- `independent_parallel`
- `dependency_serial`
- `large_response_serial`
- `auth_sensitive_serial`

Batch output contains:

- `source_results`
- `transport_status_matrix`
- `classifications`
- `missing_or_failed_sources`
- `execution_groups`
- `safety`

Source failures are isolated. A source with no data, auth failure, blocked
readiness, timeout, parse/transport error, or invalid params must not prevent
unrelated sources from completing.

Batch must not return raw upstream bodies and must not generate business
observations, evidence cards, source quality scoring, or risk conclusions.

## Division Of Responsibility

The browser-backed service:

- fetches fixed platform responses through the local browser session
- enforces fixed origin/path/input/output boundaries
- reports safe transport status

Dennis or the upper-layer Agent:

- decides which actions to call
- parses any platform response through its own trusted parser path
- creates observations and evidence cards
- applies output policy for internal review or external sharing
- performs human-facing reasoning and final judgment
