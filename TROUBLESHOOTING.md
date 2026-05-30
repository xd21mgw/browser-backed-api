# Troubleshooting

This page covers common local setup and runtime issues for the browser-backed
risk source service.

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
```

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

Fix:

- Close other Chrome instances using the same profile.
- Use a dedicated `BROWSER_BACKED_PROFILE_DIR`.
- Do not copy another person's profile.

You can check whether the local service is still running:

```sh
lsof -ti tcp:8787
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

These states are not no-risk conclusions. Preserve `source_card` and
`source_quality` when using the result.

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
latency, error type, and shape summaries. `sensitive_output=false` means no
credential secret or raw dump was returned; it does not mean internal risk
entity identifiers are hidden in `internal_risk_review` scope.

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
sessions, headers, screenshots with sensitive content, or raw upstream response
bodies.
