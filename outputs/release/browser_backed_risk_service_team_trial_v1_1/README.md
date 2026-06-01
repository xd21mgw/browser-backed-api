# Browser-Backed Risk Service Team Trial v1.1

This release contains two packages:

- `service/`: local Browser-backed Risk Platform Access Service.
- `skill/browser_backed_risk_service/`: Agent calling rules and action contract.

The service runs only on `127.0.0.1` and uses each teammate's own Chrome
profile and platform permissions. It exposes 19 fixed actions. All actions use
the passthrough transport envelope; raw upstream body is suppressed.

## v1.1 Contract

- fixed action allowlist
- typed params only
- fixed origin/path/body construction
- browser-managed login state
- same-origin fetch
- transport status envelope
- controlled parallel batch
- no raw upstream body output
- no cookies/tokens/sessions/headers/passwords/profile storage output
- no summary/source_card/source_quality/evidence/risk judgment in the service

Business observations, source quality, evidence cards, and final reasoning are
owned by Dennis or the upper-layer Agent, not by this local service.

## Quick Start

```sh
cd service
npm install
npm run open:profile
npm run refresh:once
npm run start:live
```

In another terminal:

```sh
curl http://127.0.0.1:8787/health
curl http://127.0.0.1:8787/actions
```

Use `service/FIRST_TEAMMATE_TRIAL.md` for the shortest teammate-facing guide.
