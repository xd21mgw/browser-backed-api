# Skill Package Manifest

Path: `skill/browser_backed_risk_service/`

## Included

- `SKILL.md`
- `ACTION_REGISTRY.md`
- `PASSTHROUGH_CONTRACT.md`

## Agent Requirements

- Resolve `service_base_url` before calling the service.
- Use `http://127.0.0.1:8787` only when the Agent is local to the teammate's
  computer.
- Use `BROWSER_BACKED_SERVICE_BASE_URL` or equivalent configuration for Remote
  Main Agent + Local Worker Mode.
- Treat Temporary Profile Bootstrap Mode as same-user profile activation only;
  do not use it for long-term action forwarding.
- Call `{service_base_url}/health` first.
- Call `{service_base_url}/actions` and confirm `action_count=19`.
- Call only allowlisted fixed actions with typed params.
- Never send URL/path/header/cookie/token/session/raw_body/raw_query/secret.
- Do not ask the service to create summaries, source cards, source quality,
  evidence cards, no-data interpretation, or risk judgments.
