# Passthrough Service Contract

This document defines the `response_mode=passthrough` contract for the
browser-backed service. It is a service-layer contract only. `compat_summary`
is deprecated legacy migration fallback; this Phase A marker does not delete it
or change current behavior.

## Positioning

The browser-backed service is a local controlled platform interface service.

It receives a fixed action name and typed params, maps them to a fixed platform
origin/path, uses the local Chrome profile's browser-managed login state to make
a same-origin fetch, and returns the upstream platform response in a controlled
envelope.

The service does not perform risk judgment, business interpretation, evidence
card generation, next-step recommendation, automatic DataAgent/Hive calls, or
automatic disposal.

## Current Compatibility Baseline

`compat_summary` mode is deprecated legacy compatibility fallback. It remains
available only for existing callers during migration and must not be extended.

`passthrough` mode is the target service contract. For existing dual-mode
actions, it remains opt-in until downstream parsers and migration checks are
ready to cut over the default.

New actions must be registered as passthrough-only. They must not generate
`source_card`, `source_quality`, evidence summaries, no-data interpretation, or
risk judgment inside this service.

During migration, an existing fixed action may support both:

- `response_mode=compat_summary`
- `response_mode=passthrough`

A newly promoted passthrough-only action supports:

- `response_mode=passthrough`

## Service Responsibilities

The service is responsible for:

- Maintaining the fixed action allowlist.
- Accepting typed params only.
- Mapping an action to a fixed origin and same-origin relative path.
- Starting and using a local persistent browser context.
- Letting the browser use its own local profile login state.
- Performing the upstream same-origin fetch.
- Returning the upstream response in the passthrough envelope.
- Enforcing request and output safety boundaries.

The local profile login state is managed by the browser. The service must not
read browser profile files, cookie databases, tokens, sessions, request headers,
or localStorage dumps.

## Service Non-Responsibilities

The service is not responsible for:

- Risk judgment.
- Interpreting `no_data`.
- Interpreting strategy hits.
- Building `source_quality`.
- Building evidence cards.
- Business summaries.
- Recommendations for next steps.
- DataAgent or Hive calls.
- Automatic disposal or any upstream write action.
- Permission bypass or account/role escalation.

Deprecated fallback exception: legacy `compat_summary` still builds
`source_card`, `source_quality`, and shape-only summaries for old callers. Do
not add new logic to that path. It is scheduled for removal after
passthrough-only cutover.

## Passthrough Envelope

Recommended response shape:

```json
{
  "ok": true,
  "action": "login_logs_search",
  "request_id": "local_xxx",
  "response_mode": "passthrough",
  "upstream": {
    "status": 200,
    "content_type": "application/json",
    "body": {}
  },
  "meta": {
    "origin": "login_logs",
    "latency_ms": 123,
    "fetched_at": "2026-05-30T00:00:00.000Z"
  },
  "safety": {
    "credential_material_output": false,
    "request_headers_output": false,
    "browser_profile_material_output": false
  }
}
```

Rules:

- `upstream.body` is the platform's original response body after the fixed
  action fetch.
- The service may return upstream HTTP status, content type, and envelope fields
  such as `action`, `request_id`, and `meta`.
- The service must not return request headers, response `set-cookie` headers,
  cookies, tokens, sessions, authorization strings, or passwords.
- The service must not return Chrome profile contents.
- If the upstream response is too large, the service may return
  `body_omitted=true`, `response_too_large=true`,
  `error_type=response_too_large`, and size/limit metadata.
- A too-large response is not a business summary. The service must not interpret
  the omitted body.

Example too-large shape:

```json
{
  "ok": false,
  "action": "rcp_event_feature_list",
  "request_id": "local_xxx",
  "response_mode": "passthrough",
  "upstream": {
    "status": 200,
    "content_type": "application/json",
    "body": null,
    "body_omitted": true,
    "response_too_large": true,
    "error_type": "response_too_large"
  },
  "meta": {
    "origin": "rcp",
    "latency_ms": 1234,
    "fetched_at": "2026-05-30T00:00:00.000Z"
  },
  "safety": {
    "credential_material_output": false,
    "request_headers_output": false,
    "browser_profile_material_output": false
  }
}
```

## Input Boundary

Passthrough mode does not relax input controls.

Allowed:

- Fixed action names from the action allowlist.
- Typed params accepted by each action contract.
- Fixed enum/mode fields such as `sub_interface` where already supported.
- `response_mode=passthrough`.

Forbidden:

- Arbitrary URL.
- Caller-provided origin.
- Caller-provided path or endpoint.
- Caller-provided headers.
- Caller-provided cookies.
- Caller-provided tokens.
- Caller-provided sessions.
- Caller-provided authorization strings.
- Raw body or raw query passthrough.
- Agent-built platform URLs.

The service listens only on `127.0.0.1`.

## Compatibility Strategy

Compatibility rules:

- Existing `compat_summary` behavior stays stable only as deprecated migration
  fallback.
- `response_mode=passthrough` is additive for existing dual-mode actions.
- Adding passthrough support must not change existing default action output.
- Dennis or another upper layer must opt in explicitly before receiving
  passthrough output for dual-mode actions.
