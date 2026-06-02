# Release Notes

Version: `browser_backed_risk_service_team_trial_v1_5`

## Changes Since v1.4

- Strengthened Mac Local Worker Mode as the current stable path for remote main
  Agents.
- Clarified that daily use should not open a browser every time.
- Added lower-friction Mac worker commands:
  - `worker:start`
  - `worker:status`
  - `worker:stop`
  - `worker:doctor`
- Kept the rc-cli style Skill-managed workflow:
  - 安装
  - 启动
  - 状态
  - actions
  - 调用
  - 停止
  - 排障
- Kept Local Agent Mode.
- Removed Temporary Profile Bootstrap as a recommended path.
- Added `AUTH_STATE_TRANSFER_POC.md`.
- Documented Auth State Transfer as a candidate POC: not assumed to succeed,
  not assumed to fail, and not promoted until validated.
- Kept `action_count=19`.
- Kept pure passthrough/transport service positioning.
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
