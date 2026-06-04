# Team Local Setup

This guide is for teammates who want to run the local Browser-backed Risk
Platform Access Service on their own computer.

The short version:

- Everyone runs the same tool code.
- Everyone logs in with their own Chrome profile.
- Whoever logs in, their platform permissions apply.
- The service calls fixed local actions only.
- The service does not read or output cookies, tokens, sessions, or request
  headers.
- The service returns controlled action responses. Passthrough mode forwards
  upstream business response bodies, not browser authentication material.

## What This Service Does

This is a local "risk platform hand-and-foot" service. Agent, Skill, or local
scripts call `{service_base_url}/actions/<action_name>`. In normal local use,
`service_base_url` is:

```txt
http://127.0.0.1:8787
```

The service uses your own local Chrome profile to access internal platforms
that you already have permission to view.

It does not share login state between teammates. It does not give anyone new
permissions. It does not call arbitrary URLs. It does not make risk judgments or
automatic disposal decisions.

## Deployment Modes

### Local Agent Mode

Use this when the Agent, local script, or curl command runs on the same computer
as this service.

- Keep the default `service_base_url=http://127.0.0.1:8787`.
- No bridge or tunnel is needed.
- The setup commands in this guide are unchanged.

### Remote Main Agent + Mac Local Worker Mode

Use this only when the main Agent runs remotely or in the cloud.

- The service runs on your Mac.
- Your Mac acts as the local worker.
- Chrome profile and refresh state stay on your Mac.
- Your Mac must be powered on and connected to the network while the remote
  main Agent is using it.
- MyFlicker / Mac node client, or the approved equivalent Mac worker channel,
  must stay online and connected.
- Browser-backed service must be running on your Mac.
- The Chrome profile must not be locked by another Chrome/Playwright process.
- You complete SSO, two-factor checks, and Archives account confirmation in Mac
  Chrome.
- The remote main Agent must not assume its own `127.0.0.1` is your Mac.
- The remote main Agent needs a configured `service_base_url`, usually from
  `BROWSER_BACKED_SERVICE_BASE_URL` or its Agent config.
- That URL should point to a controlled Mac worker/bridge/tunnel that reaches
  your Mac service.
- The bridge/tunnel is not implemented by this release; it is a deployment
  requirement.

Do not expose the service directly to the public internet. Do not upload or copy
your profile, refresh state, cookies, tokens, sessions, request headers, browser
storage, or `.env` files to the remote Agent.

This is the recommended remote main Agent path. It matches the successful
rc-cli style flow: authentication and platform access happen on Mac; the remote
Agent only calls the bounded Mac worker.

MyFlicker / Mac node lets the remote main Agent run controlled status/action
calls on your Mac or reach your Mac worker `service_base_url`. It does not read
cookies, tokens, sessions, request headers, profile files, or browser storage,
and it does not replace the browser-backed service.

### Not Recommended: Mac Profile Copy To Linux

Do not copy the Mac profile to Linux headless as the normal setup. Joint testing
showed that Track Analysis may become ready, but RCP, Weapon, Login Logs, and
Archives can trigger `two_factor_required`. Do not use cookie injection,
storageState injection, or `sso_session.py`.

## First-Time Setup

### 1. Download the tool code

Clone or download this repository to your own computer.

```sh
cd /path/to/browser-backed-api-poc
```

### 2. Install runtime dependencies

```sh
npm install
```

This installs the local Node/Playwright dependencies used by the service.

### 3. Start the worker

```sh
npm run worker:start
```

This is the daily command ordinary users should remember. It checks whether the
service is already running and ready. If not, it runs refresh once and starts
the local worker. If SSO, two-factor verification, QR scan, captcha, or a
manual account confirmation is required, it opens the visible profile flow and
continues after you finish.

The service does not read cookie/token/session/header values during this step.
It only lets Chrome use its own local profile state.

If you already have a dedicated local profile for this service, you can point
the service at it with `BROWSER_BACKED_PROFILE_DIR`:

```sh
BROWSER_BACKED_PROFILE_DIR=/path/to/your/profile npm run worker:start
```

If you do not set `BROWSER_BACKED_PROFILE_DIR`, the service uses:

```txt
~/.dennis-browser-backed/profile
```