- The default may change only after downstream passthrough parser support,
  side-by-side comparison, and migration sign-off.
- Passthrough-only actions may default to `passthrough` because no
  `compat_summary` output existed for them.
- New actions must be passthrough-only.

Migration period:

- Existing actions may support both `compat_summary` and `passthrough`.
- Passthrough-only actions must reject `compat_summary`.
- Tests must cover supported modes.
- Live smoke must verify that passthrough does not output credential material.
- The allowlist remains unchanged unless a separate source-contract promotion
  process adds a new fixed action.

Removal gates:

1. Dennis `full_runtime` controlled pilot continues to pass on passthrough.
2. All active consumers no longer depend on `compat_summary`.
3. Reference scans are clean for default-path summary dependencies.
4. Tests are updated to a passthrough-only baseline.

## Division Of Responsibility With Dennis

The browser-backed service:

- Fetches fixed platform responses.
- Enforces origin/path/input/output safety.
- Returns the upstream response envelope.

Dennis or the upper-layer Agent:

- Parses `upstream.body`.
- Builds normalized observations.
- Builds `source_quality`.
- Builds evidence cards.
- Applies `internal_risk_review` or `external_share` output policy.
- Performs cross-source reasoning and final narrative.

Human reviewers or upper-layer Agents remain responsible for final judgment.

## Applicable Action Scope

Initial stable passthrough actions:

- `track_analysis_summary`
- `rcp_snapshot`
- `weapon_inventory`
- `login_logs_search`

Additional explicit dual-mode actions:

- `archives_user_profile`
- `archives_user_analysis`
- `archives_photo_search`
- `archives_related_users`
- `rcp_event_detail`
- `rcp_event_feature_list`
- `rcp_policy_tree_lookup`
- `track_analysis_check_data_ready`

Recovered passthrough-only actions:

- `archives_private_message_search`
- `archives_past_four_items`
- `rcp_policy_version_lookup`
- `rcp_policy_detail_lookup`
- `rcp_policy_release_record_lookup`
- `rcp_node_policy_attribution`
- `rcp_node_bind_policy_attribution`

Future candidate actions:

- Content, social, dashboard, and Grafana-style fixed actions after inventory
  and source-contract promotion.

All fixed actions keep the same allowlist and typed-param contract when using
passthrough. New fixed actions still require tests, redaction review, and live
smoke before promotion.

## Noise Exclusion

Passthrough does not mean opening all HAR traffic. The following remain
excluded:

- Frontend telemetry.
- Product analytics beacons.
- `log-sdk`.
- `radar/misc` and log collection endpoints.
- JS/CSS/static assets.
- `h5-fingerprint`.
- `mobile-device-info`.
- Pure menu, permission, or config probes with no direct evidence value.
- Arbitrary URL fetch.
- Cookie/token/session/header-related capabilities.

## Safety Requirements

Passthrough mode may return upstream business response data, not authentication
context.

Allowed passthrough output:

- Upstream response body.
- Upstream HTTP status.
- `content_type`.
- Envelope fields such as `action`, `request_id`, `meta`, and `safety`.
- Business fields inside `upstream.body`, including risk entity fields such as
  `user_id`, `deviceId`, IP, `eventId`, `sourceId`, and strategy codes.

Forbidden passthrough or output:

- Request headers.
- Response `set-cookie` headers.
- `cookie`.
- `token`.
- `session`.
- `authorization`.
- `password`.
- Chrome profile file contents.
- localStorage or browser storage dumps.
- Playwright context storage state.
- Caller-provided header, cookie, token, or session values.
- Arbitrary URLs or raw request bodies.

If `upstream.body` itself contains fields that appear to be authentication
secrets, the service must fail closed by default or remove those fields with a
denylist before returning the body. In either case, the returned envelope must
keep `safety.credential_material_output=false`. Passthrough must not leak
credential material simply because it came from an upstream response body.

Business response fields may be passed through. Authentication material may not.
Risk entity fields are not authentication material by themselves.

The browser may use its own profile state to authenticate same-origin fetches.
That does not permit the service to inspect or expose that state.

## Implementation Plan

Completed in the service:

1. Add `response_mode=passthrough` to the typed input contract.
2. Add passthrough mock tests for the four stable actions:
   `track_analysis_summary`, `rcp_snapshot`, `weapon_inventory`, and
   `login_logs_search`.
3. Add seven recovered passthrough-only actions with fixed origin/path, typed
   params, passthrough envelope tests, forbidden input tests, response size
   guard tests, and credential-material output tests.

Remaining downstream work:

1. Add a Dennis passthrough client that calls the local service envelope.
2. Add a Dennis parser registry for passthrough `upstream.body` parsing.
3. Run `compat_summary` vs `passthrough` side-by-side comparison for the stable
   actions.
4. Gradually switch defaults only after parser coverage, evidence-card parity,
   redaction checks, and controlled pilot sign-off.

## Non-Goals

- No arbitrary platform gateway.
- No automatic DataAgent/Hive access.
- No upstream write/disposal actions.
- No permission bypass.
- No risk conclusion inside the browser-backed service.
- No raw authentication material output in any mode.
