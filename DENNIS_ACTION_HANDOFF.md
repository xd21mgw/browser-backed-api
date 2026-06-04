# Dennis Action Handoff

This file is the consumer-side handoff for Dennis and other upper-layer Agents.
`ACTION_REGISTRY.md` remains the service-layer source of truth for callable
fixed actions. This file only records how Dennis should consume passthrough
envelopes without moving business parsing into the browser-backed service.

The service stays pure passthrough: fixed action, typed params, fixed
origin/path, same-origin browser fetch, bounded upstream business body, and
transport status. It does not produce summaries, normalized observations,
source quality, evidence cards, or risk judgments.

## Archives Actions

| action_name | method | fixed_path | required typed params | optional typed params | output envelope | Dennis consumption value |
| --- | --- | --- | --- | --- | --- | --- |
| `archives_photo_profile` | `POST` | `/v3/photo/profile` | `photo_id` | none | passthrough-only; bounded `upstream.body` or `upstream.capped_body` | Publish fact chain; candidate fields such as `photoIp`, `photoMethod`, `uploadSource`, status, stats, risk hints. |
| `archives_photo_meta` | `POST` | `/v3/photo/meta` | `photo_id` | none | passthrough-only; bounded `upstream.body` or `upstream.capped_body` | Video meta and origin details; candidate fields such as upload source, publish client/device/app/platform, operation source, create/upload/publish time. |
| `archives_photo_report_aggregate` | `POST` | `/v3/photo/report/aggregate` | `photo_id` | none | passthrough-only; bounded `upstream.body` or `upstream.capped_body` | Report aggregate for content evidence follow-up. |
| `archives_photo_user_autonomy` | `POST` | `/archives/photo/home/userAutonomy` | `photo_id` | none | passthrough-only; bounded `upstream.body` or `upstream.capped_body` | Content status, autonomy, satisfaction, or approval-state auxiliary evidence. |
| `archives_gallery_photo_list` | `POST` | `/v3/user/gallery/photo/list` | `user_id` | `pageIndex`, `pageSize`, `filters` | passthrough-only; bounded `upstream.body` or `upstream.capped_body` | Photo ID discovery when a case has no known `photo_id`; candidate publish anchors. |
| `archives_photo_gallery_top` | `POST` | `/v3/user/gallery/photo/top` | `user_id` | none | passthrough-only; bounded body | Top photo anchors. |
| `archives_negative_report` | `POST` | `/v3/user/negative/report` | `user_id` | none | passthrough-only; bounded body | Negative/realtime module status. |
| `archives_negative_uninterested` | `POST` | `/v3/user/negative/unInterested` | `user_id` | none | passthrough-only; bounded body | Uninterested/negative status. |
| `archives_risk_info` | `GET` | `/v3/user/risk/info` | `user_id` | none | passthrough-only; bounded body | Risk info structure. |
| `archives_user_label` | `POST` | `/archives/user/home/getUserLabel` | `user_id` | none | passthrough-only; bounded body | User label/status fields. |
| `archives_user_shop_info` | `GET` | `/archives/user/home/getUserShopInfo` | `user_id` | none | passthrough-only; bounded body | Shop/account commerce context. |
| `archives_punish_status` | `POST` | `/archives/draco/getPunishStatus` | `photo_id` or `live_stream_id` | `target_id`, `target_type=PHOTO|LIVE_STREAM` | passthrough-only; bounded body | Photo/live target punish status only; no generic user-level lookup. |
| `archives_review_logs` | `POST` | `/v3/user/log/reviewLogs/fetch` | `user_id`, `beginTime`, `endTime` | `pageIndex`, `pageSize` | passthrough-only; bounded body | Review log list. |
| `archives_user_analyze_summary` | `POST` | `/v3/user/analyze/fetch` | `user_id`, `beginTime`, `endTime` | `pageIndex`, `pageSize` | passthrough-only; bounded body | User analysis summary/matrix. |
| `archives_live_gallery` | `POST` | `/v4/archives/gallery/live/list` | `user_id` | `page`, `count` | passthrough-only; bounded body | Live-stream ID discovery. |
| `archives_fans_list` | `POST` | `/v3/user/profile/relation/fans/list` | `user_id` | `pageIndex`, `pageSize` | passthrough-only; bounded body | Fans relation list. |
| `archives_follow_list` | `POST` | `/v3/user/profile/relation/follow/list` | `user_id` | `pageIndex`, `pageSize` | passthrough-only; bounded body | Follow relation list. |
| `archives_collect_photo_list` | `POST` | `/v3/user/collect/photo/list` | `user_id` | `page`, `count` | passthrough-only; bounded body | Collected photo list. |
| `archives_collection_list` | `POST` | `/archives/photo/collection/getCollectionList` | `user_id` | `page`, `size` | passthrough-only; bounded body | Collection/folder list. |
| `archives_comment_search` | `POST` | `/archives/photo/comment/search` | `user_id` xor `photo_id` | `containsPhotoInfo`, `page`, `count` | passthrough-only; bounded body | Sent/received comment evidence, partial only when paged/capped. |
| `archives_livestream_home_info` | `POST` | `/archives/livestream/home/info` | `live_stream_id` | none | passthrough-only; bounded body | Live home info. |
| `archives_livestream_home_meta` | `POST` | `/archives/livestream/home/meta` | `live_stream_id` | none | passthrough-only; bounded body | Live metadata. |
| `archives_livestream_home_log` | `POST` | `/archives/livestream/home/log` | `live_stream_id` | `beginTime`, `endTime`, `page`, `count` | passthrough-only; bounded body | Live audit/log list. |
| `archives_livestream_comment_statistics` | `POST` | `/archives/livestream/comment/statistics` | `live_stream_id` | none | passthrough-only; bounded body | Live comment aggregate. |
| `archives_livestream_comment_detail` | `POST` | `/archives/livestream/comment/detail` | `live_stream_id` | `page`, `count` | passthrough-only; bounded body | Live comment detail list. |
| `archives_user_report_search` | `POST` | `/v4/archives/report/user/search` | `user_id` | `begin`, `end`, `page`, `count` | passthrough-only; bounded body | User report search. |
| `archives_moment_list` | `POST` | `/archives/user/gallery/momentList` | `user_id` | `page`, `count` | passthrough-only; bounded body | Moment list; empty result is not counter-evidence. |

