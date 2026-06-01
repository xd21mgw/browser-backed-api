# Security Scan Report

Date: 2026-06-01

Release path:

```txt
outputs/release/browser_backed_risk_service_team_trial_v1_1
```

## Expected Exclusions

The release must not contain:

- `node_modules`
- `.env`
- `.ks_sso`
- profile directories
- refresh state files
- raw HAR
- run logs
- Chrome storage
- localStorage dumps
- Playwright storage state
- private keys
- credential material files

## Scan Result

Result:

- file count: `27`
- forbidden filename scan: `pass`
- trailing whitespace scan: `pass`
- credential-assignment-like content scan: `pass`
- private-key block scan: `pass`

Documentation may contain security-boundary words such as cookie, token,
session, header, authorization, and password. Those words are allowed only as
policy text, not as credential values.
