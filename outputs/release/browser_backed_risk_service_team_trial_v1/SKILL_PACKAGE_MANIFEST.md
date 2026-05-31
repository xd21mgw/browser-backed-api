# Skill Package Manifest

Package path:

```txt
skill/browser_backed_risk_service/
```

Purpose:

- Provide Agent-facing rules for calling the local service.
- Describe allowlisted fixed actions and typed params.
- Describe passthrough response envelope boundaries.

Included:

- `SKILL.md`
- `ACTION_REGISTRY.md`
- `PASSTHROUGH_CONTRACT.md`

Excluded:

- service runtime code
- login profile or state
- browser storage
- raw platform captures
- request header material

The skill package is documentation only. It does not contain credential material
or platform responses.
