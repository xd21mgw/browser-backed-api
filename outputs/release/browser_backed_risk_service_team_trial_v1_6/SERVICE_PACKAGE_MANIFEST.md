# Service Package Manifest

Path: `service/`

## Included

- `package.json`
- `src/`
- `scripts/`
- `test/`
- `README.md`
- `ACTION_REGISTRY.md`
- `PASSTHROUGH_SERVICE_CONTRACT.md`
- `TEAM_LOCAL_SETUP.md`
- `FIRST_TEAMMATE_TRIAL.md`
- `TEAM_HANDOFF_CHECKLIST.md`
- `TROUBLESHOOTING.md`
- `LOCAL_WORKER_BRIDGE_PLAN.md`
- `MAC_LOCAL_WORKER_GUIDE.md`
- `BROWSER_BACKED_SERVICE_COMMANDS.md`
- `AUTH_STATE_TRANSFER_POC.md`
- `DENNIS_ACTION_HANDOFF.md`

## Runtime

Run from `service/`:

```sh
npm install
npm run worker:start
```

`worker:start` handles refresh/start/open-profile routing. Manual commands such
as `open:profile`, `refresh:once`, and `start:live` remain available for
advanced debugging.

## Not Included

- `node_modules`
- `.env`
- Chrome profile directories
- refresh-state or auth-state files
- raw HAR
- run logs
- Chrome storage or localStorage dumps
- Playwright storageState
- cookies/tokens/sessions/headers/passwords/private keys
