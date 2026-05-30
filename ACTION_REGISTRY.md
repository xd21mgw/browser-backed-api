# Action Registry

This file is the service-side action registry closure for the browser-backed
risk platform access service. It is built from existing registry, contract,
readiness, smoke, source, and mock-test files only. It is not a new HAR
inventory and it does not add any action to the service allowlist.

The service remains a local `127.0.0.1` fixed-action service. Callers may use
only allowlisted action names and typed params. They must not pass arbitrary
URLs, paths, request headers, cookies, tokens, sessions, raw bodies, or raw
queries.

## Sources Read

- `RISK_SOURCE_CAPABILITY_REGISTRY.md`
- `BROWSER_BACKED_AGENT_SKILL.md`
- `PASSTHROUGH_SERVICE_CONTRACT.md`
- `README.md`
- `ONLINE_SOURCE_SUMMARY.md`
- `RCP_SOURCE_CONTRACT.md`
- `TRACK_ANALYSIS_SOURCE_CONTRACT.md`
- `WEAPON_SOURCE_CONTRACT.md`
- `browser_backed_live_smoke_readiness_v1.md`
- `src/actions.js`
- `src/originRegistry.js`
- `test/mock.test.js`

`browser_backed_service_adapter_v1.md` was not present in this repo when this
registry was written. No HAR inventory was rerun.

## Status Model

`current_status` describes the action's service-opening state:

- `stable`: default-open for general internal risk review.
- `beta`: implemented and smoke-backed, but explicit-trigger only.
- `contract_ready`: service contract exists, but the action is not default-open
  and still needs explicit trigger or stronger useful-sample coverage.
- `inventory_pending`: known non-noise candidate, but not registered in this
  service allowlist from the files read here.
- `excluded_noise`: intentionally not opened as a service action.

Readiness facets are tracked separately:

- `mock_ready`: covered by service mock tests and fixed request construction.
- `live_smoke_verified`: verified by local live-smoke notes without raw body or
  credential material output.
- `partial_observation_available`: live call reached the source, but safe output
  is bounded by body-size or partial extraction limits.
- `no_data`: source returned an empty useful sample in smoke; this is not a
  no-risk conclusion.

`team_open_recommendation` values:

- `yes_default`: available for general internal risk review.
- `yes_explicit`: callable only when the user or plan explicitly asks for that
  evidence domain and the caller accepts beta/contract-ready boundaries.
- `no`: not callable through this service yet.

## Stable Actions

| action_name | evidence_domain | backend_interface | typed_params | response_mode support | allowlist | mock_ready | live_smoke | team_open_recommendation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `track_analysis_summary` | 用户域 / 设备域 / 行为域 | Track Analysis `getLastestDateTime`, `getUseDuration`, `profile`, `getDeviceIds` | exactly one of `user_id` or `device_id`; `appName`; optional `sub_interface`, `time_window` | `compat_summary` default; `passthrough` opt-in | yes | yes | `live_complete` | `yes_default` |
| `login_logs_search` | 行为域 / 登录链路 | `GET /rest/unified/log/search`; large 7d response fallback to 24h `data.logSearchModels` | `user_id`; optional epoch-ms window, `recallSource`, `limit` | `compat_summary` default; `passthrough` opt-in | yes | yes | `live_complete`; `live_smoke_verified` | `yes_default` |
| `weapon_inventory` | 设备域 / 社交域 | `GET /apiv2/graphData`; internal chained `GET /apiv2/riskData` | exactly one of `user_id` or `device_id`; optional product/search/risk controls | `compat_summary` default; `passthrough` opt-in | yes | yes | `live_complete` | `yes_default` |
| `rcp_snapshot` | 策略域 | `POST /v2/rest/event/eventList` | typed event/time/source/device filters and page controls | `compat_summary` default; `passthrough` opt-in | yes | yes | `live_complete` | `yes_default` |

## Beta Actions

