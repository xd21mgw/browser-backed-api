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
scripts call `127.0.0.1:8787/actions/<action_name>`. The service uses your own
local Chrome profile to access internal platforms that you already have
permission to view.

It does not share login state between teammates. It does not give anyone new
permissions. It does not call arbitrary URLs. It does not make risk judgments or
automatic disposal decisions.

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

### 3. Open your browser profile and log in

```sh
npm run open:profile
```

This opens a visible Chrome window controlled by the local service profile.
Finish SSO or platform login steps yourself. After you finish login, return to
the terminal and press Enter.

The service does not read cookie/token/session/header values during this step.
It only lets Chrome store its own login state in your local profile directory.

If you already have a dedicated local profile for this service, you can point
the service at it with `BROWSER_BACKED_PROFILE_DIR`:

```sh
BROWSER_BACKED_PROFILE_DIR=/path/to/your/profile npm run refresh:once
BROWSER_BACKED_PROFILE_DIR=/path/to/your/profile npm run start:live
```

If you do not set `BROWSER_BACKED_PROFILE_DIR`, the service uses:

```txt
~/.dennis-browser-backed/profile
```

Do not copy another teammate's profile. Do not commit or send your profile
directory. A single profile can be used by only one Chrome/Playwright process at
the same time, so close `start:live`, `refresh:daemon`, `open:profile`, or other
Chrome instances using that profile before reusing it.

### 4. Check and refresh login state once

```sh
npm run refresh:once
```

This opens a headless persistent browser context with your profile, warms the
fixed registry origins, and writes a refresh-state file. The state file records
only metadata such as `last_refresh_at`, per-origin readiness, and error type.
It does not contain credential material.

Archives Center may show a one-time lightweight account confirmation page. The
refresh/prewarm step can click a small allowlisted confirmation control such as
`下一步`, `继续`, `确认`, `进入系统`, `Continue`, `Next`, or `Confirm` when no
password, OTP, QR, or captcha is present. If the page asks for password, 2FA,
QR scan, captcha, or extra account input, the service stops and reports manual
login required; run `npm run open:profile` and finish it yourself.

Expected good result:

- `ok: true`
- `auth_state: ready`
- required origins such as `rcp`, `weapon`, `login_logs`, and `track_analysis`
  are `ready`

### 5. Keep login state warm in the background

```sh
npm run refresh:daemon
```

The daemon refreshes once at startup and then every 4 hours. You can stop it
with Ctrl+C.

Optional interval override:

```sh
BROWSER_BACKED_REFRESH_INTERVAL_MS=14400000 npm run refresh:daemon
```

### 6. Start the local service

```sh
npm run start:live
```

The service listens only on:

```txt
127.0.0.1:8787
```

### 7. Let Agent or Skill call fixed local actions

Agent or Skill calls local endpoints such as:

```txt
POST http://127.0.0.1:8787/actions/login_logs_search
POST http://127.0.0.1:8787/actions/weapon_inventory
POST http://127.0.0.1:8787/actions/track_analysis_summary
POST http://127.0.0.1:8787/actions/rcp_snapshot
```

Callers provide typed params only, such as `user_id`, `device_id`, safe time
windows, or fixed enum values. They do not provide URLs, paths, cookies, tokens,
sessions, headers, or raw request bodies.

You can list the 19 fixed actions with:

```sh
curl http://127.0.0.1:8787/actions
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
| `BROWSER_BACKED_REFRESH_INTERVAL_MS` | Override refresh-daemon interval. Default is 4 hours. |
| `ENABLED_PLATFORMS` | Optional comma-separated origin scope for live mode. |
| `RCP_ORIGIN`, `WEAPON_ORIGIN`, `LOGIN_LOGS_ORIGIN`, `TRACK_ANALYSIS_ORIGIN`, `ARCHIVES_ORIGIN` | Optional origin overrides. Most teammates should use defaults. |

## Quick Health Check

After starting live mode:

```sh
curl http://127.0.0.1:8787/health
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
- `action_count=19`
- no credential material is printed

## Permission Model

Whoever logs in controls what the service can read.

- If you lack permission for a platform, the action may return `auth_failed`,
  `blocked`, or a platform error.
- The service will not bypass that permission.
- The service will not perform writes or automatic disposal.
- The service will not make DataAgent/Hive calls automatically.