Do not copy another teammate's profile. Do not commit or send your profile
directory. A single profile can be used by only one Chrome/Playwright process at
the same time. The service should use the dedicated profile at
`~/.dennis-browser-backed/profile`, not your daily Chrome profile. If
`worker:start` reports `profile_locked`, run `npm run worker:doctor` to classify
the lock. Main agents and worker scripts do not automatically close or kill
Chrome. If the lock belongs to your daily Chrome profile, fix
`BROWSER_BACKED_PROFILE_DIR` instead of closing daily Chrome. If it belongs to a
browser-backed dedicated profile window, close that dedicated window yourself
before retrying.

### 4. Advanced: check and refresh login state once

```sh
npm run refresh:once
```

This remains available for debugging. It opens a headless persistent browser
context with your profile, warms fixed registry origins, and writes a
refresh-state file. The state file records only metadata such as
`last_refresh_at`, per-origin readiness, and error type. It does not contain
credential material. Ordinary users should prefer `npm run worker:start`.

Archives Center may show a lightweight account confirmation page every few
hours. The refresh/prewarm/ensure-ready step can click a small allowlisted
confirmation control such as `下一步`, `继续`, `确认`, `进入系统`, `登录`,
`Continue`, `Next`, or `Confirm` when the username/account is already present
and no password, OTP, QR, or captcha is present. If the page asks for password,
2FA, QR scan, captcha, or extra account input, the service stops and reports
manual login required; run `npm run worker:start` and finish the visible profile
flow if prompted.

Expected good result:

- `ok: true`
- `auth_state: ready`
- required origins such as `rcp`, `weapon`, `login_logs`, and `track_analysis`
  are `ready`

### 5. Optional: keep login state warm in the background

```sh
npm run refresh:daemon
```

The daemon refreshes once at startup and then every 4 hours. You can stop it
with Ctrl+C.

Optional interval override:

```sh
REFRESH_INTERVAL_MINUTES=240 npm run refresh:daemon
```

If the daemon sees `manual_login_required`, `auth_required`,
`two_factor_required`, or `captcha_required`, it records
`pending_manual_login` and tells you to run `npm run worker:start` next time a
user is available. It does not bypass auth and does not repeatedly open
browsers.

### 6. Check the local service

```sh
npm run worker:status
```

This prints a sanitized health/actions summary. For foreground debugging,
`npm run start:live` is still valid, but it is not the daily entrypoint.

The service listens locally on:

```txt
127.0.0.1:8787
```

### 7. Let Agent or Skill call fixed local actions

Agent or Skill calls endpoints under `service_base_url`.

Local examples:

```txt
POST http://127.0.0.1:8787/actions/login_logs_search
POST http://127.0.0.1:8787/actions/weapon_inventory
POST http://127.0.0.1:8787/actions/track_analysis_summary
POST http://127.0.0.1:8787/actions/rcp_snapshot
```

Remote main Agent examples use the configured Mac worker/bridge/tunnel value
instead:

```txt
POST {service_base_url}/actions/login_logs_search
POST {service_base_url}/actions/weapon_inventory
```

Callers provide typed params only, such as `user_id`, `device_id`, safe time
windows, or fixed enum values. They do not provide URLs, paths, cookies, tokens,
sessions, headers, or raw request bodies.

## Daily Mac Worker Use

After first setup, keep the Mac worker running for lower-friction remote Agent
queries.

```sh
npm run worker:status
npm run worker:start
```

Daily use should not open Chrome every time and should not require repeated
command approvals. The main Agent calls `service_base_url/actions/<action_name>`
and receives a passthrough envelope.

If MyFlicker / Mac node is disconnected, the remote main Agent cannot reach the
Mac worker. Open the MyFlicker Mac client, confirm node connected, then retry
status. Do not switch to profile copy, cookie injection, storageState injection,
or `sso_session.py`.

## Skill User Self-Test

For a one-command teammate trial through the Agent Skill:

```txt
/browser-backed-risk-service 自测用户 403082302
```

Replace the sample user with a `user_id` you personally have permission to
inspect and that may have platform data.

The Skill should call this default read-only action group:

- `track_analysis_summary`
- `login_logs_search`
- `weapon_inventory`
- `archives_user_profile`

Optional:

- `archives_private_message_search`

The browser-backed service still returns only passthrough envelopes. The main
Agent may extract non-sensitive business fields, build tables, list missing
sources, and provide a structured observation summary, but that processing is
main-Agent output, not service output. Do not print full upstream body, and do
not ask the service to make a risk judgment.