| action_name | evidence_domain | backend_interface | typed_params | response_mode support | allowlist | mock_ready | live_smoke | team_open_recommendation | boundary |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `archives_user_profile` | 用户域 | `GET /archives/user/home/info` | `user_id` | `compat_summary` default; `passthrough` opt-in | yes | yes | `live_smoke_verified` | `yes_explicit` | Archives origin is optional and not default general review. |
| `archives_user_analysis` | 用户域 / 行为域 | `POST /v3/user/log/coreLogs/fetch` | `user_id`, `beginTime`, `endTime`, optional page controls | `compat_summary` default; `passthrough` opt-in | yes | yes | `live_smoke_verified`; large page can be `partial_observation_available` | `yes_explicit` | Large raw log export is not supported. |
| `archives_related_users` | 社交域 / 设备域 | `POST /archives/user/search/device` | `user_id`, optional `relation_type` enum | `compat_summary` default; `passthrough` opt-in | yes | yes | `live_smoke_verified` | `yes_explicit` | Relation evidence only, not final ring attribution. |
| `rcp_event_detail` | 策略域 | `GET /v2/rest/event/rcpEventDetail` | `eventType`, `eventId`, `queryTime` | `compat_summary` default; `passthrough` opt-in | yes | yes | `live_smoke_verified` | `yes_explicit` | Requires an existing event identity. |
| `rcp_event_feature_list` | 策略域 | `GET /v2/rest/event/rcpEventFeatureList` | `eventType`, `eventId`, `queryTime`, optional empty `featureGroup` | `compat_summary` default; `passthrough` opt-in | yes | yes | `partial_observation_available` | `yes_explicit` | Feature response can exceed live body cap; no full feature dump. |
| `rcp_policy_tree_lookup` | 策略域 | `GET /v2/rest/pro/policyTree/queryProPolicyTree` | `policyTreeCode`, `policyTreeVersion`, optional `targetPolicyCode` | `compat_summary` default; `passthrough` opt-in | yes | yes | `live_smoke_verified` | `yes_explicit` | Strategy governance lookup only. |

## Contract-Ready Actions

| action_name | evidence_domain | backend_interface | typed_params | response_mode support | allowlist | mock_ready | live_smoke | team_open_recommendation | boundary |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `archives_photo_search` | 内容域 | `POST /v4/archives/report/photo/search` | `user_id`, `begin`, `end`, optional page/filter params | `compat_summary` default; `passthrough` opt-in | yes | yes | `no_data` smoke | `yes_explicit` | Keep explicit until broader useful evidence samples exist; `no_data` is not no-risk. |
| `track_analysis_check_data_ready` | 行为域 / 设备域 | `POST /dp/platform/app/analytics/v2/sequence/checkDataReady` | `device_id`, `appName`, `startTime`, `endTime`, optional filter arrays | `compat_summary` default; `passthrough` opt-in | yes | yes | `live_smoke_verified` | `yes_explicit` | Readiness probe, not default evidence. |

## Mock-Ready Actions

`test/mock.test.js` covers the current service allowlist and verifies fixed
service-side request construction, forbidden input rejection, source envelopes,
and safety expectations.

| action_name | mock_test_status |
| --- | --- |
| `track_analysis_summary` | `mock_ready`; stable passthrough mock coverage |
| `login_logs_search` | `mock_ready`; stable passthrough mock coverage; passthrough live-envelope mock coverage |
| `weapon_inventory` | `mock_ready`; stable passthrough mock coverage |
| `rcp_snapshot` | `mock_ready`; stable passthrough mock coverage; credential-field denylist mock coverage |
| `archives_user_profile` | `mock_ready`; fixed request/action mock coverage |
| `archives_user_analysis` | `mock_ready`; fixed request/action mock coverage |
| `archives_photo_search` | `mock_ready`; fixed request/action mock coverage |
| `archives_related_users` | `mock_ready`; fixed request/action mock coverage |
| `rcp_event_detail` | `mock_ready`; fixed request/action mock coverage |
| `rcp_event_feature_list` | `mock_ready`; fixed request/action mock coverage; large-response partial observation tests |
| `rcp_policy_tree_lookup` | `mock_ready`; fixed request/action mock coverage |
| `track_analysis_check_data_ready` | `mock_ready`; fixed request/action mock coverage |

## Live-Smoke Status

| action_name | smoke_status | notes |
| --- | --- | --- |
| `track_analysis_summary` | `live_complete` | First-batch stable source; all four sub-interfaces validated as shape-only outputs. |
| `login_logs_search` | `live_complete`; `live_smoke_verified` | Latest readiness notes record 24h fallback parsing through `data.logSearchModels`. |
| `weapon_inventory` | `live_complete` | First-batch stable source; graph and graph-to-risk chaining validated. |
| `rcp_snapshot` | `live_complete` | First-batch stable source; event list produced event identity fields for downstream smoke. |
| `archives_user_profile` | `live_smoke_verified` | Visible Archives context completed with user profile shape. |
| `archives_user_analysis` | `live_smoke_verified`; `partial_observation_available` for broader page | Small bounded page completed; larger page is safely capped. |
| `archives_photo_search` | `no_data` smoke | Transport/API shape completed, but tested sample returned no records. |
| `archives_related_users` | `live_smoke_verified` | Same-device relation result path observed. |
| `rcp_event_detail` | `live_smoke_verified` | Real event sample obtained from `rcp_snapshot`. |
| `rcp_event_feature_list` | `partial_observation_available` | HTTP 200 reached; body cap requires partial feature observation. |
| `rcp_policy_tree_lookup` | `live_smoke_verified` | HAR-derived `policyTreeVersion` query mapping verified. |
| `track_analysis_check_data_ready` | `live_smoke_verified` | Real test device readiness sample completed. |

