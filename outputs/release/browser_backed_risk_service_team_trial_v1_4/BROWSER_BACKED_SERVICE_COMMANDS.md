# Browser-Backed Service Skill Commands

This document defines the rc-cli style command workflow for the
browser-backed risk service Skill.

The Skill is command-oriented. It should guide installation, startup, status
checks, action discovery, action invocation, stop, and troubleshooting without
requiring users to manually study every registry file first.

## `/browser-backed-risk-service 安装`

Purpose: prepare the release on the machine that will run the service.

Steps:

1. Check Node.js and npm.
2. Locate or unpack the release directory.
3. Enter `service/`.
4. Run `npm install`.
5. Run `npm run check`.
6. Report the next step:
   - Local Agent Mode: run local profile setup and service start.
   - Remote Main Agent Mode: run Mac Local Worker setup and configure
     `BROWSER_BACKED_SERVICE_BASE_URL`.

Do not ask for cookies, tokens, sessions, request headers, storageState, or
profile file contents.

## `/browser-backed-risk-service 启动`

Purpose: start the local service or guide the Mac local worker path.

Local Agent Mode:

```sh
npm run open:profile
npm run refresh:once
npm run start:live
```

Remote Main Agent + Mac Local Worker Mode:

1. Run those commands on the user's Mac.
2. Let the user complete SSO, two-factor checks, and Archives account
   confirmation in Mac Chrome.
3. Configure the main Agent's `service_base_url`:

```sh
BROWSER_BACKED_SERVICE_BASE_URL=<bridge_or_mac_worker_url>
```

Do not propose Mac profile copy to Linux, cookie injection, storageState
injection, or `sso_session.py`.

## `/browser-backed-risk-service 状态`

Purpose: check service readiness.

Calls:

```txt
GET {service_base_url}/health
GET {service_base_url}/actions
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
- List 19 allowlisted actions.
- Show typed params.
- State that service output is a transport envelope and raw upstream body is
  suppressed.

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
- `error_type`
- `safety.credential_material_output`

Do not output full upstream body.

## `/browser-backed-risk-service 停止`

Purpose: stop the local service safely.

Steps:

1. Ask the user to stop the `npm run start:live` terminal with Ctrl+C.
2. If needed, check local port 8787:

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
- `service_base_url` unreachable
- bridge/tunnel unreachable
- action not allowlisted
- forbidden params rejected

Recommended fix for remote main Agents: use Mac Local Worker Mode. Do not use
Mac profile copy to Linux headless as the team workflow.
