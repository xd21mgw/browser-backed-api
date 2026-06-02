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
  - 自测用户
  - 调用
  - 停止
  - 排障
- Added `/browser-backed-risk-service 自测用户 <user_id>` as the one-command
  user self-test workflow.
- Clarified that main-Agent field extraction, tables, evidence-package
  summaries, and next-step suggestions are main-Agent processing over returned
  envelopes, not browser-backed service output.
- Clarified Remote Main Agent + Mac Local Worker online dependencies:
  - user Mac powered on and online
  - browser-backed service running
  - MyFlicker / Mac node connected
  - Chrome profile not locked
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
