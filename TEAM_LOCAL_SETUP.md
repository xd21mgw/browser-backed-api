# Team Local Setup

This guide is for teammates who want to run the local risk evidence service on
their own computer.

The short version:

- Everyone runs the same tool code.
- Everyone logs in with their own Chrome profile.
- Whoever logs in, their platform permissions apply.
- The service reads evidence through fixed local actions only.
- The service does not read or output cookies, tokens, sessions, or request
  headers.

## What This Service Does

This is a local "risk platform hand-and-foot" service. Agent, Skill, or local
scripts call `127.0.0.1:8787/actions/*`. The service uses your own local Chrome
profile to access internal platforms that you already have permission to view.

It does not share login state between teammates. It does not give anyone new
permissions. It does not call arbitrary URLs.

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

### 4. Check and refresh login state once

```sh
npm run refresh:once
```

This opens a headless persistent browser context with your profile, warms the
fixed registry origins, and writes a refresh-state file. The state file records
only metadata such as `last_refresh_at`, per-origin readiness, and error type.
It does not contain credential material.

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

## Important Safety Rules

- Code can be shared. Login state must not be shared.
- Your profile stays on your own machine and must not be committed to git.
- The refresh state is only a readiness record and does not contain credentials.
- Token/cookie/session/header values are not read and not output.
- Do not copy another teammate's profile.
- Do not send your profile directory or refresh-state file to anyone.
- Do not commit `.env`, profile directories, state files, HAR captures,
  screenshots, or temporary captures.

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

`profile_dir_configured` is a boolean by design. The API does not echo your
local filesystem path.

## Permission Model

Whoever logs in controls what the service can read.

- If you lack permission for a platform, the action may return `auth_failed`,
  `blocked`, or a platform error.
- The service will not bypass that permission.
- The service will not perform writes or automatic disposal.
- The service will not make DataAgent/Hive calls automatically.
