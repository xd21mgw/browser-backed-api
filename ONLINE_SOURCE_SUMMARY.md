# Online Source Summary

## Overall Status

First batch browser-backed online sources are live-smoke complete:

- Track Analysis: `live_complete`
- RCP eventList: `live_complete`
- Weapon graph/risk: `live_complete`
- Login Logs: `live_complete`

All sources run through the local browser-backed API service with fixed action names and fixed same-origin relative paths. Dennis or other callers do not open browsers, read browser storage, or receive raw upstream responses.

Second-stage fixed action readiness is tracked in:

- `browser_backed_live_smoke_readiness_v1.md`
- `har_platform_interface_inventory_v1.md`

Latest second-stage readiness highlights:

- `login_logs_search`: `live_smoke_verified`; latest live smoke completed with records present after 7-day response-too-large fallback to a 24-hour `data.logSearchModels` response.
- `track_analysis_check_data_ready`: `live_smoke_verified`; completed with a real test device sample.
- Archives Center: visible service context with `BROWSER_HEADLESS=false` is now authenticated and `page_ready=true`; `archives_user_profile`, `archives_user_analysis`, and `archives_related_users` are live-smoke verified, while `archives_photo_search` returned source `no_data` for the tested user/window.
- `rcp_event_detail`: `live_smoke_verified`; completed with a real event sample obtained from shape-only `rcp_snapshot` output.
- `rcp_event_feature_list`: `partial_observation_available`; real event sample reaches HTTP 200, exceeds the live body cap, and now returns a capped feature-count/group observation without raw body output.
- `rcp_policy_tree_lookup`: `blocked_missing_real_sample`; needs real `policyTreeCode` and `policyTreeVersion`.

## Fixed Interfaces

### `track_analysis_summary`

Supported fixed Track Analysis sub-interfaces:

- `GET /dp/platform/app/analytics/v2/sequence/getLastestDateTime`
- `POST /dp/platform/app/analytics/v2/sequence/getUseDuration`
- `POST /dp/platform/app/analytics/v2/sequence/profile`
- `POST /dp/platform/app/analytics/v2/sequence/getDeviceIds`

Sub-interface names exposed to callers:

- `getLastestDateTime`
- `getUseDuration`
- `profile`
- `getDeviceIds`

### `rcp_snapshot`

Supported fixed RCP interface:

- `POST /v2/rest/event/eventList`

### `weapon_inventory`

Supported fixed Weapon interfaces:

- `GET /apiv2/graphData`
- `GET /apiv2/riskData`

`riskData` is invoked only by internal graph-to-risk chaining when `graphData` returns a device ID with a full `ANDROID_` or `IOS_` prefix.

### `login_logs_search`

Supported fixed Login Logs interface:

- `GET /rest/unified/log/search`

## Live Validation Summary

### Track Analysis

- source_status: `completed` for all four sub-interfaces
- latency_ms range: validated in local live smoke; exact latency varies by sub-interface and platform timing
- source_card: present
- source_quality: present
- sensitive_output: `false`
- raw_full_body_returned: `false`
- validated output: latest-date shape, activity summary, profile summary, and device summary

### RCP eventList

- source_status: `completed`
- latency_ms observed: approximately `6790`
- source_card: present
- source_quality: present
- sensitive_output: `false`
- raw_full_body_returned: `false`
- validated output: `data.eventList`, `data.pagination`, and `data.tableHeaderList`
- event_count observed: `200`

### Weapon graph/risk

- source_status: `completed`
- latency_ms observed: approximately `126` for graph-only live smoke and `480` for graph-to-risk live smoke
- source_card: present
- source_quality: present
- sensitive_output: `false`
- raw_full_body_returned: `false`
- validated output: graph shape summary, risk label summary, originalLog key summary, and `userLevel_observed=HIGH`
- graphData no-device case: `riskData_status=not_executed_missing_device_id`
- graphData with device case: `riskData_status=completed`

### Login Logs

- source_status: `completed`
- latency_ms observed: varies by 7-day initial attempt plus 24-hour fallback
- source_card: present
- source_quality: present
- sensitive_output: `false`
- raw_full_body_returned: `false`
- validated output: online API reachable; default 7-day response can be too large and falls back to a 24-hour window
- records path observed: `data.logSearchModels`
- records_count observed in latest live smoke: `19`

## Failure And Empty Result Semantics

- `no_data` does not mean no risk.
- `completed_no_data` does not mean no risk.
- `completed_no_hit_for_small_window` does not mean no risk.
- `auth_failed` is an access/source state and does not mean the platform is unavailable.
- `blocked`, `network_error`, and `platform_error` are source quality states.
- `risk_partial_failed` preserves Weapon graph success and marks only the chained risk source as partial.
- Source failure or partial source completion is not a Dennis runtime failure.
- Every source outcome should still preserve `source_card` and `source_quality`.

## Security Boundary

The first batch sources maintain these boundaries:

- Do not read cookies, tokens, sessions, or request headers.
- Do not read the Chrome cookie DB.
- Do not output raw upstream full response bodies.
- Do not output raw login log records.
- Do not output raw Weapon `labelInfo`.
- Do not output raw Weapon `originalLog`.
- Do not accept caller-provided URL, path, origin, header, cookie, token, session, secret, raw query, or raw body material.
- Use fixed action names and fixed same-origin relative paths only.
- In `internal_risk_review`, risk entity identifiers such as user_id, device_id, IP, eventId, sourceId, strategy code, photo_id, and live_id may appear in compact summaries.
- In `external_share`, risk entity identifiers are masked.
- `sensitive_output=false` means no credential secret, no raw upstream full body, and no raw record/full dump. It does not mean internal risk entity identifiers were removed.

## Dennis Evidence Card Guidance

- Track Analysis: use activity, profile, use-duration, and device-relation summaries as active profile and device association evidence.
- RCP: use eventList as strategy-hit or event-entry evidence; do not treat it as a final risk conclusion.
- Weapon: use graph summary as device relation evidence and risk label summary as device risk-label evidence.
- Login Logs: use as recent login sequence evidence. `no_data` only means the online query window returned no records; it is not no-risk counterevidence.
- Include `source_card` and `source_quality` in evidence cards for completed, no-data, blocked, auth-failed, network-error, platform-error, and partial outcomes.

## Next Stage Interface Suggestions

- Archives Center HAR inventory.
- RCP downstream interfaces:
  - `eventDetail`
  - `eventFeatureList`
  - policy attribution
- Dennis executable adapter that consumes the standard source envelope and writes partial evidence cards without browser/auth debugging.
