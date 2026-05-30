# Browser-Backed Risk Source Service

Local browser-backed risk platform access service for fixed, typed risk evidence
actions. It is the first version of the team-facing "risk unified local
hand-and-foot layer", not a Dennis-only adapter.

Each teammate runs the service on their own computer, with their own Chrome
profile and their own internal platform permissions. Agent, Skill, or local
scripts call only fixed local source actions on `127.0.0.1`; they do not read
cookies, tokens, sessions, request headers, Chrome cookie DBs, or arbitrary
platform URLs.

## Team-Facing Entry Points

- `RISK_SOURCE_CAPABILITY_REGISTRY.md` - capability menu organized by risk
  evidence domain, including stable, beta/explicit, inventory-pending, and
  excluded-noise capabilities.
- `BROWSER_BACKED_AGENT_SKILL.md` - Agent Skill draft for using the service as a
  browser-backed risk platform access layer.
- `PASSTHROUGH_SERVICE_CONTRACT.md` - future `response_mode=passthrough`
  service contract; current `compat_summary` behavior remains the stable
  baseline.
- `TEAM_LOCAL_SETUP.md` - teammate setup guide for installing, opening profile,
  refreshing auth state, and starting the local service.
- `TROUBLESHOOTING.md` - common local setup, profile, auth, origin readiness,
  and action error troubleshooting.

Passthrough means forwarding upstream business response bodies, not forwarding
browser auth material, request headers, cookies, tokens, sessions, or profile
storage.

## Current Stable Capabilities

| capability | action_name | evidence_domain | Use for |
| --- | --- | --- | --- |
| User activity/profile/device evidence summary | `track_analysis_summary` | 用户域 / 设备域 / 行为域 | User profile shape, use duration, active evidence, device list. |
| Strategy event entry snapshot | `rcp_snapshot` | 策略域 | Event list, sourceId/eventId/deviceId/hitFusePolicyCode clues. |
| Device graph and device-risk inventory | `weapon_inventory` | 设备域 / 社交域 | User-device graph, device risk labels, relation counts. |
| Login behavior evidence | `login_logs_search` | 行为域 / 登录链路 | Recent login logs, login device/IP/source/method evidence. |

These stable capabilities are evidence sources only. They do not perform
automatic disposal, permission bypass, DataAgent/Hive calls, or final risk
classification. See `RISK_SOURCE_CAPABILITY_REGISTRY.md` before calling beta or
explicit capabilities.

The safe default is `SERVICE_MODE=mock`. Mock mode does not start Playwright and does not touch real platforms.

## Goals Covered

- Keeps a long-lived Playwright persistent browser context in `SERVICE_MODE=live`.
- Uses `~/.dennis-browser-backed/profile` as the default Playwright profile directory.
- Keeps origin definitions in `src/originRegistry.js` instead of scattered hard-coded config.
- Tracks refresh metadata in `~/.dennis-browser-backed/refresh-session.state.json`.
- Prewarms the fixed registry origins for enabled platforms in live mode.
- Exposes fixed action names only; request bodies cannot provide arbitrary URLs.
- Runs live calls with `page.evaluate(fetch)` from a page already on the configured origin.
- Adds `source_card` and `source_quality` to every action response.
- Does not call Playwright cookie/session/header inspection APIs.
- Does not return full raw live responses; live mode returns status plus JSON shape only.
- Exposes Dennis runtime-oriented health, prewarm, action latency, and source quality metadata.

## Files

- `src/server.js` - HTTP service and routes.
- `src/actions.js` - fixed action registry and mock payloads.
- `src/browser.js` - Playwright persistent context and same-origin fetch executor.
- `src/config.js` - environment loading and origin registry materialization.
- `src/originRegistry.js` - extendable registry for fixed origins, warmup paths, TTLs, and action ownership.
- `src/authState.js` - profile/state path helpers and sanitized refresh-state manager.
- `src/quality.js` - `source_card`, `source_quality`, and shape-only summarization.

