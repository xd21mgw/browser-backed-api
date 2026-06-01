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
  - `Continue`
  - `Next`
  - `Confirm`

`src/browser.js` now checks same-origin Archives warmup pages during prewarm.
If a lightweight confirmation page is detected and no manual-auth challenge is
present, it clicks an allowlisted control and waits for the page to settle.

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

Business action execution does not trigger this repair path. If an Archives
action still returns `auth_flow_not_completed_in_bound_context`, the user should
run `npm run open:profile` and complete the landing page manually.

## Mock Coverage

Added or updated tests cover:

- Archives same-origin lightweight confirmation with prefilled username and
  `下一步` button succeeds during prewarm.
- Archives password page returns `manual_login_required`.
- Archives OTP / captcha / QR pages stop for manual handling.
- Archives lightweight confirmation stops after the click limit.
- Archives business action execution does not trigger landing-flow activation.
- No credential material appears in outputs.

## Live Smoke

Profile used:

```txt
BROWSER_BACKED_PROFILE_DIR=/Users/pengcheng/chrome-agent-auth-profile
```

Commands run:

- `npm run refresh:once`
- `npm run start:live`
- `POST /prewarm`
- `POST /actions/archives_user_profile` with `response_mode=passthrough`

Sanitized result:

| check | result |
| --- | --- |
| `refresh:once` | `ok=true`, required origins ready |
| Archives refresh status | `optional_failed` |
| Archives final_origin | `https://account.p.adm-corp.kuaishou.com` |
| Archives page_ready | `false` |
| Archives error_type | `manual_login_required` |
| Archives prewarm landing_flow_status | `manual_login_required` |
| Archives landing_flow_root_cause | `manual_login_required` |
| allowed_clicks_executed | `0` |
| username input present | `true` |
| username prefilled | `true`; value not read or output |
| password input present | `false` |
| OTP / 2FA signal | `false` |
| captcha signal | `false` |
| QR signal | `false` |
| permission blocked signal | `false` |

Archives action smoke:

| field | value |
| --- | --- |
| action | `archives_user_profile` |
| response_mode | `passthrough` |
| HTTP status | `200` |
| ok | `false` |
| error_type | `manual_login_required` |
| upstream body output | `false` |
| source_card/source_quality | absent |
| credential_material_output | `false` |

Conclusion:

The current local profile reaches an account confirmation/login origin for
Archives but does not expose an allowlisted lightweight confirmation button. The
service correctly stops and reports `manual_login_required`. The user should run
`npm run open:profile`, complete the Archives step manually in the visible
browser, then rerun `npm run refresh:once`.
