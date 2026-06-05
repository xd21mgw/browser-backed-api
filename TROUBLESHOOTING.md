# Troubleshooting

This page covers common local setup and runtime issues for the browser-backed
risk platform access service.

Do not debug by reading Chrome cookie DBs, dumping localStorage, copying
profiles, or printing cookies/tokens/sessions/headers. The service is designed
to expose readiness and transport metadata without credential material.

Use `service_base_url` when calling the service:

- Local Agent Mode default: `http://127.0.0.1:8787`
- Remote Main Agent + Mac Local Worker Mode: a configured controlled Mac
  worker/bridge/tunnel URL, usually from `BROWSER_BACKED_SERVICE_BASE_URL`

Local users normally do not need to set `BROWSER_BACKED_SERVICE_BASE_URL`.

## Port 8787 Is Already In Use

Symptom:

- `npm run start:live` fails to bind.
- `curl http://127.0.0.1:8787/health` reaches an unexpected process.

Check:

```sh
lsof -ti tcp:8787
```

Fix:

- Stop the old local service process.
- Or set a different `PORT` for this run if your Agent/Skill is configured to
  use that port.

The normal service host is `127.0.0.1`.

If your main Agent is remote/cloud-hosted, `127.0.0.1` is the remote Agent's
machine, not the teammate's Mac. Configure the Agent's `service_base_url` to a
controlled Mac worker/bridge/tunnel URL instead of assuming direct localhost
access.

## Remote Main Agent Cannot Reach The Mac Local Worker

Symptom:

- Local `curl http://127.0.0.1:8787/health` works on the teammate's computer.
- The remote/cloud Agent cannot reach `http://127.0.0.1:8787/health`.

Meaning:

- The remote Agent is calling its own localhost, not the teammate's computer.

Fix:

- Keep the browser-backed service running on the teammate's computer.
- Run browser-backed service on the user's Mac.
- Keep the user's Mac powered on and online.
- Keep MyFlicker / Mac node client, or the approved equivalent Mac worker
  channel, online and connected.
- Make sure the Chrome profile is not locked by another Chrome/Playwright
  process.
- Configure `BROWSER_BACKED_SERVICE_BASE_URL` or the Agent's equivalent setting
  to a controlled Mac worker/bridge/tunnel URL.
- If the Mac service is already ready, run `npm run worker:expose` on the Mac
  and use the printed `service_base_url`.
- The bridge/tunnel should forward only `/health`, `/actions`, `POST /actions/batch`,
  `POST /actions/multi_source_plan`, and `/actions/<allowlisted_action>`.
- Do not expose the service directly to the public internet.
- Do not forward or upload profile files, cookies, tokens, sessions, request
  headers, localStorage, or Playwright storageState.

## release_transfer_failed

Symptom:

- The Linux/main-agent temporary HTTP server for the release tarball is not
  reachable from the Mac.

Fix:

- Stop the install attempt.
- Report `release_transfer_failed`.
- Check the temporary HTTP server address, port, and network reachability.
- Retry the verified install transfer path after the server is reachable.
- Do not switch to base64 chunks, per-file writes, KCDN/ad hoc uploads,
  SSH/SCP guessing, profile copy, cookie injection, storageState injection, or
  arbitrary URL fetch.

## mac_command_approval_required

Symptom:

- Mac node command approval times out or the user has not approved the fixed
  install/start command.

Fix:

- Stop the install attempt.
- Report `mac_command_approval_required`.
- Ask the user to approve the Mac command or manually run the fixed command
  sequence from `REMOTE_MAIN_AGENT_SUCCESS_PATHS.md`.
- Do not invent another transfer or auth-state workaround.

## mac_node_disconnected

Symptom:

- Remote main Agent cannot reach the Mac worker.
- Local Mac service may still be healthy, but the remote channel is offline.
- Skill status reports `mac_node_disconnected` or equivalent connectivity
  failure.

Meaning:

- MyFlicker / Mac node client, or the approved equivalent worker channel, is not
  connected.
