# Security Scan Report

Generated for `browser_backed_risk_service_team_trial_v1_6`.

Expected absent categories:

- `node_modules`
- `.env`
- `.ks_sso`
- profile directories
- refresh-state or auth-state files
- cookie/token/session/header/authorization/password files
- raw HAR
- `outputs/full_runtime`
- run logs
- Chrome storage
- localStorage dumps
- Playwright storageState
- private keys

Documentation may mention cookie/token/session/header/auth-state as safety
boundary terms. It must not include real credential material.

Scan summary:

- File count: 38
- Forbidden filename scan: pass
- Trailing whitespace scan: pass
- Credential-assignment-like content scan: pass
- Package-internal service check: pass

Result: no credential material, profile/state directory, raw HAR, run log,
`node_modules`, `.env`, or `outputs/full_runtime` content is included.
