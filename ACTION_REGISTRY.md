# Action Registry

This is the controlled passthrough action registry for the local
browser-backed service. It describes which fixed actions the service can call,
which fixed platform origin/path each action maps to, which typed params are
accepted, and which response modes are supported.

This file is service-layer documentation only. It does not define how an upper
layer Agent interprets `upstream.body`, builds normalized observations, or
formats user-facing review output.

The service contract is:

- fixed action name
- typed params only
- fixed `origin_key`
- fixed same-origin path
- browser-managed local profile state
- optional upstream response passthrough envelope

The service must not accept or output caller-provided URLs, paths, request
headers, cookies, tokens, sessions, authorization strings, raw request bodies,
raw queries, Chrome profile files, browser storage dumps, or Playwright storage
state.

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

`open_status` is service-opening status, not business interpretation status.

| open_status | Meaning |
| --- | --- |
| `open_default` | Stable fixed action; current callers may use it without a special action-opening step. |
| `open_explicit` | Fixed action exists in service allowlist/mock/readiness, but callers should invoke it only through an explicit action request or plan step. |
| `contract_ready` | Fixed action exists and has typed service contract coverage, but remains explicit and not default-open. |
| `inventory_pending` | Known candidate name only; not currently a service action and cannot be called. |
| `excluded_noise` | Intentionally not eligible for action registration. |

`passthrough_body=yes` means `response_mode=passthrough` may return
`upstream.body` when the upstream body is within size limits and passes the
credential-material denylist. Large bodies may be omitted with
`response_too_large`; authentication material must never be returned.

## Current Stable Passthrough / Compat Actions

These four actions are the current stable service actions. They support the
existing default `compat_summary` mode and opt-in `passthrough` mode.

| action_name | platform / origin_key | method | fixed_path | typed_params | response_mode_support | passthrough_body | allowlisted | mock_ready | live_smoke_status | open_status | safety_boundary |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `track_analysis_summary` | Track Analysis / `track_analysis` | `GET` or `POST` by `sub_interface` | `getLastestDateTime`, `getUseDuration`, `profile`, `getDeviceIds` fixed paths under `/dp/platform/app/analytics/v2/sequence/` | exactly one of `user_id` or `device_id`; `appName`; optional `sub_interface`, `time_window`, `response_mode` | `compat_summary` / `passthrough` | yes | yes | yes | `live_complete` | `open_default` | Fixed sub-interface enum only; no caller path/url/header/auth/raw body. |
| `login_logs_search` | Login Logs / `login_logs` | `GET` | `/rest/unified/log/search` | `user_id`; optional `from_timestamp`, `to_timestamp`, `time_window`, `recallSource`, `limit`, `response_mode` | `compat_summary` / `passthrough` | yes | yes | yes | `live_complete`; `live_smoke_verified` | `open_default` | Fixed path and bounded typed query only; no raw query/header/cookie/token/session. |
| `weapon_inventory` | Weapon / `weapon` | `GET` | `/apiv2/graphData`; internal chained `/apiv2/riskData` | exactly one of `user_id` or `device_id`; optional `product`, `productName`, `searchLevel`, `include_risk_data`, `max_device_ids`, `response_mode` | `compat_summary` / `passthrough` | yes | yes | yes | `live_complete` | `open_default` | Caller cannot choose graph/risk paths or pass raw device lists; chained risk path is service-owned. |
| `rcp_snapshot` | RCP / `rcp` | `POST` | `/v2/rest/event/eventList` | optional `eventType`, `source_id`, `sourceIds`, `device_id`, `startTime`, `endTime`, `time_window`, `pageIndex`, `page`, `pageSize`, `selected_columns`, `response_mode` | `compat_summary` / `passthrough` | yes | yes | yes | `live_complete` | `open_default` | Service builds the fixed request body; caller cannot pass URL/path/header/auth/raw body. |

## Explicit Fixed Actions

These actions already exist in `src/actions.js`, `src/originRegistry.js`, mock
tests, and readiness notes. They are callable service actions, but they are not
default actions for every caller. Use them only when an upper-layer plan or user
request explicitly names the relevant platform action/domain.