- The remote main Agent cannot call the Mac local worker until the Mac node is
  online.

Fix:

- Open the MyFlicker Mac client.
- Confirm node connected.
- Confirm the browser/node permissions are normal.
- Retry `/browser-backed-risk-service 状态`.
- If needed, run on the Mac:

```sh
npm run worker:status
npm run worker:start
```

Do not change to profile copy, cookie injection, storageState injection,
`sso_session.py`, or arbitrary URL fetch.

## worker_expose_unreachable

Symptom:

- Mac service is healthy on `127.0.0.1:8787`.
- Remote main Agent cannot reach the `service_base_url` printed by
  `npm run worker:expose`.

Fix:

- Confirm `npm run worker:expose` is running or rerun it on the Mac.
- Confirm the Mac IP in `service_base_url` matches the current network.
- Confirm local firewall/VPN/internal ACL allows the test session.
- Confirm MyFlicker / Mac node, or the approved equivalent channel, is online.
- Do not replace this with profile copy, cookie injection, storageState
  injection, `sso_session.py`, or arbitrary URL fetch.

## service_not_running

Symptom:

- Mac node is connected, but `{service_base_url}/health` fails.
- Local Mac `curl http://127.0.0.1:8787/health` fails.

Fix:

```sh
npm run worker:status
npm run worker:start
```

If the service was intentionally started in foreground mode, keep the
`npm run start:live` terminal open.

## Main Agent Machine Has No GUI

Symptom:

- The remote/cloud/Linux main Agent machine cannot open a visible browser.
- `npm run open:profile` is not usable there.

Recommended fix:

- Use Remote Main Agent + Mac Local Worker Mode.
- Run `npm run open:profile`, `npm run refresh:once`, and `npm run worker:start`
  on the user's Mac.
- Complete SSO, two-factor checks, and Archives account confirmation in Mac
  Chrome.
- Configure `BROWSER_BACKED_SERVICE_BASE_URL` to the Mac worker/bridge/tunnel
  URL.

Not allowed:

- Do not copy the Mac profile to Linux headless as the team workflow.
- Do not inject cookies.
- Do not inject storageState.
- Do not use `sso_session.py`.
- Do not upload cookies, tokens, sessions, request headers, browser storage,
  storageState, or profile contents.

Why:

- Joint testing showed that Track Analysis can be ready after profile copy, but
  RCP, Weapon, Login Logs, and Archives may trigger `two_factor_required` in
  Linux headless.

## Mac Worker Daily Use Still Prompts Too Much

Symptom:

- The remote main Agent asks the user to approve many small Mac commands.
- The browser opens for every query.

Expected behavior:

- First setup can require Mac command approval and browser login.
- Daily use should reuse the running Mac worker.
- Main Agent should call `service_base_url/actions/<action_name>` instead of
  reinstalling, reopening profile, or restarting service each time.

Fix:

```sh
npm run worker:start
```

Keep the worker running for the test window. Use `npm run worker:doctor` for
diagnostics and `npm run worker:stop` when done.

## Profile Does Not Exist

Symptom:

- `/health` shows `profile_exists=false`.
- `auth_state=auth_required`.

Fix:

```sh
npm run worker:start
```

`worker:start` opens the visible profile flow if manual login is required, then
continues refresh/start after the user finishes.

If an existing browser-backed service is holding the dedicated profile,
`worker:start` stops that service process before opening the profile for manual
SSO/2FA. It does not kill daily Chrome and does not delete the profile.

If you intentionally use a custom profile path:

```sh
BROWSER_BACKED_PROFILE_DIR=/path/to/profile npm run worker:start
```

If `BROWSER_BACKED_PROFILE_DIR` is not set, the default profile is
`~/.dennis-browser-backed/profile`.

## auth_state=auth_required

Meaning:

- The profile is missing, not logged in, expired, or the browser ended on an
  auth/landing page for a required origin.

Fix:

1. Run `npm run worker:start`.
2. If prompted, complete SSO and any landing steps in the visible browser.
3. Check `/health` again.

