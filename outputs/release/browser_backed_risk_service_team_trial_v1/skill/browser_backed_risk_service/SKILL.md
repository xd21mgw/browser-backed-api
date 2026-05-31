# Browser-backed Risk Service Skill

Use this skill when an Agent needs to call the local Browser-backed Risk
Platform Access Service for controlled risk-platform reads.

Service address:

```txt
http://127.0.0.1:8787
```

## Required Behavior

- Call only allowlisted fixed actions from `ACTION_REGISTRY.md`.
- Send typed params only.
- Use `response_mode=passthrough` for passthrough-only actions.
- For dual-mode actions, prefer `response_mode=passthrough` unless the caller
  explicitly needs the deprecated legacy fallback.
- Parse `upstream.body` in the Agent or upper layer.
- If the local service is not started, tell the user to follow
  `service/TEAM_LOCAL_SETUP.md` or `service/FIRST_TEAMMATE_TRIAL.md`.

## Forbidden Inputs

Never send:

- `url`
- `path`
- `header` / `headers`
- `cookie`
- `token`
- `session`
- `authorization`
- `raw_body`
- `raw_query`
- reusable secret values

## Response Contract

Passthrough responses use this envelope:

```json
{
  "ok": true,
  "action": "action_name",
  "request_id": "local_xxx",
  "response_mode": "passthrough",
  "upstream": {
    "status": 200,
    "content_type": "application/json",
    "body": {}
  },
  "meta": {
    "origin": "origin_key",
    "latency_ms": 123,
    "fetched_at": "2026-05-31T00:00:00.000Z"
  },
  "safety": {
    "credential_material_output": false,
    "request_headers_output": false,
    "browser_profile_material_output": false
  }
}
```

The service does not create business summaries, source cards, source quality,
evidence cards, no-data interpretation, risk judgment, or next-step
recommendations for passthrough use.

## Output Handling

Record only envelope summaries during smoke tests:

- `http_status`
- `ok`
- `action`
- `response_mode`
- `upstream.status`
- `upstream.content_type`
- `upstream.body_present`
- `upstream.body_omitted`
- `error_type`
- `safety.credential_material_output`

Do not paste full `upstream.body` into casual logs or feedback. Do not expose
request headers, browser profile contents, localStorage dumps, Playwright
storage state, or reusable auth material.

## Action Scope

The service currently exposes 19 fixed actions:

- 12 dual-mode actions with deprecated legacy fallback plus passthrough.
- 7 passthrough-only recovered actions.

See `ACTION_REGISTRY.md` for fixed origin/path, method, typed params, response
mode support, live-smoke status, and safety boundary.
