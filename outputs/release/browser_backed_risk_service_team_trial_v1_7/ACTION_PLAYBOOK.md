# Action Playbook

This playbook is for users, Skills, main agents, and scripts. It describes what
to call when a user asks for a risk-platform read. `ACTION_REGISTRY.md` remains
the interface truth; `CAPABILITY_INDEX.yaml` maps capabilities to allowlisted
actions.

The service is still pure passthrough: fixed action, typed params, fixed
origin/path, upstream business response body passthrough. It does not summarize,
score risk, build evidence cards, or call DataAgent/Hive.

Use `{service_base_url}` for every request. Local default is
`http://127.0.0.1:8787`. Remote main agents should use the value printed by
`npm run worker:expose`.

## 用户画像

- 适用问题：查用户基础画像、账号状态、档案中心画像、前端活跃画像。
- 推荐 action：`archives_user_profile`, `archives_user_analysis`,
  `track_analysis_summary`
- 补充 action：`archives_negative_report`,
  `archives_negative_uninterested`, `archives_risk_info`,
  `archives_user_label`, `archives_user_shop_info`, `archives_review_logs`,
  `archives_user_analyze_summary`
- 必填参数：`user_id`
- 可选参数：`beginTime`, `endTime`, `pageIndex`, `pageSize`, `appName`,
  `sub_interface`
- 常见下一跳：登录历史、设备图谱、资料变更、作品查询。

Example:

```sh
curl -sS -X POST "{service_base_url}/actions/archives_user_profile" \
  -H 'content-type: application/json' \
  -d '{"response_mode":"passthrough","user_id":"<user_id>"}'
```

Notes: no-data or an empty body is not a risk conclusion. Upper-layer agents
should parse returned business fields and record missing sources separately.

## 登录历史

- 适用问题：查统一登录日志、登录设备、登录方式、登录链路。
- 推荐 action：`login_logs_search`
- 必填参数：`user_id`
- 可选参数：`from_timestamp`, `to_timestamp`, `time_window`, `recallSource`,
  `limit`, `max_records`
- 常见下一跳：设备图谱、用户画像、Track 活跃。

Example:

```sh
curl -sS -X POST "{service_base_url}/actions/login_logs_search" \
  -H 'content-type: application/json' \
  -d '{"response_mode":"passthrough","user_id":"<user_id>","max_records":300}'
```

Notes: fixed actions expect API JSON and use browser-context request by default;
page state is only for login/readiness. If the fixed API returns a page shell,
the service reports `unexpected_html_response` / `api_contract_mismatch`.
Large JSON uses `json_array_capped`; `missing_records` must be treated as
incomplete evidence.

## 设备图谱

- 适用问题：查用户关联设备、设备风险标签、设备活跃和关联用户。
- 推荐 action：`weapon_inventory`, `track_analysis_summary`
- 必填参数：`user_id` or `device_id`
- 可选参数：`include_risk_data`, `max_device_ids`, `appName`,
  `sub_interface`
- 常见下一跳：登录历史、用户画像、私信/社交。

Example:

```sh
curl -sS -X POST "{service_base_url}/actions/weapon_inventory" \
  -H 'content-type: application/json' \
  -d '{"response_mode":"passthrough","user_id":"<user_id>"}'
```

Notes: `weapon_inventory` is the current page-follow-up exception because it
chains service-owned graph/risk fixed paths. It still does not build a risk
judgment.

## 作品/内容

- 适用问题：查作品列表、作品详情、视频 meta、举报聚合、用户作品锚点。
- 推荐 action：`archives_photo_search`, `archives_photo_profile`,
  `archives_photo_meta`
- 补充 action：`archives_photo_report_aggregate`,
  `archives_photo_user_autonomy`, `archives_gallery_photo_list`,
  `archives_photo_gallery_top`, `archives_collect_photo_list`,
  `archives_collection_list`, `archives_live_gallery`,
  `archives_livestream_home_info`, `archives_livestream_home_meta`,
  `archives_livestream_home_log`,
  `archives_livestream_comment_statistics`,
  `archives_livestream_comment_detail`, `archives_user_report_search`,
  `archives_moment_list`, `archives_punish_status`
- 必填参数：`user_id` for search/list; `photo_id` for profile/meta/report.
- 可选参数：`begin`, `end`, `page`, `count`, `pageIndex`, `pageSize`
- 常见下一跳：用户画像、设备图谱、策略事件。

Example:

```sh
curl -sS -X POST "{service_base_url}/actions/archives_photo_meta" \
  -H 'content-type: application/json' \
  -d '{"response_mode":"passthrough","photo_id":"<photo_id>"}'
```

