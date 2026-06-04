# Browser-backed Risk Service Team Trial v1.7

This release packages the Browser-backed Risk Service for team trial use.

The service is a controlled passthrough worker:

- fixed action allowlist
- typed params
- fixed origin/path
- upstream business response body passthrough
- browser-session readiness and safe transport envelope

The service does not provide summary, source cards, source quality, evidence
cards, risk judgment, DataAgent/Hive calls, arbitrary URL fetch, or write
actions.

Current callable `action_count=70`.

## Package Layout

- `service/` - runnable Node.js service package.
- `skill/browser_backed_risk_service/` - command-oriented Skill package.
- `ACTION_PLAYBOOK.md` - user-facing capability playbook.
- `CAPABILITY_INDEX.yaml` - capability-to-action mapping.
- `CONTROLLED_LIVE_SMOKE_PLAN_V1_7.md` - current live-smoke plan using recent
  seeds and dependent identifier discovery.
- `REMOTE_MAIN_AGENT_SUCCESS_PATHS.md` - verified remote-main-agent paths.
- `MAC_LOCAL_WORKER_GUIDE.md` - Mac Local Worker setup and operation guide.
- `BROWSER_BACKED_SERVICE_COMMANDS.md` - rc-cli style command workflow.

## Main Modes

Local Agent Mode:

- Agent/script/curl and service run on the same machine.
- Default `service_base_url=http://127.0.0.1:8787`.
- Run `npm run worker:start` in `service/`.

Remote Main Agent + Mac Local Worker Mode:

- Main agent runs remotely or on Linux.
- Browser-backed service and Chrome profile stay on the user's Mac.
- Run `npm run worker:start`, then `npm run worker:expose` on the Mac.
- Use the printed `service_base_url=http://<mac_ip>:9787` for daily action
  calls.

`worker:expose` forwards only:

- `GET /health`
- `GET /actions`
- `POST /actions/<allowlisted_action>`

Do not copy Mac profiles to Linux, inject cookies, inject storageState, use
`sso_session.py`, expose arbitrary URLs, or print credential material.

Install/transfer hard rule: use the Verified Install Transfer Path in
`REMOTE_MAIN_AGENT_SUCCESS_PATHS.md`. If the Linux temporary HTTP server is
unreachable, stop with `release_transfer_failed`. If Mac command approval times
out, stop with `mac_command_approval_required`. Do not switch to base64 chunks,
per-file writes, KCDN/ad hoc uploads, SSH/SCP guessing, profile copy, cookie
injection, storageState injection, or arbitrary URL fetch.

## Capability Entry Points

Use `CAPABILITY_INDEX.yaml` and `ACTION_PLAYBOOK.md` instead of memorizing all
70 action names. Supported Skill command intents include:

- `/browser-backed-risk-service 用户画像 <user_id>`
- `/browser-backed-risk-service 登录历史 <user_id>`
- `/browser-backed-risk-service 设备图谱 <user_id>`
- `/browser-backed-risk-service 作品查询 <user_id>`
- `/browser-backed-risk-service 私信样本 <user_id>`
- `/browser-backed-risk-service 资料变更 <user_id>`
- `/browser-backed-risk-service 策略事件 <eventType> <eventId>`
- `/browser-backed-risk-service action <action_name> <json_params>`

## Quick Start

```sh
cd service
npm install
npm run worker:start
npm run worker:status
```

For remote main-agent use:

```sh
npm run worker:expose
```

Configure the remote main agent with the printed `service_base_url`.