## Explicit Trigger Required Actions

These actions are allowlisted but should not be called as default general-review
evidence. Agent or Skill callers must ask for the domain or have an explicit
plan step before invoking them.

| action_name | current_status | reason |
| --- | --- | --- |
| `archives_user_profile` | `beta` | Archives profile evidence is optional and domain-specific. |
| `archives_user_analysis` | `beta` | Core-log evidence can be large; use only for explicit Archives/history review. |
| `archives_photo_search` | `contract_ready` | Latest smoke was `no_data`; keep explicit until broader useful samples exist. |
| `archives_related_users` | `beta` | Relation-chain evidence is domain-specific and not a default review source. |
| `rcp_event_detail` | `beta` | Requires known event identity. |
| `rcp_event_feature_list` | `beta` | Can be large and currently relies on partial observation. |
| `rcp_policy_tree_lookup` | `beta` | Policy governance lookup, not default source discovery. |
| `track_analysis_check_data_ready` | `contract_ready` | Readiness probe, not direct risk evidence. |

## Full Action Matrix

| action_name | evidence_domain | backend_interface | typed_params | response_mode support | current_status | in_allowlist | mock_test | live_smoke | recommend_open | not_open_reason |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `track_analysis_summary` | 用户域 / 设备域 / 行为域 | Track Analysis profile/activity/device/latest-time interfaces | exactly one of `user_id` or `device_id`; `appName`; optional `sub_interface`, `time_window` | `compat_summary`; `passthrough` | `stable` | yes | yes | `live_complete` | yes | N/A |
| `login_logs_search` | 行为域 / 登录链路 | `/rest/unified/log/search` with 7d to 24h fallback | `user_id`; optional epoch-ms window, `recallSource`, `limit` | `compat_summary`; `passthrough` | `stable` | yes | yes | `live_complete`; `live_smoke_verified` | yes | N/A |
| `weapon_inventory` | 设备域 / 社交域 | `/apiv2/graphData`; chained `/apiv2/riskData` | exactly one of `user_id` or `device_id`; optional product/search/risk controls | `compat_summary`; `passthrough` | `stable` | yes | yes | `live_complete` | yes | N/A |
| `rcp_snapshot` | 策略域 | `/v2/rest/event/eventList` | typed event/time/source/device/page/column controls | `compat_summary`; `passthrough` | `stable` | yes | yes | `live_complete` | yes | N/A |
| `archives_user_profile` | 用户域 | `/archives/user/home/info` | `user_id` | `compat_summary`; `passthrough` | `beta` | yes | yes | `live_smoke_verified` | explicit only | Not default; Archives optional origin. |
| `archives_user_analysis` | 用户域 / 行为域 | `/v3/user/log/coreLogs/fetch` | `user_id`, `beginTime`, `endTime`, `pageIndex`, `pageSize` | `compat_summary`; `passthrough` | `beta` | yes | yes | `live_smoke_verified`; large page partial | explicit only | Not default; large responses need bounded output. |
| `archives_photo_search` | 内容域 | `/v4/archives/report/photo/search` | `user_id`, `begin`, `end`, `page`, `count`, `matchType`, `sort` | `compat_summary`; `passthrough` | `contract_ready` | yes | yes | `no_data` smoke | explicit only | Needs broader useful evidence sample before default opening. |
| `archives_related_users` | 社交域 / 设备域 | `/archives/user/search/device` | `user_id`, optional `relation_type` enum | `compat_summary`; `passthrough` | `beta` | yes | yes | `live_smoke_verified` | explicit only | Not default; relation evidence only. |
| `archives_private_message_search` | 社交域 | not defined in this repo's service registry | pending typed params | none | `inventory_pending` | no | no | no | no | Not in `src/actions.js`, `src/originRegistry.js`, mock tests, or readiness docs read here; requires strict privacy/redaction contract. |
| `archives_past_four_items` | 内容域 / 行为域 | not defined in this repo's service registry | pending typed params | none | `inventory_pending` | no | no | no | no | Not in current allowlist/registry/mock/live-smoke docs; needs source contract and bounded output policy. |
| `rcp_event_detail` | 策略域 | `/v2/rest/event/rcpEventDetail` | `eventType`, `eventId`, `queryTime` | `compat_summary`; `passthrough` | `beta` | yes | yes | `live_smoke_verified` | explicit only | Requires event identity; not default discovery source. |
| `rcp_event_feature_list` | 策略域 | `/v2/rest/event/rcpEventFeatureList` | `eventType`, `eventId`, `queryTime`, optional empty `featureGroup` | `compat_summary`; `passthrough` | `beta` | yes | yes | `partial_observation_available` | explicit only | Large response; no full feature export. |
| `rcp_policy_version_lookup` | 策略域 | not defined as an action in this repo's service registry | pending typed params | none | `inventory_pending` | no | no | no | no | Not allowlisted; needs source contract, typed params, mock tests, and live smoke. |
| `rcp_policy_detail_lookup` | 策略域 | not defined as an action in this repo's service registry | pending typed params | none | `inventory_pending` | no | no | no | no | Not allowlisted; needs source contract, typed params, mock tests, and live smoke. |
| `rcp_policy_release_record_lookup` | 策略域 | not defined as an action in this repo's service registry | pending typed params | none | `inventory_pending` | no | no | no | no | Not allowlisted; needs source contract, typed params, mock tests, and live smoke. |
| `rcp_policy_tree_lookup` | 策略域 | `/v2/rest/pro/policyTree/queryProPolicyTree` | `policyTreeCode`, `policyTreeVersion`, optional `targetPolicyCode` | `compat_summary`; `passthrough` | `beta` | yes | yes | `live_smoke_verified` | explicit only | Not default; strategy governance lookup only. |
| `rcp_node_policy_attribution` | 策略域 | not defined as an action in this repo's service registry | pending typed params | none | `inventory_pending` | no | no | no | no | Not allowlisted; attribution contract and live smoke missing here. |
| `rcp_node_bind_policy_attribution` | 策略域 | not defined as an action in this repo's service registry | pending typed params | none | `inventory_pending` | no | no | no | no | Not allowlisted; attribution contract and live smoke missing here. |
| `track_analysis_check_data_ready` | 行为域 / 设备域 | `/dp/platform/app/analytics/v2/sequence/checkDataReady` | `device_id`, `appName`, `product`, `startTime`, `endTime`, optional filter arrays, `metric`, `type` | `compat_summary`; `passthrough` | `contract_ready` | yes | yes | `live_smoke_verified` | explicit only | Readiness probe, not default evidence. |

