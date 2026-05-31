# Browser-backed Risk Service Team Trial v1

This release package has two layers:

- `service/` - the local browser-backed risk platform access service that a
  teammate runs on their own computer.
- `skill/browser_backed_risk_service/` - Agent-facing calling rules and action
  contracts.

The service is a controlled passthrough service. It accepts fixed action names
and typed params, maps them to fixed origin/path contracts, uses the teammate's
own browser profile login state, and returns controlled upstream response
envelopes.

It does not include login state, profile files, refresh state, `.env`,
`node_modules`, raw HAR captures, or development run logs.

## Quick Start

```sh
cd service
npm install
npm run open:profile
npm run refresh:once
npm run start:live
```

Then check from another terminal:

```sh
curl http://127.0.0.1:8787/health
curl http://127.0.0.1:8787/actions
```

See `service/FIRST_TEAMMATE_TRIAL.md` for the shortest first-trial guide.

## Safety Boundary

- The service listens on `127.0.0.1`.
- Each teammate uses their own Chrome profile and platform permissions.
- Do not share profiles.
- Do not commit profile/state files.
- Do not paste full upstream bodies during smoke feedback.
- Do not include request headers or browser auth material in Agent calls.

## Package Contents

- Service package: `service/`
- Skill package: `skill/browser_backed_risk_service/`
- Service manifest: `SERVICE_PACKAGE_MANIFEST.md`
- Skill manifest: `SKILL_PACKAGE_MANIFEST.md`