| action_name | platform / origin_key | method | fixed_path | typed_params | response_mode_support | passthrough_body | allowlisted | mock_ready | live_smoke_status | open_status | safety_boundary |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `archives_user_profile` | Archives Center / `archives` | `GET` | `/archives/user/home/info` | `user_id`, `response_mode` | `compat_summary` / `passthrough` | yes | yes | yes | `live_smoke_verified` | `open_explicit` | Decimal user id only; fixed Archives path; no caller auth material. |
| `archives_user_analysis` | Archives Center / `archives` | `POST` | `/v3/user/log/coreLogs/fetch` | `user_id`, `beginTime`, `endTime`, optional `pageIndex`, `pageSize`, `response_mode` | `compat_summary` / `passthrough` | yes, size-limited | yes | yes | `live_smoke_verified`; broader page can be `partial_observation_available` | `open_explicit` | Service-owned request body from typed fields; large body may be omitted or capped. |
| `archives_photo_search` | Archives Center / `archives` | `POST` | `/v4/archives/report/photo/search` | `user_id`, `begin`, `end`, optional `page`, `count`, `matchType`, `sort`, `response_mode` | `compat_summary` / `passthrough` | yes | yes | yes | `no_data` smoke | `contract_ready` | Fixed photo search path and typed page/filter params only. |
| `archives_related_users` | Archives Center / `archives` | `POST` | `/archives/user/search/device` | `user_id`, optional `relation_type`, `response_mode` | `compat_summary` / `passthrough` | yes | yes | yes | `live_smoke_verified` | `open_explicit` | Fixed same-device relation enum only; no arbitrary Archives query. |
| `rcp_event_detail` | RCP / `rcp` | `GET` | `/v2/rest/event/rcpEventDetail` | `eventType`, `eventId`, `queryTime`, `response_mode` | `compat_summary` / `passthrough` | yes | yes | yes | `live_smoke_verified` | `open_explicit` | Requires typed event identity; no caller path/query passthrough. |
| `rcp_event_feature_list` | RCP / `rcp` | `GET` | `/v2/rest/event/rcpEventFeatureList` | `eventType`, `eventId`, `queryTime`, optional empty `featureGroup`, `response_mode` | `compat_summary` / `passthrough` | yes, size-limited | yes | yes | `partial_observation_available` | `open_explicit` | Large upstream body may be omitted or capped; no full raw export guarantee. |
| `rcp_policy_tree_lookup` | RCP / `rcp` | `GET` | `/v2/rest/pro/policyTree/queryProPolicyTree` | `policyTreeCode`, `policyTreeVersion`, optional `targetPolicyCode`, `response_mode` | `compat_summary` / `passthrough` | yes | yes | yes | `live_smoke_verified` | `open_explicit` | Safe policy code/version params only; no arbitrary RCP policy path. |
| `track_analysis_check_data_ready` | Track Analysis / `track_analysis` | `POST` | `/dp/platform/app/analytics/v2/sequence/checkDataReady` | `device_id`, `appName`, optional `product`, `category`, `event`, `appPlatform`, `metric`, `type`; required `startTime`, `endTime`; `response_mode` | `compat_summary` / `passthrough` | yes | yes | yes | `live_smoke_verified` | `contract_ready` | Fixed readiness path; typed device/time/filter arrays only. |

## Inventory-Pending Candidates

These names are known non-noise candidates, but they are not service actions in
this repo today. They cannot be called until a fixed path, typed params, origin
binding, mock tests, and live smoke have been added through the normal action
promotion process.