## First Batch Source Summary

See `ONLINE_SOURCE_SUMMARY.md` for the first batch browser-backed online source closure.
See `browser_backed_live_smoke_readiness_v1.md` and `har_platform_interface_inventory_v1.md` for second-stage fixed action readiness and inventory.

- Track Analysis: `live_complete`
- RCP eventList: `live_complete`
- Weapon graph/risk: `live_complete`
- Login Logs: `live_complete_no_data_case`

All four sources return `source_card`, `source_quality`, `latency_ms`, and `sensitive_output=false`; live outputs are shape summaries only and do not include raw upstream full bodies.

## Output Scope And Field Classification

Every action accepts optional `output_scope`:

- `internal_risk_review` (default): risk entity identifiers may appear in compact summaries for internal fraud/risk review.
- `external_share`: risk entity identifiers are masked for sharing outside the internal review context.

Field classes:

- `credential_secret`: cookie, token, session, header, authorization, password, and reusable credential material. These are never output.
- `pii_strict`: phone number, ID card, and real name. Phone numbers are masked as `1381234****` internally and `138********` externally. Full ID card and real name are never output; only presence/weak summaries are allowed.
- `risk_entity_identifier`: user_id/UID, device_id/DID, IP, eventId, sourceId, hitFusePolicyCode, strategy code, logSource, method, timestamp. These can be shown in `internal_risk_review` and are masked in `external_share`.
- `source_summary_metric`: counts, time windows, status fields, and field-presence metrics. These can be displayed normally.

`sensitive_output=false` means no credential secret, no raw upstream full body, no raw records full dump, and no raw `labelInfo`/`originalLog` full dump. It does not mean risk entity identifiers were removed from internal review summaries.

## Run Mock Mode

```sh
npm run start:mock
```

Mock examples:

```sh
curl http://localhost:8787/health
curl http://localhost:8787/actions
curl -X POST http://localhost:8787/prewarm
curl -X POST http://localhost:8787/actions/rcp_snapshot \
  -H 'content-type: application/json' \
  -d '{"eventType":"USER_REGISTER_NEW","startTime":"2026-05-29 10:00:00","endTime":"2026-05-29 10:30:00"}'
```

The service binds only to `127.0.0.1`.

## Run Live Mode

Install dependencies first if they are not already present:

```sh
npm install
```

For a first profile activation, use a visible browser and finish SSO or landing steps manually:

```sh
npm run open:profile
npm run start:live
```

For an existing profile, refresh it once or keep a local refresh loop running:

```sh
npm run refresh:once
npm run refresh:daemon
```

`refresh:daemon` refreshes immediately at startup and then every 4 hours. Override the interval with `BROWSER_BACKED_REFRESH_INTERVAL_MS`.

Live mode uses the registry defaults unless an origin env var overrides them:

```sh
RCP_ORIGIN=https://rcp.example.com \
WEAPON_ORIGIN=https://weapon.example.com \
LOGIN_LOGS_ORIGIN=https://login-logs.example.com \
TRACK_ANALYSIS_ORIGIN=https://track-analysis.example.com \
npm run start:live
```

Live mode starts a long-lived Playwright persistent context with:

```txt
profileDir=~/.dennis-browser-backed/profile
channel=chrome
headless=true
```

If a normal Chrome instance has the same profile locked, close it or point `BROWSER_BACKED_PROFILE_DIR` to a copied profile before running live mode. `USER_DATA_DIR` remains supported as a legacy alias, but `BROWSER_BACKED_PROFILE_DIR` takes precedence.

## Profile, State, And Credential Material

The default profile directory is:

```txt
~/.dennis-browser-backed/profile
```

The default refresh-state file is:

```txt
~/.dennis-browser-backed/refresh-session.state.json
```

Override these paths with:

- `BROWSER_BACKED_PROFILE_DIR`
- `BROWSER_BACKED_STATE_FILE`

Profile, state, and credential material are different:

- Token/cookie/session/localStorage values are credential material. The service lets the browser use them but does not read, parse, or output them.
- The profile is the browser login-state directory used by Playwright.
- The state file is refresh bookkeeping only: `last_refresh_at`, `origin_status`, `last_error_type`, `warmed_origins`, `service_version`, and `refresh_count`.
- `/health` reports `profile_dir_configured` as a boolean instead of echoing the local profile path. This is intentional so a local filesystem path is not exposed through the API.

Do not commit profile directories, refresh state, `.env`, HAR files, screenshots, or temporary captures. On macOS, a future launchd plist can run `npm run refresh:once` on a schedule; this repo does not include that plist yet.

## Origin Registry

Origin configuration lives in `src/originRegistry.js`. Each origin defines:

- `name`
- `envVar`
- `defaultOrigin`
- `actions`
- `refreshTtlMs`
- `warmupPath`
- `requiredForActions`
- `requiredForHealth`
- `requiredForRefresh`
- `optional`
- `enabled`

The core default origins are `rcp`, `weapon`, `login_logs`, and `track_analysis`. The current registry also keeps `archives` for the existing fixed archives actions. Future sources such as video/content, private message, live, dashboard, or Grafana should be added by extending the registry first; this does not change the fixed action allowlist by itself.

`rcp`, `weapon`, `login_logs`, and `track_analysis` are required for health and refresh. `archives` is enabled but optional by default, so an archives warmup failure is recorded as `optional_failed` and does not make `refresh:once` fail when the four required origins are ready.

## API

### `GET /health`

Returns readiness metadata for Dennis runtime integration:

```json
{
  "ok": true,
  "service_mode": "mock",
  "browser_initialized": false,
  "context_initialized": false,
  "profile_dir_configured": true,
  "profile_exists": false,
  "state_file_configured": true,
  "last_refresh_at": null,
  "auth_state": "auth_required",
  "origin_status": {
    "rcp": {
      "origin": "https://rcp.corp.kuaishou.com",
      "final_origin": null,
      "status": "unknown",
      "error_type": null,
      "refreshed_at": null,
      "optional": false,
      "required_for_refresh": true,
      "required_for_health": true,
      "last_refresh_at": null,
      "last_error_type": null,
      "warmed": false,
      "page_ready": false
    }
  },
  "warmed_origins": [],
  "uptime_ms": 123,
  "action_count": 12
}
```

`auth_state` is one of `ready`, `auth_required`, `expired`, or `unknown`. `origin_status` comes from the sanitized refresh-state file. `warmed_origins` contains one entry per fixed origin with `status`, `latency_ms`, and `error_type`.

Per-origin refresh state records only non-credential metadata: `origin`, `page_ready`, `final_origin`, `status`, `error_type`, and `refreshed_at`. Status is `ready`, `auth_required`, `failed`, or `optional_failed`.

### `GET /actions`

Lists fixed actions and their input contracts. The allowlist is exactly:

- `rcp_snapshot`
- `weapon_inventory`
- `login_logs_search`
- `track_analysis_summary`
- `archives_user_analysis`
- `archives_user_profile`
- `archives_photo_search`
- `archives_related_users`
- `rcp_event_detail`
- `rcp_event_feature_list`
- `rcp_policy_tree_lookup`
- `track_analysis_check_data_ready`

### `POST /prewarm`

Mock mode returns simulated readiness. Live mode navigates each persistent page to its configured fixed origin/prewarm path and verifies the final page origin.

Each result contains:

- `status`: `simulated`, `ready`, `error`, or `not_warmed`
- `latency_ms`
- `error_type`: `null`, `timeout`, `origin_mismatch`, `network`, or `unknown`

### `POST /actions/:actionName`

Allowed action names:

