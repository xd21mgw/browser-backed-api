# Action Registry

This is the controlled passthrough action registry for the local
browser-backed service. It describes service-callable fixed actions, fixed
platform origin/path, typed params, mock/live status, and safety boundary.

Current callable action count: 37.

This file is service-layer documentation only. It does not define how an
upper-layer Agent interprets returned transport status or any platform data.

## Service Contract

- fixed action name
- typed params only
- fixed `origin_key`
- fixed method and same-origin path
- browser-managed local profile state
- bounded upstream business body passthrough envelope
- request/browser/service auth material suppressed

Callers should address the service through `service_base_url`:

- default local value: `http://127.0.0.1:8787`
- remote main Agent value: controlled Mac local worker/bridge/tunnel URL from
  `BROWSER_BACKED_SERVICE_BASE_URL` or equivalent Agent configuration

The service must not accept or output caller-provided URLs, paths, request
headers, cookies, tokens, sessions, authorization strings, raw request bodies,
raw queries, Chrome profile files, browser storage dumps, or Playwright storage
state.

`response_mode_support=passthrough only` means callers may omit `response_mode`
or set `response_mode=passthrough`. Other response modes are rejected.

## Status Model

| open_status | Meaning |
| --- | --- |
| `open_default` | Stable fixed action available to normal callers. |
| `open_explicit` | Callable fixed action, but callers should invoke it only through an explicit plan or user request. |
| `excluded_noise` | Intentionally not eligible for action registration. |

`passthrough_body=bounded` means the service returns `upstream.body` for small upstream business responses and `upstream.body_snippet` or `upstream.capped_body` for large responses. Request headers, response `set-cookie`, browser auth stores, Chrome profile material, localStorage, and Playwright storage state remain forbidden.

## Fetch Mode Model

The service uses browser pages for origin readiness, local login state, and
lightweight account confirmation. Business API fetches use browser-context
request by default, so fixed actions do not depend on the currently loaded page
JavaScript context.

Current runtime fetch modes:

- `context_request`: 36 fixed actions. The browser context supplies the local
  login state while the service calls the allowlisted fixed origin/path directly.
- `page_followup`: `weapon_inventory` only. This action chains the
  service-owned `graphData -> riskData` fixed paths and remains on
  page-context fetch for that follow-up flow.
- `page_fetch`: no current default action uses this mode.

## Callable Action Matrix

