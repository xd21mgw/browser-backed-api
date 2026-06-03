# Skill Package Manifest

Path: `skill/browser_backed_risk_service/`

## Included

- `SKILL.md`
- `ACTION_REGISTRY.md`
- `PASSTHROUGH_CONTRACT.md`

## Skill Runtime Contract

- Resolve `service_base_url`.
- Check `{service_base_url}/health`.
- Check `{service_base_url}/actions`; expected callable `action_count=37`.
- Invoke only allowlisted fixed actions with typed params.
- Do not pass URL/path/header/cookie/token/session/raw body/raw query.
- Do not print full upstream body by default.
- Do not ask the service to produce summary, source quality, evidence card, or
  risk judgment.

For Mac worker startup, guide users to run:

```sh
npm run worker:start
```
