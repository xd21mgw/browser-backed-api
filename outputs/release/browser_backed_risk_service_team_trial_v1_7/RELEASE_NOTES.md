# Release Notes

Version: `browser_backed_risk_service_team_trial_v1_7`

## Changes Since v1.6

- Added `REMOTE_MAIN_AGENT_SUCCESS_PATHS.md`.
- Added `ACTION_PLAYBOOK.md`.
- Added `CAPABILITY_INDEX.yaml`.
- Added `npm run worker:expose` for the verified low-approval Mac worker path.
- Skill workflow now supports capability-oriented commands:
  - 用户画像
  - 登录历史
  - 设备图谱
  - 作品查询
  - 私信样本
  - 资料变更
  - 策略事件
  - direct `action`
- Remote Main Agent + Mac Local Worker Mode now documents two verified paths:
  - install transfer through a temporary release HTTP server
  - daily runtime through Mac `worker:expose`
- The low-approval proxy forwards only `/health`, `/actions`, and
  `/actions/<allowlisted_action>`.
- Expanded `action_count` from 37 to 70 by actionizing additional validated
  read-only Archives/RCP/Track interfaces and aligning them with registry,
  capability index, playbook, Skill, mock tests, and passthrough contracts.
- Archives fixed actions remain browser-context request actions. The service now
  injects the HAR-aligned Archives page contract (`/frontend/archives/index.html`
  Referer plus same-origin Origin) for shared fixed APIs such as
  `archives_user_profile`, `archives_user_analysis`, `archives_photo_search`,
  `archives_gallery_photo_list`, `archives_related_users`, and
  `archives_past_four_items`.
- Live readonly validation confirms the Archives shared contract now returns
  business JSON for `archives_photo_search`, `archives_gallery_photo_list`,
  `archives_related_users`, and `archives_past_four_items` instead of short
  auth-failed shells.
- Kept pure passthrough service positioning.

## Unchanged Safety Boundary

- No summary.
- No source card.
- No source quality.
- No evidence card.
- No risk judgment.
- No DataAgent/Hive calls.
- No arbitrary URL fetch.
- No write actions.
- No Chrome profile, cookie, token, session, authorization, password, request
  header, localStorage, browser storage, or Playwright storageState output.

## Not Recommended

Do not use these as the normal team path:

- Chrome profile copy to Linux.
- Cookie injection.
- storageState injection.
- `sso_session.py`.
- Base64 chunk transfer.
- Ad hoc KCDN uploads.
- Self-designed tunnel exploration outside the reviewed worker path.
