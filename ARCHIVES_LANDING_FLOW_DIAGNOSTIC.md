# Archives Landing Flow Diagnostic

Date: 2026-06-01

## Scope

This diagnostic covers the Archives Center failure:

```txt
auth_flow_not_completed_in_bound_context
```

The service remains a controlled passthrough access service. It does not read or
output cookies, tokens, sessions, request headers, authorization values,
passwords, Chrome profile files, localStorage, Playwright storage state, or raw
browser storage. It does not make risk judgments or no-data conclusions.

## Archives Origin Configuration

| field | value |
| --- | --- |
| origin_key | `archives` |
| label | `Archives Center` |
| env var | `ARCHIVES_ORIGIN` |
| default_origin | `https://admin.p.adm-corp.kuaishou.com` |
| warmup path | `/frontend/archives/index.html` |
| enabled | `true` |
| requiredForHealth | `false` |
| requiredForRefresh | `false` |
| optional | `true` |
| refresh TTL | `4h` |

Related actions:

- `archives_user_analysis`
- `archives_user_profile`
- `archives_photo_search`
- `archives_related_users`
- `archives_private_message_search`
- `archives_past_four_items`

## Existing Landing Flow Handling Before Fix

Files checked:

- `src/browser.js`
- `src/authState.js`
- `src/service.js`
- `scripts/refresh-profile.js`
- `scripts/open-profile.js`
- `src/originRegistry.js`
- `src/actions.js`
- `test/mock.test.js`

Before this fix, `BrowserBackedClient.prewarmDomain()` only ran the landing-flow
click handler when navigation ended on a known auth redirect origin such as SSO
or account-center. It did not inspect same-origin Archives pages for a
lightweight account-confirmation page.

That meant Archives could reach `https://admin.p.adm-corp.kuaishou.com`, be
marked as origin-ready, and still have business API calls return an Archives
body-level redirect code. The action response builder then classified that
body-level redirect as `auth_flow_not_completed_in_bound_context`.

## Error Source

The error is produced in `src/actions.js` by fixed-shape Archives response
handling when an Archives upstream body contains a redirect-like API code such
as `302`.

Layer classification:

| layer | finding |
| --- | --- |
| browser/prewarm | Previously missed same-origin Archives confirmation pages. |
| refresh state | Could record Archives as ready if only origin matched. |
| action execution | Did not repair login in business action execution, by design. |
| action result | Correctly classified Archives body-level redirect as `auth_flow_not_completed_in_bound_context`. |

The misleading part was not the action classification itself. The gap was that
prewarm did not try the controlled same-origin lightweight confirmation before
business actions were called.

## Root Cause Classification

Static diagnosis:

```txt
lightweight_confirm_needed
```

Reasoning:

- Archives actions reached the configured Archives origin.
- The failure appeared as an Archives body-level redirect, not as a raw network
  error or arbitrary-origin redirect.
- This matches a same-origin account confirmation page more than missing data.
- The existing code lacked an Archives-specific same-origin landing-flow
  activation path.

The implementation still fail-closes to manual handling for these cases:

- `manual_login_required`
- `password_required`
- `two_factor_required`
- `captcha_required`
- `permission_blocked`
- `origin_mismatch`
- `unknown`

## Controlled Observation Policy

When observing a same-origin Archives landing page, the service may record only
sanitized readiness metadata:

- final origin
- current URL path without query or hash
- whether a page title exists, not title text
- allowlisted visible button labels
- whether a username/account input exists
- whether that username/account input is prefilled, without outputting value
- whether an allowlisted clickable control exists, and its control kind
- whether password / OTP / 2FA / QR / captcha / permission-blocked signals exist

It must not output:

- account name or username value
- request headers
- response `set-cookie`
- cookies, tokens, sessions, authorization, passwords
- Chrome profile files
- localStorage / browser storage dumps
- Playwright storage state

## Fix Applied

Archives origin now has a same-origin landing-flow activation policy in
`src/originRegistry.js`:

- enabled only for `archives`
- max clicks: `2`
- allowed labels:
  - `下一步`
  - `继续`
  - `确认`
  - `进入系统`
  - `登录`
  - `Continue`
  - `Next`
  - `Confirm`