| action_name | platform / origin_key | method | fixed_path | typed_params | response_mode_support | passthrough_body | allowlisted | mock_ready | live_smoke_status | open_status | safety_boundary |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `track_analysis_summary` | Track Analysis / `track_analysis` | `GET` or `POST` by `sub_interface` | Track Analysis sequence fixed paths | `user_id` or `device_id`, `appName`, optional `sub_interface`, `time_window` | passthrough only | bounded | yes | yes | `live_complete` | `open_default` | Fixed sub-interface enum only; no caller path/url/header/auth/raw body. |
| `login_logs_search` | Login Logs / `login_logs` | `GET` | `/rest/unified/log/search` | `user_id`, optional time window/limit/recall source | passthrough only | bounded | yes | yes | `live_complete`; `live_smoke_verified` | `open_default` | Fixed path and typed query only. |
| `weapon_inventory` | Weapon / `weapon` | `GET` | `/apiv2/graphData`; chained `/apiv2/riskData` | `user_id` or `device_id`, optional product/search controls | passthrough only | bounded | yes | yes | `live_complete` | `open_default` | Chained risk path is service-owned. |
| `rcp_snapshot` | RCP / `rcp` | `POST` | `/v2/rest/event/eventList` | typed event/time/source/device/page/column controls | passthrough only | bounded | yes | yes | `live_complete` | `open_default` | Service builds fixed request body. |
| `archives_user_profile` | Archives Center / `archives` | `GET` | `/archives/user/home/info` | `user_id` | passthrough only | bounded | yes | yes | `live_smoke_verified` | `open_explicit` | Fixed path only. |
| `archives_user_analysis` | Archives Center / `archives` | `POST` | `/v3/user/log/coreLogs/fetch` | `user_id`, `beginTime`, `endTime`, optional page controls | passthrough only | bounded | yes | yes | `live_smoke_verified` | `open_explicit` | Fixed request body from typed fields only. |
| `archives_photo_search` | Archives Center / `archives` | `POST` | `/v4/archives/report/photo/search` | `user_id`, `begin`, `end`, optional page/filter params | passthrough only | bounded | yes | yes | `no_data` smoke | `open_explicit` | Fixed path and typed params only. |
| `archives_photo_profile` | Archives Center / `archives` | `POST` | `/v3/photo/profile` | `photo_id` | passthrough only | bounded | yes | yes | not run; mock only | `open_explicit` | Fixed photo identifier body only. |
| `archives_photo_meta` | Archives Center / `archives` | `POST` | `/v3/photo/meta` | `photo_id` | passthrough only | bounded | yes | yes | not run; mock only | `open_explicit` | Fixed photo identifier body only. |
| `archives_photo_report_aggregate` | Archives Center / `archives` | `POST` | `/v3/photo/report/aggregate` | `photo_id` | passthrough only | bounded | yes | yes | not run; mock only | `open_explicit` | Fixed photo identifier body only. |
| `archives_photo_user_autonomy` | Archives Center / `archives` | `POST` | `/archives/photo/home/userAutonomy` | `photo_id` | passthrough only | bounded | yes | yes | not run; mock only | `open_explicit` | Fixed photo identifier body only. |
| `archives_gallery_photo_list` | Archives Center / `archives` | `POST` | `/v3/user/gallery/photo/list` | `user_id`, optional `pageIndex`, `pageSize`, `filters` | passthrough only | bounded | yes | yes | not run; mock only | `open_explicit` | Fixed gallery list body only. |
| `archives_related_users` | Archives Center / `archives` | `POST` | `/archives/user/search/device` | `user_id`, optional `relation_type` | passthrough only | bounded | yes | yes | `live_smoke_verified` | `open_explicit` | Fixed relation enum only. |
| `archives_private_message_search` | Archives Center / `archives` | `POST` | `/archives/user/message/search` | `user_id`, `direction`, optional page/filter controls | passthrough only | bounded | yes | yes | `live_pass` | `open_explicit` | Fixed private-message search body. |
| `archives_past_four_items` | Archives Center / `archives` | `POST` | `/v4/audit/user/fourinfo/log/search` | `user_id`, optional info type/page/filter controls | passthrough only | bounded | yes | yes | `live_pass` | `open_explicit` | Fixed four-info search body. |
| `rcp_event_detail` | RCP / `rcp` | `GET` | `/v2/rest/event/rcpEventDetail` | `eventType`, `eventId`, `queryTime` | passthrough only | bounded | yes | yes | `live_smoke_verified` | `open_explicit` | Typed event identity only. |
| `rcp_event_feature_list` | RCP / `rcp` | `GET` | `/v2/rest/event/rcpEventFeatureList` | `eventType`, `eventId`, `queryTime`, optional empty `featureGroup` | passthrough only | bounded | yes | yes | size-limited smoke | `open_explicit` | Large upstream body is capped and may set `response_too_large`. |
| `rcp_event_tree_or_decision` | RCP / `rcp` | `GET` | `/v2/rest/event/rcpEventTreeOrDecision` | `eventType`, `eventId`, `queryTime`, optional `region`, `isPolicyTreeExperiment` | passthrough only | bounded | yes | yes | not run; mock only | `open_explicit` | Fixed event tree/decision query only. |
| `rcp_fast_query_hbase` | RCP / `rcp` | `GET` | `/v2/rest/event/fastQueryHbase` | `source_id`, `startTime`, `endTime`, optional `eventTypeCodes`, `limit` | passthrough only | bounded | yes | yes | not run; mock only | `open_explicit` | Fixed HBase lookup query only. |
| `rcp_feature_info_by_keys` | RCP / `rcp` | `GET` | `/v2/rest/fc/getEventFeatureInfoByKeys` | `eventType`, `eventId`, `queryTime`, `featureKeys`, optional `region`, `isPolicyTreeExperiment` | passthrough only | bounded | yes | yes | not run; mock only | `open_explicit` | Fixed feature-key query only. |
| `rcp_policy_basic_info` | RCP / `rcp` | `GET` | `/v2/rest/pc/policyReview/getPolicyBasicInfo` | `policyCode`, `policyTreeCode` | passthrough only | bounded | yes | yes | not run; mock only | `open_explicit` | Fixed policy-review query only. |
| `rcp_relation_policy_tree` | RCP / `rcp` | `GET` | `/v2/rest/pc/policyReview/getRelationPolicyTree` | `policyCode` | passthrough only | bounded | yes | yes | not run; mock only | `open_explicit` | Fixed relation-policy-tree query only. |
| `rcp_policy_binding_info_list` | RCP / `rcp` | `GET` | `/v2/rest/pro/policy/policyBindingInfoList` | `policyCode`, `policyVersion`, optional `page`, `size` | passthrough only | bounded | yes | yes | not run; mock only | `open_explicit` | Fixed policy binding query only. |
| `rcp_policy_search` | RCP / `rcp` | `POST` | `/v2/rest/pro/policy/policySearch` | optional `policyCode`, `policyTreeCode`, `page`, `size` | passthrough only | bounded | yes | yes | not run; mock only | `open_explicit` | Service builds fixed policy search body. |
| `rcp_policy_blur_search` | RCP / `rcp` | `GET` | `/v2/rest/pro/policy/policyBlurSearch` | optional `policyCode`, `policyTreeCode`, `page`, `size` | passthrough only | bounded | yes | yes | not run; mock only | `open_explicit` | Fixed policy blur-search query only. |
| `rcp_policy_all_version` | RCP / `rcp` | `GET` | `/v2/rest/pro/policy/getPolicyAllVersion` | `policyCode`, optional `page`, `size` | passthrough only | bounded | yes | yes | not run; mock only | `open_explicit` | Fixed policy version-list query only. |
| `rcp_pipeline_policy_versions_by_code` | RCP / `rcp` | `GET` | `/v2/rest/common/pipeline/getPolicyVersionsByCode` | `policyCode` | passthrough only | bounded | yes | yes | not run; mock only | `open_explicit` | Fixed pipeline policy-version query only. |
| `rcp_policy_version_lookup` | RCP / `rcp` | `GET` | `/v2/rest/pc/policy/getPolicyVersionListByEvent` | `eventType`, `eventId`, `policyCode`, `policyVersion`, `queryTime` | passthrough only | bounded | yes | yes | `live_pass` | `open_explicit` | Fixed policy-version query. |
| `rcp_policy_detail_lookup` | RCP / `rcp` | `GET` | `/v2/rest/pro/policy/getPolicyDetailByVersion` | `policyCode`, `policyVersion` | passthrough only | bounded | yes | yes | `live_pass` | `open_explicit` | Fixed policy-detail query. |
| `rcp_policy_release_record_lookup` | RCP / `rcp` | `POST` | `/v2/rest/common/pipeline/list` | `policyCode`, optional `statusCode`, `page`, `size` | passthrough only | bounded | yes | yes | `live_no_data` | `open_explicit` | Fixed release-record body. |
| `rcp_policy_tree_lookup` | RCP / `rcp` | `GET` | `/v2/rest/pro/policyTree/queryProPolicyTree` | `policyTreeCode`, `policyTreeVersion`, optional `targetPolicyCode` | passthrough only | bounded | yes | yes | `live_smoke_verified` | `open_explicit` | Safe policy code/version only. |
| `rcp_node_policy_attribution` | RCP / `rcp` | `POST` | `/v2/rest/pc/policy/nodePolicyAttribution` | `eventType`, `eventId`, `policyCode`, `policyVersion`, `queryTime`, optional `region`, fixed `type` | passthrough only | bounded | yes | yes | `live_pass` | `open_explicit` | Fixed node-policy attribution body. |
| `rcp_node_bind_policy_attribution` | RCP / `rcp` | `GET` | `/v2/rest/pc/policy/nodeBindPolicyAttribution` | `eventType`, `eventId`, `queryTime`, `policyTreeCode`, `policyTreeVersion`, `policyTreeNodeCode` | passthrough only | bounded | yes | yes | `live_pass` | `open_explicit` | Fixed node-bind attribution query. |
| `track_analysis_check_data_ready` | Track Analysis / `track_analysis` | `POST` | `/dp/platform/app/analytics/v2/sequence/checkDataReady` | `device_id`, `appName`, `startTime`, `endTime`, optional filters | passthrough only | bounded | yes | yes | `live_smoke_verified` | `open_explicit` | Fixed readiness path and typed params only. |
| `track_analysis_product_list` | Track Analysis / `track_analysis` | `POST` | `/dp/track-analysis/product/list/v2` | optional `product`, `appName`, `currentPage`, `pageSize`, `keyword`, `needFavorite` | passthrough only | bounded | yes | yes | not run; mock only | `open_explicit` | Fixed product-list body only. |
| `track_sequence_dimension_list` | Track Analysis / `track_analysis` | `GET` | `/dp/platform/app/analytics/v2/sequence/dimension/list` | optional `product` | passthrough only | bounded | yes | yes | not run; mock only | `open_explicit` | Fixed sequence-dimension query only. |
| `track_data_type_list` | Track Analysis / `track_analysis` | `GET` | `/dp/platform/app/analytics/v2/track/getDataTypeList` | optional `product` | passthrough only | bounded | yes | yes | not run; mock only | `open_explicit` | Fixed data-type query only. |

