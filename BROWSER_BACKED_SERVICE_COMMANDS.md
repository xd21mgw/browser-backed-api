# Browser-Backed Service Skill Commands

This document defines the rc-cli style command workflow for the
browser-backed risk service Skill.

The Skill is command-oriented. It should guide installation, startup, status
checks, action discovery, action invocation, stop, and troubleshooting without
requiring users to manually study every registry file first.

## `/browser-backed-risk-service 安装`

Purpose: prepare the release on the machine that will run the service.

Before installing, read:

- `SKILL.md`
- `ACTION_REGISTRY.md`
- `CAPABILITY_INDEX.yaml`
- `PASSTHROUGH_CONTRACT.md`
- `REMOTE_MAIN_AGENT_SUCCESS_PATHS.md`

Steps:

1. Check Node.js and npm.
2. Locate or unpack the release directory.
3. Enter `service/`.
4. Run `npm install`.
5. Run `npm run check`.
6. Report the next step:
   - Local Agent Mode: run `npm run worker:start`.
   - Remote Main Agent Mode: run `npm run worker:start` on the Mac Local Worker
     and configure
     `BROWSER_BACKED_SERVICE_BASE_URL`.
   - For Mac worker daily use, prefer fixed worker commands over repeated
     ad hoc shell snippets.

Do not ask for cookies, tokens, sessions, request headers, storageState, or
profile file contents.

Remote Main Agent + Mac Local Worker package transfer must follow
`REMOTE_MAIN_AGENT_SUCCESS_PATHS.md`:

1. Linux/main-agent workspace has the release tarball.
2. Linux/main-agent starts a temporary HTTP server in the release directory.
3. Mac node downloads the release with `curl`.
4. Mac extracts the release.
5. Mac enters `service/`.
6. Mac runs `npm install`.
7. Mac runs `npm run worker:doctor`.
8. Mac runs `npm run worker:start`.
9. Mac runs `npm run worker:expose`.
10. Use the printed `BROWSER_BACKED_SERVICE_BASE_URL`.

Do not switch to base64 chunks, per-file writes, KCDN/ad hoc uploads, SSH/SCP
guessing, profile copy, `sso_session.py`, cookie injection, storageState
injection, arbitrary URL fetch, or profile/state/auth-state transfer. If the
HTTP server is unreachable, report `release_transfer_failed` and stop. If Mac
command approval times out, report `mac_command_approval_required` and stop.

## `/browser-backed-risk-service 启动`

Purpose: start the local service or guide the Mac local worker path.

Local Agent Mode:

```sh
npm run worker:start
```

Remote Main Agent + Mac Local Worker Mode:

1. Run setup on the user's Mac.
2. Start or reuse the Mac worker:

```sh
npm run worker:start
```

`worker:start` auto-routes refresh/start/open-profile. The visible browser opens
only when SSO, two-factor checks, QR, captcha, or account confirmation requires
a user.

3. Configure the main Agent's `service_base_url`:

```sh
BROWSER_BACKED_SERVICE_BASE_URL=<bridge_or_mac_worker_url>
```

Do not propose Mac profile copy to Linux, cookie injection, storageState
injection, or `sso_session.py`.

Remote online requirement:

- The user's Mac must be powered on and online.
- MyFlicker / Mac node client, or the approved equivalent Mac worker channel,
  must stay connected.
- The browser-backed service must be running.
- The Chrome profile must not be locked by another Chrome/Playwright process.
- If Mac node is disconnected, ask the user to open the MyFlicker Mac client
  and confirm node connectivity. Do not fall back to profile copy, cookie
  injection, storageState injection, or `sso_session.py`.

## `/browser-backed-risk-service 状态`

Purpose: check service readiness.

Calls:

```txt
GET {service_base_url}/health
GET {service_base_url}/actions
```

When running directly on the Mac worker, the Skill may also use:

```sh
npm run worker:status
```

Report:

- `ok`
- `service_mode`
- `auth_state`
- `action_count`
- origin readiness
- `safety.credential_material_output`

Do not print cookies, tokens, sessions, request headers, profile contents, or
full upstream bodies.

## `/browser-backed-risk-service actions`

Purpose: list callable actions and required typed params.

Behavior:

- Load `ACTION_REGISTRY.md`.
- Use `CAPABILITY_INDEX.yaml` and `ACTION_PLAYBOOK.md` when the user asks by
  capability instead of exact action name.
- List 70 allowlisted actions.
- Show typed params.
- State that service output is a passthrough envelope with bounded upstream
  business body visibility.

## Capability Commands

Use these command intents when users describe what they want to inspect rather
than naming a fixed action:

