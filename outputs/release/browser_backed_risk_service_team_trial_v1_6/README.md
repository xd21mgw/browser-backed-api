# Browser-backed Risk Service Team Trial v1.6

This release packages the Browser-backed Risk Platform Access Service and its
command-oriented Agent Skill.

It has two layers:

- `service/` - local/Mac worker service code and teammate docs.
- `skill/browser_backed_risk_service/` - Skill rules and action contract.

The service remains pure passthrough: fixed action allowlist, typed params,
fixed origin/path, browser-session readiness, bounded upstream business body
passthrough, transport status, and controlled batch scheduling. It does not do
summary, source card, source quality, evidence card, no-data interpretation,
risk judgment, DataAgent/Hive calls, arbitrary URL fetch, or platform writes.

Current callable `action_count=37`.

## Daily Command

Ordinary users should remember one command:

```sh
npm run worker:start
```

`worker:start` automatically routes:

- ready service -> returns ready summary
- service missing -> runs refresh once, then starts service
- auth not ready -> runs refresh once
- lightweight account confirmation -> handled during refresh/prewarm
- manual SSO, 2FA, QR, captcha, or account confirmation -> opens the visible
  profile flow, waits for the user, then continues refresh/start

Advanced commands remain available:

- `npm run worker:status`
- `npm run worker:stop`
- `npm run worker:doctor`
- `npm run open:profile`
- `npm run refresh:once`
- `npm run start:live`

## Remote Main Agent + Mac Local Worker

Remote main Agents should call a Mac Local Worker through configured
`service_base_url`. Keep the user's Mac powered on, online, and connected
through MyFlicker / Mac node or an approved equivalent worker channel.

Do not copy Chrome profiles to Linux, inject cookies, inject storageState, use
`sso_session.py`, or expose arbitrary URL fetch.

## Contents

- `SERVICE_PACKAGE_MANIFEST.md`
- `SKILL_PACKAGE_MANIFEST.md`
- `RELEASE_NOTES.md`
- `SECURITY_SCAN_REPORT.md`
- `LOCAL_WORKER_BRIDGE_PLAN.md`
- `MAC_LOCAL_WORKER_GUIDE.md`
- `BROWSER_BACKED_SERVICE_COMMANDS.md`
- `AUTH_STATE_TRANSFER_POC.md`
