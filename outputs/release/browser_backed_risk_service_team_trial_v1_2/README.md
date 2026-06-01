# Browser-backed Risk Service Team Trial v1.2

This release packages the Browser-backed Risk Platform Access Service for a
small team trial.

It has two layers:

- `service/` - code and docs for the teammate's local browser-backed worker.
- `skill/browser_backed_risk_service/` - Agent-facing calling rules and action
  contract.

The service is a controlled transport service. It only does fixed action
allowlist, typed params validation, fixed origin/path construction, browser
session readiness, same-origin fetch, raw-body suppression, transport status,
and controlled batch scheduling.

The service does not do business summaries, observations, source cards, source
quality, evidence cards, no-data interpretation, risk judgment, DataAgent/Hive
calls, permission bypass, or platform writes.

Current callable `action_count=19`. All callable actions are passthrough-only at
the service layer; legacy compat/summary modes are rejected.

## Service Base URL

Agent callers should use `service_base_url`:

- Default Local Agent Mode value: `http://127.0.0.1:8787`
- Remote Main Agent + Local Worker Mode value: a controlled bridge/tunnel URL
  configured through `BROWSER_BACKED_SERVICE_BASE_URL` or equivalent Agent
  config
- Temporary Profile Bootstrap Mode value: no service forwarding value; this is
  only a same-user GUI bootstrap path for profile activation or account
  confirmation when the eventual service machine has no GUI

Local use is unchanged: run the service on your own computer and call
`http://127.0.0.1:8787` directly from local scripts, local Agent, or curl.

Remote/cloud main Agents must not assume `127.0.0.1` is the teammate's
computer. They need a controlled bridge/tunnel to the teammate's local worker.
This release documents that deployment requirement but does not implement
bridge/tunnel code.

Temporary Profile Bootstrap Mode is only for first-time `open:profile`,
periodic Archives/account confirmation, or required human SSO/verification when
the main Agent's local machine has no GUI. It is not for long-term action
forwarding, not for cross-user profile sharing, and not for turning a GUI Mac
service into a team center.

## First Commands

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

For remote main Agent deployments, configure the Agent's `service_base_url` to
the approved bridge/tunnel URL before calling `/health` or `/actions`.

## Safety

This package does not include `node_modules`, `.env`, Chrome profiles, refresh
state, raw HAR, run logs, Chrome storage, localStorage dumps, Playwright
storageState, cookies, tokens, sessions, request headers, passwords, or private
keys.

Do not copy or upload another teammate's profile. Whoever logs in locally
determines which platform permissions are available.
