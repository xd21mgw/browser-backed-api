# Skill Package Manifest

Path: `skill/browser_backed_risk_service/`

## Included

- `SKILL.md`
- `ACTION_REGISTRY.md`
- `PASSTHROUGH_CONTRACT.md`

## Agent Requirements

- Resolve `service_base_url` before calling the service.
- Use `http://127.0.0.1:8787` only when the Agent is local to the same machine
  as the service.
- Use `BROWSER_BACKED_SERVICE_BASE_URL` or equivalent configuration for Remote
  Main Agent + Mac Local Worker Mode.
- Check `{service_base_url}/health`.
- Check `{service_base_url}/actions` and confirm `action_count=19`.
- Call only allowlisted fixed actions with typed params.
- Never send URL/path/header/cookie/token/session/raw_body/raw_query/secret.
- Do not ask the service to create summaries, source cards, source quality,
  evidence cards, no-data interpretation, or risk judgments.
- Do not propose Chrome profile copy to Linux, cookie injection, storageState
  injection, or `sso_session.py` as the standard path.
- Treat Auth State Transfer only as a future POC until validated.
