# Troubleshooting

This page covers common local setup and runtime issues for the browser-backed
risk platform access service.

Do not debug by reading Chrome cookie DBs, dumping localStorage, copying
profiles, or printing cookies/tokens/sessions/headers. The service is designed
to expose readiness and source-quality metadata without credential material.

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

## Profile Does Not Exist

Symptom:

- `/health` shows `profile_exists=false`.
- `auth_state=auth_required`.

Fix:

```sh
npm run open:profile
```

Finish login in the visible browser, then run:

```sh
npm run refresh:once
```

If you intentionally use a custom profile path:

```sh
BROWSER_BACKED_PROFILE_DIR=/path/to/profile npm run open:profile
BROWSER_BACKED_PROFILE_DIR=/path/to/profile npm run refresh:once
BROWSER_BACKED_PROFILE_DIR=/path/to/profile npm run start:live
```

If `BROWSER_BACKED_PROFILE_DIR` is not set, the default profile is
`~/.dennis-browser-backed/profile`.

## auth_state=auth_required

Meaning:

- The profile is missing, not logged in, expired, or the browser ended on an
  auth/landing page for a required origin.

Fix:

1. Run `npm run open:profile`.
2. Complete SSO and any landing steps in the visible browser.
3. Run `npm run refresh:once`.
4. Check `/health` again.

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

- Run `npm run open:profile` again.
- Make sure Chrome is not holding the same profile lock.
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
| `failed` | Required origin failed due to timeout, network, origin mismatch, or other refresh failure. |
| `optional_failed` | Optional origin failed; this is recorded but does not fail required-origin readiness. |
| `navigation_timeout` | Platform page did not load within timeout. |
| `origin_mismatch` | Browser landed outside the configured fixed origin. |
| `network_error` | Local browser/network could not reach the platform. |

## Service Is Not Started

Symptom:

```sh
curl http://127.0.0.1:8787/health
```

returns connection refused.

Fix:

```sh
npm run start:live
```

For mock-only development:

```sh
npm run start:mock
```

## Chrome Profile Lock

Symptom:

- Playwright cannot launch persistent context.
- Chrome says the profile is in use.
- You see a `ProcessSingleton`, `SingletonLock`, or profile-in-use style error.

Fix:

- First confirm whether this profile is already used by `npm run start:live`,
  `npm run refresh:daemon`, `npm run open:profile`, a previous refresh command,
  or a normal Chrome window.
- Close or stop the process that is using the same profile, then retry.
- Use a dedicated `BROWSER_BACKED_PROFILE_DIR`.
- Do not copy another person's profile.
- Do not delete the profile directory to fix a lock unless you have separately
  confirmed it is disposable test data.

You can check whether the local service is still running:

```sh
lsof -ti tcp:8787
```

You can also inspect obvious local Chrome/Playwright processes without reading
the profile contents:

```sh
pgrep -fl "chrome|Chromium|playwright|start:live|refresh:daemon|open-profile" || true
```

## Action Returns blocked/auth_failed/network_error

Meaning:

- `blocked`: source quality or platform failure state, not a runtime crash.
- `auth_failed`: login state or permission flow did not complete.
- `network_error`: browser fetch failed before a useful platform response.

Fix:

- Check `/health` and `/prewarm`.
- Re-run `npm run refresh:once`.
- Re-run `npm run open:profile` if auth is required.
- Confirm you personally have permission for the platform.

These states are not no-risk conclusions. In `compat_summary`, preserve the
legacy diagnostic fields returned by the service. In `passthrough`, preserve the
service `error_type` and `safety` envelope fields for upper-layer handling.

## Passthrough-Only Action Rejects compat_summary

Symptom:

- A recovered action such as `archives_private_message_search` or
  `rcp_policy_detail_lookup` returns `parameter_error` or `invalid_parameter`
  when called with `response_mode=compat_summary`.

Meaning:

- The action is passthrough-only by design.
- It does not generate `source_card`, `source_quality`, evidence summaries,
  no-data interpretation, or risk judgments.

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

Run:

```sh
npm run open:profile
```

Complete SSO/login in the visible browser window and press Enter in the terminal.
Then run:

```sh
npm run refresh:once
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
latency, error type, legacy shape summaries, or passthrough upstream business
bodies. `sensitive_output=false` or
`safety.credential_material_output=false` means no credential secret or raw
browser/profile material was returned; it does not mean risk entity fields such
as `user_id`, `deviceId`, IP, `eventId`, `sourceId`, or policy codes are hidden
inside upstream business responses.

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
- `compat_summary` vs `passthrough` support
- mock and live smoke status
- open status
- safety boundary

It does not define how an Agent should interpret `upstream.body`.

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
- `final_origin`
- `error_type`

Do not share profile directories, refresh-state files, `.env`, cookies, tokens,
sessions, headers, screenshots with sensitive content, or full raw upstream
response bodies.

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
