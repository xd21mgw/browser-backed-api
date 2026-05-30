# HAR Platform Interface Inventory V1

Date: 2026-05-30

This inventory covers the fixed browser-backed interfaces used by the
second-stage live smoke readiness pass. It is an implementation and readiness
inventory, not a runtime-routing promotion list.

## Common Contract

- Access method: local browser-backed API service with a persistent Chrome
  profile in live mode.
- Caller surface: fixed action names and typed input fields only.
- Forbidden caller surface: URL, origin, path, header, cookie, token, session,
  authorization, password, secret, raw query, and raw body.
- Output policy: shape summaries and source quality only; no raw upstream full
  body and no raw records full dump.
- Routing policy: `default_runtime_routing=false` for every action in this
  inventory.
- Evidence policy: blocked, auth-failed, no-data, parse-error, and
  response-too-large outcomes are source states, not risk conclusions.

## Interface Inventory

| action_name | platform | method/path | typed params | latest_status | next_probe_needed |
| --- | --- | --- | --- | --- | --- |
| `login_logs_search` | Login Logs | `GET /rest/unified/log/search` | `user_id`; optional bounded epoch-ms window, `recallSource`, `limit` | `live_smoke_verified` | none |
| `track_analysis_check_data_ready` | Track Analysis | `POST /dp/platform/app/analytics/v2/sequence/checkDataReady` | `device_id`, `appName`, epoch-ms `startTime/endTime`; optional safe enum/list filters | `live_smoke_verified` | none for smoke; broader semantic validation can use more known devices later |
| `archives_user_analysis` | Archives Center | `POST /v3/user/log/coreLogs/fetch` | decimal `user_id`, epoch-ms `beginTime/endTime`, page controls | `blocked_auth_required` | refresh Archives login/permission state |
| `archives_user_profile` | Archives Center | `GET /archives/user/home/info` | decimal `user_id` | `blocked_auth_required` | refresh Archives login/permission state |
| `archives_photo_search` | Archives Center | `POST /v4/archives/report/photo/search` | decimal `user_id`, epoch-ms `begin/end`, page controls, fixed enum filters | `blocked_auth_required` | refresh Archives login/permission state |
| `archives_related_users` | Archives Center | `POST /archives/user/search/device` | decimal `user_id`, fixed relation type enum | `blocked_auth_required` | refresh Archives login/permission state |
| `rcp_event_detail` | RCP | `GET /v2/rest/event/rcpEventDetail` | `eventType`, `eventId`, epoch-ms `queryTime` | `live_smoke_verified` | none |
| `rcp_event_feature_list` | RCP | `GET /v2/rest/event/rcpEventFeatureList` | `eventType`, `eventId`, epoch-ms `queryTime`, empty `featureGroup` | `blocked_response_too_large` | bounded feature summarization or smaller query contract |
| `rcp_policy_tree_lookup` | RCP | `GET /v2/rest/pro/policyTree/queryProPolicyTree` | `policyTreeCode`, integer `policyTreeVersion`, optional safe `targetPolicyCode` | `blocked_missing_real_sample` | real policy tree code and version |

## Supporting Probe

`rcp_snapshot` is not counted as a second-stage action in this inventory, but it
was used as a supporting shape-only probe to obtain a real event identity for
the two RCP event downstream actions.

- Fixed path: `POST /v2/rest/event/eventList`
- Latest supporting probe status: `completed`
- Event count observed: `200`
- First-event sample fields available in summary: `eventId`, `sourceId`,
  `deviceId`, `hitFusePolicyCode`, `_occurTime`
- Raw event list full dump returned: `false`

## Source-Specific Notes

### Login Logs

The latest verified parser path is `data.logSearchModels`. The default 7-day
query can exceed `MAX_LIVE_BODY_BYTES`; the action keeps initial diagnostics and
falls back to a 24-hour window. If the fallback has records, final
`source_status` is `completed`.

### Archives Center

Archives currently reaches an account/auth state in the live browser profile.
Body-level `api_code=302` is classified as `auth_failed`, not as a platform
network failure.

### RCP

`rcp_event_detail` is live-smoke verified with a real event identity from
`rcp_snapshot`. `rcp_event_feature_list` now has a real event sample but is
blocked by response size, not by sample quality. `rcp_policy_tree_lookup` still
requires a real policy tree versioned sample.

### Track Analysis

`track_analysis_check_data_ready` was promoted from candidate after a retest with
test device `ANDROID_c081c29a506f9db1` completed with `api_code=0`.
