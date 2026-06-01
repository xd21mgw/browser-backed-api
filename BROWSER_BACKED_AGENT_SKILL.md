# Browser-Backed Agent Skill Draft

## Positioning

This skill uses the **Browser-backed Risk Platform Access Service** as a local
controlled passthrough service for risk-platform reads.

- The service runs locally on `127.0.0.1`.
- Each teammate uses their own Chrome profile and their own platform
  permissions.
- Agent calls only allowlisted fixed actions exposed by the local service.
- Agent sends typed params only.
- Agent does not read cookies, tokens, sessions, request headers, Chrome cookie
  DBs, browser storage, or profile files.
- Agent does not compose arbitrary platform URLs or call platform endpoints
  directly.
- This is not Dennis-specific and not account-security-specific. It is a common
  browser-backed risk platform access layer.

The service is not an evidence-writing or risk-judgment engine. In passthrough
mode, it returns the upstream response envelope. Agent or another upper layer is
responsible for parsing `upstream.body`, building normalized observations, and
deciding how to present evidence.

## Agent Calling Principles

1. Identify the platform/action needed, then choose an allowlisted action from
   `ACTION_REGISTRY.md`.
2. Prefer the 12 dual-mode actions for existing compatibility flows.
3. Use the 7 passthrough-only actions only when the user or plan explicitly asks
   for that upstream action.
4. For passthrough calls, expect only the passthrough envelope:
   `ok`, `action`, `request_id`, `response_mode`, `upstream`, `meta`, and
   `safety`.
5. Never call `excluded_noise` capabilities.
6. Never send `url`, `path`, `header`, `headers`, `cookie`, `token`, `session`,
   `authorization`, `raw_body`, `raw_query`, or `secret`.
7. Never ask the service to create a summary, evidence card, `source_card`,
   `source_quality`, no-data interpretation, risk judgment, or next-step
   recommendation for passthrough-only actions.
8. New actions require fixed origin/path, typed params, forbidden-input policy,
   passthrough safety checks, mock tests, live smoke, and registry updates before
   they can enter the allowlist.

## Controlled Multi-Source Calls

When a review needs several sources, Agent may call `POST /actions/batch` with
execution groups instead of firing unrelated HTTP requests manually.

Batch rules:

- Each source must name one allowlisted fixed action.
- Each source must pass only that action's typed params.
- Batch forces `response_mode=passthrough`.
- Supported group modes are `independent_parallel`, `dependency_serial`,
  `large_response_serial`, and `auth_sensitive_serial`.
- Unknown group modes are rejected; `depends_on` must reference an earlier group
  in the same request.
- Batch suppresses every `upstream.body` and returns source status,
  `source_quality_matrix`, `normalized_observation`, `evidence_card_inputs`, and
  `missing_evidence`.
- One source failure must not be treated as a whole-batch failure unless all
  evidence is missing.
- Agent still owns parsing, evidence cards, and final reasoning outside the
  service.

## Dual-Mode Actions

These actions support `compat_summary` and `passthrough`. The default remains
`compat_summary` for old callers.

| action_name | origin_key | Notes |
| --- | --- | --- |
| `track_analysis_summary` | `track_analysis` | Track Analysis fixed sub-interfaces. |
| `login_logs_search` | `login_logs` | Login log fixed search endpoint. |
| `weapon_inventory` | `weapon` | Weapon graphData with service-owned riskData chaining. |
| `rcp_snapshot` | `rcp` | RCP eventList entry action. |
| `archives_user_profile` | `archives` | Archives user profile endpoint. |
| `archives_user_analysis` | `archives` | Archives core log timeline endpoint. |
| `archives_photo_search` | `archives` | Archives photo report search endpoint. |
| `archives_related_users` | `archives` | Archives related-user same-device endpoint. |
| `rcp_event_detail` | `rcp` | RCP event detail endpoint. |
| `rcp_event_feature_list` | `rcp` | RCP event feature list endpoint. |
| `rcp_policy_tree_lookup` | `rcp` | RCP policy tree lookup endpoint. |
| `track_analysis_check_data_ready` | `track_analysis` | Track Analysis data-readiness endpoint. |

