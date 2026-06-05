---
name: browser-backed-risk-service
description: Install, start, connect to, and call the Browser-backed Risk Service; use for Mac Local Worker setup, service_base_url checks, and capability commands for user profile, login history, device graph, content, private message, profile change, and RCP strategy-event passthrough reads.
---

# Browser-Backed Risk Service Skill

## Positioning

This is a command-oriented Skill for the **Browser-backed Risk Platform Access
Service**. The service is a controlled local/Mac worker for risk-platform reads.

The service only does fixed action allowlist, typed params validation, fixed
origin/path construction, browser-session readiness, browser-context API
request by default, bounded upstream business body passthrough, response-size
guard, transport status, and controlled batch scheduling.

The service does not do business summaries, observations, source cards, source
quality, evidence cards, no-data interpretation, risk judgment, DataAgent/Hive
calls, permission bypass, or platform writes.

Current callable `action_count=70`. All actions are passthrough-only at the
service layer.

This Skill is independent of any specific upper-layer agent.

## Service Base URL

Agent must resolve `service_base_url` before calling the service.

- Local Agent Mode default: `http://127.0.0.1:8787`
- Remote Main Agent + Mac Local Worker Mode:
  `BROWSER_BACKED_SERVICE_BASE_URL=<bridge_or_mac_worker_url>`

Agent must not assume `127.0.0.1` is the teammate's computer when the main
Agent is running remotely or in a cloud/Linux environment.

Call order:

```txt
GET  {service_base_url}/health
GET  {service_base_url}/actions
POST {service_base_url}/actions/<action_name>
```

Before action calls, verify `/health` and `/actions`; `action_count` should be
70.

## Deployment Modes

### Local Agent Mode

- Agent, script, curl, and browser-backed service run on the same computer.
- Use `service_base_url=http://127.0.0.1:8787`.
- No bridge or tunnel is required.
- User runs `npm install`, then `npm run worker:start`.
- `worker:start` reuses a ready service, refreshes and starts when needed, and
  opens the visible profile flow only for manual login/confirmation.
- Profile and refresh state stay on that machine.

### Remote Main Agent + Mac Local Worker Mode

This is the recommended mode for remote/cloud/Linux main Agents.

- Main Agent runs remotely, in cloud, or on Linux.
- Browser-backed service runs on the user's Mac.
- Chrome profile stays on the user's Mac.
- User completes SSO, two-factor checks, and Archives account confirmation in
  the Mac GUI.
- Main Agent calls the Mac service through Mac node, a controlled bridge, or a
  controlled tunnel.
- `service_base_url` points to the Mac local worker or bridge URL.

This matches the successful rc-cli style path: authentication and platform
access happen locally on Mac, while the remote Agent only invokes bounded worker
capabilities.

Online dependency for remote calls:

- The user's Mac must be powered on and connected to the network.
- The browser-backed service must be running on the Mac.
- MyFlicker / Mac node client, or the approved equivalent Mac worker channel,
  must stay online and connected.
- Chrome profile must not be locked by another Chrome/Playwright process.
- If MyFlicker / Mac node is disconnected, do not switch to profile copy,
  cookie injection, storageState injection, or `sso_session.py`; ask the user
  to open the MyFlicker Mac client and reconnect the Mac node.

MyFlicker / Mac node lets the remote main Agent execute controlled status/action
calls on the Mac or reach the Mac worker `service_base_url`. It does not read
cookies, tokens, sessions, request headers, profile files, or browser storage,
and it does not replace the browser-backed service.

Daily user experience should be low-friction:

- First setup may need Mac command approval and a visible Mac Chrome login.
- After setup, the Mac worker should stay running.
- Daily action calls should not open a browser every time.
- Daily action calls should not require repeated command approvals.
- Users should normally only need `npm run worker:start` for recovery/startup.
- The remote main Agent should call service APIs through `service_base_url`.
- For low-approval daily use, prefer the `service_base_url` printed by
  `npm run worker:expose`.
