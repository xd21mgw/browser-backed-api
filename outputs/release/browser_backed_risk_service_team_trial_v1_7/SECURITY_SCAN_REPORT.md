# Security Scan Report

Release: `browser_backed_risk_service_team_trial_v1_7`

Status: passed.

File count: 44.

Checks completed:

- no `node_modules`
- no `.env`
- no `.ks_sso`
- no Chrome profile directories
- no refresh state/auth-state data files
- no cookie/token/session/header/authorization/password data files
- no raw HAR files
- no `outputs/full_runtime`
- no run logs
- no Chrome storage, localStorage dumps, or Playwright storageState files
- no private keys
- no credential-assignment-like values in package content

Notes:

- `AUTH_STATE_TRANSFER_POC.md` is documentation, not an auth-state file.
- `src/authState.js`, `scripts/open-profile.js`, and
  `scripts/refresh-profile.js` are source files. They do not contain local
  profile contents or credential material.
- Documentation may mention words such as cookie, token, session, header, and
  auth-state as part of safety-boundary text. Those mentions are not credential
  material.
