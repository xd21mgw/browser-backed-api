# Browser-backed Risk Service Team Trial v1.4

This release packages the Browser-backed Risk Platform Access Service and its
Agent Skill for a remote-main-agent trial.

It has two layers:

- `service/` - code and docs for the user's local or Mac browser-backed worker.
- `skill/browser_backed_risk_service/` - command-oriented Agent Skill rules and
  action contract.

The service is a controlled transport service. It only does fixed action
allowlist, typed params validation, fixed origin/path construction,
browser-session readiness, same-origin fetch, raw-body suppression, transport
status, and controlled batch scheduling.

The service does not do business summaries, observations, source cards, source
quality, evidence cards, no-data interpretation, risk judgment, DataAgent/Hive
calls, permission bypass, or platform writes.

Current callable `action_count=19`. All actions are passthrough-only at the
service layer.

## Deployment Modes

### Local Agent Mode

- Agent, script, curl, and service run on the same computer.
- `service_base_url=http://127.0.0.1:8787`.
- No bridge or tunnel is needed.

### Remote Main Agent + Mac Local Worker Mode

This is the recommended remote-main-agent path.

- Main Agent runs remotely, in cloud, or on Linux.
- Browser-backed service runs on the user's Mac.
- Chrome profile stays on the Mac.
- User completes SSO, two-factor checks, and Archives account confirmation in
  Mac Chrome.
- Main Agent calls the Mac service through Mac node, controlled bridge, or
  controlled tunnel.
- Configure `BROWSER_BACKED_SERVICE_BASE_URL=<bridge_or_mac_worker_url>`.

Do not copy the Mac profile to Linux headless as the normal workflow. Joint
testing showed RCP, Weapon, Login Logs, and Archives can trigger
`two_factor_required` after profile copy. Do not use cookie injection,
storageState injection, or `sso_session.py`.

## Skill-Managed Workflow

The Skill supports rc-cli style command intents:

- `/browser-backed-risk-service 安装`
- `/browser-backed-risk-service 启动`
- `/browser-backed-risk-service 状态`
- `/browser-backed-risk-service actions`
- `/browser-backed-risk-service 调用 <action> <params>`
- `/browser-backed-risk-service 停止`
- `/browser-backed-risk-service 排障`

The Skill resolves `service_base_url`, checks `/health`, lists `/actions`, and
validates allowlisted actions before invoking them. It outputs only envelope
summaries and does not print full upstream body.

## First Local Commands

```sh
cd service
npm install
npm run open:profile
npm run refresh:once
npm run start:live
```

Then from another local terminal:

```sh
curl http://127.0.0.1:8787/health
curl http://127.0.0.1:8787/actions
```

For remote main Agent deployments, run the service on the user's Mac and
configure the Agent's `service_base_url` to the approved Mac worker/bridge URL.

## Safety

This package does not include `node_modules`, `.env`, Chrome profiles, refresh
state, raw HAR, run logs, Chrome storage, localStorage dumps, Playwright
storageState, cookies, tokens, sessions, request headers, passwords, or private
keys.