| action_name | platform / origin_key | method | fixed_path | typed_params | response_mode_support | passthrough_body | allowlisted | mock_ready | live_smoke_status | open_status | safety_boundary |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `archives_private_message_search` | Archives Center / pending | pending | pending | pending | none | no | no | no | no | `inventory_pending` | Not callable; requires strict fixed path, typed params, and output safety review before allowlist. |
| `archives_past_four_items` | Archives Center / pending | pending | pending | pending | none | no | no | no | no | `inventory_pending` | Not callable; requires fixed path, typed params, mock, and live smoke. |
| `rcp_policy_version_lookup` | RCP / pending | pending | pending | pending | none | no | no | no | no | `inventory_pending` | Not callable; requires service registration and fixed RCP path. |
| `rcp_policy_detail_lookup` | RCP / pending | pending | pending | pending | none | no | no | no | no | `inventory_pending` | Not callable; requires service registration and fixed RCP path. |
| `rcp_policy_release_record_lookup` | RCP / pending | pending | pending | pending | none | no | no | no | no | `inventory_pending` | Not callable; requires service registration and fixed RCP path. |
| `rcp_node_policy_attribution` | RCP / pending | pending | pending | pending | none | no | no | no | no | `inventory_pending` | Not callable; requires bounded attribution contract before allowlist. |
| `rcp_node_bind_policy_attribution` | RCP / pending | pending | pending | pending | none | no | no | no | no | `inventory_pending` | Not callable; requires bounded attribution contract before allowlist. |

## Excluded Noise

The following categories are intentionally not service actions. Passthrough mode
does not make them callable.

| action_name / category | platform / origin_key | method | fixed_path | typed_params | response_mode_support | passthrough_body | allowlisted | mock_ready | live_smoke_status | open_status | safety_boundary |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| telemetry | none | none | none | none | none | no | no | no | no | `excluded_noise` | Frontend/page telemetry is not registered as an action. |
| `radar/misc/log` collect | none | none | none | none | none | no | no | no | no | `excluded_noise` | Log collection traffic is not exposed through the service. |
| `log-sdk` | none | none | none | none | none | no | no | no | no | `excluded_noise` | SDK logging traffic is not exposed through the service. |
| JS/CSS/static | none | none | none | none | none | no | no | no | no | `excluded_noise` | Static resources are never action targets. |
| `h5-fingerprint` | none | none | none | none | none | no | no | no | no | `excluded_noise` | Fingerprinting endpoints are not callable actions. |
| `mobile-device-info` | none | none | none | none | none | no | no | no | no | `excluded_noise` | Not registered as a bounded service action. |
| menu/config probes without direct evidence value | none | none | none | none | none | no | no | no | no | `excluded_noise` | Runtime probing is not a substitute for fixed action contracts. |
| arbitrary URL fetch | none | caller-controlled | caller-controlled | caller-controlled | none | no | no | no | no | `excluded_noise` | Violates fixed action, fixed origin, and fixed path boundary. |
| cookie/token/session/header capability | none | none | none | auth material | none | no | no | no | no | `excluded_noise` | Browser auth material must not be read, accepted, or output. |

## Full Service Action Matrix

This matrix repeats the callable and non-callable action names in one place
using the same service-layer fields.

