# Browser-Backed Agent Skill Draft

## Positioning

This skill uses the **Browser-backed Risk Platform Access Service** as a local
risk evidence hand-and-foot layer.

- The service runs locally on `127.0.0.1`.
- Each teammate uses their own Chrome profile and their own platform
  permissions.
- Agent calls only fixed allowlist actions exposed by the local service.
- Agent does not read cookies, tokens, sessions, request headers, Chrome cookie
  DBs, or browser storage.
- Agent does not compose arbitrary URLs or call platform endpoints directly.
- This is not Dennis-specific and not account-security-specific. It is a common
  risk source access layer for internal review evidence.

## Agent Calling Principles

1. Identify the evidence domain first: user, device, behavior, strategy,
   content, social, or monitoring.
2. Choose the highest-status matching capability from
   `RISK_SOURCE_CAPABILITY_REGISTRY.md`.
3. Prefer `stable` capabilities for general review.
4. Use `beta` or `contract_ready` capabilities only when the user explicitly
   asks for that evidence domain or an upstream plan requires it.
5. Never call `excluded_noise` capabilities.
6. Never call arbitrary URLs, raw paths, raw queries, headers, cookies, tokens,
   sessions, or secrets.
7. New actions must pass source contract, typed params, fixed origin/path,
   `source_card`, `source_quality`, redaction policy, mock tests, and live smoke
   before being added to the allowlist.

## Current Stable Source Actions

| action_name | Applicable questions | Typed params example | Output summary | Evidence boundary |
| --- | --- | --- | --- | --- |
| `track_analysis_summary` | User activity/profile/device list; active profile; use duration; frontend activity evidence. | `{"user_id":"123","appName":"KUAISHOU","sub_interface":"profile"}`; `{"user_id":"123","appName":"KUAISHOU","sub_interface":"getUseDuration"}`; `{"user_id":"123","appName":"KUAISHOU","sub_interface":"getDeviceIds"}` | `profile_summary`, `activity_summary`, `device_summary`, latest activity shape, field presence, counts, masked device sample. | Supporting activity/profile/device evidence only; no raw profile/body/device dump; no final risk conclusion. |
| `rcp_snapshot` | Strategy event entry; event list; sourceId/eventId/deviceId/hitFusePolicyCode clues. | `{"eventType":"USER_REGISTER_NEW","source_id":"...","startTime":"2026-05-29 10:00:00","endTime":"2026-05-29 10:30:00"}` | Event count, pagination, observed columns, first-event shape keys, candidate chaining fields. | Strategy event entry only; not full attribution chain and not final risk classification. |
| `weapon_inventory` | Device graph; device risk labels; user-device relation; related user/device counts. | `{"user_id":"123"}` or `{"device_id":"ANDROID_xxx"}` | Graph node/edge counts, related users/devices, masked device sample, risk labels/groups, userLevel, originalLog key summary. | Device relation and risk-label evidence only; no raw `labelInfo`, raw `originalLog`, raw device list, or disposal. |
| `login_logs_search` | Recent login sequence; login device/IP/source/method; login chain evidence. | `{"user_id":"123"}` or `{"user_id":"123","from_timestamp":1780000000000,"to_timestamp":1780086400000}` | Records count, first/last login time, observed fields, IP/device/source/method samples under output-scope policy, parser diagnostics. | Login evidence only; empty logs are not no-risk evidence; no raw record dump. |

## Scenario Mapping

| User question | Agent action plan |
| --- | --- |
| "看这个用户近期登录和设备风险" | Call `login_logs_search`, `weapon_inventory`, and `track_analysis_summary`. Combine as evidence, not final judgment. |
| "看这个设备关联和风险标签" | Call `weapon_inventory` with `device_id`. |
| "看策略事件入口" | Call `rcp_snapshot` with typed event/time filters. |
| "看用户活跃画像和设备列表" | Call `track_analysis_summary` with `profile`, `getUseDuration`, and `getDeviceIds` as needed. |
| "看视频/私信/档案中心" | Check registry. These are beta/explicit or inventory-pending; do not call by default. |
| "看某个 eventId 的详情/特征/策略树" | Only call beta RCP downstream actions when the user explicitly provides or requests that event/policy evidence. |

## Output Rules

- Default `output_scope` is `internal_risk_review`.
- In internal review, risk entity identifiers such as `user_id`, `deviceId`,
  IP, `eventId`, `sourceId`, and strategy codes may appear in compact summaries
  when needed for evidence chaining.
- Use `output_scope=external_share` when preparing content for external sharing;
  risk identifiers and strict PII must be masked.
- `sensitive_output=false` means no credential secret and no raw dump. It does
  not mean every risk entity identifier has been removed.
- `no_data` does not mean no risk.
- Strategy hits, device risk labels, activity profile, and login logs are
  evidence sources. They do not automatically equal a final risk conclusion.
- Preserve `source_card` and `source_quality` with evidence output, including
  failures, no-data, partial, and auth/blocked states.

## Forbidden Actions

Agent must not:

- Automatically dispose, block, freeze, appeal, label, or change upstream state.
- Bypass or escalate platform permissions.
- Read or export cookies, tokens, sessions, request headers, browser storage, or
  Chrome cookie DB data.
- Call arbitrary URLs, platform paths, raw query strings, raw bodies, or
  caller-provided endpoints.
- Automatically call DataAgent or Hive.
- Output raw upstream full bodies, raw records, raw `labelInfo`, or raw
  `originalLog`.
- Call excluded-noise capabilities such as telemetry, static assets,
  fingerprinting, radar/misc/log collection, log-sdk traffic, or menu/config
  probes without direct evidence value.

## Adding A New Capability

Before a new action can become callable by this skill, it must have:

- A source contract that states evidence value and non-goals.
- Fixed registry origin and same-origin relative path.
- Typed params and forbidden-input validation.
- Redaction policy for raw bodies, records, labels, logs, PII, and risk entity
  identifiers.
- `source_card` and `source_quality` in all response states.
- Mock tests for success, no-data, auth/blocked/error, forbidden input, and
  redaction.
- Live smoke evidence showing no credential material output.

Until then, keep it `inventory_pending`, `contract_ready`, or `beta` with
`explicit_trigger_required=yes`.