- If readiness expires, the service tries lightweight landing-flow activation in
  refresh/prewarm/ensure-ready. If password, 2FA, QR, or captcha appears, return
  `manual_login_required` and ask the user to open the Mac login page.
- Treat `ready` and `fresh` separately. `/health` reports
  `auth_state_expired`, `origin_ready_state_stale`, and per-origin freshness
  age/TTL. If an action returns
  `auth_state_expired_or_api_session_not_ready` or
  `safe_reason=origin_ready_state_stale`, do not reinterpret it as no data; ask
  the user to run `npm run worker:start` or complete manual login if requested.
- `login_logs_search` is the page-session-sensitive exception. The workbench can
  stop reacting after idle time even when it is on the correct origin. The
  service refreshes the login logs page session before the fixed API call and
  retries once after `unexpected_html_response` or `api_fetch_timeout`. If it
  returns `login_logs_page_context_stale`, report that the login logs source is
  blocked by stale page context; do not call it `no_data` and do not retry
  indefinitely.
- `npm run worker:start` is the only daily recovery entry point. It may open the
  Mac profile flow when refresh/rewarm reports `manual_login_required`,
  `auth_required`, `two_factor_required`, or `captcha_required`; after the user
  finishes interaction it refreshes again and starts/reuses the service.
- If the existing browser-backed service is holding the dedicated profile,
  `worker:start` may stop that service process before opening the profile flow.
  This is not a daily Chrome kill and does not delete profile data.

Do not copy the Mac profile to Linux as a standard path. Joint testing showed
that Track may become ready, but RCP, Weapon, Login Logs, and Archives can
trigger `two_factor_required` in Linux headless. That historical path is not
recommended and should not be given to teammates as a normal workflow.

The remote mode does not need cookie injection, storageState injection,
`sso_session.py`, or profile bootstrap into Linux.

Auth State Transfer is a separate POC candidate. Do not present it as the
recommended workflow until it is validated. If validated, it may become a
future focus area; until then, prefer Mac Local Worker for remote main Agents.

Bridge/tunnel safety boundary:

- Forward only `/health`, `/actions`, and `/actions/<allowlisted_action>`
  unless a separately reviewed deployment explicitly enables more service
  routes.
- Do not expose arbitrary URL fetch or arbitrary platform paths.
- Do not expose Chrome profile files, cookies, tokens, sessions, authorization
  values, request headers, localStorage, or Playwright storageState.
- Require access control such as internal ACL, temporary token, user
  confirmation, or equivalent deployment guard.
- Do not expose the Mac service directly to the public internet.

## Skill-Managed Workflow

The Skill should behave like a command-oriented helper, not just a static
manual. Use these command intents.

Before installation or action calls, read these local contract files:

- `SKILL.md`
- `ACTION_REGISTRY.md`
- `CAPABILITY_INDEX.yaml`
- `PASSTHROUGH_CONTRACT.md`
- `REMOTE_MAIN_AGENT_SUCCESS_PATHS.md`

## Installation Transfer Policy

Remote Main Agent + Mac Local Worker installs must use the verified transfer
path unless the deployment environment provides a reviewed file-transfer API:

1. Linux/main-agent workspace has the release tarball.
2. Linux/main-agent starts a temporary HTTP server in the release directory.
3. Mac node downloads the release with `curl`.
4. Mac extracts the release.
5. Mac enters `service/`.
6. Mac runs `npm install`.
7. Mac runs `npm run worker:doctor`.
8. Mac runs `npm run worker:start`.
9. Mac runs `npm run worker:expose`.
10. `worker:expose` prints `BROWSER_BACKED_SERVICE_BASE_URL`.
11. Later action calls use `service_base_url`; do not run a Mac node curl for
    every action.

Hard prohibitions during install/transfer:

- no base64 chunk transfer
- no逐文件写入 as an improvised package transfer
- no KCDN or ad hoc upload fallback
- no SSH tunnel self-exploration
- no SCP guessing
- no profile copy to Linux
- no `sso_session.py`
- no cookie injection
- no storageState injection
- no arbitrary URL fetch
- no transfer of profile/state/auth-state/cookie/token/session/header material

