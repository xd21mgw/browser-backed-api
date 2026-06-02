# Browser-backed Risk Service Team Trial v1.5

This release packages the Browser-backed Risk Platform Access Service and its
command-oriented Agent Skill for a remote-main-agent trial.

It has two layers:

- `service/` - local/Mac worker code and teammate docs.
- `skill/browser_backed_risk_service/` - Skill rules and action contract.

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
- The user's Mac must be powered on, online, and running the browser-backed
  service.
- MyFlicker / Mac node client, or the approved equivalent Mac worker channel,
  must stay online and connected.
- Chrome profile must not be locked by another Chrome/Playwright process.
- Main Agent calls the Mac service through Mac node, controlled bridge, or
  controlled tunnel.
- Configure `BROWSER_BACKED_SERVICE_BASE_URL=<bridge_or_mac_worker_url>`.

Daily use should be low-friction. Keep the Mac worker running and let the
remote main Agent call service APIs. Browsers should open only for first setup,
periodic expiry recovery, or `manual_login_required`.

MyFlicker / Mac node lets the remote main Agent execute controlled status/action
calls on the Mac or reach the Mac worker `service_base_url`. It does not read
cookies, tokens, sessions, request headers, profile files, or browser storage,
and it does not replace the browser-backed service.

If MyFlicker / Mac node is offline, the remote main Agent cannot call the Mac
worker. Reconnect the Mac client; do not switch to profile copy, cookie
injection, storageState injection, or `sso_session.py`.

Do not copy the Mac profile to Linux headless as the normal workflow. Joint
testing showed RCP, Weapon, Login Logs, and Archives can trigger
`two_factor_required` after profile copy. Do not use cookie injection,
storageState injection, or `sso_session.py`.

## Mac Worker Commands

- `npm run worker:start`
- `npm run worker:status`
- `npm run worker:stop`
- `npm run worker:doctor`

These commands group common Mac worker operations and reduce repeated ad hoc
command approvals. They do not delete profiles and do not read or output
authentication material.

## Skill-Managed Workflow

The Skill supports rc-cli style command intents:

- `/browser-backed-risk-service 安装`
- `/browser-backed-risk-service 启动`
- `/browser-backed-risk-service 状态`
- `/browser-backed-risk-service actions`
- `/browser-backed-risk-service 自测用户 <user_id>`
- `/browser-backed-risk-service 调用 <action> <params>`
- `/browser-backed-risk-service 停止`
- `/browser-backed-risk-service 排障`

The Skill resolves `service_base_url`, checks `/health`, lists `/actions`, and
validates allowlisted actions before invoking them. It outputs only envelope
summaries and does not print full upstream body.

`/browser-backed-risk-service 自测用户 <user_id>` is the recommended one-command
user self-test. The main Agent calls a default read-only action group:

- `track_analysis_summary`
- `login_logs_search`
- `weapon_inventory`
- `archives_user_profile`

Optional:

- `archives_private_message_search`

The service remains pure passthrough. Field extraction, tables, evidence-package
summaries, missing-source lists, and next-step suggestions are main-Agent
processing over returned envelopes, not browser-backed service output.

## Auth State Transfer POC

Auth State Transfer is documented as a candidate POC. It is not a recommended
team deployment yet and is not rejected as impossible. If it succeeds, it may
become a v1.6 focus area. Until then, Mac Local Worker remains the stable remote
main Agent path.

## First Local Commands

```sh
cd service
npm install
npm run open:profile
npm run refresh:once
npm run worker:start
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
state, auth-state files, raw HAR, run logs, Chrome storage, localStorage dumps,
Playwright storageState, cookies, tokens, sessions, request headers, passwords,
or private keys.