Do not inspect cookies or tokens to debug this. Use the browser UI and the
sanitized `origin_status` fields.

## refresh:once Fails

Symptom:

- `npm run refresh:once` exits non-zero.
- Output has `ok=false`.

Check:

- Required origins: `rcp`, `weapon`, `login_logs`, `track_analysis`.
- Optional origins such as `archives` may record `optional_failed` without
  making refresh fail.
- Look at each origin's `status`, `page_ready`, `final_origin`, and
  `error_type`.

Common fixes:

- Run `npm run worker:start` to let the worker route to open-profile if needed.
- Run `npm run worker:doctor` if a profile lock is suspected. The service should
  use the dedicated browser-backed profile, not the daily Chrome profile, and
  worker scripts do not automatically close or kill Chrome.
- Check whether your account has permission to that internal platform.
- Check network/VPN access.

## Origin Not Ready

Useful fields:

- `status`
- `page_ready`
- `final_origin`
- `error_type`
- `last_error_type`

Typical meanings:

| status/error | Meaning |
| --- | --- |
| `auth_required` / `auth_redirect` / `login_page` | Login or landing flow did not finish in this profile. |
| `manual_login_required` | Browser reached a page that requires human login or account input. |
| `auth_flow_not_completed_in_bound_context` | Browser stayed on the fixed origin but did not finish the bounded landing flow. |
| `two_factor_required` / `captcha_required` | 2FA, QR, captcha, or another human challenge is required. |
| `failed` | Required origin failed due to timeout, network, origin mismatch, or other refresh failure. |
| `optional_failed` | Optional origin failed; this is recorded but does not fail required-origin readiness. |
| `navigation_timeout` | Platform page did not load within timeout. |
| `origin_mismatch` | Browser landed outside the configured fixed origin. |
| `network_error` | Local browser/network could not reach the platform. |

## Archives Center Landing Flow

Symptom:

- Archives actions return `auth_flow_not_completed_in_bound_context`.
- `/prewarm` or `refresh:once` shows Archives not ready while other origins are
  ready.

Meaning:

- Archives may have reached its configured origin or the account confirmation
  origin but stayed on a lightweight account-confirmation page.
- This can recur every 2-3 hours even when the Chrome profile and platform auth
  state are otherwise usable.
- This is not a no-data result and not a risk conclusion.

What the service tries automatically:

- During `refresh:once`, `/prewarm`, refresh daemon, or action-stage
  ensure-ready before the fixed fetch.
- At most two clicks.
- Only lightweight labels: `下一步`, `继续`, `确认`, `进入系统`, `登录`,
  `Continue`, `Next`, `Confirm`.
- Safe control candidates include `button`, `input[type=submit]`,
  `input[type=button]`, `a[role=button]`, `[role=button]`, a form with one
  matching submit control, or a visible clickable text element with an
  allowlisted label.
- The username/account must already be present or prefilled. The service does
  not fill it.
- No password, OTP, QR, captcha, localStorage, cookie, token, session, or header
  is read or output.

When it stops:

- password input is present
- OTP / 2FA / QR / captcha is present
- username or account input needs manual entry
- permission-blocked text appears
- the same confirmation page remains after the click limit
- diagnostics show `allowlisted_clickable_control_present=false`

Fix:

```sh
npm run open:profile
```

Finish the Archives page manually in the visible browser, then run:

```sh
npm run refresh:once
```

Do not delete the profile. Do not copy another teammate's profile.

## Service Is Not Started

Symptom:

```sh
SERVICE_BASE_URL="${BROWSER_BACKED_SERVICE_BASE_URL:-http://127.0.0.1:8787}"
curl "$SERVICE_BASE_URL/health"
```

returns connection refused.

Fix:

```sh
npm run worker:start
```

For foreground debugging only, `npm run start:live` is still available.

For mock-only development:

```sh
npm run start:mock
```

## Chrome Profile Lock

Symptom:

- Playwright cannot launch persistent context.
- Chrome says the profile is in use.
- You see a `ProcessSingleton`, `SingletonLock`, or profile-in-use style error.

Safety rule:

- Browser-backed service should use the dedicated profile
  `~/.dennis-browser-backed/profile`.
- User daily Chrome profiles must not be used for this service.
- Main agents, Skills, and worker scripts must not automatically close or kill
  `Google Chrome`, `Chromium`, or browser processes.
- Daily Chrome is never killed by the agent.
- Profile locks are diagnosed and classified; user confirmation is required
  before closing anything.

You can check whether the local service is still running:

```sh
lsof -ti tcp:8787
```

For fixed worker diagnostics:

```sh
npm run worker:doctor
```

Useful explicit diagnostics:

```sh
npm run worker:doctor -- --show-profile-processes
npm run worker:doctor -- --explain-lock
```

Lock classifications:

- `daily_chrome_profile_in_use`: the configured profile points at the user's
  normal Chrome profile. Do not close daily Chrome. Reconfigure
  `BROWSER_BACKED_PROFILE_DIR` to `~/.dennis-browser-backed/profile`.
- `dedicated_profile_live_lock`: the browser-backed dedicated profile is in use,
  usually by `open:profile`, `worker:start`, `start:live`, or a Playwright
  remnant. The agent does not kill it; ask the user to close the browser-backed
  profile window or stop the owning worker.
- `stale_profile_lock`: lock files exist under the dedicated profile but the
  recorded PID is not live. `worker:start` automatically clears only these
  dedicated stale lock files, then continues refresh/start. If auto-clear
  fails, it returns `service_ready=false`, `lock_type=stale_profile_lock`, and a
  recovery `next_step`.
- `unknown_lock`: the profile source or PID state cannot be trusted. Stop and
  ask the user to inspect. Do not delete files or kill Chrome.

The explicit stale-lock cleanup command remains available for diagnosis or
manual recovery. It is allowed only for stale locks under the dedicated
browser-backed profile:

```sh
npm run worker:doctor -- --clear-stale-lock
npm run worker:start
```

`stale_profile_lock` is recoverable only when it is the dedicated stale-lock
case. Dennis and other runners must not continue live source calls while
`service_ready=false`.

You can also inspect obvious local Chrome/Playwright processes without reading
the profile contents:

```sh
pgrep -fl "chrome|Chromium|playwright|start:live|refresh:daemon|open-profile" || true
```

This command is inspect-only. Do not run `killall Chrome`, `pkill Chrome`,
`osascript quit app "Google Chrome"`, or any equivalent automatic browser
shutdown from an Agent or Skill.

## Action Returns blocked/auth_failed/network_error

Meaning:

- `blocked`: platform/readiness failure state, not a runtime crash.
- `auth_failed`: login state or permission flow did not complete.
- `network_error`: browser fetch failed before a useful platform response.

Fix:

- Check `/health` and `/prewarm`.
- Re-run `npm run worker:start`.
- Confirm you personally have permission for the platform.

These states are not no-risk conclusions. Preserve the service `error_type`,
transport fields, and `safety` envelope fields for upper-layer handling.

## Legacy Response Mode Is Rejected

Symptom:

- Any action returns `parameter_error` or `invalid_parameter` when called with a
  legacy response mode.

Meaning:

- All actions are passthrough-only by design.
- The service does not generate business summaries, observations, evidence
  cards, no-data interpretation, source scoring, or risk judgments.

Fix:

```json
{
  "response_mode": "passthrough"
}
```

Check `ACTION_REGISTRY.md` for each action's `response_mode_support`.

## Action Is Not In The Allowlist

Symptom:

- `POST /actions/<action_name>` returns an unknown-action style error.
- `GET /actions` does not list the action.

Meaning:

- The service only accepts fixed allowlisted actions from `src/actions.js`.
- Passthrough mode does not allow arbitrary platform URLs, paths, or HAR
  requests.

Fix:

