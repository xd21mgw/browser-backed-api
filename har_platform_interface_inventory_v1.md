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
| `archives_user_analysis` | Archives Center | `POST /v3/user/log/coreLogs/fetch` | decimal `user_id`, epoch-ms `beginTime/endTime`, page controls | `live_smoke_verified`; large-page `partial_observation_available` | bounded page size still gives exact completed smoke; pageSize=30 returns capped partial observation when it exceeds the 65536-byte live cap |
| `archives_user_profile` | Archives Center | `GET /archives/user/home/info` | decimal `user_id` | `live_smoke_verified` | none |
| `archives_photo_search` | Archives Center | `POST /v4/archives/report/photo/search` | decimal `user_id`, epoch-ms `begin/end`, page controls, fixed enum filters | `no_data` | no-data is source state only, not no-risk |
| `archives_related_users` | Archives Center | `POST /archives/user/search/device` | decimal `user_id`, fixed relation type enum | `live_smoke_verified` | none |
| `rcp_event_detail` | RCP | `GET /v2/rest/event/rcpEventDetail` | `eventType`, `eventId`, epoch-ms `queryTime` | `live_smoke_verified` | none |
| `rcp_event_feature_list` | RCP | `GET /v2/rest/event/rcpEventFeatureList` | `eventType`, `eventId`, epoch-ms `queryTime`, empty `featureGroup` | `partial_observation_available` | exact full feature count still needs a narrower query or dedicated bounded extraction contract |
| `rcp_policy_tree_lookup` | RCP | `GET /v2/rest/pro/policyTree/queryProPolicyTree` | `policyTreeCode`, integer `policyTreeVersion`, optional safe `targetPolicyCode` | `live_smoke_verified` | none; recommended minimum is `policyTreeCode + policyTreeVersion` |

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

Archives live smoke now succeeds when the service is started with
`BROWSER_HEADLESS=false` and the auth flow is completed in the service-owned
visible browser context. The earlier body-level `api_code=302` state is
classified as `auth_flow_not_completed_in_bound_context`, not as explicit
permission denial. `archives_photo_search` currently returns a standard
`no_data` source state for the tested user/window. `archives_user_analysis`
still completes with bounded page size; when larger pages exceed the configured
65536-byte live body cap, the action now returns `partial_observation_available`
with top-level keys, count estimate, page-info partial fields, key user entity,
and large-response source-quality flags without returning raw records.

### RCP

`rcp_event_detail` is live-smoke verified with a real event identity from
`rcp_snapshot`. `rcp_event_feature_list` now has a real event sample and returns
`partial_observation_available` when the HTTP 200 body is capped at
`MAX_LIVE_BODY_BYTES=65536`; the summary includes top-level keys, feature count
estimate, feature group summary, and key event entity fields without returning
the raw body. `rcp_policy_tree_lookup` is live-smoke verified after aligning the
builder with the HAR-derived query keys: `policyTreeCode`, `policyTreeVersion`,
and optional `targetPolicyCode`.

### Track Analysis

`track_analysis_check_data_ready` was promoted from candidate after a retest with
test device `ANDROID_c081c29a506f9db1` completed with `api_code=0`.