Archives outputs may contain risk entities such as `user_id`, `photo_id`,
device identifiers, IP, UA, status fields, and publish timestamps. These are
business response fields and may be parsed by Dennis. The service must not
output request headers, `set-cookie`, cookies, tokens, sessions, authorization
values, Chrome profile files, localStorage, or Playwright storage state.

## RCP Actions

| action_name | method | fixed_path | required typed params | optional typed params | Dennis use |
| --- | --- | --- | --- | --- | --- |
| `rcp_event_tree_or_decision` | `GET` | `/v2/rest/event/rcpEventTreeOrDecision` | `eventType`, `eventId`, `queryTime` | `region`, `isPolicyTreeExperiment=false` | Strategy tree or decision-chain follow-up. |
| `rcp_fast_query_hbase` | `GET` | `/v2/rest/event/fastQueryHbase` | `source_id`, `startTime`, `endTime` | `eventTypeCodes`, `limit` | Event underlying detail follow-up. |
| `rcp_feature_info_by_keys` | `GET` | `/v2/rest/fc/getEventFeatureInfoByKeys` | `eventType`, `eventId`, `queryTime`, `featureKeys` | `region`, `isPolicyTreeExperiment=false` | Feature key detail explanation. |
| `rcp_policy_basic_info` | `GET` | `/v2/rest/pc/policyReview/getPolicyBasicInfo` | `policyCode`, `policyTreeCode` | none | Policy basic information. |
| `rcp_relation_policy_tree` | `GET` | `/v2/rest/pc/policyReview/getRelationPolicyTree` | `policyCode` | none | Related policy tree lookup. |
| `rcp_policy_binding_info_list` | `GET` | `/v2/rest/pro/policy/policyBindingInfoList` | `policyCode`, `policyVersion` | `page`, `size` | Policy binding relation. |
| `rcp_policy_search` | `POST` | `/v2/rest/pro/policy/policySearch` | none | `policyCode`, `policyTreeCode`, `page`, `size` | Policy lookup by code/tree. |
| `rcp_policy_blur_search` | `GET` | `/v2/rest/pro/policy/policyBlurSearch` | none | `policyCode`, `policyTreeCode`, `page`, `size` | Policy code/name fuzzy lookup. |
| `rcp_policy_all_version` | `GET` | `/v2/rest/pro/policy/getPolicyAllVersion` | `policyCode` | `page`, `size` | Policy version list. |
| `rcp_pipeline_policy_versions_by_code` | `GET` | `/v2/rest/common/pipeline/getPolicyVersionsByCode` | `policyCode` | none | Pipeline policy-version metadata. |
| `rcp_policy_tree_list` | `GET` | `/v2/rest/pro/policyTree/policyTreeList` | none | `policyTreeCode`, `policyCode`, `eventTypeAssociator`, `page`, `size` | Coarse policy-tree discovery. |
| `rcp_policy_tree_node_binding` | `GET` | `/v2/rest/pro/policyTree/queryBindingByNodeCode` | `policyTreeCode`, `policyTreeVersion`, `policyTreeNodeCode` | `policyCode`, `page`, `size` | Node-level bound policy list. |
| `rcp_policy_tree_policy_codes` | `GET` | `/v2/rest/pro/policyTree/getAllPolicyCodeByPage` | `policyTreeCode`, `policyTreeVersion` | `code`, `page`, `size` | Full-tree policy-code list. |
| `rcp_policy_tree_max_version` | `GET` | `/v2/rest/pro/policyTree/getMaxPolicyTreeVersion` | `policyTreeCode` | `treeSnapshot` | Max policy-tree version lookup. |
| `rcp_event_type_list` | `GET` | `/v2/rest/basicInfo/getEventTypeListByPage` | none | `keyWord`, `keyword`, `page`, `size` | Event type option discovery. |
| `rcp_realtime_op_list` | `GET` | `/v2/rest/event/realTimeOpList` | `eventType` | none | Realtime operation option discovery. |
| `rcp_event_query_max_duration` | `GET` | `/v2/rest/event/eventQueryMaxDurationGet` | `eventType` | none | Event query max-duration helper. |
| `rcp_event_save_ratios` | `GET` | `/v2/rest/event/getEventSaveRatios` | `eventType` | none | Event save-ratio helper. |