Notes: service returns upstream business body only. Field meaning such as
`uploadSource`, `photoMethod`, publish device, IP, or UA is interpreted outside
the service.

## 私信/社交

- 适用问题：查私信样本、粉丝、关注、评论、关联用户、关系链线索。
- 推荐 action：`archives_private_message_search`
- 补充 action：`archives_fans_list`, `archives_follow_list`,
  `archives_comment_search`, `archives_related_users`
- 必填参数：`user_id`, `direction`
- 可选参数：`page`, `count`, `beginTime`, `endTime`
- 常见下一跳：用户画像、设备图谱。

Example:

```sh
curl -sS -X POST "{service_base_url}/actions/archives_private_message_search" \
  -H 'content-type: application/json' \
  -d '{"response_mode":"passthrough","user_id":"<user_id>","direction":"sent","page":1,"count":20}'
```

Notes: private-message action is explicit-use. Do not print full upstream body
in user-facing summaries.

## 资料变更

- 适用问题：查历史昵称、头像、简介、背景等资料变更。
- 推荐 action：`archives_past_four_items`
- 必填参数：`user_id`
- 可选参数：`info_type`, `infoType`, `page`, `count`
- 常见下一跳：用户画像、作品/内容。

Example:

```sh
curl -sS -X POST "{service_base_url}/actions/archives_past_four_items" \
  -H 'content-type: application/json' \
  -d '{"response_mode":"passthrough","user_id":"<user_id>","info_type":"all","page":1,"count":20}'
```

## 策略事件/RCP

- 适用问题：查策略事件入口、事件详情、特征、策略树、策略版本、节点归因。
- 推荐 action：`rcp_snapshot`, `rcp_event_detail`,
  `rcp_event_feature_list`, `rcp_policy_tree_lookup`,
  `rcp_policy_version_lookup`, `rcp_policy_detail_lookup`,
  `rcp_policy_release_record_lookup`, `rcp_node_policy_attribution`,
  `rcp_node_bind_policy_attribution`
- 补充 action：`rcp_policy_tree_list`, `rcp_policy_tree_node_binding`,
  `rcp_policy_tree_policy_codes`, `rcp_policy_tree_max_version`,
  `rcp_event_type_list`, `rcp_realtime_op_list`,
  `rcp_event_query_max_duration`, `rcp_event_save_ratios`
- 必填参数：depends on action; common params include `eventType`, `eventId`,
  `queryTime`, `policyCode`, `policyVersion`, `policyTreeCode`,
  `policyTreeVersion`, `policyTreeNodeCode`
- 可选参数：`region`, `page`, `size`, `featureGroup`
- 常见下一跳：作品/内容, 用户画像, RCP feature info.

Example:

```sh
curl -sS -X POST "{service_base_url}/actions/rcp_event_detail" \
  -H 'content-type: application/json' \
  -d '{"response_mode":"passthrough","eventType":"<eventType>","eventId":"<eventId>","queryTime":"<queryTime>"}'
```

Notes: RCP actions are explicit-use. They are not default user-id lookup
actions, and the service does not explain strategy hits or produce risk
judgments.

## 前端活跃/Track

- 适用问题：查前端活跃、设备列表、数据就绪状态、产品和维度枚举。
- 推荐 action：`track_analysis_summary`, `track_analysis_check_data_ready`
- 补充 action：`track_sequence_get_device_ids`,
  `track_sequence_get_use_duration`, `track_sequence_profile`,
  `track_analysis_product_list`, `track_sequence_dimension_list`,
  `track_data_type_list`
- 必填参数：`user_id` or `device_id` for user/device queries; `device_id` for
  check-data-ready.
- 可选参数：`appName`, `sub_interface`, `startTime`, `endTime`, `product`
- 常见下一跳：登录历史、设备图谱。

Example:

```sh
curl -sS -X POST "{service_base_url}/actions/track_analysis_summary" \
  -H 'content-type: application/json' \
  -d '{"response_mode":"passthrough","sub_interface":"profile","user_id":"<user_id>","appName":"KUAISHOU"}'
```

Notes: auxiliary product/dimension/data-type actions support parameter
discovery and should not be treated as direct risk evidence.

## Direct Action Escape Hatch

Use direct action mode only when the caller already knows the exact action and
typed params:

```txt
/browser-backed-risk-service action <action_name> <json_params>
```

The action must be allowlisted. Forbidden keys such as `url`, `path`, `header`,
`cookie`, `token`, `session`, `authorization`, `raw_body`, `raw_query`, and
`secret` are rejected.
