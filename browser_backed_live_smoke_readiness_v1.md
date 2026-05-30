# Browser-Backed Live Smoke Readiness V1

Date: 2026-05-30

Scope: second-stage fixed browser-backed actions plus the already-promoted
`login_logs_search` evidence source. This file records live smoke readiness only;
it does not change Dennis routing or default runtime behavior.

## Boundaries

- No DataAgent or Hive calls.
- No writes to upstream platforms.
- No changes to `outputs/full_runtime`, `outputs/release`, or `outputs/dist`.
- No arbitrary caller-provided URL, path, header, cookie, token, session, secret,
  raw query, or raw body capability.
- No raw upstream full body output.
- No raw login records, raw event list records, raw `labelInfo`, or raw
  `originalLog` full dump output.
- `default_runtime_routing=false` remains the required default for these fixed
  actions until mother-runtime promotion is done separately.
- `no_data`, `auth_failed`, `blocked`, `parse_error`, and
  `response_too_large` are source quality states. They are not no-risk
  conclusions.

Risk entity identifiers such as user_id, device_id, IP, eventId, sourceId,
strategy code, photo_id, and live_id may be retained in internal risk-review
summaries. Credential material remains forbidden in every output scope.

## Status Vocabulary

- `live_smoke_verified`: fixed action completed against the live browser-backed
  service with source card/source quality and no raw body or raw record dump.
- `live_verified_candidate`: live call completed, but the sample was not a real
  semantic sample for the intended source.
- `blocked_auth_required`: fixed action reached the platform but the current
  browser profile lacks the required product login or permission state.
- `blocked_missing_real_sample`: implementation is registered but a real
  required identifier/version sample is still missing.
- `partial_observation_available`: live upstream call returned HTTP 200 and the
  body exceeded the configured live body cap, but action-specific capped
  extraction produced a safe structured observation.
- `blocked_response_too_large`: live upstream call returned HTTP 200, but the
  body exceeded the configured live body cap before any safe observation could
  be extracted.
- `implemented_mock_only`: implemented and covered by mock tests but not live
  probed.

## Final Action Status

| action_name | previous_live_status | final_status | blocker_or_next_step |
| --- | --- | --- | --- |
| `login_logs_search` | `completed`; `records_count=19`; fallback from 7d response-too-large to 24h `data.logSearchModels` parser | `live_smoke_verified` | No retest needed. Keep as source evidence only; do not treat no-data variants as no-risk. |
| `track_analysis_check_data_ready` | `completed/api_code=0` with placeholder device sample | `live_smoke_verified` | Retested with test device `ANDROID_c081c29a506f9db1`; source completed with `api_code=0`. |
| `archives_user_analysis` | `auth_flow_not_completed_in_bound_context`; earlier HTTP 200 body-level `api_code=302` | `live_smoke_verified`; large-page `partial_observation_available` | Visible Archives service context completed with `pageSize=1`; larger `pageSize=30` now returns a capped safe partial observation instead of `parse_error`. |
| `archives_user_profile` | `auth_flow_not_completed_in_bound_context`; earlier HTTP 200 body-level `api_code=302` | `live_smoke_verified` | Visible Archives service context completed with `api_code=1`. |
| `archives_photo_search` | `auth_flow_not_completed_in_bound_context`; earlier HTTP 200 body-level `api_code=302` | `no_data` | Visible Archives service context completed transport/API shape with empty `dataList`; no-data is not no-risk. |
| `archives_related_users` | `auth_flow_not_completed_in_bound_context`; earlier HTTP 200 body-level `api_code=302` | `live_smoke_verified` | Visible Archives service context completed with one related-users result path observed. |
| `rcp_event_detail` | `blocked`; placeholder sample produced platform error | `live_smoke_verified` | Used a shape-only `rcp_snapshot` probe to obtain a real event sample; downstream detail completed with `api_code=200`. |
| `rcp_event_feature_list` | `blocked_response_too_large`; real event sample reached HTTP 200 but truncated at `MAX_LIVE_BODY_BYTES=65536` | `partial_observation_available` | Capped partial extraction now returns top-level keys, feature count estimate, feature group summary, key event entity, and `source_quality.large_response_limited=true`; exact full feature count still requires a narrower platform query or dedicated bounded extraction contract. |
| `rcp_policy_tree_lookup` | `blocked`; placeholder policy tree sample produced platform error | `blocked_missing_real_sample` | Needs real `policyTreeCode` and `policyTreeVersion`; do not derive or guess from hit policy code. |