- `/browser-backed-risk-service 用户画像 <user_id>`
- `/browser-backed-risk-service 登录历史 <user_id>`
- `/browser-backed-risk-service 设备图谱 <user_id>`
- `/browser-backed-risk-service 作品查询 <user_id>`
- `/browser-backed-risk-service 私信样本 <user_id>`
- `/browser-backed-risk-service 资料变更 <user_id>`
- `/browser-backed-risk-service 策略事件 <eventType> <eventId>`
- `/browser-backed-risk-service action <action_name> <json_params>`

The Skill should map these commands through `CAPABILITY_INDEX.yaml`, then use
typed params from `ACTION_REGISTRY.md`. Do not require users to memorize the 70
action names.

## `/browser-backed-risk-service 自测用户 <user_id>`

Purpose: run one real user case through service readiness, Mac worker
connectivity, fixed action calls, and main-Agent post-processing.

This is a user self-test workflow, not a service-side risk judgment. The
browser-backed service remains pure passthrough. Any field extraction, table,
evidence-package summary, or next-step suggestion is main-Agent processing over
the returned envelopes and available business body metadata.

Pre-check:

1. Resolve `service_base_url`.
2. For Remote Main Agent + Mac Local Worker Mode, confirm Mac node is connected.
3. Call `{service_base_url}/health`.
4. Call `{service_base_url}/actions`.
5. Confirm `action_count=70`.

Default action group:

| action | params |
| --- | --- |
| `track_analysis_summary` | `{"response_mode":"passthrough","sub_interface":"profile","user_id":"<user_id>","appName":"KUAISHOU"}` |
| `login_logs_search` | `{"response_mode":"passthrough","user_id":"<user_id>"}` |
| `weapon_inventory` | `{"response_mode":"passthrough","user_id":"<user_id>"}` |
| `archives_user_profile` | `{"response_mode":"passthrough","user_id":"<user_id>"}` |

Optional action:

| action | params |
| --- | --- |
| `archives_private_message_search` | `{"response_mode":"passthrough","user_id":"<user_id>","direction":"sent","page":1,"count":20}` |

Do not include `rcp_snapshot` by default because it is not a direct `user_id`
lookup. Use RCP actions only when the user provides event/source/policy params.

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
3. Main-agent processing summary:
   - `track_profile_observed`
   - `login_records_observed`
   - `device_graph_observed`
   - `archives_profile_observed`
   - `private_message_sample_observed`
4. Missing or blocked:
   - `manual_login_required`
   - `auth_required`
   - `no_data`
   - `response_too_large`
   - `permission_denied`
5. Safety:
   - `credential_material_output=false`
   - `raw_upstream_body_printed=false`
   - `cookie/token/session/header_output=false`

Do not print full upstream body. Do not call this command `综合研判`; if the
upper-layer main Agent continues with analysis, label it as main-Agent analysis,
not browser-backed service output.

## `/browser-backed-risk-service 调用 <action> <params>`

Purpose: safely call one fixed action.

Steps:

1. Resolve `service_base_url`.
2. Call `{service_base_url}/health`.
3. Confirm the action is allowlisted.
4. Validate typed params.
5. Reject forbidden input keys:
   - `url`
   - `path`
   - `header`
   - `headers`
   - `cookie`
   - `token`
   - `session`
   - `authorization`
   - `raw_body`
   - `raw_query`
   - `secret`
6. Call `{service_base_url}/actions/<action>`.
7. Output only envelope summary fields.

Envelope summary fields:

- `http_status`
- `ok`
- `action`
- `response_mode`
- `upstream.status`
- `upstream.content_type`
- `upstream.body_present`
- `upstream.body_omitted`
- `upstream.body_truncated`
- `upstream.raw_body_handling`
- whether `upstream.body`, `upstream.body_snippet`, or `upstream.capped_body` is present
- `error_type`
- `safety.credential_material_output`

The main Agent can parse `upstream.body`, `upstream.body_snippet`, or
`upstream.capped_body` for its own processing. Do not print the full upstream
body to the user by default. Do not print request headers, response
`set-cookie`, cookies, tokens, sessions, authorization values, Chrome profile
contents, localStorage/browser storage, or Playwright storage state.

## `/browser-backed-risk-service 停止`

Purpose: stop the local service safely.

Steps:

1. Prefer the fixed worker command:

```sh
npm run worker:stop
```

2. If the service was started in a foreground terminal, ask the user to stop the
   `npm run start:live` terminal with Ctrl+C.
3. If needed, check local port 8787:

```sh
lsof -ti tcp:8787
```

3. Do not delete profile directories.

## `/browser-backed-risk-service 排障`

