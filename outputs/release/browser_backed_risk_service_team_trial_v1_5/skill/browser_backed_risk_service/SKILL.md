# Browser-Backed Risk Service Skill

## Positioning

This is a command-oriented Skill for the **Browser-backed Risk Platform Access
Service**. The service is a controlled local/Mac worker for risk-platform reads.

The service only does fixed action allowlist, typed params validation, fixed
origin/path construction, browser-session readiness, same-origin fetch,
raw-body suppression, transport status, and controlled batch scheduling.

The service does not do business summaries, observations, source cards, source
quality, evidence cards, no-data interpretation, risk judgment, DataAgent/Hive
calls, permission bypass, or platform writes.

Current callable `action_count=19`. All actions are passthrough-only at the
service layer.

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
POST {service_base_url}/actions/batch
```

Before action calls, verify `/health` and `/actions`; `action_count` should be
19.

## Deployment Modes

### Local Agent Mode

- Agent, script, curl, and browser-backed service run on the same computer.
- Use `service_base_url=http://127.0.0.1:8787`.
- No bridge or tunnel is required.
- User runs `npm install`, `npm run open:profile`, `npm run refresh:once`, and
  `npm run start:live` locally.
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

Daily user experience should be low-friction:

- First setup may need Mac command approval and a visible Mac Chrome login.
- After setup, the Mac worker should stay running.
- Daily action calls should not open a browser every time.
- Daily action calls should not require repeated command approvals.
- The remote main Agent should call service APIs through `service_base_url`.
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
recommended workflow until it is validated. If validated, it may become a v1.6
focus area; until then, prefer Mac Local Worker for remote main Agents.

Bridge/tunnel safety boundary:

- Forward only `/health`, `/actions`, `/actions/<allowlisted_action>`,
  `/actions/batch`, and `/actions/multi_source_plan`.
- Do not expose arbitrary URL fetch or arbitrary platform paths.
- Do not expose Chrome profile files, cookies, tokens, sessions, authorization
  values, request headers, localStorage, or Playwright storageState.
- Require access control such as internal ACL, temporary token, user
  confirmation, or equivalent deployment guard.
- Do not expose the Mac service directly to the public internet.

## Skill-Managed Workflow

The Skill should behave like a command-oriented helper, not just a static
manual. Use these command intents.

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

- For Local Agent Mode, guide the user through:
  - `npm run open:profile`
  - `npm run refresh:once`
  - `npm run start:live`
- For Remote Main Agent Mode, prefer Mac Local Worker:
  - run `npm run worker:start` on the user's Mac when available
  - otherwise run the service on the user's Mac
  - let the user complete SSO, two-factor checks, and Archives account
    confirmation in Mac Chrome
  - configure `BROWSER_BACKED_SERVICE_BASE_URL` to the Mac worker/bridge URL
- Do not propose cookie injection, storageState injection, `sso_session.py`, or
  Mac-profile copy to Linux.

### `/browser-backed-risk-service 状态`

- Call `{service_base_url}/health`.
- Call `{service_base_url}/actions`.
- If running on the Mac worker directly, `npm run worker:status` is also valid.
- Report only sanitized status:
  - `ok`
  - `service_mode`
  - `auth_state`
  - `action_count`
  - origin readiness
  - `safety.credential_material_output`

### `/browser-backed-risk-service actions`

- List the 19 allowlisted fixed actions.
- Show typed params from `ACTION_REGISTRY.md`.
- Remind that service output is a transport envelope and raw upstream body is
  suppressed.

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
- `raw_body_handling=suppressed`
- `upstream.status`
- `upstream.content_type`
- `upstream.body_present`
- `upstream.body_omitted=true`
- `safety.credential_material_output=false`

Agent must not expect raw upstream body in the browser-backed service response.

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
| `archives_related_users` | `archives` |
| `archives_private_message_search` | `archives` |
| `archives_past_four_items` | `archives` |
| `rcp_event_detail` | `rcp` |
| `rcp_event_feature_list` | `rcp` |
| `rcp_policy_version_lookup` | `rcp` |
| `rcp_policy_detail_lookup` | `rcp` |
| `rcp_policy_release_record_lookup` | `rcp` |
| `rcp_policy_tree_lookup` | `rcp` |
| `rcp_node_policy_attribution` | `rcp` |
| `rcp_node_bind_policy_attribution` | `rcp` |
| `track_analysis_check_data_ready` | `track_analysis` |

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
- transport-only response envelope
- raw body suppression
- credential-material protection
- mock tests for success, parameter errors, forbidden inputs, upstream errors,
  too-large responses, and credential-material protection
- live smoke evidence showing no authentication material output
- `ACTION_REGISTRY.md` status update

Until then, keep it out of the allowlist.
