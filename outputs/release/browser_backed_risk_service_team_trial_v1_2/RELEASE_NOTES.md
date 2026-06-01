# Release Notes

Version: `browser_backed_risk_service_team_trial_v1_2`

Base: v1.1 team trial release.

## Changes Since v1.1

- Added Remote Main Agent + Local Worker Mode documentation.
- Added Temporary Profile Bootstrap Mode documentation for same-user GUI
  profile activation when the eventual service machine has no GUI.
- Introduced `service_base_url` as the Agent-facing endpoint setting.
- Kept the default local value as `http://127.0.0.1:8787`.
- Clarified that local Agent / local script / curl usage does not need a bridge
  or `BROWSER_BACKED_SERVICE_BASE_URL`.
- Clarified that remote/cloud main Agents must not assume `127.0.0.1` is the
  teammate's computer.
- Added `LOCAL_WORKER_BRIDGE_PLAN.md`.
- Documented bridge/tunnel as deployment infrastructure only; no bridge/tunnel
  code is implemented in this release.
- Clarified that Temporary Profile Bootstrap Mode is not long-term action
  forwarding and is not the formal team remote-Agent deployment shape.
- Kept `action_count=19`.
- Kept the pure passthrough/transport service positioning.
- Kept Archives landing-flow activation behavior.
- Kept legacy compat/summary behavior rejected; new service work must not add
  summary, source card, source quality, evidence card, or risk judgment logic.

## Package Contents

- `service/` contains the local service source, scripts, and teammate docs.
- `skill/browser_backed_risk_service/` contains Agent calling instructions and
  action/contract references.

## Safety Boundary

The release package does not include `node_modules`, `.env`, profile/state
files, raw HAR, run logs, Chrome storage, localStorage dumps, Playwright
storageState, cookies, tokens, sessions, request headers, passwords, or private
keys.
