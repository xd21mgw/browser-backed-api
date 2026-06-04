# Controlled Live Smoke Plan V1.7

This plan closes the gap between HAR-derived contracts and current live
platform behavior for the 70 allowlisted browser-backed fixed actions.

HAR and inventory files are contract hints only. They are not live smoke
parameters. For live validation, use recent time windows and derive dependent
identifiers from upstream entry actions before calling follow-up actions.

The service remains pure passthrough: fixed action, typed params, fixed
origin/path, upstream business body passthrough. It does not summarize, score
risk, build source quality, build evidence cards, or call DataAgent/Hive.

## Safety Boundary

- Call only `http://.../health`, `/actions`, and `/actions/<allowlisted_action>`.
- Do not use arbitrary URL, path, header, cookie, token, session, raw query, or
  raw body inputs.
- Do not print full upstream bodies in smoke reports.
- Record envelope summaries, capped-body metadata, IDs needed for follow-up, and
  safety flags.
- Treat `no_data`, `manual_login_required`, `auth_required`,
  `response_too_large`, and `unexpected_html_response` as live statuses, not
  business conclusions.

## Seed Strategy

Use current samples instead of historical HAR values.

### User-Seeded Actions

Start from a user ID that the caller is allowed to inspect.

Recommended first calls:

- `track_analysis_summary` with `sub_interface=profile`
- `track_sequence_get_device_ids`
- `login_logs_search` with recent 7-day window and `max_records=300`
- `archives_user_profile`
- `archives_user_analysis` with recent 7-day window
- `weapon_inventory`

Use the returned business body or capped body only to extract follow-up
identifiers such as `device_id`, `photo_id`, and `live_stream_id`.

### Archives Follow-Up Seeds

Do not use old HAR photo IDs as the default live-smoke source. Derive current
anchors first:

1. `archives_photo_search` or `archives_gallery_photo_list` with the recent
   window to obtain candidate `photo_id` values.
2. Feed a candidate `photo_id` into:
   - `archives_photo_profile`
   - `archives_photo_meta`
   - `archives_photo_report_aggregate`
   - `archives_photo_user_autonomy`
   - `archives_punish_status` with `target_type=PHOTO`
3. Use `archives_live_gallery` to obtain `live_stream_id` before calling:
   - `archives_livestream_home_info`
   - `archives_livestream_home_meta`
   - `archives_livestream_home_log`
   - `archives_livestream_comment_statistics`
   - `archives_livestream_comment_detail`
   - `archives_punish_status` with `target_type=LIVE_STREAM`

Actions such as `archives_fans_list`, `archives_follow_list`,
`archives_collect_photo_list`, `archives_collection_list`,
`archives_comment_search`, `archives_user_report_search`, and
`archives_moment_list` can start from `user_id`, but still use recent windows or
small page sizes for the first smoke pass.

### RCP Follow-Up Seeds

Do not reuse stale HAR `eventId` / `queryTime` values as proof of current
readiness. Seed from recent events:

1. Call `rcp_snapshot` with a recent 5-15 minute window. If the case has no
   known event type, use the action default first, then optionally discover
   event types with `rcp_event_type_list`.
2. Extract one current event sample from the returned body or capped body:
   - `eventType`
   - `eventId`
   - `_occurTime` / `queryTime`
   - `sourceId`
   - `deviceId`
   - `hitFusePolicyCode` or equivalent policy code fields when present
3. Feed that sample into:
   - `rcp_event_detail`
   - `rcp_event_feature_list`
   - `rcp_event_tree_or_decision`
4. If feature keys are needed, get them from `rcp_event_feature_list` first,
   then call `rcp_feature_info_by_keys`.
5. If policy fields are present, derive `policyCode`, `policyVersion`,
   `policyTreeCode`, `policyTreeVersion`, and `policyTreeNodeCode` from
   event/detail/tree actions before calling policy follow-ups.

Policy helper actions such as `rcp_policy_search`, `rcp_policy_blur_search`,
`rcp_policy_all_version`, and `rcp_pipeline_policy_versions_by_code` may be used
to discover missing policy versions, but they are not default user-chain
actions.

### Track Follow-Up Seeds

Use `user_id` first, then derive `device_id`:

1. Call `track_sequence_get_device_ids` or
   `track_analysis_summary/sub_interface=getDeviceIds`.
2. Feed one returned `device_id` into:
   - `track_analysis_check_data_ready`
   - `track_sequence_get_use_duration`
   - `track_sequence_profile`
3. Use `track_analysis_product_list`, `track_sequence_dimension_list`, and
   `track_data_type_list` for parameter discovery, not as direct risk evidence.

## Smoke Result Fields

For every call, record:

- `action_name`
- `request_params_used` with sensitive-free typed params only
- `http_status`
- `ok`
- `response_mode`
- `upstream.status`
- `upstream.content_type`
- `body_present`
- `body_omitted`
- `body_truncated`
- `raw_body_handling`
- `observed_bytes`
- `returned_bytes`
- `observed_records`
- `returned_records`
- `missing_records`
- `error_type`
- `platform_error`
- `timeout`
- `auth_redirect_detected`
- `safety.credential_material_output`
- `safety.request_headers_output`
- `safety.transport_auth_material_output`

Do not paste complete `upstream.body`.

## Live Status Vocabulary

- `live_pass`: fixed action returned expected transport/API shape.
- `live_no_data`: expected transport/API shape with empty business result.
- `live_partial`: expected shape with capped or partial body.
- `live_param_seed_needed`: follow-up sample could not be derived from entry
  actions in the current smoke window.
- `live_auth_blocked`: auth, manual login, two-factor, captcha, or permission
  blocked the origin.
- `live_contract_mismatch`: fixed path returned page shell, unexpected HTML, or
  a body shape inconsistent with the action contract.
- `live_timeout`: timeout with `timeout_stage` when available.
- `live_fail`: service code or request builder error.

## Closure Criteria

A capability group is closed when:

1. Its entry action passes or returns expected no-data.
2. At least one dependent action is validated with a freshly derived identifier,
   unless the entry action returned no derivable sample.
3. All failures have one of the live statuses above.
4. No output includes request headers, cookies, tokens, sessions,
   authorization values, passwords, Chrome profile content, localStorage, or
   Playwright storage state.

Write results to a dedicated run log such as
`LIVE_SMOKE_V1_7_RESULTS_<date>.md`. Do not use historical HAR values as final
evidence of live readiness.
