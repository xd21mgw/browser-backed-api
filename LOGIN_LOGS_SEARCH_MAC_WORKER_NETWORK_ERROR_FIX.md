# Login Logs Search Mac Worker Network Error Fix

## Scope

Action: `login_logs_search`

Mode: Remote Main Agent + Mac Local Worker

Service positioning remains unchanged: fixed action + typed params + fixed
origin/path + browser session + safe passthrough transport envelope. The service
does not produce summary, source card, source quality, evidence card, no-data
interpretation, or risk judgment.

## Symptom

Before the fix, `login_logs_search` could fail while `/health` showed
`login_logs` origin ready:

| Field | Before Fix |
| --- | --- |
| service HTTP status | `200` |
| action | `login_logs_search` |
| `ok` | `false` |
| `error_type` | `network_error` |
| `upstream.status` | `null` |
| `body_present` | `false` |
| `observed_bytes` | `0` |
| `raw_body_handling` | `suppressed` |
| `safety.credential_material_output` | `false` |

The failure was stable and fast even when the login logs origin was warmed and
page-ready.

## Root Cause

The action used page-context `fetch()` from the
`user-center-workbench.corp.kuaishou.com` page. In Mac Local Worker live smoke,
that page-context fetch could fail before an upstream response was available.

This is an action fetch implementation issue, not a profile issue, Mac node
issue, or auth readiness issue.

## Fix

When `login_logs_search` page-context fetch fails with `network_error`, the
service now retries the same fixed request through the Playwright browser
context request API.

The fallback remains bounded:

- only applies to allowlisted `login_logs_search`
- uses the action's fixed `login_logs` origin
- uses the action's fixed same-origin relative path
- uses typed params already validated by `src/actions.js`
- does not accept caller-provided URL/path/header/cookie/token/session
- does not read Chrome cookie DB
- does not output request headers
- does not output cookie/token/session/header/authorization/password
- still suppresses raw upstream body
- still applies response-size guard

## Mock Coverage

Added regression coverage:

- page-context fetch throws `network_error`
- `login_logs_search` falls back to context request
- response returns passthrough transport envelope
- `upstream.status=200`
- `upstream.body_omitted=true`
- credential material is not output

Existing coverage still verifies:

- forbidden input keys are rejected
- explicit legacy response mode is rejected
- credential material in upstream body fails closed
- response too large is reported as transport-limited envelope

## Controlled Live Smoke

Profile: existing Mac worker profile

Health:

| Field | Result |
| --- | --- |
| `/health ok` | `true` |
| `service_mode` | `live` |
| `auth_state` | `ready` |
| `action_count` | `19` |
| `rcp` | `ready` |
| `weapon` | `ready` |
| `login_logs` | `ready` |
| `archives` | `ready` |
| `track_analysis` | `ready` |

`login_logs_search` smoke with `user_id=403082302`:

| Field | After Fix |
| --- | --- |
| service HTTP status | `200` |
| action | `login_logs_search` |
| `ok` | `false` |
| `error_type` | `response_too_large` |
| `http_status` | `200` |
| `upstream.status` | `200` |
| `upstream.content_type` | `application/json;charset=UTF-8` |
| `body_present` | `true` |
| `body_truncated` | `true` |
| `observed_bytes` | `65536` |
| `upstream.body_omitted` | `true` |
| `upstream.response_too_large` | `true` |
| `raw_body_handling` | `suppressed` |
| `safety.credential_material_output` | `false` |

Result: fixed. The action no longer reports `network_error`; it reaches the
upstream login logs interface and returns a transport-limited passthrough
envelope.

Track Analysis control smoke with `track_analysis_summary` and
`user_id=403082302`:

| Field | Result |
| --- | --- |
| service HTTP status | `200` |
| `ok` | `true` |
| `upstream.status` | `200` |
| `content_type` | `application/json;charset=UTF-8` |
| `body_present` | `true` |
| `body_truncated` | `false` |
| `observed_bytes` | `9706` |
| `upstream.body_omitted` | `true` |
| `safety.credential_material_output` | `false` |

## Safety Boundary

No authentication material was read or output. No request headers were output.
No cookie/token/session/header/authorization/password values were output. No
raw upstream body was printed. No arbitrary URL fetch was added.

The service was stopped after the controlled smoke; port `8787` was released.