## Excluded Noise

These are intentionally not open capabilities, including in passthrough mode.

| category | current_status | action_name | reason |
| --- | --- | --- | --- |
| Frontend telemetry and page analytics | `excluded_noise` | none | No direct risk evidence value for service callers. |
| `radar/misc` and log collect traffic | `excluded_noise` | none | Logging collection, not evidence retrieval. |
| `log-sdk` traffic | `excluded_noise` | none | SDK telemetry only. |
| JS/CSS/static assets | `excluded_noise` | none | Static resources are not source actions. |
| `h5-fingerprint` | `excluded_noise` | none | Fingerprinting endpoints are not opened as read-only evidence tools. |
| `mobile-device-info` | `excluded_noise` | none | Not a bounded risk evidence capability in this service. |
| Pure menu/config/permission probes | `excluded_noise` | none | Capability discovery must happen through contracts, not runtime probing. |
| Arbitrary URL fetch | `excluded_noise` | none | Violates fixed action and fixed origin/path boundary. |
| Cookie/token/session/header capabilities | `excluded_noise` | none | Browser auth material must not be read, accepted, or output. |

## Opening Summary

Actions recommended for default team use:

- `track_analysis_summary`
- `login_logs_search`
- `weapon_inventory`
- `rcp_snapshot`

Actions recommended only with explicit trigger:

- `archives_user_profile`
- `archives_user_analysis`
- `archives_photo_search`
- `archives_related_users`
- `rcp_event_detail`
- `rcp_event_feature_list`
- `rcp_policy_tree_lookup`
- `track_analysis_check_data_ready`

Known candidates not yet open in this service:

- `archives_private_message_search`
- `archives_past_four_items`
- `rcp_policy_version_lookup`
- `rcp_policy_detail_lookup`
- `rcp_policy_release_record_lookup`
- `rcp_node_policy_attribution`
- `rcp_node_bind_policy_attribution`

These candidates need service registration, fixed origin/path binding, typed
params, output policy, mock tests, and live smoke before callers can use them.
