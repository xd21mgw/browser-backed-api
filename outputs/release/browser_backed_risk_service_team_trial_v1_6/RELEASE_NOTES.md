# Release Notes

Version: `browser_backed_risk_service_team_trial_v1_6`

## Changes Since v1.5

- Made `npm run worker:start` the single ordinary daily command.
- `worker:start` now auto-routes refresh/start/open-profile:
  - ready service returns ready without duplicate start
  - missing service refreshes once before start
  - non-ready auth runs refresh once
  - manual auth requirements open the visible profile flow, then continue
    refresh/start
- `refresh:daemon` keeps the 4-hour default refresh cadence.
- Added `REFRESH_INTERVAL_MINUTES` override for `refresh:daemon`.
- `refresh:daemon` records `pending_manual_login` for manual auth states and
  asks users to run `npm run worker:start`; it does not bypass auth and does
  not repeatedly open browsers.
- Clarified docs and Skill workflow so ordinary users do not need to memorize
  `open:profile`, `refresh:once`, or `start:live`.
- Kept Local Agent Mode and Remote Main Agent + Mac Local Worker Mode.
- Kept pure passthrough service positioning.
- Kept `action_count=37`.
- No summary, source card, source quality, evidence card, no-data
  interpretation, risk judgment, DataAgent/Hive call, arbitrary URL fetch, or
  platform write logic was added.

## Package Contents

- `service/` contains the local/Mac worker service source, scripts, and teammate
  docs.
- `skill/browser_backed_risk_service/` contains the command-oriented Agent Skill
  and action/contract references.

## Safety Boundary

The release package does not include `node_modules`, `.env`, profile/state
files, auth-state files, raw HAR, run logs, Chrome storage, localStorage dumps,
Playwright storageState, cookies, tokens, sessions, request headers, passwords,
or private keys.