No second-stage action is only `implemented_mock_only` after this pass.

## Latest Retest Log

The live service was restarted once with scoped fixed origins for:
`archives`, `rcp`, `track_analysis`, and `login_logs`. `weapon` remained disabled
by platform scope.

### Service Readiness

- Service started in `SERVICE_MODE=live`.
- Registered fixed actions: 12.
- `default_runtime_routing=false` reported by `/actions` for every action.
- `weapon_inventory` reported `platform_enabled=false` under this scoped run.
- `archives` prewarm reached the configured Archives origin first, but the bound
  page ended on the account origin and `page_ready=false`, matching an auth-state
  blocker.

### Track Analysis Retest

Input sample:

- `device_id=ANDROID_c081c29a506f9db1`
- `appName=KUAISHOU`
- 24-hour window generated at smoke time

Superseded safe summary from the earlier auth-flow-incomplete context:

- HTTP status: `200`
- action status: `completed`
- source status: `completed`
- error_type: `null`
- api_code: `0`
- top-level keys: `code`, `message`, `data`, `traceId`
- raw full body returned: `false`
- raw records full dump returned: `false`

### Archives Retest

Input sample:

- `user_id=772671837`
- recent 7-day window where the action requires a window

Observed safe summary:

| action_name | HTTP status | action status | error_type | api_code | top_level_keys |
| --- | --- | --- | --- | --- | --- |
| `archives_user_analysis` | `200` | `auth_failed` | `auth_failed` | `302` | `result,currentTime,costTime,port,clientIp,host,message` |
| `archives_user_profile` | `200` | `auth_failed` | `auth_failed` | `302` | `result,currentTime,costTime,port,clientIp,host,message` |
| `archives_photo_search` | `200` | `auth_failed` | `auth_failed` | `302` | `result,currentTime,costTime,port,clientIp,host,message` |
| `archives_related_users` | `200` | `auth_failed` | `auth_failed` | `302` | `result,currentTime,costTime,port,clientIp,host,message` |

The first `archives_photo_search` retest in this pass returned a transient
`network_error`; the immediate retry returned the same body-level auth redirect
shape as the other Archives actions. This is superseded by the latest
visible-context retest below and is now classified as
`auth_flow_not_completed_in_bound_context`, not as explicit permission denial.

Latest Archives visible-context retest:

- service scope: `ENABLED_PLATFORMS=archives`
- service mode: `SERVICE_MODE=live`
- browser mode: `BROWSER_HEADLESS=false`
- user data dir: long-lived default profile
- prewarm path: `/frontend/archives/index.html`
- prewarm final origin: `https://admin.p.adm-corp.kuaishou.com`
- current origin: `https://admin.p.adm-corp.kuaishou.com`
- page_ready: `true`
- raw full body returned: `false`
- credential secret values returned: `false`
- phone/id-card-like values displayed: `false`

Latest Archives action results:

| action_name | HTTP status | action status | classification | api_code | body_truncated | observed_bytes | no_data |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `archives_user_profile` | `200` | `completed` | `completed` | `1` | `false` | `14197` | `false` |
| `archives_user_analysis` | `200` | `completed` | `completed` | `1` | `false` | `4006` | `false` |
| `archives_photo_search` | `200` | `no_data` | `no_data` | `1` | `false` | `197` | `true` |
| `archives_related_users` | `200` | `completed` | `completed` | `1` | `false` | `1974` | `false` |

