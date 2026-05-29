# RCP Source Contract

## Source Identity

- source_name: `rcp_snapshot`
- access_method: `browser_backed_api_service`
- fixed action endpoint: `POST http://127.0.0.1:8787/actions/rcp_snapshot`
- origin: `https://rcp.corp.kuaishou.com`
- fixed path: `POST /v2/rest/event/eventList`
- runtime boundary: the browser-backed API service owns the persistent Chrome context; Dennis or other callers only call the fixed local action endpoint.

## Source Nature

`rcp_snapshot` wraps the RCP `eventList` endpoint. This endpoint is a ClickHouse-like dynamic event query builder, not a fixed-field business API.

The stable contract is the request protocol and response wrapper:

- fixed same-origin relative path
- HAR-derived request body structure
- `tableHeaderList` object array
- `eventV2` complete query object
- `eventV2.conditionList` condition-group structure
- time fields formatted as `YYYY-MM-DD HH:mm:ss`
- response wrapper paths under `data`

Returned event columns are dynamic and sparse. Consumers must inspect observed shape fields instead of requiring all possible event fields to be present.

## Typed Input Contract

Accepted typed input:

- `eventType`: optional string; default `USER_REGISTER_NEW`
- `source_id`: optional string; maps to `eventV2.sourceIds`
- `sourceIds`: optional string or string array; normalized into a single `eventV2.sourceIds` string
- `device_id`: optional string; maps to `eventV2.conditionList`
- `startTime`: optional `YYYY-MM-DD HH:mm:ss`
- `endTime`: optional `YYYY-MM-DD HH:mm:ss`
- `time_window`: optional `{ startTime, endTime }`
- `pageIndex`: optional positive integer; default `1`
- `page`: optional positive integer alias for `pageIndex`
- `pageSize`: optional positive integer; default `40`
- `selected_columns`: optional string array; only overrides `tableHeaderList`

Rejected caller input:

- URL, origin, path, endpoint, route
- header, cookie, authorization
- token, session, secret
- raw body

Invalid or missing typed params return `parameter_error` before any platform call.

## HAR-Derived Body Contract

The service generates the request body from a HAR-derived template with typed overrides only.

Top-level body fields:

- `tableHeaderList`: object array
- `startTime`: `YYYY-MM-DD HH:mm:ss`
- `endTime`: `YYYY-MM-DD HH:mm:ss`
- `currentTime`: `YYYY-MM-DD HH:mm:ss`
- `eventV2`: complete query object
- `pageIndex`: number
- `pageSize`: number

The body must not include a top-level `pagination` object. The body must not include a top-level `conditionList`.

### `tableHeaderList`

`tableHeaderList` is always an object array:

- `column_name`
- `column_comment`

Default selected columns:

- `sourceId`
- `eventId`
- `_occurTime`
- `_realTimeOp`
- `_errorCode`
- `deviceId`
- `hitFusePolicyCode`
- `time`

`selected_columns` can only replace this object array. It cannot change the path, method, event query object, or raw request body.

### `eventV2`

Default `eventV2` fields and types:

- `eventType`: string, default `USER_REGISTER_NEW`
- `hitPolicies`: string, default `""`
- `version`: string, default `""`
- `status`: number, default `2`
- `snapshotVersion`: string, default `""`
- `sourceIds`: string, default `""`
- `realTimeOp`: string, default `""`
- `isPolicyTreeExperiment`: boolean, default `false`
- `conditionList`: array of condition groups
- `grayFeature`: string, default `""`
- `grayQueryStatus`: number, default `0`
- `region`: string, default `"china"`

`sourceIds` is a string field. If the caller passes an array, the service normalizes it into a comma-separated string before building the fixed body.

### `conditionList`

`conditionList` appears only at `eventV2.conditionList`.

When `device_id` is supplied, the service generates a HAR-style condition item:

- `key`: `"deviceId"`
- `logic`: `"term"`
- `value`: caller-supplied typed `device_id`
- `id`: service-generated UUID string
- `seq`: number, starting at `0`
- `keyType`: `"主表"`
- `description`: `""`
- `rightDataType`: `"C"`

The service does not accept caller-provided condition objects or raw query bodies.

## Response Wrapper

Successful RCP eventList responses are summarized only when these wrapper paths are present:

- `data.eventList`
- `data.pagination`
- `data.tableHeaderList`

Wrapper presence is reported as:

- `response_wrapper_paths_present.data_eventList`
- `response_wrapper_paths_present.data_pagination`
- `response_wrapper_paths_present.data_tableHeaderList`

## Dynamic Output Rules

The action returns shape-only output. It does not return the raw upstream full body.

RCP event rows are dynamic. Consumers should use:

- `event_count`
- `pagination_summary`
- `table_header_columns`
- `returned_columns_observed`
- `first_event_shape_keys`
- `dynamic_columns_observed`

The service does not require every default or possible event column to appear in every event row.

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

- `completed`: platform fetch succeeded, `data.eventList`, `data.pagination`, and `data.tableHeaderList` were present, and the response was summarized by shape only.
- `completed_no_hit_for_small_window`: platform fetch succeeded, wrapper paths were present, and `eventList` was empty for the small query window. This is not no-risk counterevidence.
- `no_data`: platform returned no useful rows or an empty source result. This is not no-risk counterevidence.
- `wrong_request_body_shape`: RCP returned a status/message wrapper or other signal that the generated body did not match the expected eventList body contract.
- `wrong_time_field_format`: RCP or local validation indicated the time format was not `YYYY-MM-DD HH:mm:ss`.
- `invalid_parameter`: typed params were invalid or RCP indicated a parameter-level error.
- `auth_failed`: the browser page or fetch result indicates SSO/login/auth redirect. This is a source access outcome, not a runtime failure.
- `parse_error`: the response could not be parsed as expected JSON and did not match the RCP wrapper or known error wrapper.
- `platform_error`: RCP returned an API-level error outside the typed body/time/parameter classes. Preserve `source_card` and `source_quality`; do not treat it as Dennis runtime failure.
- `network_error`: local browser fetch failed before a valid platform response was summarized. Preserve `source_card` and `source_quality`.

`no_data`, `completed_no_hit_for_small_window`, `auth_failed`, `blocked`, `timeout`, `network_error`, and `platform_error` must not be used as no-risk counterevidence.

## Live Validation Summary

Local live smoke validated the RCP eventList action through the browser-backed service and Chrome profile:

- `source_status=completed`
- `event_count=200`
- `response_wrapper_paths_present.data_eventList=true`
- `response_wrapper_paths_present.data_pagination=true`
- `response_wrapper_paths_present.data_tableHeaderList=true`
- `sensitive_output=false`
- `raw_full_body_returned=false`

Validation scope was source transport, wrapper alignment, and shape-only summarization. No business risk judgment was made.

## Security Boundary

- The service does not read Chrome cookie storage.
- The service does not call cookie, token, session, or header inspection APIs.
- The service does not output cookies, tokens, sessions, request headers, or raw upstream full bodies.
- The service accepts only fixed action names and fixed same-origin relative paths.
- The service rejects caller-supplied URL, path, origin, header, cookie, token, session, secret, and raw body material.
- Sensitive-looking JSON key names are redacted in shape summaries.
- Event rows are summarized by observed shape and column names only.

## Dennis Evidence Card Guidance

- Use RCP eventList only as a strategy-hit or event-entry source.
- Do not use RCP eventList as a final risk conclusion by itself.
- Treat `hitFusePolicyCode`, `eventId`, and `_occurTime` as candidate chaining keys for downstream evidence collection.
- Include `source_card` and `source_quality` for every source result, including failures.
- Treat `no_data`, `completed_no_hit_for_small_window`, `auth_failed`, `blocked`, `timeout`, `network_error`, and `platform_error` as source quality/completion states, not as no-risk counterevidence.
