# Skill Package Manifest

Package root: `skill/browser_backed_risk_service/`

## Files

- `SKILL.md`
- `ACTION_REGISTRY.md`
- `PASSTHROUGH_CONTRACT.md`

## Purpose

This skill package tells an Agent how to call the local browser-backed service:

- service URL: `http://127.0.0.1:8787`
- allowlisted fixed actions only
- typed params only
- no arbitrary URL/path/header/cookie/token/session/raw body/raw query
- passthrough transport envelope only
- raw upstream body suppressed
- no service-side summary/source quality/evidence/risk judgment

The skill package contains no login state or authentication material.
