# Mac Local Worker Guide

Use this guide when the main Agent runs remotely or on Linux, but the
browser-backed risk service should access risk platforms through the user's Mac
Chrome profile.

## When To Use

Use Mac Local Worker Mode for remote/cloud/Linux main Agents.

- Main Agent is remote.
- Browser-backed service runs on the user's Mac.
- Chrome profile stays on the user's Mac.
- User completes SSO, two-factor checks, and Archives account confirmation in
  the Mac GUI.
- Main Agent calls the Mac service through Mac node, bridge, or tunnel.
- The user's Mac stays powered on and connected to the network while the remote
  main Agent is using the service.
- MyFlicker / Mac node client, or the approved equivalent Mac worker channel,
  stays online and connected.
- The Chrome profile is not locked by another Chrome/Playwright process.

MyFlicker / Mac node lets the remote main Agent run controlled status/action
calls on the Mac or reach the Mac worker `service_base_url`. It does not read
cookies, tokens, sessions, request headers, profile files, or browser storage,
and it does not replace the browser-backed service.

Do not use Mac profile copy to Linux headless as the normal workflow. Joint
testing showed that RCP, Weapon, Login Logs, and Archives can trigger
`two_factor_required` after profile bootstrap to Linux.

## Start The Service On Mac

If the release package must be transferred from a remote/Linux main-agent
workspace, follow `REMOTE_MAIN_AGENT_SUCCESS_PATHS.md`. The verified fallback is
Linux temporary HTTP server plus Mac `curl`; do not improvise base64 chunks,
per-file writes, KCDN/ad hoc uploads, SSH/SCP guessing, profile copy,
`sso_session.py`, cookie injection, storageState injection, arbitrary URL fetch,
or profile/state/auth-state transfer. If the HTTP server is unreachable, report
`release_transfer_failed` and stop. If Mac command approval times out, report
`mac_command_approval_required` and stop.

Unpack the release on the Mac and enter the service directory:

```sh
cd browser_backed_risk_service_team_trial_v1_7/service
```

Install dependencies:

```sh
npm install
```

Start the worker:

```sh
npm run worker:start
```

`worker:start` is the ordinary daily command. It reuses a ready service, runs
`refresh:once` before starting when needed, and opens the visible Mac browser
only when SSO, two-factor checks, QR, captcha, or Archives/account confirmation
requires a user. It prints `service_base_url=http://127.0.0.1:8787`, a pid
file, and a log file. It does not read or output authentication material.

Advanced commands remain available for manual debugging:

```sh
npm run open:profile
npm run refresh:once
```

For a foreground service during debugging, `npm run start:live` is still valid;
keep that terminal open while the remote main Agent is using the Mac worker.

## Daily Use

After first setup, daily queries should not reopen the browser and should not
ask for repeated command approvals.

Recommended daily flow:

```sh
npm run worker:start
```

- If service is already running, `worker:start` prints a health summary and does
  not start a second service.
- If service is not running, `worker:start` refreshes once and then starts it.
- If manual login is required, `worker:start` opens the profile flow and
  continues after the user completes it.
- If the already-running browser-backed service is holding the dedicated
  profile, `worker:start` stops that service process first so the profile can be
  opened for manual SSO/2FA. It does not kill daily Chrome.
- Main Agent calls `service_base_url/actions/<action_name>`.
- The service reuses the existing Mac profile.
- The service returns a passthrough transport envelope.
- The service does not output full upstream body.
- MyFlicker / Mac node must remain connected. If it disconnects, the remote
  main Agent cannot reach the Mac worker even when the local service is healthy.
- If MyFlicker / Mac node disconnects, open the MyFlicker Mac client, confirm
  node connected, and retry the Skill status command.

If readiness expires, refresh/prewarm/ensure-ready attempts lightweight landing
flow activation. If the page is only username prefilled plus `Next`,
`Continue`, or `Confirm`, the service can handle it. If password, 2FA, QR, or
captcha appears, `worker:start` opens the profile flow for manual recovery.
Origin `ready` is not identical to API-session `fresh`. `/health` exposes
`auth_state_expired`, `origin_ready_state_stale`, and per-origin freshness
age/TTL. Before a fixed action runs, the service rewarms stale target origins;
if rewarm needs manual login, the action is blocked instead of returning an
HTML page shell as business data.

`login_logs_search` has one extra page-session guard. The user-center workbench
page can become idle after sitting unused: typing a new `user_id` and clicking
search may do nothing until the page is refreshed. The service refreshes the
login logs page session before this fixed action. If the fixed API returns a
workbench HTML shell or times out, it refreshes the page session once and retries
the same action. A second HTML shell is reported as
`login_logs_page_context_stale`, not as `no_data`.