`archives_user_analysis` note: the live-smoke verified run used `pageSize=1`.
A broader `pageSize=30` run in the same authenticated context returned HTTP 200
and was capped at `65536` bytes. The current parser classifies that state as
`partial_observation_available` with source-quality large-response flags instead
of `parse_error`; this is a large-response handling limit, not an authentication
failure.

Latest `archives_user_analysis` large-page retest:

- input shape: same authenticated visible service context, `pageSize=30`
- HTTP status: `200`
- action status: `partial_observation_available`
- source status: `partial_observation_available`
- error_type: `response_too_large`
- body_truncated: `true`
- observed_bytes: `65536`
- top-level keys observed: `result`, `currentTime`, `data`
- log/event count estimate: `24` from `totalCount` in capped prefix
- source_quality.large_response_limited: `true`
- source_quality.partial_observation_available: `true`
- raw full body returned: `false`
- raw records full dump returned: `false`
- credential secret values returned: `false`

### RCP Retest

A supporting `rcp_snapshot` probe was used only to obtain a real event identity
from shape-only output. It returned:

- HTTP status: `200`
- action status: `completed`
- source status: `completed`
- event_count: `200`
- returned columns: `sourceId`, `eventId`, `_occurTime`, `hitFusePolicyCode`,
  `time`, `deviceId`
- first-event sample fields present: `eventId`, `sourceId`, `deviceId`,
  `hitFusePolicyCode`, `_occurTime`
- raw full body returned: `false`
- raw event list full dump returned: `false`

Downstream retest results:

| action_name | HTTP status | action status | source status | error_type | observed blocker |
| --- | --- | --- | --- | --- | --- |
| `rcp_event_detail` | `200` | `completed` | `completed` | `null` | none |
| `rcp_event_feature_list` | `200` | `parse_error` | `parse_error` | `parse_error` | superseded by latest partial-observation retest below |
| `rcp_policy_tree_lookup` | not retested | `blocked_missing_real_sample` | `blocked_missing_real_sample` | n/a | missing real `policyTreeCode` and `policyTreeVersion` |

The superseded `rcp_event_feature_list` diagnostics were:

- upstream HTTP status: `200`
- upstream ok: `true`
- body_truncated: `true`
- observed_bytes: `65536`
- response_summary format: `non_json_or_unparseable`
- raw full body returned: `false`
- raw records full dump returned: `false`

Latest `rcp_event_feature_list` retest after the large-response summarizer fix:

- service scope: `ENABLED_PLATFORMS=rcp`
- live smoke timeout: `REQUEST_TIMEOUT_MS=30000`
- body cap: unchanged, `MAX_LIVE_BODY_BYTES=65536`
- HTTP status: `200`
- action status: `partial_observation_available`
- source status: `partial_observation_available`
- error_type: `response_too_large`
- latency_ms observed: approximately `28567`
- body_truncated: `true`
- observed_bytes: `65536`
- top-level keys: `status`, `message`, `data`
- feature_count_estimate: `137`
- feature_count_estimate_method: `featureName_occurrence_count_capped`
- feature_group_summary: `DERIVE=89`, `ORIG=23`, `SYS=10`,
  `COUNTER=6`, `DATASERV=5`, `OTHER=4`
- key entity fields present: `event_id`, `event_type`, `query_time`
- source_quality.large_response_limited: `true`
- source_quality.partial_observation_available: `true`
- raw full body returned: `false`
- raw records full dump returned: `false`
- credential secret values returned: `false`

## Minimal Human Inputs Needed

- Archives: no current human login action needed for the verified visible
  service context. If future headless or fresh service runs return
  `api_code=302`, rerun with `BROWSER_HEADLESS=false` and complete the auth flow
  in that service-owned visible browser context.
- RCP policy tree: provide a real `policyTreeCode` and matching
  `policyTreeVersion`.
- RCP feature list: partial observation is available. Exact full feature counts
  still require a narrower platform query or a dedicated bounded extraction
  contract. This is no longer a missing event sample issue.

## Live Service Stop

The live service was stopped after retests. A final `GET /health` to
`127.0.0.1:8787` failed to connect, confirming the service port was released.