- Use `GET /actions` or `ACTION_REGISTRY.md` to find a callable action.
- If the action is `inventory_pending` or missing, it needs fixed path, typed
  params, mock tests, and live smoke before it can be added.

## Re-Open Profile For Login

Ordinary users should run:

```sh
npm run worker:start
```

The worker opens the profile flow only if manual interaction is required. For
advanced manual debugging, run:

```sh
npm run open:profile
```

## Confirm No Credential Material Is Output

Expected boundaries:

- No cookie values.
- No token values.
- No session values.
- No request headers.
- No authorization strings.
- No raw browser storage dumps.

The service reports only sanitized metadata such as readiness, origin status,
latency, error type, transport status, or body-presence metadata.
`sensitive_output=false` or
`safety.credential_material_output=false` means no credential secret or raw
browser/profile material was returned; it does not make a risk conclusion about
the requested entity.

If any response appears to contain cookie, token, session, authorization,
password, request header, localStorage, or profile-storage content, stop using
that output and treat it as a service bug.

## Use ACTION_REGISTRY To Choose Actions

`ACTION_REGISTRY.md` is the service-layer source of truth for:

- action name
- origin key
- method
- fixed path
- typed params
- passthrough support
- mock and live smoke status
- open status
- safety boundary

It does not define how an Agent should interpret platform data.

## Why Some Capabilities Are Not Open

A platform request may be excluded because it is:

- `excluded_noise`: telemetry, radar/misc/log collection, log-sdk, static
  assets, h5-fingerprint, mobile-device-info, or config/menu noise.
- `inventory_pending`: evidence value or bounded typed contract is not ready.
- `contract_ready`: implementation exists but should not be called by default.
- `beta`: useful evidence exists but requires explicit trigger and caution.
- Permission-bound: your own account may not have access.

Agent/Skill should consult `RISK_SOURCE_CAPABILITY_REGISTRY.md` before choosing
non-stable capabilities.

## Still Blocked

Collect only sanitized information:

- command run
- exit code
- `/health` summary
- origin key
- `status`
- `page_ready`
- `auth_state_expired`
- `origin_ready_state_stale`
- `origin_freshness_age_ms`
- `origin_freshness_ttl_ms`
- `final_origin`
- `error_type`

Do not share profile directories, refresh-state files, `.env`, cookies, tokens,
sessions, headers, screenshots with sensitive content, or full raw upstream
response bodies.

## ready But Stale

`origin_status.<origin>.status=ready` and `page_ready=true` only mean the bound
browser page is still on the expected platform origin. They do not prove the API
session is fresh. Check `/health` for:

- `auth_state_expired`
- `origin_ready_state_stale`
- `origin_freshness_age_ms`
- `origin_freshness_ttl_ms`

If an action reports `auth_state_expired_or_api_session_not_ready` or
`safe_reason=origin_ready_state_stale`, do not treat the result as `no_data`.
Run `npm run worker:start`; it will bounded-refresh/rewarm the target origin or
ask for manual login if password, 2FA, QR, or captcha is required.

If `/health` reports `pending_manual_login=true`, do not continue live source
calls. The recovery path is `npm run worker:start`; the service will open the
profile flow only for user interaction and then refresh/start again.

## login_logs_search Returns HTML Or Times Out

The unified login logs workbench can become idle even while the page is still on
the correct origin. A stale page may stop reacting to new user searches until it
is refreshed. For this action, service-side `ready` therefore means both
origin/auth freshness and a fresh login-logs page session.

Before `login_logs_search`, the service refreshes the login logs workbench page
session and then calls the fixed API. If the API call returns a workbench HTML
shell or hits `api_fetch_timeout`, the service refreshes that page session once
and retries the same fixed action. If it still returns HTML, the action reports
`error_type=login_logs_page_context_stale` with
`safe_reason=html_response_not_business_json`. This is not `no_data`; rerun
`npm run worker:start` or manually refresh/complete the login logs workbench
only if the action also reports auth/manual-login fields.

For passthrough smoke, record only:

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