Failure behavior:

- If the Linux temporary HTTP server is unreachable, report
  `release_transfer_failed` and stop. Do not switch to another transfer method.
- If Mac node command approval times out, report
  `mac_command_approval_required` and stop. Ask the user to approve or manually
  run the fixed command sequence.
- If `service_base_url` is unreachable, run the status/connection workflow
  first. Do not switch to profile, cookie, state, or storage workarounds.

### `/browser-backed-risk-service 安装`

- Check Node.js and npm are available.
- Locate or unpack the release.
- Enter `service/`.
- Run `npm install`.
- Run `npm run check`.
- Tell the user the next step: local start or Mac Local Worker setup.
- If Mac node approval is needed, group high-frequency operations into the
  fixed worker commands instead of running many ad hoc shell commands.

### `/browser-backed-risk-service 启动`

- For Local Agent Mode, run `npm run worker:start`.
- For Remote Main Agent Mode, prefer Mac Local Worker:
  - run `npm run worker:start` on the user's Mac
  - let `worker:start` handle refresh/start/open-profile routing
  - let the user complete SSO, two-factor checks, and Archives account
    confirmation in Mac Chrome only when prompted
  - configure `BROWSER_BACKED_SERVICE_BASE_URL` to the Mac worker/bridge URL
- Do not propose cookie injection, storageState injection, `sso_session.py`, or
  Mac-profile copy to Linux.

### `/browser-backed-risk-service 状态`

- Call `{service_base_url}/health`.
- Call `{service_base_url}/actions`.
- If running on the Mac worker directly, `npm run worker:status` is also valid.
- If Remote Main Agent + Mac Local Worker Mode uses the low-approval proxy, use
  the `service_base_url` printed by `npm run worker:expose`.
- Report only sanitized status:
  - `ok`
  - `service_mode`
  - `auth_state`
  - `action_count`
  - origin readiness
  - `safety.credential_material_output`

### `/browser-backed-risk-service actions`

- List the 70 allowlisted fixed actions.
- Show typed params from `ACTION_REGISTRY.md`.
- Use `CAPABILITY_INDEX.yaml` and `ACTION_PLAYBOOK.md` when the user asks by
  capability rather than exact action name.
- Remind that service output is a passthrough envelope with bounded upstream
  business body visibility.

### Capability Commands

Use these intents when a user describes a capability instead of naming an
action:

- `/browser-backed-risk-service 用户画像 <user_id>`
- `/browser-backed-risk-service 登录历史 <user_id>`
- `/browser-backed-risk-service 设备图谱 <user_id>`
- `/browser-backed-risk-service 作品查询 <user_id>`
- `/browser-backed-risk-service 私信样本 <user_id>`
- `/browser-backed-risk-service 资料变更 <user_id>`
- `/browser-backed-risk-service 策略事件 <eventType> <eventId>`
- `/browser-backed-risk-service action <action_name> <json_params>`

Map capability commands through `CAPABILITY_INDEX.yaml`, then use
`ACTION_REGISTRY.md` for fixed paths and typed params. Do not require users to
memorize action names.

### Quick Capability Routing

Use this table before selecting actions. It is a usage map, not a risk
judgment rule. `ACTION_REGISTRY.md` remains the exact interface contract.