- `rcp_snapshot`
- `weapon_inventory`
- `login_logs_search`
- `track_analysis_summary`
- `archives_user_analysis`
- `archives_user_profile`
- `archives_photo_search`
- `archives_related_users`
- `rcp_event_detail`
- `rcp_event_feature_list`
- `rcp_policy_tree_lookup`
- `track_analysis_check_data_ready`

Each live action uses the configured domain page and calls `fetch()` with a fixed same-origin relative path from the action registry. The request body is sanitized to a small allowlist and capped at 128 KB.

`rcp_snapshot` uses the fixed RCP eventList source:

- fixed path: `POST /v2/rest/event/eventList`
- typed input: `eventType`, `source_id` or `sourceIds`, `device_id`, `startTime`, `endTime`, `time_window`, `pageIndex`, `page`, `pageSize`, `selected_columns`
- default input: `eventType=USER_REGISTER_NEW`, small recent time window, `pageIndex=1`, `pageSize=40`
- time fields must use `YYYY-MM-DD HH:mm:ss`; epoch timestamps are rejected as `wrong_time_field_format`
- fixed body generated by the service from a HAR-like template with typed overrides: `tableHeaderList` object array, `startTime`, `endTime`, `currentTime`, complete `eventV2`, and top-level `pageIndex/pageSize`
- `eventV2` includes `eventType`, `hitPolicies`, `version`, `status`, `snapshotVersion`, `sourceIds` as a string, `realTimeOp`, `isPolicyTreeExperiment`, `conditionList`, `grayFeature`, `grayQueryStatus`, and `region`
- condition items live only under `eventV2.conditionList` and use `key`, `logic`, `value`, `id`, `seq`, `keyType`, `description`, and `rightDataType`
- live output is shape-only and summarizes `data.eventList`, `data.pagination`, and `data.tableHeaderList`
- empty `eventList` is a source no-hit/no-data outcome and is not no-risk counterevidence
- no caller-provided URL, path, header, cookie, token, session, secret, or raw body is accepted

RCP source status:

- source contract: `RCP_SOURCE_CONTRACT.md`
- source_name: `rcp_snapshot`
- access_method: `browser_backed_api_service`
- origin: `https://rcp.corp.kuaishou.com`
- live validated wrapper: `data.eventList`, `data.pagination`, `data.tableHeaderList`
- live validation summary: `source_status=completed`, `event_count=200`, `sensitive_output=false`, `raw_full_body_returned=false`
- evidence use: strategy-hit or event-entry source; `hitFusePolicyCode`, `eventId`, and `_occurTime` are candidate chaining keys
- `no_data`, `completed_no_hit_for_small_window`, `auth_failed`, `blocked`, `timeout`, `network_error`, and `platform_error` are source completion/quality states, not no-risk counterevidence

`weapon_inventory` uses fixed Weapon `/apiv2/*` sources:

- primary fixed path: `GET /apiv2/graphData`
- optional chained fixed path: `GET /apiv2/riskData`
- typed input: exactly one of `user_id` or `device_id`
- optional typed input: `product`, `productName`, `searchLevel`, `include_risk_data`, `max_device_ids`
- default input: `product=KUAISHOU`, `productName=KUAISHOU`, `searchLevel=2`, `include_risk_data=true`, `max_device_ids=5`
- user input maps to graph query `groupKey=USER_ID`, `dimKey=DEVICE_ID`
- device input maps to graph query `groupKey=DEVICE_ID`, `dimKey=USER_ID`
- graph output is shape-only and summarizes `pointInfoMap`, `relationEdgeList`, related device/user counts, and masked device samples
- `riskData` only runs when graph output contains device IDs with full `ANDROID_` or `IOS_` prefixes; pure numeric graph keys are treated as probable user IDs, not device IDs
- risk output summarizes label counts, group names, readable label samples, originalLog keys, and userLevel values without returning raw `labelInfo` or raw `originalLog` full dumps
- related device/user identifiers in summary follow `output_scope`: visible for internal risk review and masked for external sharing
- graph no-data is a source no-hit/no-data outcome and is not no-risk counterevidence
- riskData failure is reported as partial risk status and does not overwrite graph success
- no caller-provided URL, path, header, cookie, token, session, secret, or raw body is accepted

