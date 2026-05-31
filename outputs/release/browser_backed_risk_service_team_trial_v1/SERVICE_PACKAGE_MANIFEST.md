# Service Package Manifest

Package path:

```txt
service/
```

Purpose:

- Run the Browser-backed Risk Platform Access Service on a teammate's local
  machine.
- Support `npm install`, `npm run open:profile`, `npm run refresh:once`, and
  `npm run start:live`.
- Expose fixed allowlisted actions on `http://127.0.0.1:8787`.

Included:

- `package.json`
- `src/`
- `scripts/`
- `README.md`
- `TEAM_LOCAL_SETUP.md`
- `FIRST_TEAMMATE_TRIAL.md`
- `TROUBLESHOOTING.md`
- `TEAM_HANDOFF_CHECKLIST.md`
- `ACTION_REGISTRY.md`
- `PASSTHROUGH_SERVICE_CONTRACT.md`

Excluded:

- `node_modules/`
- `.env`
- Chrome profile directories
- refresh state files
- raw HAR captures
- screenshots and temporary captures
- `outputs/full_runtime`
- development run logs
- profile storage or browser storage dumps

Operational notes:

- The package does not carry any teammate login state.
- `BROWSER_BACKED_PROFILE_DIR` can point to a teammate-owned local profile.
- If `BROWSER_BACKED_PROFILE_DIR` is unset, the service uses
  `~/.dennis-browser-backed/profile`.
- A single Chrome profile can be used by only one Chrome/Playwright process at a
  time.