| Observation area | Representative actions | Default role | Anchor / params to prepare |
| --- | --- | --- | --- |
| 账号域 / 行为域 / 处置域 | `archives_user_profile`, `archives_user_analysis`, `archives_review_logs`, `archives_user_label`, `archives_past_four_items` | first hop / drilldown | `user_id`; time window for logs/analysis |
| 设备域 / 团伙候选 | `weapon_inventory` | first hop | `user_id` or `device_id` |
| 网络/登录行为域 | `login_logs_search` | first hop | `user_id`; recent 7-day window; `max_records=300` |
| 内容域 / 社交域 | `archives_photo_search`, `archives_gallery_photo_list`, `archives_photo_meta`, `archives_live_gallery`, `archives_collect_photo_list`, `archives_moment_list` | first hop / anchor drilldown | `user_id`; derive `photo_id` / `live_stream_id` before detail actions |
| 社交域 / 关系扩散 | `archives_fans_list`, `archives_follow_list`, `archives_comment_search`, `archives_related_users`, `archives_private_message_search` | anchor drilldown | `user_id`; `direction` for private message; page cap |
| 反馈域 / 处置域 | `archives_user_report_search`, `archives_punish_status` | drilldown / validation | `user_id` or `photo_id` / `live_stream_id` |
| 策略域 / 治理域 | `rcp_snapshot`, `rcp_fast_query_hbase`, `rcp_event_detail`, `rcp_policy_tree_lookup`, `rcp_node_policy_attribution` | first hop / governance | recent event seed from `rcp_snapshot`; then `eventType`, `eventId`, `queryTime`, policy/tree fields |
| 行为域 / 前端活跃 | `track_analysis_summary`, `track_sequence_get_device_ids`, `track_sequence_profile`, `track_analysis_check_data_ready` | first hop / validation / parameter discovery | `user_id` first; derive `device_id` before device readiness/use-duration |

Default roles:

- `first_hop_candidate`: safe to try early for a user/entity case.
- `first_or_drilldown`: can start a case, but may need time/page bounds.
- `anchor_triggered_drilldown`: call only after an anchor such as `photo_id`,
  `live_stream_id`, `eventId`, `policyCode`, or `device_id` is known.
- `governance_only` / `parameter_only`: helper or strategy-governance actions;
  do not put them into an ordinary user risk chain by default.
- `validation_only`: use to validate readiness or parameter availability, not
  as direct evidence.

Hard usage limits:

- Do not treat labels, strategy hits, device co-occurrence, no-data, or partial
  capped rows as final conclusions.
- Do not expand relation/fans/follow/comment/private-message lists without a
  page cap.
- Do not print private-message/comment/raw upstream bodies to users by default.
- For RCP follow-ups, do not use stale HAR `eventId` / `queryTime`; get a
  recent event anchor from `rcp_snapshot` first.

### Default Param Recipes

These payloads are safe starting points. Replace placeholders with the current
case entity. Always call `{service_base_url}/health` and `/actions` first.

User first-hop bundle:

```json
[
  {
    "action": "track_analysis_summary",
    "params": {
      "response_mode": "passthrough",
      "sub_interface": "profile",
      "user_id": "<user_id>",
      "appName": "KUAISHOU"
    }
  },
  {
    "action": "login_logs_search",
    "params": {
      "response_mode": "passthrough",
      "user_id": "<user_id>",
      "recallSource": "2,0,1,3",
      "max_records": 300
    }
  },
  {
    "action": "weapon_inventory",
    "params": {
      "response_mode": "passthrough",
      "user_id": "<user_id>",
      "include_risk_data": true,
      "max_device_ids": 5
    }
  },
  {
    "action": "archives_user_profile",
    "params": {
      "response_mode": "passthrough",
      "user_id": "<user_id>"
    }
  }
]
```

Archives content seed and photo drilldown:

```json
[
  {
    "action": "archives_photo_search",
    "params": {
      "response_mode": "passthrough",
      "user_id": "<user_id>",
      "begin": "<recent_30d_epoch_ms>",
      "end": "<now_epoch_ms>",
      "page": 1,
      "count": 20
    }
  },
  {
    "action": "archives_gallery_photo_list",
    "params": {
      "response_mode": "passthrough",
      "user_id": "<user_id>",
      "pageIndex": 1,
      "pageSize": 20
    }
  },
  {
    "action": "archives_photo_meta",
    "params": {
      "response_mode": "passthrough",
      "photo_id": "<photo_id_from_seed>"
    }
  }
]
```

Archives social drilldown:

```json
[
  {
    "action": "archives_private_message_search",
    "params": {
      "response_mode": "passthrough",
      "user_id": "<user_id>",
      "direction": "sent",
      "page": 1,
      "count": 20
    }
  },
  {
    "action": "archives_fans_list",
    "params": {
      "response_mode": "passthrough",
      "user_id": "<user_id>",
      "pageIndex": 1,
      "pageSize": 20
    }
  },
  {
    "action": "archives_follow_list",
    "params": {
      "response_mode": "passthrough",
      "user_id": "<user_id>",
      "pageIndex": 1,
      "pageSize": 20
    }
  }
]
```

RCP recent-event seed and follow-up:

```json
[
  {
    "action": "rcp_snapshot",
    "params": {
      "response_mode": "passthrough",
      "eventType": "USER_REGISTER_NEW",
      "startTime": "<recent_5_to_15m_YYYY-MM-DD HH:mm:ss>",
      "endTime": "<now_YYYY-MM-DD HH:mm:ss>",
      "pageIndex": 1,
      "pageSize": 20,
      "selected_columns": [
        "sourceId",
        "eventId",
        "_occurTime",
        "hitFusePolicyCode",
        "deviceId"
      ]
    }
  },
  {
    "action": "rcp_event_feature_list",
    "params": {
      "response_mode": "passthrough",
      "eventType": "<eventType_from_seed>",
      "eventId": "<eventId_from_seed>",
      "queryTime": "<_occurTime_or_queryTime_from_seed>"
    }
  },
  {
    "action": "rcp_event_tree_or_decision",
    "params": {
      "response_mode": "passthrough",
      "eventType": "<eventType_from_seed>",
      "eventId": "<eventId_from_seed>",
      "queryTime": "<_occurTime_or_queryTime_from_seed>"
    }
  }
]
```

Track device seed and validation:

```json
[
  {
    "action": "track_sequence_get_device_ids",
    "params": {
      "response_mode": "passthrough",
      "user_id": "<user_id>",
      "appName": "KUAISHOU"
    }
  },
  {
    "action": "track_analysis_check_data_ready",
    "params": {
      "response_mode": "passthrough",
      "device_id": "<device_id_from_seed>",
      "appName": "KUAISHOU",
      "startTime": "<recent_24h_epoch_ms>",
      "endTime": "<now_epoch_ms>"
    }
  }
]
```

### `/browser-backed-risk-service 自测用户 <user_id>`

Purpose: validate service readiness, Mac worker connectivity, fixed action
calls, and main-Agent post-processing on one real user case.

This command does not ask the browser-backed service to summarize, score, or
judge risk. The service still returns only passthrough transport envelopes. The
main Agent may process returned business response bodies or body metadata when
available and produce a clearly labeled main-agent observation summary.

Before running:

- Confirm `service_base_url`.
- In Remote Main Agent + Mac Local Worker Mode, confirm the Mac node is
  connected and `{service_base_url}/health` is reachable.
- Call `{service_base_url}/actions` and confirm `action_count=70`.

Default low-risk read-only action group:

1. `track_analysis_summary`

```json
{
  "response_mode": "passthrough",
  "sub_interface": "profile",
  "user_id": "<user_id>",
  "appName": "KUAISHOU"
}
```

2. `login_logs_search`

```json
{
  "response_mode": "passthrough",
  "user_id": "<user_id>"
}
```

3. `weapon_inventory`

```json
{
  "response_mode": "passthrough",
  "user_id": "<user_id>"
}
```

4. `archives_user_profile`

```json
{
  "response_mode": "passthrough",
  "user_id": "<user_id>"
}
```

Optional sample action:

```json
{
  "response_mode": "passthrough",
  "user_id": "<user_id>",
  "direction": "sent",
  "page": 1,
  "count": 20
}
```

Use the optional sample for `archives_private_message_search` only when the
user wants an Archives message smoke and accepts that results may be `no_data`
or permission-limited.

Do not include `rcp_snapshot` in the default user self-test group. It is not a
direct `user_id` lookup and needs event/source/policy params.

Recommended output:

1. Service status:
   - `service_base_url`
   - `auth_state`
   - `action_count`
2. Action call table:
   - `action_name`
   - `ok`
   - `upstream.status`
   - `body_present`
   - `body_omitted`
   - `body_truncated`
   - `observed_bytes`
   - `error_type`
   - `live_status`