If auth/confirmation expires:

- refresh/prewarm/ensure-ready attempts lightweight landing-flow activation
  first.
- If the page is username prefilled plus `下一步` / `继续` / `确认`, the service
  can handle it.
- If password, 2FA, QR, or captcha appears, the service returns
  `manual_login_required`; run `npm run worker:start` on the Mac.

Use:

```sh
npm run worker:doctor
```

for Node/npm, install, port, profile path, and profile lock diagnostics.

You can list the 19 fixed actions with:

```sh
SERVICE_BASE_URL="${BROWSER_BACKED_SERVICE_BASE_URL:-http://127.0.0.1:8787}"
curl "$SERVICE_BASE_URL/actions"
```

Some actions are passthrough-only. For those, call with
`"response_mode":"passthrough"` and expect only the passthrough envelope. See
`ACTION_REGISTRY.md` before calling an action you have not used before.

For live smoke, replace sample IDs with test entities that you personally have
permission to view and that are likely to have platform data:

- `user_id`
- `device_id`
- `eventId`
- `policyCode`

If you do not have a suitable sample, an action may return `no_data`,
`auth_blocked`, or `param_needed`. That does not automatically mean the local
service is broken.

When sharing a smoke result, do not paste the full `upstream.body`. Record only
the envelope summary:

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
- whether cookie/token/session/header/authorization/password appeared: `false`

## Important Safety Rules

- Code can be shared. Login state must not be shared.
- Your profile stays on your own machine and must not be committed to git.
- The refresh state is only a readiness record and does not contain credentials.
- Token/cookie/session/header values are not read and not output.
- Do not copy another teammate's profile.
- Do not send your profile directory or refresh-state file to anyone.
- Do not commit `.env`, profile directories, state files, HAR captures,
  screenshots, or temporary captures.
- Do not paste full `upstream.body`, request headers, cookie/token/session/header
  values, authorization strings, localStorage, browser storage dumps, or
  Playwright storage state into feedback.

## Useful Environment Variables

| Variable | Meaning |
| --- | --- |
| `BROWSER_BACKED_PROFILE_DIR` | Override the local Playwright/Chrome profile directory. |
| `BROWSER_BACKED_STATE_FILE` | Override the refresh-state file path. |
| `REFRESH_INTERVAL_MINUTES` | Override refresh-daemon interval in minutes. Default is 240. |
| `BROWSER_BACKED_REFRESH_INTERVAL_MS` | Override refresh-daemon interval. Default is 4 hours. |
| `BROWSER_BACKED_SERVICE_BASE_URL` | Agent-side service URL override. Local users normally do not need this; remote main Agents use it to point at a controlled local-worker bridge/tunnel. |
| `BROWSER_BACKED_WORKER_RUNTIME_DIR` | Optional directory for worker pid/log files. Default is `~/.dennis-browser-backed`. |
| `BROWSER_BACKED_WORKER_PID_FILE` | Optional worker pid file override. |
| `BROWSER_BACKED_WORKER_LOG_FILE` | Optional worker log file override. |
| `ENABLED_PLATFORMS` | Optional comma-separated origin scope for live mode. |
| `RCP_ORIGIN`, `WEAPON_ORIGIN`, `LOGIN_LOGS_ORIGIN`, `TRACK_ANALYSIS_ORIGIN`, `ARCHIVES_ORIGIN` | Optional origin overrides. Most teammates should use defaults. |

## Quick Health Check

After starting live mode:

```sh
SERVICE_BASE_URL="${BROWSER_BACKED_SERVICE_BASE_URL:-http://127.0.0.1:8787}"
curl "$SERVICE_BASE_URL/health"
```

Useful fields:

- `profile_exists`
- `auth_state`
- `last_refresh_at`
- `origin_status`
- `warmed_origins`
- `action_count`

`profile_dir_configured` is a boolean by design. The API does not echo your
local filesystem path.

Good local readiness usually means:

- `/health` returns `ok=true`
- `service_mode=live`
- `auth_state=ready`, or the origin needed by your action is ready
- `action_count=70`
- no credential material is printed

## Permission Model

Whoever logs in controls what the service can read.

- If you lack permission for a platform, the action may return `auth_failed`,
  `blocked`, or a platform error.
- The service will not bypass that permission.
- The service will not perform writes or automatic disposal.
- The service will not make DataAgent/Hive calls automatically.
