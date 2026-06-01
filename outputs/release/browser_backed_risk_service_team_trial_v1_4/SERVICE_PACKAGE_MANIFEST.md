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
- `MAC_LOCAL_WORKER_GUIDE.md`
- `BROWSER_BACKED_SERVICE_COMMANDS.md`

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

Remote Main Agent + Mac Local Worker Mode requires running this service on the
user's Mac and configuring the Agent with:

```txt
BROWSER_BACKED_SERVICE_BASE_URL=<bridge_or_mac_worker_url>
```

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