3. Main-agent observation summary:
   - `track_profile_observed`
   - `login_records_observed`
   - `device_graph_observed`
   - `archives_profile_observed`
   - `private_message_sample_observed`
4. Missing or blocked sources:
   - `manual_login_required`
   - `auth_required`
   - `no_data`
   - `response_too_large`
   - `permission_denied`
5. Safety:
   - `credential_material_output=false`
   - `raw_upstream_body_printed=false`
   - `cookie/token/session/header_output=false`

The main Agent may generate tables, field coverage summaries, missing-evidence
lists, and next-step suggestions from the passthrough results. It must label
that as main-Agent processing, not service output. It must not treat `no_data`
as no risk, and must not treat one strategy hit or device-risk field as a final
risk conclusion.

### `/browser-backed-risk-service 调用 <action> <params>`

- Confirm `service_base_url`.
- Check `{service_base_url}/health`.
- Confirm `<action>` is allowlisted.
- Validate that params are typed params only.
- Reject `url`, `path`, `header`, `headers`, `cookie`, `token`, `session`,
  `authorization`, `raw_body`, `raw_query`, and `secret`.
- Call `{service_base_url}/actions/<action>`.
- Output only an envelope summary; do not print full upstream body.

### `/browser-backed-risk-service 停止`

- Guide the user to stop the service terminal with Ctrl+C.
- If using the Mac worker helper, run `npm run worker:stop`.
- If needed, identify the local process listening on 8787.
- Do not delete profile directories.

### `/browser-backed-risk-service 排障`

Cover:

- profile lock
- `auth_state=auth_required`
- `manual_login_required`
- `two_factor_required`
- MyFlicker / Mac node disconnected
- no GUI on the main Agent machine
- `service_base_url` unreachable
- bridge/tunnel unreachable
- Mac worker status/doctor output
- action not allowlisted
- forbidden params rejected

For remote main Agents, the preferred remediation is Mac Local Worker, not
profile copy to Linux.

If the Mac worker is available, run `npm run worker:doctor` before asking for
manual profile reset. Do not delete the profile.

Profile lock handling is diagnostic-only by default:

- The service should use `~/.dennis-browser-backed/profile`, not the user's
  daily Chrome profile.
- If `worker:doctor` reports `daily_chrome_profile_in_use`, stop and tell the
  user to fix `BROWSER_BACKED_PROFILE_DIR`; do not close daily Chrome.
- If it reports `dedicated_profile_live_lock`, ask the user to close the
  browser-backed dedicated profile window or stop the owning worker; do not
  kill Chrome automatically.
- If it reports `stale_profile_lock`, run `npm run worker:start`: it may
  automatically clear stale lock files only under the dedicated
  `~/.dennis-browser-backed/profile` when the recorded PID is gone, then
  continue refresh/start. If `worker:start` returns `service_ready=false`, stop
  live source execution and report `dennis_should_continue_live=false`; do not
  continue to `/actions`.
- If it reports `unknown_lock`, stop with `blocking_issue=profile_lock_unknown`.
- Never run `killall Chrome`, `pkill Chrome`,
  `osascript quit app "Google Chrome"`, or any equivalent automatic browser
  shutdown.

If the Mac node is disconnected, ask the user to open the MyFlicker Mac client,
confirm the node is connected, and retry `/browser-backed-risk-service 状态`.
Do not try profile copy, cookie injection, storageState injection, or
`sso_session.py` as a workaround.

## Response Contract

Single action responses include transport fields such as:

- `ok`
- `action`
- `action_name`
- `request_id`
- `request_mode=fixed_action`
- `response_mode=passthrough`
- `platform`
- `http_status`
- `content_type`
- `body_present`
- `body_truncated`
- `observed_bytes`
- `elapsed_ms`
- `transport_error`
- `platform_error`
- `invalid_params`
- `timeout`
- `auth_redirect_detected`
- `raw_body_handling=visible` for small responses
- `raw_body_handling=capped` for large responses
- `upstream.status`
- `upstream.content_type`
- `upstream.body_present`
- `upstream.body` for small JSON/text responses
- `upstream.body_snippet` or `upstream.capped_body` for large responses
- `upstream.body_omitted=false` when bounded body content is returned
- `safety.credential_material_output=false`

