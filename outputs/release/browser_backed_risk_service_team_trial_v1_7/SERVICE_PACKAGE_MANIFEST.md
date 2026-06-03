# Service Package Manifest

Package: `service/`

Purpose: runnable Browser-backed Risk Service for a teammate's local machine or
Mac Local Worker.

Included:

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
- `REMOTE_MAIN_AGENT_SUCCESS_PATHS.md`
- `ACTION_PLAYBOOK.md`
- `CAPABILITY_INDEX.yaml`

Not included:

- `node_modules`
- `.env`
- Chrome profile directories
- refresh state/auth-state files
- cookie/token/session/header/authorization/password files
- raw HAR files
- run logs
- `outputs/full_runtime`
- Chrome storage, localStorage dumps, or Playwright storageState files

Runtime entrypoint for users:

```sh
npm run worker:start
```

Remote low-approval helper:

```sh
npm run worker:expose
```
