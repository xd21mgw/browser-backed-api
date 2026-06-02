# Security Scan Report

Version: `browser_backed_risk_service_team_trial_v1_5`

Status: pass

Scan results:

- file count: 36
- trailing whitespace: pass
- forbidden filename scan: pass
- credential-assignment-like content scan: pass
- packaged service syntax check: pass

Allowed documentation terms include cookie, token, session, header,
authorization, password, and auth-state when used only to describe safety
boundaries.

Allowed source/doc names such as `AUTH_STATE_TRANSFER_POC.md`,
`open-profile.js`, and `authState.js` are not auth material. No actual
profile/state/auth-state artifact, cookie/token/session/header file, raw HAR,
run log, storage dump, or private key was found in the release package.
