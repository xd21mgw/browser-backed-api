# Track Analysis Source Contract

## Source Identity

- source_name: `track_analysis_summary`
- access_method: `browser_backed_api_service`
- fixed action endpoint: `POST http://127.0.0.1:8787/actions/track_analysis_summary`
- origin: `https://track-analysis.corp.kuaishou.com`
- runtime boundary: the browser-backed API service owns the persistent Chrome context; Dennis or other callers only call the fixed local action endpoint.

## Supported Sub-Interfaces

The action supports exactly these `sub_interface` values:

- `getLastestDateTime`
- `getUseDuration`
- `profile`
- `getDeviceIds`

All calls require typed input:

- exactly one of `user_id` or `device_id`
- `appName=KUAISHOU|NEBULA`
- optional `time_window` only where the sub-interface uses it

The caller must not provide URL, path, origin, header, cookie, token, session, or secret material. The service rejects those inputs before any platform call.

## Sub-Interface Contracts

### `getLastestDateTime`

- fixed path: `/dp/platform/app/analytics/v2/sequence/getLastestDateTime`
- method: `GET`
- typed params: exactly one of `user_id` or `device_id`, plus `appName`
- generated request params:
  - `product=<appName>`
  - `type=userId|deviceId`
  - `funcType=USER_PROFILE_QUERY`
  - `_t=<service-generated timestamp>`
- output shape summary:
  - `sub_interface`
  - `entity_type`
  - `appName`
  - `latest_datetime_present`
  - `uid_did_relation_latest_datetime_present`
  - `output_fields_observed`
  - `no_data`
  - `no_data_not_risk_exclusion`

### `getUseDuration`

- fixed path: `/dp/platform/app/analytics/v2/sequence/getUseDuration`
- method: `POST`
- typed params: exactly one of `user_id` or `device_id`, plus `appName`
- generated request body:
  - `appName`
  - `funcType=USER_PROFILE_QUERY`
  - `_t=<service-generated timestamp>`
  - `userId|deviceId`
- output shape summary:
  - `sub_interface`
  - `entity_type`
  - `appName`
  - `output_fields_observed`
  - `no_data`
  - `no_data_not_risk_exclusion`
  - `activity_summary`
- `activity_summary` fields:
  - `rows_count`
  - `total_duration`
  - `peak_duration`
  - `peak_date`
  - `nonzero_days_count`
  - `date_range_observed`

### `profile`

- fixed path: `/dp/platform/app/analytics/v2/sequence/profile`
- method: `POST`
- typed params: exactly one of `user_id` or `device_id`, plus `appName`
- optional typed params: `time_window`
- generated request body:
  - `appName`
  - `startTime`
  - `endTime`
  - `include=1`
  - `pageSize=100`
  - `funcType=USER_PROFILE_QUERY`
  - `_t=<service-generated timestamp>`
  - `userId|deviceId`
- output shape summary:
  - `sub_interface`
  - `entity_type`
  - `appName`
  - `output_fields_observed`
  - `no_data`
  - `no_data_not_risk_exclusion`
  - `profile_summary`
- `profile_summary` fields:
  - `profile_sections_observed`
  - `first_level_profile_keys_count`
  - `second_level_profile_keys_count`
  - `register_time_present`
  - `fan_distribution_present`
  - `active_days_bucket_present`
  - `device_ids_count`
  - `output_fields_observed`

### `getDeviceIds`

- fixed path: `/dp/platform/app/analytics/v2/sequence/getDeviceIds`
- method: `POST`
- typed params: `user_id` preferred; `device_id` is also supported by the fixed request builder when the platform contract accepts device-scoped lookup
- generated request body:
  - `appName`
  - `funcType=USER_PROFILE_QUERY`
  - `_t=<service-generated timestamp>`
  - `userId|deviceId`
- output shape summary:
  - `sub_interface`
  - `entity_type`
  - `appName`
  - `output_fields_observed`
  - `no_data`
  - `no_data_not_risk_exclusion`
  - `device_summary`
- `device_summary` fields:
  - `device_ids_count`
  - `device_id_sample_masked`
  - `device_fields_observed`
  - `device_model_fields_present`
  - `last_active_fields_present`
- device identifiers are never returned raw; samples must use the form `[masked_device_id:length=N]`.

## Standard Source Response

Every live response returns the standard source envelope:

- `status`
- `source_status`
- `error_type`
- `latency_ms`
- `sensitive_output=false`
- `data.response_summary`
- `source_card`
- `source_quality`

`source_card` fields used by Dennis evidence cards:

- `source_type`
- `action`
- `domain`
- `origin`
- `method`
- `path`
- `mode`
- `captured_at`
- `transport`
- `source_status`
- `error_type`
- `origin_warmed`
- `latency_ms`
- `action_diagnostics`
- `lazy_rewarm`
- `body_policy.raw_response_full_body_returned=false`
- `body_policy.cookie_token_session_header_plaintext_read=false`
- `fetch_status`

`source_quality` fields used by Dennis evidence cards:

- `level`
- `score`
- `checks`
- `warnings`
- `no_data_not_risk_exclusion=true`
- `no_hit_not_risk_exclusion=true`

## Status And Error Semantics

- `completed`: platform fetch succeeded and the response was summarized by JSON shape and sub-interface summary only.
- `no_data`: platform returned an empty or non-informative payload for the requested typed entity. This is not risk exclusion evidence.
- `auth_failed`: the browser page or fetch result indicates SSO/login/auth redirect. This is a source access outcome, not a runtime failure.
- `parse_error`: the response could not be parsed as expected JSON and did not match the SSO/login classification.
- `platform_error`: the platform returned an HTTP or API-level error. Preserve `source_card` and `source_quality`; do not treat it as Dennis runtime failure.
- `network_error`: local browser fetch failed before a valid platform response was summarized. Preserve `source_card` and `source_quality`.
- `parameter_error`: typed params are missing or invalid. No platform call is made.

`no_data`, `auth_failed`, `blocked`, `timeout`, `network_error`, and `platform_error` must not be used as no-risk counterevidence.

## Live Validation Summary

Local live smoke has validated the four Track Analysis sub-interfaces through the browser-backed service and Chrome profile:

- `getLastestDateTime`: live passed
- `getUseDuration`: live passed
- `profile`: live passed
- `getDeviceIds`: live passed

Validation scope was source transport and shape-only summarization. No business risk judgment was made.

## Security Boundary

- The service does not read Chrome cookie storage.
- The service does not call cookie, token, session, or header inspection APIs.
- The service does not output cookies, tokens, sessions, request headers, or raw upstream full bodies.
- The service accepts only fixed action names and fixed same-origin relative paths.
- The service rejects caller-supplied URL, path, origin, header, cookie, token, session, and secret material.
- Sensitive-looking JSON key names are redacted in shape summaries.
- Device identifiers are exposed only as counts and masked samples.

## Dennis Evidence Card Guidance

- Use `getUseDuration.activity_summary` as activity evidence.
- Use `profile.profile_summary` as profile evidence.
- Use `getDeviceIds.device_summary` as device relation evidence.
- Use `getLastestDateTime` as recency/availability shape evidence.
- Include `source_card` and `source_quality` for every source result, including failures.
- Treat `no_data`, `auth_failed`, `blocked`, `timeout`, `network_error`, and `platform_error` as source quality/completion states, not as no-risk counterevidence.
