---
name: browser-backed-risk-service
description: Install, start, connect to, and call the Browser-backed Risk Service; use for Mac Local Worker setup, service_base_url checks, and capability commands for user profile, login history, device graph, content, private message, profile change, and RCP strategy-event passthrough reads.
---

# Browser-Backed Risk Service Skill

## Positioning

This is a command-oriented Skill for the **Browser-backed Risk Platform Access
Service**. The service is a controlled local/Mac worker for risk-platform reads.

The service only does fixed action allowlist, typed params validation, fixed
origin/path construction, browser-session readiness, same-origin fetch,
bounded upstream business body passthrough, response-size guard, transport
status, and controlled batch scheduling.

The service does not do business summaries, observations, source cards, source
quality, evidence cards, no-data interpretation, risk judgment, DataAgent/Hive
calls, permission bypass, or platform writes.

Current callable `action_count=37`. All actions are passthrough-only at the
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
37.

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

- List the 37 allowlisted fixed actions.
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
- Call `{service_base_url}/actions` and confirm `action_count=37`.

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