## Passthrough-Only Actions

These actions support only `response_mode=passthrough`. They reject
`compat_summary` and do not return `source_card` or `source_quality`.

| action_name | origin_key | Notes |
| --- | --- | --- |
| `archives_private_message_search` | `archives` | Private-message search by typed user/direction/page params. |
| `archives_past_four_items` | `archives` | Past four profile-item change log by typed user/filter params. |
| `rcp_policy_version_lookup` | `rcp` | RCP policy version lookup by typed event/policy identity. |
| `rcp_policy_detail_lookup` | `rcp` | RCP policy detail lookup by typed policy code/version. |
| `rcp_policy_release_record_lookup` | `rcp` | RCP policy release-record fixed pipeline lookup. |
| `rcp_node_policy_attribution` | `rcp` | RCP node policy attribution by typed event/policy identity. |
| `rcp_node_bind_policy_attribution` | `rcp` | RCP node-binding attribution by typed event/tree-node identity. |

## Scenario Mapping

| User question | Agent action plan |
| --- | --- |
| "看这个用户近期登录和设备风险" | Call `login_logs_search`, `weapon_inventory`, and optionally `track_analysis_summary`. Interpret returned bodies outside the service. |
| "看这个设备关联和风险标签" | Call `weapon_inventory` with typed `device_id`. |
| "看策略事件入口" | Call `rcp_snapshot` with typed event/time filters. |
| "看用户活跃画像和设备列表" | Call `track_analysis_summary` with the relevant fixed `sub_interface`. |
| "看私信/档案中心明细" | Use an explicit Archives action from `ACTION_REGISTRY.md`; passthrough-only actions require explicit intent. |
| "看某个 eventId 的详情/特征/策略树/归因" | Use explicit RCP downstream actions only when the event/policy/tree typed params are available. |

## Output Rules

- `compat_summary` is a legacy compatibility mode for existing callers.
- `passthrough` returns upstream business response data in the envelope.
- `safety.credential_material_output=false` means no authentication material was
  output; it does not mean risk entity fields were removed from upstream
  business data.
- Upstream business fields such as `user_id`, `deviceId`, IP, `eventId`,
  `sourceId`, and policy codes are not authentication material by themselves.
- `no_data`, empty body, or empty arrays are interpreted by Agent or a human
  reviewer, not by the service.
- Agent must suppress raw upstream bodies in user-facing summaries unless the
  workflow explicitly requires controlled internal inspection.
- External sharing must apply its own masking/redaction policy.

## Forbidden Actions

Agent must not:

- Automatically dispose, block, freeze, appeal, label, or change upstream state.
- Bypass or escalate platform permissions.
- Read or export cookies, tokens, sessions, request headers, browser storage, or
  Chrome cookie DB data.
- Call arbitrary URLs, platform paths, raw query strings, raw bodies, or
  caller-provided endpoints.
- Automatically call DataAgent or Hive.
- Ask passthrough-only actions to return `source_card`, `source_quality`,
  evidence cards, no-data interpretations, or risk conclusions.
- Call excluded-noise capabilities such as telemetry, static assets,
  fingerprinting, radar/misc/log collection, log-sdk traffic, mobile-device-info
  traffic, or menu/config probes without direct evidence value.

## Adding A New Callable Action

Before a new service action can become callable, it must have:

- Fixed `origin_key`.
- Fixed method and same-origin relative path.
- Typed params and validation.
- Forbidden-input rejection for URL/path/header/cookie/token/session/raw body/raw
  query.
- Passthrough response safety policy for credential-material keys and response
  size.
- Mock tests for success, parameter errors, forbidden inputs, upstream errors,
  too-large responses, and credential-material protection.
- Live smoke evidence showing no credential material output.
- `ACTION_REGISTRY.md` status update.

Until then, keep it `inventory_pending`, `contract_ready`, or blocked in a local
contract-recovery report.
