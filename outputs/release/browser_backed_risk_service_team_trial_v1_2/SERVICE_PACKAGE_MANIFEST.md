# Service Package Manifest

Path: `service/`

## Included

- `package.json`
- `src/`
- `scripts/`
- `README.md`
- `ACTION_REGISTRY.md`
- `PASSTHROUGH_SERVICE_CONTRACT.md`
- `TEAM_LOCAL_SETUP.md`
- `FIRST_TEAMMATE_TRIAL.md`
- `TEAM_HANDOFF_CHECKLIST.md`
- `TROUBLESHOOTING.md`
- `LOCAL_WORKER_BRIDGE_PLAN.md`

## Runtime

Run from `service/`:

```sh
npm install
npm run open:profile
npm run refresh:once
npm run start:live
```

Local Agent Mode uses:

```txt
service_base_url=http://127.0.0.1:8787
```

Remote Main Agent + Local Worker Mode requires a controlled bridge/tunnel URL
configured in the Agent as `BROWSER_BACKED_SERVICE_BASE_URL` or equivalent.

Temporary Profile Bootstrap Mode may be used only by the same user to complete
first-time `open:profile`, Archives/account confirmation, or required human
SSO/verification on a GUI Mac when the eventual service machine has no GUI. It
is not a long-term action forwarding mode.

## Not Included

- `node_modules`
- `.env`
- Chrome profile directories
- refresh-state files
- raw HAR
- run logs
- Chrome storage or localStorage dumps
- Playwright storageState
- cookies/tokens/sessions/headers/passwords/private keys