Weapon source status:

- source contract: `WEAPON_SOURCE_CONTRACT.md`
- source_name: `weapon_inventory`
- access_method: `browser_backed_api_service`
- origin: `https://weapon-platform.corp.kuaishou.com`
- live validated APIs: `GET /apiv2/graphData`, `GET /apiv2/riskData`
- live validation summary: `source_status=completed`, `riskData_status=completed`, `risk_item_count=1`, `risk_label_count=17`, `userLevel_observed=HIGH`, `sensitive_output=false`, `raw_full_body_returned=false`
- evidence use: device relation evidence, device risk label summary, and userLevel/risk group supporting evidence
- raw `labelInfo`, raw `originalLog`, and raw upstream full bodies are not output; related device IDs in compact summaries follow `output_scope`
- `no_data`, `completed_no_data`, `not_executed_missing_device_id`, `risk_partial_failed`, `auth_failed`, `blocked`, `timeout`, `network_error`, and `platform_error` are source completion/quality states, not no-risk counterevidence

`login_logs_search` uses the fixed Login Logs online source:

- fixed path: `GET /rest/unified/log/search`
- typed input: `user_id`
- optional typed input: `time_window`, `from_timestamp`, `to_timestamp`, `recallSource`, `limit`
- default input: recent 7-day window, `recallSource=2,0,1,3`, `limit=20`
- generated query: `userId`, `from_timestamp`, `to_timestamp`, `recallSource`
- time fields must be epoch milliseconds; windows larger than 7 days are rejected as `query_window_too_large`
- live output is shape-only and summarizes record count, observed time range, result/device/IP/origin field presence, and returned field names
- records arrays are detected from known response wrappers including `data.records` and `data.logSearchModels`
- when the default 7-day response is too large or unparseable JSON, the action retries once with a 24-hour window and keeps the first-attempt diagnostics
- raw login log records and raw upstream full bodies are not output
- login IP, login device, userId, method, and logSource samples follow `output_scope`: visible for internal risk review and masked for external sharing
- empty records are a source no-data outcome and are not no-risk counterevidence
- no caller-provided URL, path, header, cookie, token, session, secret, or raw query is accepted

`track_analysis_summary` supports fixed track-analysis sub-interfaces:

- default sub-interface: `getLastestDateTime`
- activity sub-interface: `getUseDuration`
- profile sub-interface: `profile`
- device relation sub-interface: `getDeviceIds`
- `getLastestDateTime`: `GET /dp/platform/app/analytics/v2/sequence/getLastestDateTime`
- `getUseDuration`: `POST /dp/platform/app/analytics/v2/sequence/getUseDuration`
- `profile`: `POST /dp/platform/app/analytics/v2/sequence/profile`
- `getDeviceIds`: `POST /dp/platform/app/analytics/v2/sequence/getDeviceIds`
- typed input: exactly one of `user_id` or `device_id`, plus `appName=KUAISHOU|NEBULA`
- optional typed input: `sub_interface=getLastestDateTime|getUseDuration|profile|getDeviceIds`, `time_window`
- fixed params generated by the service: `product/type` query params for `getLastestDateTime`, `appName/funcType/_t/userId|deviceId` body fields for `getUseDuration` and `getDeviceIds`, or `appName/startTime/endTime/include/pageSize/funcType/_t/userId|deviceId` body fields for `profile`
- live output is shape-only; `getUseDuration` returns an `activity_summary`, `profile` returns a `profile_summary`, and `getDeviceIds` returns a `device_summary`
- no caller-provided URL, path, header, cookie, token, session, or secret is accepted