Dennis should use these for `strategy_hit_explanation`,
`policy_attribution`, `false_positive_review`, and `strategy_governance`.
They should not be inserted into the default ordinary ATO user chain unless the
case already has an RCP event/policy anchor or the user explicitly asks for RCP
follow-up. The service does not explain policy semantics or risk conclusions.

## Track Auxiliary Actions

| action_name | method | fixed_path | required typed params | optional typed params | Dennis use |
| --- | --- | --- | --- | --- | --- |
| `track_analysis_product_list` | `POST` | `/dp/track-analysis/product/list/v2` | none | `product`, `appName`, `currentPage`, `pageSize`, `keyword`, `needFavorite` | Product/app discovery before Track queries. |
| `track_sequence_dimension_list` | `GET` | `/dp/platform/app/analytics/v2/sequence/dimension/list` | none | `product` | Sequence dimension discovery. |
| `track_data_type_list` | `GET` | `/dp/platform/app/analytics/v2/track/getDataTypeList` | none | `product` | Track data type discovery. |
| `track_sequence_get_device_ids` | `POST` | `/dp/platform/app/analytics/v2/sequence/getDeviceIds` | `user_id` xor `device_id`, `appName` | none | Standalone device-id list subinterface. |
| `track_sequence_get_use_duration` | `POST` | `/dp/platform/app/analytics/v2/sequence/getUseDuration` | `user_id` xor `device_id`, `appName` | none | Standalone use-duration subinterface. |
| `track_sequence_profile` | `POST` | `/dp/platform/app/analytics/v2/sequence/profile` | `user_id` xor `device_id`, `appName` | `time_window` | Standalone Track profile subinterface. |

These are auxiliary enumeration actions for `track_parameter_discovery`,
`track_field_explanation`, and dimension/data type discovery. They should not
be treated as direct risk evidence or default final-risk-chain inputs.

## Login Logs Capped Body Contract

`login_logs_search` returns a passthrough envelope. For large JSON responses
with `data.logSearchModels`, the service uses a structured row cap instead of a
raw string-only cap.

- expected upstream body: API JSON, not a front-end HTML/page shell
- default service body cap: 5MB (`MAX_LIVE_BODY_BYTES` can override)
- default `max_records`: `300`
- hard `max_records`: `300`
- explicit cap: caller may pass `max_records=20/50/100/300`
- compatibility cap: caller may pass existing `limit`, which is reused as the
  service-side row cap when `max_records` is absent
- byte cap: if the target row count cannot fit within the response byte cap,
  the service returns the largest complete leading row set that fits
- fallback: if JSON parse fails, the service falls back to bounded
  `upstream.body_snippet`, `raw_body_handling=capped`, and
  `json_array_cap_error_type=json_parse_error`
- HTML/page shell guard: if the fixed API call returns HTML, the service returns
  `error_type=unexpected_html_response` and
  `platform_error=api_contract_mismatch`; Dennis must not parse it as login
  logs or classify it as no-data.

Structured cap fields:

```json
{
  "raw_body_handling": "json_array_capped",
  "cap_reason": "record_limit",
  "upstream": {
    "raw_body_handling": "json_array_capped",
    "capped_json_path": "data.logSearchModels",
    "observed_records": 334,
    "returned_records": 300,
    "missing_records": 34,
    "missing_body_reason": "response_too_large",
    "cap_reason": "record_limit",
    "capped_body": {
      "data": {
        "logSearchModels": []
      }
    }
  }
}
```

`cap_reason` values:

- `record_limit`: rows were omitted because the requested/default row cap was
  reached.
- `byte_limit`: fewer than the requested/default rows were returned because
  the bounded JSON still had to fit the byte cap.
- `response_too_large`: generic fallback when the service cannot classify the
  cap more precisely.

Dennis consumption rules:

- Parse only `upstream.capped_body.data.logSearchModels` when
  `raw_body_handling=json_array_capped`.
- Treat `returned_records` as partial evidence only.
- Put `missing_records` into the incomplete evidence explanation.
- Do not treat returned rows as the full login history.
- Do not treat `no_data`, `body_truncated`, `byte_limit`, or
  `response_too_large` as proof of no risk.
- Treat `unexpected_html_response` as a service/API contract issue that needs
  action contract repair, not as user evidence.
- Dennis may create source quality, evidence chains, observations, summaries,
  and final review boundaries; the service must not.
- Field projection, compact tables, and narrative summaries belong in Dennis.
  The service only returns bounded upstream body or capped body plus transport
  metadata.
