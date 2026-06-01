# Service Package Manifest

Package root: `service/`

## Runtime Files

- `package.json`
- `src/actions.js`
- `src/authState.js`
- `src/browser.js`
- `src/config.js`
- `src/diagnostics.js`
- `src/originRegistry.js`
- `src/server.js`
- `src/service.js`
- `scripts/open-profile.js`
- `scripts/refresh-profile.js`
- `scripts/refresh-daemon.js`

## Service Docs

- `README.md`
- `ACTION_REGISTRY.md`
- `PASSTHROUGH_SERVICE_CONTRACT.md`
- `TEAM_LOCAL_SETUP.md`
- `FIRST_TEAMMATE_TRIAL.md`
- `TEAM_HANDOFF_CHECKLIST.md`
- `TROUBLESHOOTING.md`

## Explicitly Excluded

- `node_modules`
- `.env`
- Chrome profile directories
- refresh state files
- cookies/tokens/sessions/headers/passwords
- raw HAR
- run logs
- `outputs/full_runtime`
- `outputs/dist`
- Chrome storage / localStorage dumps / Playwright storage state
