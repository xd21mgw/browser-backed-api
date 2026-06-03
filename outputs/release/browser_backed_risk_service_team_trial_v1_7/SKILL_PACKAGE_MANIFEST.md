# Skill Package Manifest

Package: `skill/browser_backed_risk_service/`

Purpose: command-oriented Skill instructions and contracts for any main agent or
script that calls the Browser-backed Risk Service.

Included:

- `SKILL.md`
- `ACTION_REGISTRY.md`
- `CAPABILITY_INDEX.yaml`
- `PASSTHROUGH_CONTRACT.md`

The Skill package contains no login state and no authentication material. It
does not include service runtime dependencies, Chrome profiles, cookies, tokens,
sessions, request headers, storageState files, or raw HARs.

Primary command intents:

- `/browser-backed-risk-service 安装`
- `/browser-backed-risk-service 启动`
- `/browser-backed-risk-service 状态`
- `/browser-backed-risk-service actions`
- `/browser-backed-risk-service 用户画像 <user_id>`
- `/browser-backed-risk-service 登录历史 <user_id>`
- `/browser-backed-risk-service 设备图谱 <user_id>`
- `/browser-backed-risk-service 作品查询 <user_id>`
- `/browser-backed-risk-service 私信样本 <user_id>`
- `/browser-backed-risk-service 资料变更 <user_id>`
- `/browser-backed-risk-service 策略事件 <eventType> <eventId>`
- `/browser-backed-risk-service action <action_name> <json_params>`
- `/browser-backed-risk-service 停止`
- `/browser-backed-risk-service 排障`

The Skill must resolve `service_base_url`, check `/health`, check `/actions`,
validate allowlisted actions and typed params, and avoid printing full upstream
body by default.