## Excluded Noise

The following categories are intentionally not service actions. Passthrough mode
does not make them callable.

| category | open_status | reason |
| --- | --- | --- |
| telemetry | `excluded_noise` | Frontend/page telemetry is not a service action. |
| `radar/misc/log` collect | `excluded_noise` | Log collection traffic is not exposed. |
| `log-sdk` | `excluded_noise` | SDK logging traffic is not exposed. |
| JS/CSS/static assets | `excluded_noise` | Static resources are never action targets. |
| `h5-fingerprint` | `excluded_noise` | Fingerprinting endpoints are not callable actions. |
| `mobile-device-info` | `excluded_noise` | Not registered as a bounded service action. |
| menu/config probes without direct service value | `excluded_noise` | Runtime probing is not a fixed action contract. |
| arbitrary URL fetch | `excluded_noise` | Violates fixed action, fixed origin, and fixed path boundary. |
| cookie/token/session/header capability | `excluded_noise` | Browser auth material must not be read, accepted, or output. |

## Promotion Requirements

A candidate can become an allowlisted service action only after all of the
following exist:

- fixed `origin_key`
- fixed method and same-origin path
- typed params
- forbidden input validation for URL/path/header/cookie/token/session/raw body
- bounded upstream business body passthrough contract
- request/browser/service auth material suppression
- credential-material protection
- mock tests
- live smoke plan and result

Adding a new action must not add arbitrary URL fetch, caller-provided request
headers, browser auth material output, profile storage output, business
parsing, or automatic platform writes.