## Expose A Low-Approval Worker URL

After the local service is running, expose a constrained Mac worker URL:

```sh
npm run worker:expose
```

`worker:expose` prints:

- `proxy_status`
- `local_service=http://127.0.0.1:8787`
- `service_base_url=http://<mac_ip>:9787`
- `action_count`
- `auth_state`
- `allowed_paths`
- `security_todo`

Use that printed `service_base_url` for the remote main Agent. Do not hardcode
one observed Mac IP; it can change by network.

The proxy forwards only:

- `GET /health`
- `GET /actions`
- `POST /actions/batch`
- `POST /actions/multi_source_plan`
- `POST /actions/<allowlisted_action>`

Daily action calls should use this HTTP path instead of asking Mac node to run
a new curl command for every action.

## Check On Mac

From another Mac terminal:

```sh
curl http://127.0.0.1:8787/health
curl http://127.0.0.1:8787/actions
```

Expected:

- `/health ok=true`
- `auth_state=ready`, or the needed origin is ready
- `action_count=70`
- no credential material output

Or use:

```sh
npm run worker:status
```

## Main Agent Calling Pattern

The remote main Agent should call the configured Mac worker URL:

```txt
{service_base_url}/health
{service_base_url}/actions
{service_base_url}/actions/<action_name>
```

`service_base_url` should point to the Mac node worker, bridge, or tunnel URL.
For example:

```sh
BROWSER_BACKED_SERVICE_BASE_URL=<bridge_or_mac_worker_url>
```

Before action calls, the main Agent should verify:

- Mac node connected.
- `{service_base_url}/health` reachable.
- `{service_base_url}/actions` returns `action_count=70`.
- Required origin readiness is acceptable for the intended action.

When recording smoke results, capture only envelope fields:

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

Do not paste full upstream body.

## Bridge/Tunnel Boundary

The bridge/tunnel may forward only:

- `GET /health`
- `GET /actions`
- `POST /actions/<allowlisted_action>`

It must not expose:

- arbitrary URL fetch
- arbitrary platform path access
- Chrome profile files
- cookie/token/session/header values
- request headers
- localStorage or browser storage
- Playwright storageState
- `.env` files

The bridge/tunnel should have access control such as internal ACL, temporary
token, user confirmation, or an equivalent deployment guard.

If the bridge, tunnel, MyFlicker client, or Mac node is offline, fix that
connectivity first. Do not switch to Chrome profile copy to Linux, cookie
injection, storageState injection, or `sso_session.py`.

## Stop The Mac Service

If started with `worker:start`:

```sh
npm run worker:stop
```

If started in the foreground, stop the `npm run start:live` terminal with Ctrl+C.

Check whether port 8787 is still listening:

```sh
lsof -ti tcp:8787
```

If a profile lock appears, do not close or kill daily Chrome from the Agent.
Use:

```sh
npm run worker:doctor
npm run worker:doctor -- --show-profile-processes
```

for Node/npm, install, profile path, profile lock, and port diagnostics.

`worker:doctor` classifies locks as `daily_chrome_profile_in_use`,
`dedicated_profile_live_lock`, `stale_profile_lock`, or `unknown_lock`.

- Daily Chrome profile: do not close daily Chrome; fix `BROWSER_BACKED_PROFILE_DIR`.
- Dedicated live lock: ask the user to close the browser-backed profile window
  or stop the owning worker.
- Stale dedicated lock: `worker:start` automatically clears stale lock files
  only when they are under `~/.dennis-browser-backed/profile` and the recorded
  PID is not live, then continues refresh/start.
- If stale auto-clear fails, `worker:start` reports `service_ready=false` and a
  blocking issue; remote runners must stop instead of calling live sources.
- Unknown lock: stop and ask the user to inspect.

Do not delete the profile. Do not run `killall Chrome`, `pkill Chrome`, or
`osascript quit app "Google Chrome"`.

## Safety Rules

- Do not copy the Mac profile to Linux as the team workflow.
- Do not upload cookie/token/session/header values.
- Do not read Chrome cookie DB.
- Do not use storageState injection.
- Do not use `sso_session.py`.
- Do not open arbitrary URL fetch.
- Do not expose the Mac service directly to the public internet.
- Do not let the Agent read profile files.
- Do not let the Agent automatically close or kill daily Chrome.

## Auth State Transfer POC

Auth State Transfer is a candidate POC, not the current recommended mode. It
may reduce dependency on a long-running Mac worker if a same-user bounded state
can be safely activated on Mac and loaded by the main Agent machine.

This release does not implement the full Auth State Transfer runtime. Until the
POC is proven, Mac Local Worker remains the stable remote-main-agent path.