| action_name | platform / origin_key | method | fixed_path | typed_params | response_mode_support | passthrough_body | allowlisted | mock_ready | live_smoke_status | open_status | safety_boundary |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `track_analysis_summary` | Track Analysis / `track_analysis` | `GET` or `POST` by `sub_interface` | Track Analysis sequence fixed paths | `user_id` or `device_id`, `appName`, optional `sub_interface`, `time_window` | `compat_summary` / `passthrough` | yes | yes | yes | `live_complete` | `open_default` | Fixed sub-interface enum only. |
| `login_logs_search` | Login Logs / `login_logs` | `GET` | `/rest/unified/log/search` | `user_id`, optional time window/limit/recall source | `compat_summary` / `passthrough` | yes | yes | yes | `live_complete`; `live_smoke_verified` | `open_default` | Fixed path and typed query only. |
| `weapon_inventory` | Weapon / `weapon` | `GET` | `/apiv2/graphData`; chained `/apiv2/riskData` | `user_id` or `device_id`, optional product/search controls | `compat_summary` / `passthrough` | yes | yes | yes | `live_complete` | `open_default` | Chained path is service-owned. |
| `rcp_snapshot` | RCP / `rcp` | `POST` | `/v2/rest/event/eventList` | typed event/time/source/device/page/column controls | `compat_summary` / `passthrough` | yes | yes | yes | `live_complete` | `open_default` | Service builds fixed request body. |
| `archives_user_profile` | Archives Center / `archives` | `GET` | `/archives/user/home/info` | `user_id` | `compat_summary` / `passthrough` | yes | yes | yes | `live_smoke_verified` | `open_explicit` | Fixed path only. |
| `archives_user_analysis` | Archives Center / `archives` | `POST` | `/v3/user/log/coreLogs/fetch` | `user_id`, `beginTime`, `endTime`, optional page controls | `compat_summary` / `passthrough` | yes, size-limited | yes | yes | `live_smoke_verified`; partial broader page | `open_explicit` | Fixed request body from typed fields only. |
| `archives_photo_search` | Archives Center / `archives` | `POST` | `/v4/archives/report/photo/search` | `user_id`, `begin`, `end`, optional page/filter params | `compat_summary` / `passthrough` | yes | yes | yes | `no_data` smoke | `contract_ready` | Fixed path and typed params only. |
| `archives_related_users` | Archives Center / `archives` | `POST` | `/archives/user/search/device` | `user_id`, optional `relation_type` | `compat_summary` / `passthrough` | yes | yes | yes | `live_smoke_verified` | `open_explicit` | Fixed relation enum only. |
| `archives_private_message_search` | pending | pending | pending | pending | none | no | no | no | no | `inventory_pending` | Not callable. |
| `archives_past_four_items` | pending | pending | pending | pending | none | no | no | no | no | `inventory_pending` | Not callable. |
| `rcp_event_detail` | RCP / `rcp` | `GET` | `/v2/rest/event/rcpEventDetail` | `eventType`, `eventId`, `queryTime` | `compat_summary` / `passthrough` | yes | yes | yes | `live_smoke_verified` | `open_explicit` | Typed event identity only. |
| `rcp_event_feature_list` | RCP / `rcp` | `GET` | `/v2/rest/event/rcpEventFeatureList` | `eventType`, `eventId`, `queryTime`, optional empty `featureGroup` | `compat_summary` / `passthrough` | yes, size-limited | yes | yes | `partial_observation_available` | `open_explicit` | Large upstream body may be omitted/capped. |
| `rcp_policy_version_lookup` | pending | pending | pending | pending | none | no | no | no | no | `inventory_pending` | Not callable. |
| `rcp_policy_detail_lookup` | pending | pending | pending | pending | none | no | no | no | no | `inventory_pending` | Not callable. |
| `rcp_policy_release_record_lookup` | pending | pending | pending | pending | none | no | no | no | no | `inventory_pending` | Not callable. |
| `rcp_policy_tree_lookup` | RCP / `rcp` | `GET` | `/v2/rest/pro/policyTree/queryProPolicyTree` | `policyTreeCode`, `policyTreeVersion`, optional `targetPolicyCode` | `compat_summary` / `passthrough` | yes | yes | yes | `live_smoke_verified` | `open_explicit` | Safe policy code/version only. |
| `rcp_node_policy_attribution` | pending | pending | pending | pending | none | no | no | no | no | `inventory_pending` | Not callable. |
| `rcp_node_bind_policy_attribution` | pending | pending | pending | pending | none | no | no | no | no | `inventory_pending` | Not callable. |
| `track_analysis_check_data_ready` | Track Analysis / `track_analysis` | `POST` | `/dp/platform/app/analytics/v2/sequence/checkDataReady` | `device_id`, `appName`, `startTime`, `endTime`, optional filters | `compat_summary` / `passthrough` | yes | yes | yes | `live_smoke_verified` | `contract_ready` | Fixed readiness path and typed params only. |

## Promotion Requirements

An `inventory_pending` candidate can become an allowlisted service action only
after all of the following exist:

- fixed `origin_key`
- fixed method and same-origin path
- typed params
- forbidden input validation for URL/path/header/cookie/token/session/raw body
- passthrough safety policy for upstream body size and credential fields
- mock tests
- live smoke record

Adding a new action must not add arbitrary URL fetch, caller-provided request
headers, browser auth material output, profile storage output, or automatic
platform writes.