Track Analysis source status:

- source contract: `TRACK_ANALYSIS_SOURCE_CONTRACT.md`
- source_name: `track_analysis_summary`
- access_method: `browser_backed_api_service`
- origin: `https://track-analysis.corp.kuaishou.com`
- live validated sub-interfaces: `getLastestDateTime`, `getUseDuration`, `profile`, `getDeviceIds`
- evidence use: activity summary, profile summary, device relation summary, and recency shape evidence
- `no_data`, `auth_failed`, `blocked`, `timeout`, `network_error`, and `platform_error` are source completion/quality states, not no-risk counterevidence

Every action response includes:

- `latency_ms`
- `origin_warmed`
- `output_scope`
- `field_classification`
- `sensitive_output: false`
- `source_card`
- `source_quality`

## Safety Boundaries

- No endpoint accepts a URL, origin, path, header, cookie, token, or session value from the caller.
- Live fetches use `credentials: "include"` so the browser may use its own ambient login state, but the service does not read or return that state.
- Refresh scripts use the persistent browser profile only through Playwright; they do not inspect cookie DBs, localStorage dumps, tokens, sessions, or request headers.
- All actions still go through the fixed action allowlist in `src/actions.js`.
- Response bodies are read only up to `MAX_LIVE_BODY_BYTES` for summarization, and returned live data is shape-only.
- Sensitive-looking JSON key names are redacted in shape summaries.
- Inputs containing URL-like values, raw header fields, raw cookie fields, tokens, sessions, or secrets are rejected with `forbidden_action_input`.
- `external_share` masks risk entity identifiers; `internal_risk_review` can display the compact risk entity samples needed for fraud review.

## Live Smoke Checklist

Run this only on the local machine after fixed origins are configured:

```sh
npm install
npm run start:live
curl http://127.0.0.1:8787/health
curl -X POST http://127.0.0.1:8787/prewarm
curl -X POST http://127.0.0.1:8787/actions/rcp_snapshot \
  -H 'content-type: application/json' \
  -d '{"eventType":"USER_REGISTER_NEW","startTime":"2026-05-29 10:00:00","endTime":"2026-05-29 10:30:00"}'
curl -X POST http://127.0.0.1:8787/actions/weapon_inventory \
  -H 'content-type: application/json' \
  -d '{"user_id":"demo"}'
curl -X POST http://127.0.0.1:8787/actions/track_analysis_summary \
  -H 'content-type: application/json' \
  -d '{"user_id":"demo","appName":"KUAISHOU"}'
curl -X POST http://127.0.0.1:8787/actions/track_analysis_summary \
  -H 'content-type: application/json' \
  -d '{"sub_interface":"getUseDuration","user_id":"demo","appName":"KUAISHOU"}'
curl -X POST http://127.0.0.1:8787/actions/track_analysis_summary \
  -H 'content-type: application/json' \
  -d '{"sub_interface":"profile","user_id":"demo","appName":"KUAISHOU"}'
curl -X POST http://127.0.0.1:8787/actions/track_analysis_summary \
  -H 'content-type: application/json' \
  -d '{"sub_interface":"getDeviceIds","user_id":"demo","appName":"KUAISHOU"}'
```

Verify:

- `/health` reports `service_mode: "live"`, `browser_initialized: true`, and `context_initialized: true`.
- `/prewarm` returns one result per fixed origin and no unexpected `origin_mismatch`.
- action responses include `source_card`, `source_quality`, `latency_ms`, `origin_warmed`, and `sensitive_output: false`.
- no response contains raw cookies, tokens, sessions, request headers, or a full raw upstream response body.

## Local Checks

```sh
npm run check
```

`npm run check` runs syntax checks and mock tests for health, actions, prewarm, action metadata, arbitrary URL rejection, and raw header/cookie rejection.