Cover:

- profile lock
- `auth_state=auth_required`
- `manual_login_required`
- `two_factor_required`
- no GUI on the remote main Agent machine
- MyFlicker / Mac node disconnected
- `service_base_url` unreachable
- bridge/tunnel unreachable
- action not allowlisted
- forbidden params rejected

Use the fixed doctor command on Mac when available:

```sh
npm run worker:doctor
```

Recommended fix for remote main Agents: use Mac Local Worker Mode. Do not use
Mac profile copy to Linux headless as the team workflow.

If `mac_node_disconnected` appears, ask the user to open the MyFlicker Mac
client, confirm the node is connected, and retry `/browser-backed-risk-service
状态`. Do not change deployment mode or attempt cookie/profile workarounds.

## Mac Worker Fixed Commands

These commands reduce repeated Mac node approvals by grouping common operations.

### `npm run worker:start`

- Checks whether port 8787 already has a reachable service.
- If service is reachable and `auth_state=ready`, prints a sanitized ready
  summary and does not start a duplicate service.
- If service is not reachable, checks profile locks before refresh/start.
- If the configured profile is the user's daily Chrome profile, stops with
  `daily_chrome_profile_in_use`; it does not close daily Chrome.
- If the dedicated browser-backed profile is actively locked, stops with
  `dedicated_profile_live_lock`; it asks for user action and does not kill the
  browser.
- If the dedicated profile has stale lock files, stops with
  `stale_profile_lock`; cleanup requires an explicit doctor command.
- If service is missing or auth is not ready, runs `refresh:once`.
- If refresh succeeds, starts `SERVICE_MODE=live node src/server.js` in the
  background when needed.
- If refresh reports `manual_login_required`, `auth_required`,
  `two_factor_required`, or `captcha_required`, opens the visible profile flow,
  waits for the user to finish, then runs refresh again and starts/reuses the
  service.
- Writes a pid file and log file under `~/.dennis-browser-backed`.
- Prints `service_base_url=http://127.0.0.1:8787`.
- Does not delete profile/state.
- Does not read or output cookie/token/session/header.
- Does not automatically close or kill `Google Chrome`, `Chromium`, or browser
  processes.

### `npm run worker:status`

- Calls `/health`.
- Calls `/actions`.
- Prints service mode, auth state, action count, and origin readiness.
- Does not print full upstream body.

### `npm run worker:expose`

- Requires the local service to be reachable on `http://127.0.0.1:8787`.
- Starts or reuses a constrained Mac proxy on `0.0.0.0:9787`.
- Prints:
  - `proxy_status`
  - `local_service=http://127.0.0.1:8787`
  - `service_base_url=http://<mac_ip>:9787`
  - `action_count`
  - `auth_state`
  - `allowed_paths`
  - `security_todo`
- Allows only:
  - `GET /health`
  - `GET /actions`
  - `POST /actions/<allowlisted_action>`
- Does not expose arbitrary URL fetch, Chrome profile files, cookies, tokens,
  sessions, authorization values, request headers, localStorage, or Playwright
  storageState.
- Use the printed `service_base_url` as
  `BROWSER_BACKED_SERVICE_BASE_URL` for the remote main Agent.

### `npm run worker:stop`

- Stops the worker process started by `worker:start`.
- Stops the constrained proxy started by `worker:expose` when its pid file is
  present.
- Does not delete profile/state.
- If no pid file exists but the service is reachable, asks the user to stop the
  owning terminal/process manually.

### `npm run worker:doctor`

- Checks Node.js and npm availability.
- Checks whether `node_modules` exists.
- Checks whether port 8787 is reachable.
- Checks whether the configured profile path exists.
- Classifies profile locks as `daily_chrome_profile_in_use`,
  `dedicated_profile_live_lock`, `stale_profile_lock`, `unknown_lock`, or
  `no_lock`.
- Prints next-step suggestions.
- Does not inspect profile contents or authentication material.
- Does not kill Chrome or delete lock files by default.

Optional inspect-only flags:

```sh
npm run worker:doctor -- --show-profile-processes
npm run worker:doctor -- --explain-lock
```

Explicit stale-lock cleanup:

```sh
npm run worker:doctor -- --clear-stale-lock
```

This only clears stale lock files under `~/.dennis-browser-backed/profile` when
the recorded PID is not live. It never clears daily Chrome locks and never kills
Chrome.

## Auth State Transfer POC Command Policy

Auth State Transfer is documented as a POC candidate, not a default command
workflow. Do not run state transfer commands unless the team explicitly starts a
controlled POC. The current Skill-managed workflow should prefer Mac Local
Worker for remote main Agents.
