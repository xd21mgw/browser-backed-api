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

Agents call the service through a configured `service_base_url`.

- Local Agent Mode default: `http://127.0.0.1:8787`
- Remote Main Agent + Mac Local Worker Mode: a controlled Mac worker/bridge or
  tunnel URL supplied by `BROWSER_BACKED_SERVICE_BASE_URL` or equivalent Agent
  configuration

The browser-backed service itself still binds locally by default. A
bridge/tunnel is deployment infrastructure and is not implemented by this
service contract.

## Responsibilities

The service is responsible for:

- fixed action allowlist
- typed params validation
- fixed origin/path/body construction
- browser session startup and prewarm
- same-origin fetch
- timeout handling
- response-size guard
- bounded upstream business body passthrough
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

The action response is passthrough-only. The upstream business response body is
returned when it fits within the configured passthrough size cap. Large
responses return a bounded `upstream.body_snippet` or `upstream.capped_body`
instead of the full body.

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
  "raw_body_handling": "visible",
  "upstream": {
    "status": 200,
    "content_type": "application/json",
    "body_present": true,
    "body_omitted": false,
    "body_truncated": false,
    "response_too_large": false,
    "observed_bytes": 1234,
    "returned_bytes": 1234,
    "raw_body_handling": "visible",
    "body": {
      "data": {}
    }
  },
  "meta": {
    "origin": "login_logs",
    "latency_ms": 42,
    "fetched_at": "2026-06-01T00:00:00.000Z"
  },
  "safety": {
    "credential_material_output": false,
    "request_headers_output": false,
    "browser_profile_material_output": false,
    "transport_auth_material_output": false,
    "upstream_business_body_visible": true
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
  "raw_body_handling": "capped",
  "upstream": {
    "status": 200,
    "content_type": "application/json",
    "body_present": true,
    "body_omitted": false,
    "body_truncated": true,
    "response_too_large": true,
    "observed_bytes": 7340032,
    "returned_bytes": 5242880,
    "raw_body_handling": "capped",
    "body_snippet": "{\"data\":[",
    "error_type": "response_too_large"
  },
  "safety": {
    "credential_material_output": false,
    "request_headers_output": false,
    "browser_profile_material_output": false,
    "transport_auth_material_output": false,
    "upstream_business_body_visible": true
  }
}
```

Structured row-cap example for `login_logs_search`:

```json
{
  "ok": false,
  "action": "login_logs_search",
  "response_mode": "passthrough",
  "error_type": "response_too_large",
  "body_present": true,
  "body_truncated": true,
  "raw_body_handling": "json_array_capped",
  "cap_reason": "record_limit",
  "upstream": {
    "status": 200,
    "content_type": "application/json",
    "body_present": true,
    "body_omitted": false,
    "body_truncated": true,
    "response_too_large": true,
    "raw_body_handling": "json_array_capped",
    "capped_json_path": "data.logSearchModels",
    "observed_records": 334,
    "returned_records": 300,
    "missing_records": 34,
    "missing_body_reason": "response_too_large",
    "cap_reason": "record_limit",
    "capped_body": {
      "data": {
        "logSearchModels": []
      }
    }
  },
  "safety": {
    "credential_material_output": false,
    "request_headers_output": false,
    "browser_profile_material_output": false,
    "transport_auth_material_output": false,
    "upstream_business_body_visible": true
  }
}
```

For `login_logs_search`, the default service-side row cap is 300 records and
the hard cap is 300 records. If the capped JSON still exceeds the byte cap, the
service returns the largest complete leading record set that fits and sets
`cap_reason=byte_limit`.

The default service body cap is 5MB and can be overridden with
`MAX_LIVE_BODY_BYTES`. The service does not do fixed-field projection or
business summarization; Dennis/main agent should parse `upstream.body` or
`upstream.capped_body` and decide how to compact fields for user-facing output.

`login_logs_search` expects API JSON. If the fixed API call returns a front-end
HTML/page shell instead, the service returns
`error_type=unexpected_html_response` with
`platform_error=api_contract_mismatch` and omits the HTML body. This is not
`no_data` and not login-log evidence; it means the fixed API contract or bound
page context needs repair.

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

The service listens locally on `127.0.0.1` by default. Remote/cloud main Agents
must not assume that their own `127.0.0.1` is the teammate's Mac. They must use
a configured `service_base_url` that points to a controlled Mac local worker,
bridge, or tunnel.

The bridge/tunnel may forward only the service routes needed for controlled
access:

- `GET /health`
- `GET /actions`
- `POST /actions/<allowlisted_action>`
- `POST /actions/batch`
- `POST /actions/multi_source_plan`

It must not expose arbitrary URL fetch, arbitrary local files, arbitrary
platform paths, Chrome profiles, cookies, tokens, sessions, authorization
values, request headers, localStorage, or Playwright storageState.

Mac profile copy/bootstrap to Linux headless is not a recommended service
deployment. Joint testing showed RCP, Weapon, Login Logs, and Archives can
trigger `two_factor_required` in Linux headless after profile copy. The service
contract assumes either Local Agent Mode or Remote Main Agent + Mac Local Worker
Mode.

Auth State Transfer is a separate POC candidate, not a current recommended
service deployment. It must not require the service to output authentication
material, raw browser storage, request headers, or profile contents. Until the
POC is validated, Mac Local Worker remains the stable remote-main-agent path.

## Output Boundary

Allowed:

- envelope metadata
- upstream HTTP status
- content type
- body presence boolean
- body truncation boolean
- observed byte count
- returned byte count
- upstream business response body when it fits within the size cap
- bounded `body_snippet` / `capped_body` for large responses
- elapsed time
- sanitized transport/platform/auth error type
- safety booleans

Forbidden:

- request headers
- response `set-cookie` headers
- cookies, tokens, sessions, authorization values, passwords
- Chrome profile file contents
- localStorage / browser storage dumps
- Playwright storage state
- caller-provided auth material

The upstream body is business data. Field names such as `token`, `session`,
`login`, or `auth` inside the upstream body can be legitimate platform business
fields and must not be deleted only because of the name. The service blocks
request/browser/service credential material and transport auth headers; it does
not read browser auth stores and does not return request headers, `set-cookie`,
cookies, tokens, sessions, passwords, profile files, localStorage dumps, or
Playwright storage state. `safety.credential_material_output` must remain
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