Agent may parse `upstream.body`, `upstream.body_snippet`, or
`upstream.capped_body` as upstream business response data. Do not print the full
body to the user by default. Field names such as `token`, `session`, `login`, or
`auth` inside `upstream.body` can be business fields and are not service auth
material by name alone. The forbidden material remains request headers,
`set-cookie`, browser cookie jars, Chrome profile contents, localStorage/browser
storage dumps, Playwright storage state, caller-provided auth material, and
service/browser credential material.

## Fixed Actions

| action_name | origin_key |
| --- | --- |
| `track_analysis_summary` | `track_analysis` |
| `login_logs_search` | `login_logs` |
| `weapon_inventory` | `weapon` |
| `rcp_snapshot` | `rcp` |
| `archives_user_profile` | `archives` |
| `archives_user_analysis` | `archives` |
| `archives_photo_search` | `archives` |
| `archives_photo_profile` | `archives` |
| `archives_photo_meta` | `archives` |
| `archives_photo_report_aggregate` | `archives` |
| `archives_photo_user_autonomy` | `archives` |
| `archives_gallery_photo_list` | `archives` |
| `archives_related_users` | `archives` |
| `archives_private_message_search` | `archives` |
| `archives_past_four_items` | `archives` |
| `rcp_event_detail` | `rcp` |
| `rcp_event_feature_list` | `rcp` |
| `rcp_event_tree_or_decision` | `rcp` |
| `rcp_fast_query_hbase` | `rcp` |
| `rcp_feature_info_by_keys` | `rcp` |
| `rcp_policy_basic_info` | `rcp` |
| `rcp_relation_policy_tree` | `rcp` |
| `rcp_policy_binding_info_list` | `rcp` |
| `rcp_policy_search` | `rcp` |
| `rcp_policy_blur_search` | `rcp` |
| `rcp_policy_all_version` | `rcp` |
| `rcp_pipeline_policy_versions_by_code` | `rcp` |
| `rcp_policy_version_lookup` | `rcp` |
| `rcp_policy_detail_lookup` | `rcp` |
| `rcp_policy_release_record_lookup` | `rcp` |
| `rcp_policy_tree_lookup` | `rcp` |
| `rcp_node_policy_attribution` | `rcp` |
| `rcp_node_bind_policy_attribution` | `rcp` |
| `track_analysis_check_data_ready` | `track_analysis` |
| `track_analysis_product_list` | `track_analysis` |
| `track_sequence_dimension_list` | `track_analysis` |
| `track_data_type_list` | `track_analysis` |

## Forbidden Actions

Agent must not:

- Automatically dispose, block, freeze, appeal, label, or change upstream state.
- Bypass or escalate platform permissions.
- Read or export cookies, tokens, sessions, request headers, browser storage, or
  Chrome cookie DB data.
- Call arbitrary URLs, platform paths, raw query strings, raw request bodies, or
  caller-provided endpoints.
- Automatically call DataAgent or Hive.
- Ask the service to interpret no-data, produce business observations, create
  evidence cards, score source quality, or provide risk conclusions.
- Call excluded-noise capabilities such as telemetry, static assets,
  fingerprinting, radar/misc/log collection, log-sdk traffic, mobile-device-info
  traffic, or menu/config probes without direct service value.

## Adding A New Callable Action

Before a new service action can become callable, it must have:

- fixed `origin_key`
- fixed method and same-origin relative path
- typed params and validation
- forbidden-input rejection for URL/path/header/cookie/token/session/raw body/raw
  query
- passthrough response envelope
- bounded upstream business body visibility
- credential-material protection
- mock tests for success, parameter errors, forbidden inputs, upstream errors,
  too-large responses, and credential-material protection
- live smoke evidence showing no authentication material output
- `ACTION_REGISTRY.md` status update

Until then, keep it out of the allowlist.
