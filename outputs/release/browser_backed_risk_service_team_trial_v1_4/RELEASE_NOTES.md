# Release Notes

Version: `browser_backed_risk_service_team_trial_v1_4`

## Changes Since v1.3 / v1.2

- Removed Temporary Profile Bootstrap Mode as a recommended path.
- Kept Local Agent Mode as the default local mode.
- Optimized Remote Main Agent + Mac Local Worker Mode as the recommended
  remote-main-agent deployment.
- Documented that Mac profile copy/bootstrap to Linux headless can trigger
  `two_factor_required` for RCP, Weapon, Login Logs, and Archives and is not a
  team workflow.
- Added rc-cli style Skill-managed workflow:
  - 安装
  - 启动
  - 状态
  - actions
  - 调用
  - 停止
  - 排障
- Added `MAC_LOCAL_WORKER_GUIDE.md`.
- Added `BROWSER_BACKED_SERVICE_COMMANDS.md`.
- Kept `action_count=19`.
- Kept pure passthrough/transport service positioning.
- Kept Archives landing-flow activation behavior.
- No summary, source card, source quality, evidence card, no-data
  interpretation, risk judgment, DataAgent/Hive call, or platform write logic
  was added.

## Package Contents

- `service/` contains the local/Mac worker service source, scripts, and teammate
  docs.
- `skill/browser_backed_risk_service/` contains the command-oriented Agent Skill
  and action/contract references.

## Safety Boundary

The release package does not include `node_modules`, `.env`, profile/state
files, raw HAR, run logs, Chrome storage, localStorage dumps, Playwright
storageState, cookies, tokens, sessions, request headers, passwords, or private
keys.