`src/browser.js` now checks same-origin and account-origin Archives readiness
pages during prewarm, refresh, and action-stage ensure-ready. If a lightweight
confirmation page is detected and no manual-auth challenge is present, it clicks
an allowlisted control and waits for the page to settle.

The controlled click detector accepts only these safe candidates:

- `button`
- `input[type=submit]`
- `input[type=button]`
- `a[role=button]`
- `[role=button]`
- a form with exactly one allowlisted submit control
- a visible clickable text element whose text contains an allowlisted label

Successful activation records:

- `page_ready=true`
- `landing_flow_status=completed`
- `landing_flow_root_cause=lightweight_confirm_needed`

Manual-auth or blocked cases record:

- `page_ready=false`
- `landing_flow_status=manual_login_required` or `blocked`
- `error_type=manual_login_required`, `two_factor_required`,
  `captcha_required`, `permission_blocked`, or
  `auth_flow_not_completed_in_bound_context`

Business action response parsing does not trigger this repair path after an API
body has already returned. The action-stage origin readiness check may run the
same bounded activation before fetch. If an Archives action still returns
`auth_flow_not_completed_in_bound_context` or `manual_login_required`, the user
should run `npm run open:profile` only when diagnostics show no safe
allowlisted control, empty username, password, OTP, QR, captcha, or permission
blocking.

## Mock Coverage

Added or updated tests cover:

- Archives same-origin lightweight confirmation with prefilled username and
  `下一步` button succeeds during prewarm.
- Archives account-origin lightweight confirmation succeeds for `button`,
  `input[type=submit]`, `a[role=button]`, `[role=button]`, and unique form
  submit controls.
- Archives password page returns `manual_login_required`.
- Archives OTP / captcha / QR pages stop for manual handling.
- Archives lightweight confirmation stops after the click limit.
- Archives action-stage ensure-ready uses the same bounded handler, while
  business response parsing still does not repair login after an API response.
- No credential material appears in outputs.

## Live Smoke

Profile used:

```txt
BROWSER_BACKED_PROFILE_DIR=/Users/pengcheng/chrome-agent-auth-profile
```

Commands run:

- `npm run refresh:once`
- `npm run start:live`
- `GET /health`
- `POST /prewarm`
- `POST /actions/archives_user_profile` with `response_mode=passthrough`
- `POST /actions/archives_private_message_search` with
  `response_mode=passthrough`

Sanitized result:

| check | result |
| --- | --- |
| `refresh:once` | `ok=true`, required origins ready |
| service health | `ok=true`, `service_mode=live`, `auth_state=ready` |
| Archives refresh status | `ready` |
| Archives final_origin | `https://admin.p.adm-corp.kuaishou.com` |
| Archives page_ready | `true` |
| Archives error_type | `null` |
| Archives prewarm status | `ready` |
| Archives prewarm landing_flow_status | `not_needed` |
| Archives landing_flow_root_cause | `null` |
| allowed_clicks_executed | `0` in this run |
| username input present | `false` in this run |
| username prefilled | `false` in this run; value not read or output |
| password input present | `false` |
| OTP / 2FA signal | `false` |
| captcha signal | `false` |
| QR signal | `false` |
| permission blocked signal | `false` |

Archives action smoke:

| action | HTTP status | ok | upstream.status | body_present | error_type | source_card/source_quality | credential_material_output |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `archives_user_profile` | `200` | `true` | `200` | `true` | `null` | absent | `false` |
| `archives_private_message_search` | `200` | `true` | `200` | `true` | `null` | absent | `false` |

Conclusion:

The current local profile was already ready during the latest live smoke, so no
Archives account-origin click was needed. The service reached Archives admin
origin, prewarm reported ready, and two Archives passthrough actions returned
body-present upstream envelopes without credential material or
source_card/source_quality fields.

The lightweight account-origin branch is covered by mock tests for `button`,
`input[type=submit]`, `a[role=button]`, `[role=button]`, and unique form submit
controls. If the page has a prefilled username and a newly recognized safe
control, the service should complete activation without asking the user to
rerun `open:profile`. If no safe control is found or a password/2FA/captcha/QR
challenge appears, the service must stop with `manual_login_required`.
