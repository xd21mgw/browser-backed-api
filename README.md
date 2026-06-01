# Browser-Backed Risk Platform Access Service

Browser-backed Risk Platform Access Service / 风控统一受控透传服务.

This local service runs only on `127.0.0.1`. It gives Agent, Skill, and local
scripts a controlled way to call fixed risk-platform actions with typed params
through the teammate's own Chrome profile and platform permissions.

The service only does:

- fixed action allowlist
- typed params validation
- fixed origin/path/body construction
- browser session and origin readiness/prewarm
- same-origin fetch through the local browser context
- raw body suppression and response-size guard
- credential-material output protection
- transport status envelope
- controlled parallel batch scheduling

The service does not do business parsing, observations, evidence cards, source
quality scoring, risk judgments, no-data interpretation, next-step
recommendations, DataAgent/Hive calls, permission bypass, or automatic upstream
write/disposal actions.

Current `action_count=19`.

## Safety Boundary

The service must not read or output:

- Chrome cookie DB contents
- cookies, tokens, sessions, authorization values, passwords
- request headers or response `set-cookie` headers
- Chrome profile files
- localStorage / browser storage dumps
- Playwright storage state
- caller-provided URL/path/header/cookie/token/session/raw body/raw query

The upstream response body is not returned raw. The service reports only
transport metadata such as status, content type, body presence, truncation, byte
count, elapsed time, and error type.

## Action Layers

All actions are passthrough-only at the service layer. `response_mode` defaults
to `passthrough`; legacy modes are rejected.

### Fixed Actions

| action_name | origin_key |
| --- | --- |
| `track_analysis_summary` | `track_analysis` |
| `login_logs_search` | `login_logs` |
| `weapon_inventory` | `weapon` |
| `rcp_snapshot` | `rcp` |
| `archives_user_profile` | `archives` |
| `archives_user_analysis` | `archives` |
| `archives_photo_search` | `archives` |
| `archives_related_users` | `archives` |
| `archives_private_message_search` | `archives` |
| `archives_past_four_items` | `archives` |
| `rcp_event_detail` | `rcp` |
| `rcp_event_feature_list` | `rcp` |
| `rcp_policy_version_lookup` | `rcp` |
| `rcp_policy_detail_lookup` | `rcp` |
| `rcp_policy_release_record_lookup` | `rcp` |
| `rcp_policy_tree_lookup` | `rcp` |
| `rcp_node_policy_attribution` | `rcp` |
| `rcp_node_bind_policy_attribution` | `rcp` |
| `track_analysis_check_data_ready` | `track_analysis` |

Excluded noise remains non-callable: telemetry, radar/misc/log collection,
log-sdk traffic, JS/CSS/static assets, h5-fingerprint, mobile-device-info,
menu/config probes without direct service value, arbitrary URL fetch, and any
cookie/token/session/header capability.

## Single Action Envelope

Example shape:

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

No raw upstream body is included in this envelope.

## Controlled Batch

Batch endpoints:

- `POST /actions/batch`
- `POST /actions/multi_source_plan`

Batch is a scheduler over fixed actions. It is not a generic HTTP client.

Supported execution modes:

- `independent_parallel`
- `dependency_serial`
- `large_response_serial`
- `auth_sensitive_serial`

Batch output contains:

- `source_results`
- `transport_status_matrix`
- `classifications`
- `missing_or_failed_sources`
- execution group metadata
- safety metadata

One source failure does not block unrelated sources. Batch still does not
produce business observations, evidence cards, source quality, or final risk
judgment.

## Local Setup

Install dependencies:

```sh
npm install
```

First-time profile activation:

```sh
npm run open:profile
npm run refresh:once
npm run start:live
```

Existing custom profile:

```sh
BROWSER_BACKED_PROFILE_DIR=/path/to/your/profile npm run refresh:once
BROWSER_BACKED_PROFILE_DIR=/path/to/your/profile npm run start:live
```

Do not copy someone else's profile. Do not commit profile/state files.

Optional refresh loop:

```sh
npm run refresh:daemon
```

`refresh:daemon` refreshes immediately at startup and then every 4 hours by
default. Override with `BROWSER_BACKED_REFRESH_INTERVAL_MS`.

## Mock Mode

```sh
npm run start:mock
```

Examples:

```sh
curl http://127.0.0.1:8787/health
curl http://127.0.0.1:8787/actions
curl -X POST http://127.0.0.1:8787/prewarm
curl -X POST http://127.0.0.1:8787/actions/login_logs_search \
  -H 'content-type: application/json' \
  -d '{"user_id":"2871834924"}'
```

## Archives Landing Flow

Archives may require a lightweight account confirmation every few hours.
Readiness/prewarm may click allowlisted confirmation controls only when the
account is already present and there is no password, OTP, QR, captcha, or
permission-blocked signal. The service never enters usernames, passwords, OTP,
or captcha values. If manual factors appear, run `npm run open:profile`.

## Files

- `src/server.js` - HTTP service and routes.
- `src/service.js` - action execution, origin readiness, and controlled batch.
- `src/actions.js` - fixed action registry, typed params, request builders, and
  safe transport envelope builders.
- `src/browser.js` - Playwright persistent context and same-origin fetch.
- `src/config.js` - environment loading.
- `src/originRegistry.js` - fixed origin registry.
- `src/authState.js` - sanitized profile/state readiness metadata.
- `src/diagnostics.js` - sanitized transport/auth classification helpers.

## Related Docs

- `ACTION_REGISTRY.md`
- `PASSTHROUGH_SERVICE_CONTRACT.md`
- `BROWSER_BACKED_AGENT_SKILL.md`
- `TEAM_LOCAL_SETUP.md`
- `TROUBLESHOOTING.md`
